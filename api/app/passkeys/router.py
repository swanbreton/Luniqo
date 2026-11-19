"""Routes des passkeys : /api/v2/auth/passkeys/* (LUN-69, ADR-004).

Chaque cérémonie WebAuthn se fait en deux appels : `…/options` renvoie les
options à passer à navigator.credentials.create() ou .get() (avec un défi à
usage unique, valable 5 minutes), puis la réponse du navigateur est envoyée
pour vérification.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Request, Response, status

from app.auth.dependencies import ClientDep, CurrentUser, CurrentWebSession, NowDep, cookie_name
from app.auth.router import no_store, session_out
from app.auth.schemas import SessionOut
from app.config import get_settings
from app.db import SessionDep
from app.errors import TOO_MANY_ATTEMPTS, ApiError, ErrorSpec
from app.mfa.service import Refused, TooManyAttempts
from app.openapi import error_responses, retry_after
from app.passkeys import policy, service
from app.passkeys.policy import RelyingParty
from app.passkeys.schemas import AssertionIn, PasskeyNameIn, PasskeyOut, RegistrationIn, RegistrationOut

router = APIRouter(prefix="/api/v2/auth/passkeys", tags=["passkeys"])

_REFUSALS = {
    "mfa_pending": ErrorSpec(status.HTTP_403_FORBIDDEN, "mfa_pending", "Présentez d'abord votre second facteur"),
    "reauthentication_required": ErrorSpec(status.HTTP_403_FORBIDDEN, "reauthentication_required",
                                           "Reconnectez-vous pour modifier vos facteurs "
                                           "(connexion de plus de 15 minutes)"),
    "not_found": ErrorSpec(status.HTTP_404_NOT_FOUND, "passkey_not_found", "Passkey introuvable"),
    "not_pending": ErrorSpec(status.HTTP_409_CONFLICT, "mfa_not_pending",
                             "Aucun second facteur attendu pour cette session"),
    "no_passkey": ErrorSpec(status.HTTP_409_CONFLICT, "no_passkey", "Aucune passkey enregistrée pour ce compte"),
    "no_challenge": ErrorSpec(status.HTTP_409_CONFLICT, "passkey_challenge_expired",
                              "Aucun enregistrement en cours, ou délai dépassé : recommencez"),
    "too_many_passkeys": ErrorSpec(status.HTTP_409_CONFLICT, "too_many_passkeys",
                                   f"{policy.MAX_PASSKEYS_PER_USER} passkeys au plus : retirez-en une d'abord"),
    "already_registered": ErrorSpec(status.HTTP_409_CONFLICT, "passkey_already_registered",
                                    "Cette passkey est déjà enregistrée"),
    "last_factor": ErrorSpec(status.HTTP_409_CONFLICT, "last_factor",
                             "Second facteur obligatoire pour ce rôle : "
                             "enregistrez-en un autre avant de retirer celui-ci"),
    "invalid_name": ErrorSpec(status.HTTP_422_UNPROCESSABLE_CONTENT, "passkey_name_invalid",
                              "Nom de passkey vide ou trop long"),
}

# Réponse du navigateur refusée : 400 à l'enregistrement, 401 à la présentation.
_REJECTED = {code: ErrorSpec(code, "passkey_rejected", "Passkey refusée")
             for code in (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED)}
# Aucune origine configurée (APP_ORIGINS) : configuration du serveur, pas une erreur de la personne.
_UNAVAILABLE = ErrorSpec(status.HTTP_503_SERVICE_UNAVAILABLE, "passkeys_unavailable",
                         "Passkeys momentanément indisponibles")

_ERRORS = retry_after(error_responses(
    *_REFUSALS.values(), *_REJECTED.values(), TOO_MANY_ATTEMPTS, _UNAVAILABLE))


def _rp() -> RelyingParty | None:
    return policy.relying_party(get_settings().app_origins)


def _http_error(exc: Exception, rejected: int = status.HTTP_401_UNAUTHORIZED) -> ApiError:
    if isinstance(exc, Refused):
        return ApiError(_REFUSALS[exc.reason])
    if isinstance(exc, service.InvalidPasskey):
        return ApiError(_REJECTED[rejected])
    if isinstance(exc, TooManyAttempts):
        return ApiError(TOO_MANY_ATTEMPTS, retry_after=exc.retry_after)
    return ApiError(_UNAVAILABLE)


_HANDLED = (Refused, service.InvalidPasskey, TooManyAttempts, service.Unavailable)


@router.get("", responses=_ERRORS)
async def list_passkeys(web: CurrentWebSession, db: SessionDep, response: Response) -> list[PasskeyOut]:
    """Passkeys du compte."""
    no_store(response)
    try:
        passkeys = await service.list_passkeys(db, web)
    except _HANDLED as exc:
        raise _http_error(exc) from None
    return [PasskeyOut.model_validate(passkey) for passkey in passkeys]


@router.post("/registration/options", responses=_ERRORS)
async def registration_options(web: CurrentWebSession, db: SessionDep, now: NowDep,
                               response: Response) -> dict[str, Any]:
    """Options à passer à navigator.credentials.create() pour enregistrer une passkey.

    Ouverte à une session qui doit encore enregistrer son premier facteur
    (`setup_required`), comme à une session complète de moins de 15 minutes.
    """
    no_store(response)
    try:
        return await service.registration_options(db, web, _rp(), now)
    except _HANDLED as exc:
        raise _http_error(exc) from None


@router.post("", status_code=status.HTTP_201_CREATED, responses=_ERRORS)
async def register(body: RegistrationIn, web: CurrentWebSession, db: SessionDep, client: ClientDep, now: NowDep,
                   response: Response) -> RegistrationOut:
    """Enregistre la passkey créée par le navigateur. Ferme les autres sessions du compte."""
    no_store(response)
    try:
        passkey, codes = await service.register(db, web, _rp(), body.name, body.credential, client, now)
    except _HANDLED as exc:
        raise _http_error(exc, rejected=status.HTTP_400_BAD_REQUEST) from None
    return RegistrationOut(passkey=PasskeyOut.model_validate(passkey), backup_codes=codes)


@router.patch("/{passkey_id}", responses=_ERRORS)
async def rename(passkey_id: uuid.UUID, body: PasskeyNameIn, user: CurrentUser, db: SessionDep) -> PasskeyOut:
    """Renomme une passkey du compte."""
    try:
        return PasskeyOut.model_validate(await service.rename(db, user, passkey_id, body.name))
    except _HANDLED as exc:
        raise _http_error(exc) from None


@router.delete("/{passkey_id}", status_code=status.HTTP_204_NO_CONTENT, responses=_ERRORS)
async def remove(passkey_id: uuid.UUID, web: CurrentWebSession, db: SessionDep, client: ClientDep,
                 now: NowDep) -> None:
    """Retire une passkey. La direction et l'éditeur gardent toujours au moins un facteur."""
    try:
        await service.remove(db, web, passkey_id, client, now)
    except _HANDLED as exc:
        raise _http_error(exc) from None


