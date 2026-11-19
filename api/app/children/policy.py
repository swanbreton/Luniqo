"""Règles des dates d'un enfant, sans base de données."""

from datetime import date

from app.children.models import ChildStatus

ENROLLMENT_BEFORE_BIRTH = "Ne peut pas précéder la naissance"
EXIT_BEFORE_ENROLLMENT = "Ne peut pas précéder l'entrée"
EXIT_REQUIRED = "Obligatoire pour un enfant parti"
EXIT_FORBIDDEN = "Réservée à un enfant parti"


def date_errors(birth_date: date, enrollment_date: date, exit_date: date | None,
                status: ChildStatus) -> dict[str, str]:
    """Dates incohérentes, un message par champ fautif (vide si tout va bien).

    - l'entrée ne précède pas la naissance ;
    - la sortie ne précède pas l'entrée ;
    - un enfant parti a une date de sortie, et seulement lui.
    """
    errors: dict[str, str] = {}
    if enrollment_date < birth_date:
        errors["enrollment_date"] = ENROLLMENT_BEFORE_BIRTH
    if exit_date is not None and exit_date < enrollment_date:
        errors["exit_date"] = EXIT_BEFORE_ENROLLMENT
    departed = status == ChildStatus.DEPARTED
    if departed and exit_date is None:
        errors.setdefault("exit_date", EXIT_REQUIRED)
    elif not departed and exit_date is not None:
        errors.setdefault("exit_date", EXIT_FORBIDDEN)
    return errors
