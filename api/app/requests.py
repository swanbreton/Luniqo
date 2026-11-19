"""Référence de chaque requête et journal JSON de l'API (docs/projet/ERREURS.md § 3).

Chaque requête reçoit un identifiant : celui de l'en-tête `X-Request-ID` s'il est
sûr (la passerelle nginx en pose un), sinon un nouveau. Il revient dans l'en-tête
`X-Request-ID` de chaque réponse et dans chaque ligne du journal. Une personne qui
signale une erreur donne la référence affichée à l'écran ; on la retrouve par
`docker compose logs api | grep <référence>`.

Le journal est écrit en JSON sur la sortie standard, une ligne par événement.
Il ne contient ni adresse IP, ni user-agent, ni corps, ni chaîne de requête
(`?email=…`) : la référence, la méthode, le chemin, le statut et la durée suffisent.
"""

import json
import logging
import re
import sys
import time
import traceback
import uuid
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

HEADER = "X-Request-ID"
_SAFE_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")

# Référence de la requête en cours, lue par le journal et par les gestionnaires d'erreurs.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

logger = logging.getLogger("luniqo")
_access = logging.getLogger("luniqo.requests")


def new_request_id(received: str | None) -> str:
    """Reprend l'identifiant reçu s'il est sûr (lettres, chiffres, `._-`, 8 à 64 caractères), sinon en crée un.

    Un identifiant quelconque venu du client pourrait injecter du texte dans le journal.
    """
    if received is not None and _SAFE_ID.fullmatch(received):
        return received
    return uuid.uuid4().hex


class RequestIdMiddleware:
    """Pose la référence de la requête, la renvoie dans `X-Request-ID` et journalise la requête.

    À placer à l'extérieur des autres middlewares de l'application : un refus du
    contrôle d'origine porte alors, lui aussi, sa référence.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        received = dict(scope["headers"]).get(HEADER.lower().encode())
        request_id = new_request_id(received.decode("latin-1") if received else None)
        scope.setdefault("state", {})["request_id"] = request_id
        token = request_id_var.set(request_id)
        status = 500
        started = time.perf_counter()

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = [(name, value) for name, value in message.get("headers", [])
                           if name.lower() != HEADER.lower().encode()]
                message = {**message, "headers": [*headers, (HEADER.lower().encode(), request_id.encode())]}
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            # Exception imprévue : la 500 est écrite plus haut (errors.py) ; la requête est notée 500 ici.
            _access.info("requête", extra={
                "request_id": request_id, "event": "request", "method": scope["method"], "path": scope["path"],
                "status": status,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1)})
            request_id_var.reset(token)


# --- Journal JSON -----------------------------------------------------------------------------

# Champs passés par `extra=` et repris dans la ligne JSON (les autres attributs d'un LogRecord sont ignorés).
_EXTRA = ("event", "method", "path", "status", "duration_ms")


class JsonFormatter(logging.Formatter):
    """Une ligne JSON par événement : date, niveau, référence de la requête, message, et la pile d'une erreur."""

    def format(self, record: logging.LogRecord) -> str:
        line: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "request_id": getattr(record, "request_id", None) or request_id_var.get(),
            "message": record.getMessage(),
        }
        line |= {name: getattr(record, name) for name in _EXTRA if hasattr(record, name)}
        if record.exc_info and record.exc_info[1] is not None:
            error = record.exc_info[1]
            line["exception"] = type(error).__name__
            line["stack"] = "".join(traceback.format_exception(error)).rstrip()
        return json.dumps(line, ensure_ascii=False)


def configure_logging(level: int = logging.INFO) -> None:
    """Journal JSON de l'API sur la sortie standard. Sans effet si déjà configuré."""
    if any(getattr(handler, "luniqo_json", False) for handler in logger.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    handler.luniqo_json = True  # type: ignore[attr-defined]
    logger.addHandler(handler)
    logger.setLevel(level)