@router.post("/verify/options", responses=_ERRORS)
async def verification_options(web: CurrentWebSession, db: SessionDep, now: NowDep,
                               response: Response) -> dict[str, Any]:
    """Options à passer à navigator.credentials.get() pour présenter le second facteur avec une passkey."""
    no_store(response)
    try:
        return await service.verification_options(db, web, _rp(), now)
    except _HANDLED as exc:
        raise _http_error(exc) from None


@router.post("/verify", responses=_ERRORS)
async def verify(body: AssertionIn, web: CurrentWebSession, db: SessionDep, client: ClientDep, now: NowDep,
                 response: Response) -> SessionOut:
    """Présente le second facteur avec une passkey du compte : la session devient complète."""
    no_store(response)
    try:
        await service.verify(db, web, _rp(), body.credential, client, now)
    except _HANDLED as exc:
        raise _http_error(exc) from None
    return session_out(web.user, web.session, has_factor=True)


@router.post("/login/options", responses=_ERRORS)
async def login_options(db: SessionDep, client: ClientDep, now: NowDep, response: Response) -> dict[str, Any]:
    """Options à passer à navigator.credentials.get() pour se connecter sans mot de passe.

    Aucun compte n'est désigné : le navigateur propose les passkeys Luniqo de l'appareil.
    """
    no_store(response)
    try:
        return await service.login_options(db, _rp(), client, now)
    except _HANDLED as exc:
        raise _http_error(exc) from None


@router.post("/login", responses=_ERRORS)
async def login(body: AssertionIn, request: Request, db: SessionDep, client: ClientDep, now: NowDep,
                response: Response) -> SessionOut:
    """Se connecter avec une passkey, sans mot de passe : la session est complète d'emblée.

    La passkey, vérifiée par la biométrie ou le code de l'appareil, vaut les
    deux facteurs (ADR-004). Pose le cookie de session, comme /api/v2/auth/login.
    """
    try:
        result = await service.login(db, _rp(), body.credential, client, now,
                                     previous_token=request.cookies.get(cookie_name()))
    except _HANDLED as exc:
        raise _http_error(exc) from None
    # Mêmes attributs que le cookie de /api/v2/auth/login.
    response.set_cookie(cookie_name(), result.token, httponly=True, secure=get_settings().cookie_secure,
                        samesite="lax", path="/")
    no_store(response)
    return session_out(result.user, result.session, result.has_factor)
