"""Résumé sur PostgreSQL : comptages réels, pointage et isolation entre crèches."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest

from app.attendance.models import Attendance
from app.auth.dependencies import get_now
from app.auth.models import UserRole
from app.children.models import Child, ChildStatus, Family
from app.main import app
from tests.integration.conftest import login

pytestmark = pytest.mark.anyio
NOW = datetime(2026, 11, 17, 10, 0, tzinfo=UTC)
DAY = date(2026, 11, 17)


@pytest.fixture
def clock():
    state = {"now": NOW}

    async def get_clock():
        return state["now"]

    app.dependency_overrides[get_now] = get_clock
    return state


@pytest.fixture
async def world(data, db):
    a, b = await data.enterprise("Groupe A"), await data.enterprise("Groupe B")
    nord = await data.nursery(a, "Nord")
    sud = await data.nursery(a, "Sud")
    other = await data.nursery(b, "Témoin")
    owner = await data.user("direction@a.test", UserRole.OWNER, a)
    employee = await data.user("employe@a.test", UserRole.EMPLOYEE, a)
    multi = await data.user("multi@a.test", UserRole.EMPLOYEE, a)
    inactive = await data.user("parti@a.test", UserRole.EMPLOYEE, a)
    inactive.is_active = False
    await data.user("sans-acces@a.test", UserRole.EMPLOYEE, a)
    await data.user("direction@b.test", UserRole.OWNER, b)
    other_staff = await data.user("employe@b.test", UserRole.EMPLOYEE, b)
    for user, nursery in ((employee, nord), (multi, nord), (multi, sud), (inactive, nord),
                           (owner, nord), (other_staff, other)):
        await data.grant(user, nursery)

    async def child(nursery, status):
        family = Family(id=uuid.uuid4(), nursery_id=nursery.id, label="Famille Démo", is_active=True)
        db.add(family)
        await db.flush()
        kid = Child(id=uuid.uuid4(), nursery_id=nursery.id, family_id=family.id, first_name="Enfant",
                    last_name="Démo", birth_date=date(2024, 1, 1), enrollment_date=date(2025, 9, 1),
                    status=status, exit_date=DAY if status == ChildStatus.DEPARTED else None)
        db.add(kid)
        await db.flush()
        return kid

    active = await child(nord, ChildStatus.ACTIVE)
    adaptation = await child(nord, ChildStatus.ADAPTATION)
    await child(nord, ChildStatus.DEPARTED)
    suspended = await child(nord, ChildStatus.SUSPENDED)
    for nursery in (sud, other):
        kid = await child(nursery, ChildStatus.ACTIVE)
        db.add(Attendance(id=uuid.uuid4(), child_id=kid.id, nursery_id=nursery.id, day=DAY,
                          arrived_at=NOW - timedelta(hours=2)))
    arrival = Attendance(id=uuid.uuid4(), child_id=active.id, nursery_id=nord.id, day=DAY,
                         arrived_at=NOW - timedelta(hours=2))
    db.add_all([
        arrival,
        Attendance(id=uuid.uuid4(), child_id=adaptation.id, nursery_id=nord.id, day=DAY,
                   arrived_at=NOW - timedelta(hours=2), departed_at=NOW - timedelta(hours=1)),
        Attendance(id=uuid.uuid4(), child_id=suspended.id, nursery_id=nord.id, day=DAY - timedelta(days=1),
                   arrived_at=NOW - timedelta(days=1)),
    ])
    await db.flush()
    return {"nord": nord, "sud": sud, "other": other, "active": active, "adaptation": adaptation,
            "arrival": arrival}


async def test_direction_voit_les_compteurs_de_chaque_creche(http, world, clock):
    await login(http, "direction@a.test")
    for key, expected in (("nord", {"children": 2, "present": 1, "staff": 2}),
                          ("sud", {"children": 1, "present": 1, "staff": 1})):
        response = await http.get(f"/api/v2/nurseries/{world[key].id}/summary")
        assert response.status_code == 200, response.text
        assert response.json() == expected


async def test_creche_sans_enfant_presence_ni_personnel(http, data, clock):
    a = await data.enterprise("Vide")
    nursery = await data.nursery(a, "Vide")
    await data.user("direction@vide.test", UserRole.OWNER, a)
    await login(http, "direction@vide.test")
    response = await http.get(f"/api/v2/nurseries/{nursery.id}/summary")
    assert response.status_code == 200
    assert response.json() == {"children": 0, "present": 0, "staff": 0}


@pytest.mark.parametrize(("email", "key"), [
    ("employe@a.test", "sud"),
    ("direction@a.test", "other"),
    ("direction@b.test", "nord"),
])
async def test_resume_inaccessible_et_inexistant_repondent_le_meme_404(http, world, clock, email, key):
    await login(http, email)
    response = await http.get(f"/api/v2/nurseries/{world[key].id}/summary")
    missing = await http.get(f"/api/v2/nurseries/{uuid.uuid4()}/summary")
    assert response.status_code == missing.status_code == 404
    assert response.json() == missing.json() == {"detail": "Crèche introuvable"}


async def test_employe_peut_lire_le_resume_de_sa_creche(http, world, clock):
    await login(http, "employe@a.test")
    response = await http.get(f"/api/v2/nurseries/{world['nord'].id}/summary")
    assert response.status_code == 200
    assert response.json() == {"children": 2, "present": 1, "staff": 2}


@pytest.mark.parametrize("instant", [
    datetime(2026, 7, 14, 22, 30, tzinfo=UTC),
    datetime(2026, 11, 16, 23, 30, tzinfo=UTC),
])
async def test_presences_du_jour_de_paris_apres_minuit(http, world, clock, db, instant):
    clock["now"] = instant
    # Le jour à Paris est le lendemain du jour UTC, en été comme en hiver.
    world["arrival"].day = instant.date() + timedelta(days=1)
    world["arrival"].arrived_at = instant - timedelta(minutes=10)
    await db.flush()
    await login(http, "direction@a.test")
    response = await http.get(f"/api/v2/nurseries/{world['nord'].id}/summary")
    assert response.status_code == 200
    assert response.json()["present"] == 1


async def test_retour_d_un_enfant_ne_multiplie_pas_les_compteurs(http, world, clock, db):
    db.add(Attendance(id=uuid.uuid4(), child_id=world["adaptation"].id, nursery_id=world["nord"].id,
                      day=DAY, arrived_at=NOW - timedelta(minutes=20)))
    await db.flush()
    await login(http, "direction@a.test")
    response = await http.get(f"/api/v2/nurseries/{world['nord'].id}/summary")
    assert response.json() == {"children": 2, "present": 2, "staff": 2}


async def test_presence_annulee_ne_compte_plus(http, world, clock):
    await login(http, "direction@a.test")
    base = f"/api/v2/nurseries/{world['nord'].id}"
    response = await http.post(f"{base}/attendance/{world['arrival'].id}/cancel",
                               json={"reason": "Pointage sur le mauvais enfant"})
    assert response.status_code == 200, response.text
    response = await http.get(f"{base}/summary")
    assert response.json() == {"children": 2, "present": 0, "staff": 2}
