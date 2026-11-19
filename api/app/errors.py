"""Erreurs de l'API : un seul corps, `{"detail", "code", "fields"?}` (docs/projet/ERREURS.md § 2).

- `detail` : message en français, affichable tel quel ; il peut être reformulé.
- `code` : identifiant stable en snake_case ; le front décide sur lui, jamais
  sur le texte. Une fois publié, un code ne change plus de sens.
- `fields` : pour une saisie refusée (422), un message par champ.

Une erreur se déclare par un `ErrorSpec` (statut, code, message), se lève par
`ApiError(spec)` et se documente par `error_responses(spec)` ou `raises(spec)`
(app/openapi.py). Les gestionnaires ci-dessous donnent la même forme aux
erreurs de FastAPI : validation des entrées (traduite en français) et routes
inconnues.
"""

from collections.abc import Callable, Sequence
from typing import Any, NamedTuple

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorSpec(NamedTuple):
    """Une erreur que l'API peut renvoyer : statut HTTP, code stable, message par défaut."""

    status: int
    code: str
    message: str


VALIDATION_ERROR = ErrorSpec(status.HTTP_422_UNPROCESSABLE_CONTENT, "validation_error",
                             "Certains champs sont invalides.")
EMPTY_FIELD = "Ne peut pas être vide"
# Limitation des essais, commune à la connexion, au second facteur, aux passkeys, aux comptes et au PIN.
TOO_MANY_ATTEMPTS = ErrorSpec(status.HTTP_429_TOO_MANY_REQUESTS, "too_many_attempts",
                              "Trop de tentatives, réessayez plus tard")

# Erreurs que Starlette lève seul (route ou méthode inconnue) : leur code se déduit du statut.
_STATUS_CODES = {
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
}


class ApiError(StarletteHTTPException):
    """Erreur levée par une route ou une dépendance, rendue en `{"detail", "code", "fields"?}`."""

    def __init__(self, spec: ErrorSpec, *, detail: str | None = None, fields: dict[str, str] | None = None,
                 retry_after: int | None = None) -> None:
        headers = {"Retry-After": str(max(1, retry_after))} if retry_after is not None else None
        super().__init__(spec.status, detail or spec.message, headers)
        self.code = spec.code
        self.fields = fields or None


def required_field(field: str) -> ApiError:
    """Refus d'un champ obligatoire envoyé à `null` dans une modification partielle."""
    return ApiError(VALIDATION_ERROR, fields={field: EMPTY_FIELD})


# --- Observation (tests) ----------------------------------------------------------------------

# Rappels appelés pour chaque erreur rendue : (méthode, chemin, statut, code). Vide en production ;
# les tests s'y branchent pour vérifier que toute erreur levée est déclarée dans le schéma.
observers: list[Callable[[str, str, int, str], None]] = []


def _respond(request: Request, status_code: int, body: dict[str, Any],
             headers: dict[str, str] | None = None) -> JSONResponse:
    for observer in observers:
        observer(request.method, request.url.path, status_code, body["code"])
    return JSONResponse(body, status_code=status_code, headers=headers)


def body(detail: str, code: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    """Corps d'une erreur ; `fields` n'apparaît que s'il y a des champs."""
    return {"detail": detail, "code": code} | ({"fields": fields} if fields else {})


# --- Gestionnaires ----------------------------------------------------------------------------

async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # enregistré pour cette seule classe
        raise exc
    code = getattr(exc, "code", None) or _STATUS_CODES.get(exc.status_code, f"http_{exc.status_code}")
    detail = exc.detail if isinstance(exc.detail, str) else "Une erreur inattendue est survenue."
    return _respond(request, exc.status_code, body(detail, code, getattr(exc, "fields", None)), exc.headers)


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):  # enregistré pour cette seule classe
        raise exc
    detail, fields = translate(exc.errors())
    return _respond(request, VALIDATION_ERROR.status, body(detail, VALIDATION_ERROR.code, fields))


def install(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)


# --- Traduction des erreurs de validation de Pydantic -----------------------------------------

