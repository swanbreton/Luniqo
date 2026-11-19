"""Règles des dates d'un enfant : un message par champ fautif."""

from datetime import date

import pytest

from app.children import policy
from app.children.models import ChildStatus

BIRTH = date(2024, 1, 10)
ENROLLED = date(2025, 9, 1)


def test_dates_coherentes():
    assert policy.date_errors(BIRTH, ENROLLED, None, ChildStatus.ACTIVE) == {}
    assert policy.date_errors(BIRTH, ENROLLED, date(2026, 7, 3), ChildStatus.DEPARTED) == {}


@pytest.mark.parametrize(("enrollment", "exit_date", "status", "expected"), [
    (date(2023, 12, 1), None, ChildStatus.ACTIVE, {"enrollment_date": policy.ENROLLMENT_BEFORE_BIRTH}),
    (ENROLLED, date(2025, 8, 1), ChildStatus.DEPARTED, {"exit_date": policy.EXIT_BEFORE_ENROLLMENT}),
    (ENROLLED, None, ChildStatus.DEPARTED, {"exit_date": policy.EXIT_REQUIRED}),
    (ENROLLED, date(2026, 7, 3), ChildStatus.ACTIVE, {"exit_date": policy.EXIT_FORBIDDEN}),
])
def test_une_regle_un_champ(enrollment, exit_date, status, expected):
    assert policy.date_errors(BIRTH, enrollment, exit_date, status) == expected


def test_deux_regles_deux_champs():
    # Entrée avant la naissance et sortie sans départ : deux champs, plus de message joint par « ; ».
    errors = policy.date_errors(BIRTH, date(2023, 12, 1), date(2026, 7, 3), ChildStatus.ACTIVE)
    assert errors == {"enrollment_date": policy.ENROLLMENT_BEFORE_BIRTH, "exit_date": policy.EXIT_FORBIDDEN}


def test_la_sortie_avant_l_entree_prime_sur_le_statut():
    errors = policy.date_errors(BIRTH, ENROLLED, date(2025, 8, 1), ChildStatus.ACTIVE)
    assert errors == {"exit_date": policy.EXIT_BEFORE_ENROLLMENT}
