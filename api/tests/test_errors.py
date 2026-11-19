"""Corps unique des erreurs : `{"detail", "code", "fields"?}`, y compris pour les erreurs de FastAPI."""

import pytest
from fastapi import FastAPI, Query
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, field_validator, model_validator

from app import errors
from app.errors import ApiError, ErrorSpec, required_field
from app.main import app

ORIGIN = {"Origin": "http://localhost:8080"}
_CONFLICT = ErrorSpec(409, "demo_conflict", "Conflit de démonstration")


class Payload(BaseModel):
    name: str = Field(min_length=2, max_length=5)
    age: int
    email: str = ""

    @field_validator("email")
    @classmethod
    def email_valide(cls, value: str) -> str:
        if value and "@" not in value:
            raise ValueError("Adresse e-mail invalide")
        return value

    @model_validator(mode="after")
    def coherent(self) -> Payload:
        if self.name == "zz":
            raise ValueError("Ce nom est réservé")
        return self


@pytest.fixture(scope="module")
def demo() -> TestClient:
    """Petite application avec les gestionnaires de l'API, pour viser chaque cas."""
    application = FastAPI()
    errors.install(application)

    @application.post("/payload")
    async def payload(body: Payload) -> dict:
        return {}

    @application.get("/search")
    async def search(days: int = Query(ge=1, le=62)) -> dict:
        return {}

    @application.get("/conflict")
    async def conflict() -> dict:
        raise ApiError(_CONFLICT)

    @application.get("/throttled")
    async def throttled() -> dict:
        raise ApiError(errors.TOO_MANY_ATTEMPTS, retry_after=42)

    @application.patch("/empty")
    async def empty() -> dict:
        raise required_field("name")

    return TestClient(application)


def test_erreur_declaree(demo):
    response = demo.get("/conflict")
    assert response.status_code == 409
    assert response.json() == {"detail": "Conflit de démonstration", "code": "demo_conflict"}


def test_retry_after_pose_l_en_tete(demo):
    response = demo.get("/throttled")
    assert response.status_code == 429 and response.headers["Retry-After"] == "42"
    assert response.json()["code"] == "too_many_attempts"


def test_champ_vide(demo):
    response = demo.patch("/empty")
    assert response.status_code == 422
    assert response.json() == {"detail": "Certains champs sont invalides.", "code": "validation_error",
                               "fields": {"name": "Ne peut pas être vide"}}


def test_validation_traduite_un_message_par_champ(demo):
    response = demo.post("/payload", json={"name": "a", "email": "pas-une-adresse"})
    assert response.status_code == 422
    assert response.json() == {
        "detail": "Certains champs sont invalides.",
        "code": "validation_error",
        "fields": {"name": "Au moins 2 caractère(s)", "age": "Champ obligatoire", "email": "Adresse e-mail invalide"},
    }


def test_aucun_message_anglais_ni_prefixe(demo):
    response = demo.post("/payload", json={"name": "abcdefgh", "age": "douze"})
    fields = response.json()["fields"]
    assert fields == {"name": "Au plus 5 caractères", "age": "Nombre entier attendu"}
    assert not any(message.startswith("Value error") for message in fields.values())


def test_erreur_de_tout_le_corps_dans_detail(demo):
    response = demo.post("/payload", json={"name": "zz", "age": 3})
    assert response.status_code == 422
    assert response.json() == {"detail": "Ce nom est réservé.", "code": "validation_error"}


def test_corps_absent_ou_illisible(demo):
    assert demo.post("/payload").json()["detail"] == "Corps de requête manquant."
    illisible = demo.post("/payload", content=b"{pas du json", headers={"Content-Type": "application/json"})
    assert illisible.status_code == 422
    assert illisible.json()["detail"] == "Corps de requête illisible (JSON invalide)."
    assert "fields" not in illisible.json()


def test_parametre_de_requete(demo):
    response = demo.get("/search", params={"days": 100})
    assert response.json()["fields"] == {"days": "Doit être inférieur ou égal à 62"}


def test_route_inconnue_et_methode_refusee():
    client = TestClient(app)
    assert client.get("/api/v2/inexistante").json() == {"detail": "Adresse inconnue", "code": "not_found"}
    response = client.put("/api/health", headers=ORIGIN)
    assert response.status_code == 405 and response.json()["code"] == "method_not_allowed"


def test_origine_refusee_porte_son_code():
    response = TestClient(app).post("/api/v2/auth/login", json={})
    assert response.status_code == 403
    assert response.json() == {"detail": "Origine de la requête refusée", "code": "origin_refused"}


def test_observateurs_recoivent_chaque_erreur(demo):
    seen = []
    errors.observers.append(lambda *event: seen.append(event))
    try:
        demo.get("/conflict")
        demo.post("/payload", json={})
    finally:
        errors.observers.pop()
    assert seen == [("GET", "/conflict", 409, "demo_conflict"), ("POST", "/payload", 422, "validation_error")]
