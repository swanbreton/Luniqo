"""Contrat HTTP du résumé et contrôle d'accès, sans base de données."""

import uuid
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_now
from app.main import app
from app.nurseries.schemas import NurserySummary


@pytest.mark.parametrize(("now", "day"), [
    (datetime(2026, 7, 14, 22, 30, tzinfo=UTC), date(2026, 7, 15)),
    (datetime(2026, 11, 16, 23, 30, tzinfo=UTC), date(2026, 11, 17)),
])
def test_resume_utilise_la_creche_demandee_et_le_jour_de_paris(as_user, world, now, day):
    async def clock():
        return now

    app.dependency_overrides[get_now] = clock
    nord, sud = world.nurseries["nord"].id, world.nurseries["sud"].id
    world.repo.summaries[nord, day] = NurserySummary(children=2, present=1, staff=3)
    world.repo.summaries[sud, day] = NurserySummary(children=6, present=4, staff=2)
    client = as_user("owner_a")
    for nursery, expected in ((nord, {"children": 2, "present": 1, "staff": 3}),
                              (sud, {"children": 6, "present": 4, "staff": 2})):
        response = client.get(f"/api/v2/nurseries/{nursery}/summary")
        assert response.status_code == 200
        assert response.json() == expected


def test_resume_vide(as_user, world):
    response = as_user("employee_nord").get(f"/api/v2/nurseries/{world.nurseries['nord'].id}/summary")
    assert response.status_code == 200
    assert response.json() == {"children": 0, "present": 0, "staff": 0}


@pytest.mark.parametrize(("key", "nursery", "expected"), [
    ("employee_nord", "sud", 404),
    ("employee_nord", "fermee", 404),
    ("employee_nord", "temoin", 404),
    ("employee_none", "nord", 404),
    ("owner_a", "temoin", 404),
    ("owner_b", "nord", 404),
    ("developer", "nord", 403),
    ("guardian", "nord", 403),
])
def test_resume_inaccessible_sans_lecture_des_compteurs(as_user, world, monkeypatch, key, nursery, expected):
    async def forbidden_read(*args):
        pytest.fail("Les compteurs ne doivent pas être lus avant l'autorisation")

    monkeypatch.setattr(world.repo, "get_summary", forbidden_read)
    client = as_user(key)
    response = client.get(f"/api/v2/nurseries/{world.nurseries[nursery].id}/summary")
    assert response.status_code == expected
    if expected == 404:
        missing = client.get(f"/api/v2/nurseries/{uuid.uuid4()}/summary")
        assert missing.status_code == 404
        assert response.json() == missing.json() == {"detail": "Crèche introuvable"}


def test_resume_sans_session(as_user, world):
    response = TestClient(app, base_url="https://testserver").get(
        f"/api/v2/nurseries/{world.nurseries['nord'].id}/summary")
    assert response.status_code == 401


def test_resume_exige_le_second_facteur(as_user, world):
    response = as_user("owner_a", complete_mfa=False).get(
        f"/api/v2/nurseries/{world.nurseries['nord'].id}/summary")
    assert response.status_code == 403
    assert response.json() == {"detail": "Second facteur requis"}


def test_resume_identifiant_invalide(as_user):
    assert as_user("owner_a").get("/api/v2/nurseries/invalide/summary").status_code == 422


def test_resume_documente_sa_session_et_ses_erreurs():
    operation = app.openapi()["paths"]["/api/v2/nurseries/{nursery_id}/summary"]["get"]
    assert operation["security"] == [{"webSession": []}]
    responses = operation["responses"]
    assert set(responses) == {"200", "401", "403", "404", "422"}
    assert "Crèche introuvable" in responses["404"]["content"]["application/json"]["examples"]
    assert set(responses["403"]["content"]["application/json"]["examples"]) == {
        "Second facteur requis", "Action non autorisée pour ce rôle"}
