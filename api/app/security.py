"""Protection contre les requêtes intersites (CSRF), ADR-003.

Toute requête qui peut modifier des données (POST, PUT, PATCH, DELETE) doit
porter un en-tête Origin égal à l'une des origines de Luniqo. Les navigateurs
l'envoient toujours sur ces méthodes et un site tiers ne peut pas le falsifier.
Une requête sans Origin est refusée aussi : l'API ne sert que le front.

Middleware ASGI plutôt que dépendance de route : une nouvelle route est
protégée sans qu'on ait à y penser.
"""

import json

from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import get_settings
from app.errors import ErrorSpec, body

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
ORIGIN_REFUSED = ErrorSpec(403, "origin_refused", "Origine de la requête refusée")


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] in SAFE_METHODS:
            await self.app(scope, receive, send)
            return
        origin = dict(scope["headers"]).get(b"origin", b"").decode("latin-1").rstrip("/")
        if origin in get_settings().app_origins:
            await self.app(scope, receive, send)
            return
        # Middleware ASGI : hors des gestionnaires d'exception de FastAPI, le corps s'écrit ici.
        content = json.dumps(body(ORIGIN_REFUSED.message, ORIGIN_REFUSED.code)).encode()
        await send({
            "type": "http.response.start",
            "status": ORIGIN_REFUSED.status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(content)).encode())],
        })
        await send({"type": "http.response.body", "body": content})
