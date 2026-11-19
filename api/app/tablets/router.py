"""Routes des tablettes et du PIN."""

import uuid

from fastapi import APIRouter, Response, status

from app.auth.dependencies import ClientDep, CurrentUser, NowDep
from app.auth.models import UserRole
from app.config import get_settings
from app.db import SessionDep
from app.errors import TOO_MANY_ATTEMPTS, ApiError, ErrorSpec
from app.nurseries.dependencies import ManagedNursery, OwnerUser
from app.openapi import error_responses, retry_after
from app.tablets import policy, service
from app.tablets.dependencies import CurrentActor, CurrentTablet, action_cookie_name, device_cookie_name
from app.tablets.schemas import (
    PinIn,
    TabletActorOut,
    TabletCreate,
    TabletInfo,
    TabletLoginIn,
    TabletOut,
    TabletStaffMember,
    display_name,
)

router = APIRouter(prefix="/api/v2", tags=["tablettes"])

_PIN_ERRORS = {
    "invalid": ErrorSpec(status.HTTP_401_UNAUTHORIZED, "pin_invalid", "PIN incorrect"),
    "locked": ErrorSpec(status.HTTP_423_LOCKED, "pin_locked",
                        "PIN bloqué après 3 erreurs : demandez à la direction de le débloquer"),
    "not_set": ErrorSpec(status.HTTP_409_CONFLICT, "pin_not_set",
                         "PIN non défini : le choisir depuis l'espace employé"),
    "throttled": ErrorSpec(status.HTTP_429_TOO_MANY_REQUESTS, "tablet_throttled",
                           "Trop d'erreurs de PIN sur cette tablette, réessayez plus tard"),
}
_TABLET_NOT_FOUND = ErrorSpec(status.HTTP_404_NOT_FOUND, "tablet_not_found", "Tablette introuvable")
_EMPLOYEE_NOT_FOUND = ErrorSpec(status.HTTP_404_NOT_FOUND, "employee_not_found", "Employé introuvable")
_PIN_FOR_EMPLOYEES = ErrorSpec(status.HTTP_403_FORBIDDEN, "pin_for_employees_only",
                               "Le PIN de tablette est réservé aux employés")
_WRONG_PASSWORD = ErrorSpec(status.HTTP_403_FORBIDDEN, "wrong_password", "Mot de passe incorrect")
# Messages de policy.check_pin, levés tels quels.
_WEAK_PIN = [ErrorSpec(status.HTTP_422_UNPROCESSABLE_CONTENT, "pin_policy", message) for message in (
    f"Le PIN doit contenir exactement {policy.PIN_LENGTH} chiffres.",
    "Ce PIN est trop prévisible (chiffres identiques).", "Ce PIN est trop prévisible (suite de chiffres).")]


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    # SameSite=Strict : ces cookies ne servent qu'à la tablette, sur l'origine de Luniqo.
    response.set_cookie(name, value, max_age=max_age, httponly=True, secure=get_settings().cookie_secure,
                        samesite="strict", path="/")


def _delete_cookie(response: Response, name: str) -> None:
    response.delete_cookie(name, httponly=True, secure=get_settings().cookie_secure, samesite="strict", path="/")


# --- Direction : enrôlement et révocation -------------------------------------

@router.post("/nurseries/{nursery_id}/tablets", status_code=status.HTTP_201_CREATED)
async def enroll_tablet(body: TabletCreate, context: ManagedNursery, db: SessionDep, client: ClientDep,
                        now: NowDep, response: Response) -> TabletOut:
    """Enrôle **l'appareil qui envoie la requête** comme tablette de cette crèche.

    La direction se connecte sur la tablette elle-même, l'enrôle, puis se
    déconnecte : le cookie d'appareil (90 jours) reste sur la tablette.
    """
    device, token = await service.enroll(db, context.nursery, context.user, body.label, client, now)
    _set_cookie(response, device_cookie_name(), token, int(policy.DEVICE_LIFETIME.total_seconds()))
    return TabletOut.model_validate(device)


@router.get("/nurseries/{nursery_id}/tablets")
async def list_tablets(context: ManagedNursery, db: SessionDep) -> list[TabletOut]:
    """Tablettes de la crèche, révoquées et expirées comprises."""
    return [TabletOut.model_validate(device) for device in await service.list_devices(db, context.nursery.id)]


@router.delete("/nurseries/{nursery_id}/tablets/{tablet_id}", status_code=status.HTTP_204_NO_CONTENT,
               responses=error_responses(_TABLET_NOT_FOUND))