# Messages par type d'erreur Pydantic ; `{…}` est rempli avec le contexte de l'erreur.
_MESSAGES = {
    "missing": "Champ obligatoire",
    "string_too_short": "Au moins {min_length} caractère(s)",
    "string_too_long": "Au plus {max_length} caractères",
    "too_short": "Au moins {min_length} élément(s)",
    "too_long": "Au plus {max_length} éléments",
    "string_pattern_mismatch": "Format invalide",
    "string_type": "Texte attendu",
    "greater_than": "Doit être supérieur à {gt}",
    "greater_than_equal": "Doit être supérieur ou égal à {ge}",
    "less_than": "Doit être inférieur à {lt}",
    "less_than_equal": "Doit être inférieur ou égal à {le}",
    "int_parsing": "Nombre entier attendu",
    "int_type": "Nombre entier attendu",
    "int_from_float": "Nombre entier attendu",
    "float_parsing": "Nombre attendu",
    "float_type": "Nombre attendu",
    "bool_parsing": "Oui ou non attendu",
    "bool_type": "Oui ou non attendu",
    "date_parsing": "Date invalide (AAAA-MM-JJ)",
    "date_from_datetime_parsing": "Date invalide (AAAA-MM-JJ)",
    "date_from_datetime_inexact": "Date invalide (AAAA-MM-JJ)",
    "date_type": "Date invalide (AAAA-MM-JJ)",
    "datetime_parsing": "Date et heure invalides",
    "datetime_from_date_parsing": "Date et heure invalides",
    "datetime_type": "Date et heure invalides",
    "time_parsing": "Heure invalide",
    "uuid_parsing": "Identifiant invalide",
    "uuid_type": "Identifiant invalide",
    "enum": "Valeur non autorisée",
    "literal_error": "Valeur non autorisée",
    "list_type": "Liste attendue",
    "dict_type": "Objet attendu",
    "model_type": "Objet attendu",
    "model_attributes_type": "Objet attendu",
    "extra_forbidden": "Champ inconnu",
    "json_invalid": "Corps de requête illisible (JSON invalide)",
    "json_type": "Corps de requête illisible (JSON invalide)",
}
_DEFAULT = "Valeur invalide"
# Emplacements où se trouvent les champs : on garde le nom du champ, pas la source.
_SOURCES = frozenset({"body", "query", "path", "header", "cookie"})


def message(error: dict[str, Any]) -> str:
    """Message français d'une erreur de Pydantic."""
    kind = error.get("type", "")
    context = error.get("ctx") or {}
    if kind == "value_error":
        # Validateur maison : son message est déjà en français ; Pydantic le préfixe de « Value error, ».
        return str(context.get("error") or error.get("msg", _DEFAULT)).removeprefix("Value error, ")
    if kind == "assertion_error":
        return str(context.get("error") or _DEFAULT)
    template = _MESSAGES.get(kind, _DEFAULT)
    try:
        return template.format(**context)
    except (KeyError, IndexError):
        return _DEFAULT


def field_name(location: Sequence[Any]) -> str | None:
    """Nom du champ d'une erreur (`["body", "email"]` → `email`), ou None pour une erreur de tout le corps."""
    parts = list(location)
    if parts and parts[0] in _SOURCES:
        parts = parts[1:]
    return ".".join(str(part) for part in parts) or None


def translate(errors: Sequence[dict[str, Any]]) -> tuple[str, dict[str, str]]:
    """`(detail, fields)` à partir des erreurs de Pydantic.

    Une erreur qui porte sur un champ va dans `fields` (premier message par champ).
    Une erreur sur tout le corps (validateur de modèle, corps absent ou illisible)
    devient le `detail`, plus parlant que le message générique.
    """
    fields: dict[str, str] = {}
    general: list[str] = []
    for error in errors:
        name = field_name(error.get("loc", ()))
        if error.get("type") == "json_invalid":
            name = None
        text = message(error)
        if name is None:
            if error.get("type") == "missing":
                text = "Corps de requête manquant"
            if text not in general:
                general.append(text)
        else:
            fields.setdefault(name, text)
    detail = " ".join(_sentence(text) for text in general) if general else VALIDATION_ERROR.message
    return detail, fields


def _sentence(text: str) -> str:
    return text if text.endswith((".", "!", "?")) else f"{text}."
