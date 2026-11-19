"""Référence des requêtes, journal JSON et 500 sans rien d'interne (docs/projet/ERREURS.md § 3)."""

import json
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import errors
from app.errors import INTERNAL_ERROR, ApiError, ErrorSpec
from app.main import app
from app.openapi import documented_codes
from app.requests import JsonFormatter, RequestIdMiddleware, new_request_id
from app.security import OriginCheckMiddleware

ORIGIN = {"Origin": "http://localhost:8080"}
_UNAVAILABLE = ErrorSpec(503, "demo_unavailable", "Service de démonstration indisponible")


class SecretError(RuntimeError):
    """Exception dont le message ne doit jamais sortir de l'API."""


@pytest.fixture(scope="module")
def demo() -> TestClient:
    """Application avec les middlewares et gestionnaires de l'API, dans le même ordre que create_app."""
    application = FastAPI()
    errors.install(application)
    application.add_middleware(OriginCheckMiddleware)
    application.add_middleware(RequestIdMiddleware)

    @application.get("/ok")
    async def ok() -> dict:
        return {"ok": True}

    @application.get("/crash")
    async def crash() -> dict:
        raise SecretError("mot de passe en clair dans le message : Secret123")

    @application.get("/unavailable")
    async def unavailable() -> dict:
        raise ApiError(_UNAVAILABLE)

    @application.post("/write")
    async def write() -> dict:
        return {}

    # Comme en production : une exception imprévue devient une réponse, au lieu d'interrompre le test.
    return TestClient(application, raise_server_exceptions=False)


def records(caplog, name: str) -> list[dict]:
    """Lignes JSON écrites par le logger `name`, telles que le journal les écrit."""
    formatter = JsonFormatter()
    return [json.loads(formatter.format(record)) for record in caplog.records if record.name == name]


# --- Identifiant -----------------------------------------------------------------------------

def test_identifiant_sur_quelques_reponses(demo):
    for response in (demo.get("/ok"), demo.get("/inconnue"), demo.post("/write"), demo.get("/crash")):
        assert len(response.headers.get_list("x-request-id")) == 1, response.status_code
        assert len(response.headers["x-request-id"]) == 32


def test_identifiant_sur_toutes_les_erreurs_de_l_api():
    client = TestClient(app)
    responses = [
        client.get("/api/v2/nurseries"),  # 401
        client.post("/api/v2/auth/login", json={}),  # 403 d'origine, refusé avant l'application
        client.get("/api/v2/inexistante"),  # 404
        client.post("/api/v2/auth/login", json={}, headers=ORIGIN),  # 422
    ]
    assert [response.status_code for response in responses] == [401, 403, 404, 422]
    assert all(response.headers.get("x-request-id") for response in responses)


@pytest.mark.parametrize("received", ["essai-ci-12345678", "6f1c0b0e9d2a4c51", "a.b_c-d1"])
def test_identifiant_sur_repris(demo, received):
    assert demo.get("/ok", headers={"X-Request-ID": received}).headers["x-request-id"] == received


@pytest.mark.parametrize("received", ["court", "x" * 65, "avec espace 123", "a\"b{c}12345", "ligne\\nfausse1"])
def test_identifiant_douteux_remplace(demo, received):
    sent = demo.get("/ok", headers={"X-Request-ID": received}).headers["x-request-id"]
    assert sent != received and len(sent) == 32


def test_new_request_id():
    assert new_request_id(None) != new_request_id(None)
    assert new_request_id("essai-ci-12345678") == "essai-ci-12345678"


# --- 500 ---------------------------------------------------------------------------------------

def test_exception_imprevue_sans_rien_d_interne(demo, caplog):
    caplog.set_level(logging.INFO, logger="luniqo")
    response = demo.get("/crash", headers={"X-Request-ID": "plainte-de-la-creche-42"})
    assert response.status_code == 500
    assert response.json() == {"detail": INTERNAL_ERROR.message, "code": "internal_error",
                               "request_id": "plainte-de-la-creche-42"}
    assert response.headers["x-request-id"] == "plainte-de-la-creche-42"
    assert "Secret" not in response.text and "Traceback" not in response.text

    # La pile part au journal, avec la même référence : retrouvée par `grep plainte-de-la-creche-42`.
    (error,) = records(caplog, "luniqo.errors")
    assert error["request_id"] == "plainte-de-la-creche-42"
    assert error["level"] == "error" and error["exception"] == "SecretError"
    assert "Traceback" in error["stack"] and "in crash" in error["stack"]


def test_erreur_serveur_metier_porte_sa_reference(demo):
    response = demo.get("/unavailable", headers={"X-Request-ID": "reference-503-abc"})
    assert response.status_code == 503
    assert response.json() == {"detail": _UNAVAILABLE.message, "code": "demo_unavailable",
                               "request_id": "reference-503-abc"}


def test_erreur_client_sans_reference_dans_le_corps(demo):
    # La référence d'une 4xx reste dans l'en-tête : le corps garde sa forme.
    assert "request_id" not in demo.get("/inconnue").json()


# --- Journal -----------------------------------------------------------------------------------

def test_une_ligne_json_par_requete_sans_donnee_personnelle(demo, caplog):
    caplog.set_level(logging.INFO, logger="luniqo")
    demo.get("/ok?email=lea@demo.test", headers={"X-Request-ID": "journal-12345678", "User-Agent": "Navigateur"})
    (line,) = records(caplog, "luniqo.requests")
    assert line["event"] == "request" and line["request_id"] == "journal-12345678"
    assert line["method"] == "GET" and line["path"] == "/ok" and line["status"] == 200
    assert isinstance(line["duration_ms"], float)
    text = json.dumps(line)
    assert "lea@demo.test" not in text and "Navigateur" not in text and "testclient" not in text


def test_requete_en_erreur_notee_500(demo, caplog):
    caplog.set_level(logging.INFO, logger="luniqo")
    demo.get("/crash")
    (line,) = records(caplog, "luniqo.requests")
    assert line["status"] == 500


def test_formateur_ligne_json_valide():
    record = logging.LogRecord("luniqo", logging.WARNING, __file__, 1, "Message « accentué »", None, None)
    line = json.loads(JsonFormatter().format(record))
    assert line["level"] == "warning" and line["message"] == "Message « accentué »"
    assert line["time"].endswith("+00:00")


# --- Schéma ------------------------------------------------------------------------------------

def test_500_documentee_sur_chaque_route():
    for path, item in app.openapi()["paths"].items():
        for method, operation in item.items():
            if path == "/api/health":
                continue
            assert documented_codes(operation["responses"]["500"]) == {"internal_error"}, f"{method} {path}"
    assert "request_id" in app.openapi()["components"]["schemas"]["Error"]["properties"]