async def revoke_tablet(tablet_id: uuid.UUID, context: ManagedNursery, db: SessionDep, client: ClientDep,
                        now: NowDep) -> None:
    """Révoque la tablette (perte, vol, remplacement) et ferme ses sessions d'action. Effet immédiat."""
    if not await service.revoke(db, context.nursery, tablet_id, context.user, client, now):
        raise ApiError(_TABLET_NOT_FOUND)


# --- PIN : employé et direction -----------------------------------------------

@router.put("/auth/me/pin", status_code=status.HTTP_204_NO_CONTENT, tags=["authentification"],
            responses=retry_after(error_responses(_PIN_FOR_EMPLOYEES, _WRONG_PASSWORD, *_WEAK_PIN, TOO_MANY_ATTEMPTS)))
async def set_my_pin(body: PinIn, user: CurrentUser, db: SessionDep, client: ClientDep, now: NowDep) -> None:
    """L'employé choisit ou change son PIN de tablette, en confirmant son mot de passe. Débloque le PIN."""
    if user.role != UserRole.EMPLOYEE:
        raise ApiError(_PIN_FOR_EMPLOYEES)
    try:
        await service.set_pin(db, user, body.password, body.pin, client, now)
    except service.TooManyAttempts as exc:
        raise ApiError(TOO_MANY_ATTEMPTS, retry_after=exc.retry_after) from None
    except service.WrongPassword:
        raise ApiError(_WRONG_PASSWORD) from None
    except policy.PinPolicyError as error:
        raise ApiError(_WEAK_PIN[0], detail=str(error)) from None


@router.post("/staff/{user_id}/pin/unlock", status_code=status.HTTP_204_NO_CONTENT, tags=["personnel"],
             responses=error_responses(_EMPLOYEE_NOT_FOUND))
async def unlock_pin(user_id: uuid.UUID, owner: OwnerUser, db: SessionDep, client: ClientDep, now: NowDep) -> None:
    """La direction débloque le PIN d'un employé de son entreprise."""
    if not await service.unlock_pin(db, owner, user_id, client, now):
        raise ApiError(_EMPLOYEE_NOT_FOUND)


# --- Tablette ------------------------------------------------------------------

@router.get("/tablet")
async def tablet_info(tablet: CurrentTablet, db: SessionDep) -> TabletInfo:
    """Crèche de la tablette et employés qui peuvent s'y identifier (prénom et initiale)."""
    members = await service.staff(db, tablet)
    return TabletInfo(tablet_id=tablet.device.id, label=tablet.device.label, nursery_id=tablet.nursery.id,
                      nursery_name=tablet.nursery.name, staff=[TabletStaffMember.of(user) for user in members])


@router.post("/tablet/session", status_code=status.HTTP_201_CREATED,
             responses=retry_after(error_responses(*_PIN_ERRORS.values())))
async def open_tablet_session(body: TabletLoginIn, tablet: CurrentTablet, db: SessionDep, client: ClientDep,
                              now: NowDep, response: Response) -> TabletActorOut:
    """Ouvre une session d'action de 2 minutes par PIN, pour la crèche de la tablette."""
    try:
        user, token = await service.open_action_session(db, tablet, body.user_id, body.pin, client, now)
    except service.PinRefused as refused:
        raise ApiError(_PIN_ERRORS[refused.reason], retry_after=refused.retry_after) from None
    _set_cookie(response, action_cookie_name(), token, int(policy.ACTION_SESSION_LIFETIME.total_seconds()))
    return TabletActorOut(user_id=user.id, display_name=display_name(user), nursery_id=tablet.nursery.id,
                          nursery_name=tablet.nursery.name, expires_at=now + policy.ACTION_SESSION_LIFETIME)


@router.get("/tablet/session")
async def tablet_session(actor: CurrentActor) -> TabletActorOut:
    """Employé de la session d'action en cours."""
    return TabletActorOut(user_id=actor.user.id, display_name=display_name(actor.user),
                          nursery_id=actor.tablet.nursery.id, nursery_name=actor.tablet.nursery.name,
                          expires_at=actor.session.created_at + policy.ACTION_SESSION_LIFETIME)


@router.delete("/tablet/session", status_code=status.HTTP_204_NO_CONTENT)
async def end_tablet_session(actor: CurrentActor, db: SessionDep, client: ClientDep, now: NowDep,
                             response: Response) -> None:
    """Ferme la session d'action (l'employé a fini son geste)."""
    await service.end_action_session(db, actor, client, now)
    _delete_cookie(response, action_cookie_name())
