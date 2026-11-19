"""Tests unitaires de la couche HTTP : la base est remplacée par une session factice."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app import errors
from app.db import get_session
from app.main import app
from app.openapi import undocumented_errors


@pytest.fixture(scope="session", autouse=True)
def erreurs_levees_documentees() -> Iterator[None]:
    """Documenté = levé : toute erreur rendue pendant les tests doit figurer dans le schéma de sa route.

    S'applique aux tests unitaires comme d'intégration ; échoue en fin de session
    avec la liste des erreurs manquantes (à déclarer par `error_responses` ou `raises`).
    """
    observed: set[tuple[str, str, int, str]] = set()

    def record(method: str, path: str, status: int, code: str) -> None:
        observed.add((method, path, status, code))

    errors.observers.append(record)
    yield
    errors.observers.remove(record)
    missing = undocumented_errors(app.openapi(), observed)
    assert not missing, "Erreurs levées mais absentes du schéma OpenAPI :\n" + "\n".join(
        f"  {method} {path} → {status} {code}" for method, path, status, code in sorted(missing))


class FakeSession:
    """Imite les méthodes d'AsyncSession utilisées par les routes."""

    def __init__(self, rows=(), fail=False):
        self.rows = list(rows)
        self.fail = fail

    async def execute(self, statement):
        if self.fail:
            from sqlalchemy.exc import OperationalError

            raise OperationalError(str(statement), {}, Exception("connexion refusée"))

    async def scalars(self, statement):
        return iter(self.rows)


@pytest.fixture
def client_with() -> Iterator:
    """Fabrique un client HTTP dont la session de base est `FakeSession(**kwargs)`."""

    def make(**kwargs) -> TestClient:
        session = FakeSession(**kwargs)

        async def override():
            return session

        app.dependency_overrides[get_session] = override
        return TestClient(app)

    yield make
    app.dependency_overrides.clear()
