# Gestion des erreurs : stratégie front et back

Comment Luniqo signale une erreur, de l'API jusqu'à l'écran, et comment on en
ajoute une. Rédigé le 2026-11-17 (LUN-129), pour la feature imposée par le TD
« Road to MVP » (cours « Coordination Front & Back ») : « les cas d'erreurs
doivent être majoritairement gérés pour aider l'UX et également le dev ».

**Ce document décrit l'existant tel qu'il était** (section 1, `[RÉEL]`, lu dans
le code de `develop` le 2026-11-17), puis **la cible** (sections 2 à 6). Depuis
LUN-137 (2026-11-19), le contrat de la section 2 est en place côté API : corps
`{"detail", "code", "fields"?}`, 422 traduites, `Retry-After` sur toute 429,
test « erreur levée = erreur documentée ». Le code
de la cible viendra dans les sprints suivants, par les stories de la section 7.
Chaque écart entre l'existant et la cible porte un numéro (E1 à E8) repris par
ces stories.

## 0. Principes

Une erreur a **deux lecteurs** :

- **l'utilisateur**, qui doit comprendre ce qui s'est passé et **savoir quoi
  faire** ;
- **le développeur**, qui doit **retrouver la cause** sans reproduire le
  problème à l'aveugle.

**Écrire un message.**

- En français, phrase courte, sans jargon (« statut », « requête », « 500 »).
- Dire ce qui s'est passé, puis quoi faire quand ce n'est pas évident :
  « PIN bloqué après 3 erreurs : demandez à la direction de le débloquer ».
- Ne pas accuser : « Ce PIN est trop prévisible », pas « PIN invalide ».
- Lisible là où il s'affiche : sur la tablette, les mains occupées (persona
  Yasmine) ; sur un écran 800×600 (persona Margeritte), sans défilement
  horizontal.

**Ne rien laisser fuir.** Ces règles sont déjà appliquées et restent la règle :

- une crèche d'une autre entreprise, ou sans accès, répond **404 comme un objet
  qui n'existe pas** : on ne révèle pas son existence ;
- la connexion répond « Identifiants invalides » sans dire si l'e-mail existe ;
- aucune trace technique, requête SQL ni donnée d'enfant dans un message ou un
  journal accessible à l'utilisateur.

**Le message peut changer, le code jamais.** Le programme décide sur le code et
le statut ; le texte ne sert qu'à l'affichage (section 2).

## 1. État des lieux `[RÉEL]`

### API (`api/app/`)

- **Un seul corps d'erreur, sans code.** Toute erreur documentée renvoie
  `{"detail": "message en français"}`, modèle `Error` de
  [`api/app/openapi.py`](../../api/app/openapi.py). Chaque route déclare ses
  erreurs (`@raises` sur les dépendances, `error_responses` sur les routes) ;
  [`tests/test_openapi.py`](../../api/tests/test_openapi.py) vérifie que chaque
  réponse ≥ 400 a un corps et un exemple. Il vérifie la documentation, **pas**
  que l'erreur levée par le code est bien celle qui est documentée.
- **Les raisons métier existent, mais restent sur le serveur.** Six exceptions
  portent une clé `reason` (`AccountRefused`, `AttendanceRefused`,
  `CheckRefused`, `InvitationRefused`, `Refused` du second facteur,
  `PinRefused`), traduite en `(statut, message)` par une table `_REFUSALS` dans
  chaque `router.py`. Le client ne reçoit que le message : **pour distinguer
  deux erreurs de même statut, il doit comparer des textes** (E1).
- **Aucun gestionnaire d'exception, aucun journal applicatif, aucun identifiant
  de requête** (E2). Une exception non prévue (par exemple une violation de
  contrainte inattendue, que `cleaning/router.py` laisse volontairement
  remonter) donne la réponse par défaut de Starlette : `500`, texte brut
  « Internal Server Error ». Seul le journal d'accès d'uvicorn est écrit, sans
  identifiant pour relier une plainte à une ligne.
- **La passerelle répond en HTML** (E3). `docker/web/nginx.conf.template`
  renvoie la page `indisponible.html` sur 502, 503 et 504, y compris pour les
  appels à `/api/` : le front reçoit du HTML là où il attend du JSON.
- **Deux formes de 422** (E4). Les refus métier renvoient
  `{"detail": "…"}` ; la validation de FastAPI renvoie
  `{"detail": [{"loc": […], "msg": "Field required", …}]}`, **en anglais**, et
  les messages des validateurs maison arrivent préfixés (« Value error, … »).
  Une même règle peut produire plusieurs messages collés par « ; »
  (`children/router.py`).
- **`Retry-After` n'accompagne pas toutes les 429** (E6). Présent sur la
  connexion, le second facteur et les passkeys ; absent sur les comptes
  (`accounts/router.py`, changement de mot de passe) et sur la tablette
  (`tablets/router.py`, PIN et changement de PIN).

### Front (`front/src/`)

- **Une erreur unique, `ApiError`** ([`front/src/api/errors.ts`](../../front/src/api/errors.ts)) :
  statut, message de l'API, erreurs par champ d'une 422, délai de
  `Retry-After`. Le client ([`client.ts`](../../front/src/api/client.ts)) la lève
  sur toute réponse non OK. Sans corps lisible : message générique pour une
  5xx, « Une erreur inattendue est survenue » sinon ; erreur réseau :
  « Connexion au serveur impossible. Vérifiez le réseau. ».
- **Traitement global** ([`front/src/app/app.tsx`](../../front/src/app/app.tsx)) :
  401 → page de connexion ; 403 → écran du second facteur **si le message vaut
  exactement « Second facteur requis »** (E1) ; pas de nouvel essai sur une 4xx,
  2 au plus sur une 5xx ou une erreur réseau, pour les lectures seulement. La
  tablette et la connexion gèrent leurs 401 elles-mêmes.
- **Ailleurs, chaque écran affiche le message** dans `FormError`
  ([`components/form-error.tsx`](../../front/src/components/form-error.tsx),
  `role="alert"`). La tablette revient à la liste des employés sur 409 et 423 ;
  l'export CSV affiche le refus au lieu de télécharger l'erreur ; le routeur a
  une page « Un problème est survenu » et une page « Page introuvable ».
- **Les erreurs par champ ne sont pas affichées** (E4) : `ApiError.fields`
  n'est lu nulle part, alors qu'[ADR-002](../../M2/decisions/ADR-002-front-v2.md)
  prévoit que « ses erreurs 422 s'affichent sous les champs ».
- **Peu d'issues proposées** (E5) : un seul bouton « Réessayer » (tablette) ;
  le délai d'une 429 est écrit dans le message mais le bouton reste actif ;
  aucune détection du mode hors ligne ; aucune notification.
- **Tests** (E8) : chaque état d'erreur d'un composant a sa story (variantes
  `Erreur`, `RefusParLApi`, `TropDeTentatives`…), l'erreur étant passée en
  propriété. MSW ne sert qu'aux tests d'intégration, chacun déclarant ses
  réponses. **Aucun test ne couvre une 5xx, une coupure réseau ou une 422 avec
  champs.**

### Écarts

| | Écart | Repris par |
|---|---|---|
| E1 | Pas de code d'erreur : le front compare des textes | Story A : API faite (LUN-137), front à venir (LUN-138) |
| E2 | Ni gestionnaire des 500, ni journal, ni identifiant de requête | Story B : API faite (LUN-140) ; passerelle à venir (LUN-139) |
| E1 | Pas de code d'erreur : le front compare des textes | Story A : fait (API LUN-137, front LUN-138) |
| E2 | Ni gestionnaire des 500, ni journal, ni identifiant de requête | Story B |
| E3 | La passerelle renvoie du HTML sur `/api/` en cas de panne | Story B |
| E4 | Deux formes de 422, validation en anglais, champs jamais affichés | Story A : fait (API LUN-137, affichage sous les champs LUN-138) |
| E5 | Peu d'actions proposées : réessayer, attendre, hors ligne | Story C |
| E6 | `Retry-After` absent de certaines 429 | Story A : fait (LUN-137) |
| E7 | Pas de référence à donner au support pour une erreur serveur | Stories B, C : référence renvoyée par l'API (LUN-140) ; affichage à venir (LUN-141) |
| E8 | 5xx, réseau et 422 avec champs non testés ; réponses MSW non partagées | Story D |

## 2. Contrat de l'API

### Corps d'une erreur

Toute réponse d'erreur de l'API, et de la passerelle sous `/api/`, est du JSON
(`application/json`) de cette forme :

```json
{
  "detail": "PIN bloqué après 3 erreurs : demandez à la direction de le débloquer",
  "code": "pin_locked"
}
```

| Champ | Présent | Rôle |
|---|---|---|
| `detail` | toujours | Message en français, **affichable tel quel**. Peut être reformulé à tout moment |
| `code` | toujours | Identifiant stable en `snake_case`. **Ne change jamais** une fois publié : c'est lui que le front teste |
| `fields` | 422 de saisie | Objet `{champ: message en français}`, un message par champ |
| `request_id` | 5xx | Identifiant de la requête (section 3), à donner au support |

Une erreur de saisie a **une seule forme**, que la règle soit vérifiée par
FastAPI ou par le code métier :

```json
{
  "detail": "Certains champs sont invalides.",
  "code": "validation_error",
  "fields": {"email": "Champ obligatoire", "birth_date": "Date invalide"}
}
```

Les messages de Pydantic sont traduits (« Field required » → « Champ
obligatoire ») ; le préfixe « Value error, » disparaît. Une règle qui porte sur
plusieurs champs garde son propre `code` et cite le champ fautif dans `fields`.

### Règles

- **Statuts** : on garde ceux d'aujourd'hui (tableau ci-dessous). Rappel : 401
  = pas ou plus authentifié ; 403 = authentifié mais refusé ; 404 = absent **ou
  hors de portée** ; 409 = conflit avec l'état actuel ; 422 = saisie refusée ;
  423 = verrouillé ; 429 = trop de tentatives ; 503 = service momentanément
  indisponible.
- **Codes** : la clé `reason` existante quand elle est unique, préfixée du
  domaine sinon (`not_found` devient `child_not_found`, `room_not_found`…). Un
  même code peut servir à plusieurs routes s'il a le même sens
  (`too_many_attempts`).
- **Toute 429 envoie `Retry-After`** (en secondes).
- **Documenté = levé** : chaque couple (statut, code) levé par une route est
  déclaré dans Swagger, et un test le vérifie (section 5).

**Option écartée : RFC 9457** (`application/problem+json`, champs `type`,
`title`, `status`, `detail`, `instance`). Elle sert surtout des API publiques
aux nombreux clients ; Luniqo a un seul client, généré depuis le schéma. Garder
`detail` et ajouter `code` change le moins de choses. Le passage reste possible
plus tard : `detail` a déjà le sens que lui donne la RFC, `code` deviendrait
`type`.

### Catalogue des erreurs

Toutes les erreurs que l'API lève, avec leur code, en place depuis LUN-137 (2026-11-19). Les
messages sont ceux du code de `develop` au 2026-11-17. Les erreurs déclenchées
par une dépendance s'appliquent à toutes les routes qui l'utilisent.

**Transverses** (dépendances, middleware, passerelle)

| Statut | Message | Code | Où |
|---|---|---|---|
| 401 | Authentification requise | `auth_required` | `auth/dependencies.py`, toute route connectée |
| 403 | Second facteur requis | `mfa_required` | `auth/dependencies.py`, direction et éditeur |
| 403 | Origine de la requête refusée | `origin_refused` | `security.py`, toute écriture |
| 403 | Action non autorisée pour ce rôle | `role_refused` | `nurseries/dependencies.py` |
| 403 | Seule la direction peut gérer cette crèche | `manager_required` | `nurseries/dependencies.py` |
| 404 | Crèche introuvable | `nursery_not_found` | `nurseries/dependencies.py` |
| 401 | Tablette non enrôlée, expirée ou révoquée | `tablet_required` | `tablets/dependencies.py` |
| 401 | Session de tablette absente ou expirée : saisir le PIN | `pin_session_required` | `tablets/dependencies.py` |
| 422 | Certains champs sont invalides. (validation de FastAPI traduite, un message par champ dans `fields`) | `validation_error` | toute route avec un corps ou des paramètres, ceux de ses dépendances compris |
| 404, 405 | Adresse inconnue · Méthode non autorisée pour cette adresse | `not_found`, `method_not_allowed` | Starlette (route ou méthode inconnue) |
| 429 | Trop de tentatives, réessayez plus tard | `too_many_attempts` | connexion, second facteur, passkeys, comptes, PIN |
| 500 | Une erreur est survenue de notre côté. Réessayez dans un instant ; si elle revient, donnez la référence à la crèche. (avec `request_id`) | `internal_error` | toute route : exception imprévue (section 3) |
| 502, 503, 504 | *(page HTML de nginx jusqu'à LUN-134)* | `service_unavailable` | passerelle, sous `/api/` (section 3, LUN-134) |

**Connexion** (`auth/router.py`)

| Statut | Message | Code |
|---|---|---|
| 401 | Identifiants invalides | `invalid_credentials` |

**Second facteur** (`mfa/router.py`)

| Statut | Message | Code |
|---|---|---|
| 401 | Code invalide | `invalid_code` |
| 403 | Présentez d'abord votre second facteur | `mfa_pending` |
| 403 | Reconnectez-vous pour modifier vos facteurs (connexion de plus de 15 minutes) | `reauthentication_required` |
| 403 | Application d'authentification bloquée après trop d'échecs : utilisez un code de secours | `totp_locked` |
| 404 | Aucune application d'authentification active | `totp_not_found` |
| 409 | Aucun second facteur attendu pour cette session | `mfa_not_pending` |
| 409 | Aucune activation en cours | `totp_setup_not_pending` |
| 409 | Second facteur obligatoire pour ce rôle : remplacez-le au lieu de le retirer | `last_factor` |
| 503 | Second facteur momentanément indisponible | `mfa_unavailable` |

**Passkeys** (`passkeys/router.py`)

| Statut | Message | Code |
|---|---|---|
| 400, 401 | Passkey refusée | `passkey_rejected` |
| 403 | Présentez d'abord votre second facteur | `mfa_pending` |
| 403 | Reconnectez-vous pour modifier vos facteurs (connexion de plus de 15 minutes) | `reauthentication_required` |
| 404 | Passkey introuvable | `passkey_not_found` |
| 409 | Aucun second facteur attendu pour cette session | `mfa_not_pending` |
| 409 | Aucune passkey enregistrée pour ce compte | `no_passkey` |
| 409 | Aucun enregistrement en cours, ou délai dépassé : recommencez | `passkey_challenge_expired` |
| 409 | *N* passkeys au plus : retirez-en une d'abord | `too_many_passkeys` |
| 409 | Cette passkey est déjà enregistrée | `passkey_already_registered` |
| 409 | Second facteur obligatoire pour ce rôle : enregistrez-en un autre avant de retirer celui-ci | `last_factor` |
| 422 | Nom de passkey vide ou trop long | `passkey_name_invalid` |
| 503 | Passkeys momentanément indisponibles | `passkeys_unavailable` |

**Comptes des employés** (`accounts/router.py`)

| Statut | Message | Code |
|---|---|---|
| 403 | Mot de passe actuel incorrect | `wrong_password` |
| 404 | Employé introuvable | `employee_not_found` |
| 404 | Invitation inconnue, expirée ou déjà utilisée | `invitation_invalid` |
| 409 | Cette adresse est déjà utilisée par un compte | `email_taken` |
| 409 | Ce compte a déjà son mot de passe, ou il est désactivé | `account_already_active` |
| 422 | Certains champs sont invalides. (`fields` : « Ne peut pas être vide » sous le champ envoyé à `null`) | `validation_error` |
| 422 | Politique des mots de passe (`auth/passwords.py`) : Le mot de passe doit contenir au moins *N* caractères. · Le mot de passe doit contenir au plus *N* caractères. · Ce mot de passe est trop prévisible (répétition ou suite de touches). · Ce mot de passe est trop courant. · Le mot de passe ne doit pas reprendre l'adresse e-mail. | `password_policy` |
| 429 | Trop de tentatives, réessayez plus tard | `too_many_attempts` |

**Crèches et personnel** (`nurseries/router.py`)

| Statut | Message | Code |
|---|---|---|
| 404 | Employé introuvable | `employee_not_found` |
| 422 | Certains champs sont invalides. (`fields` : « Ne peut pas être vide » sous le champ envoyé à `null`) | `validation_error` |

**Tablettes et PIN** (`tablets/router.py`)

| Statut | Message | Code |
|---|---|---|
| 401 | PIN incorrect | `pin_invalid` |
| 403 | Le PIN de tablette est réservé aux employés | `pin_for_employees_only` |
| 403 | Mot de passe incorrect | `wrong_password` |
| 404 | Tablette introuvable | `tablet_not_found` |
| 404 | Employé introuvable | `employee_not_found` |
| 409 | PIN non défini : le choisir depuis l'espace employé | `pin_not_set` |
| 422 | Le PIN doit contenir exactement 4 chiffres. · Ce PIN est trop prévisible (chiffres identiques). · Ce PIN est trop prévisible (suite de chiffres). | `pin_policy` |
| 423 | PIN bloqué après 3 erreurs : demandez à la direction de le débloquer | `pin_locked` |
| 429 | Trop d'erreurs de PIN sur cette tablette, réessayez plus tard | `tablet_throttled` |
| 429 | Trop de tentatives, réessayez plus tard | `too_many_attempts` |

**Familles et enfants, côté crèche** (`children/router.py`)

| Statut | Message | Code |
|---|---|---|
| 404 | Famille introuvable | `family_not_found` |
| 404 | Enfant introuvable | `child_not_found` |
| 404 | Responsable introuvable | `guardian_not_found` |
| 422 | Certains champs sont invalides. (`fields` : « Ne peut pas être vide » sous le champ envoyé à `null`) | `validation_error` |
| 422 | Le responsable n'appartient pas à la famille | `guardian_other_family` |
| 422 | Les dates de l'enfant ne sont pas cohérentes (`fields` : `enrollment_date` « Ne peut pas précéder la naissance », `exit_date` « Ne peut pas précéder l'entrée », « Obligatoire pour un enfant parti » ou « Réservée à un enfant parti ») | `child_dates_incoherent` |

**Portail des familles** (`family/router.py`)

| Statut | Message | Code |
|---|---|---|
| 403 | Un compte existe déjà avec cette adresse : saisir son mot de passe | `account_exists_password_required` |
| 404 | Invitation inconnue, expirée ou déjà utilisée | `invitation_invalid` |
| 404 | Responsable introuvable | `guardian_not_found` |
| 404 | Enfant introuvable | `child_not_found` |
| 409 | Cette adresse est déjà utilisée par un compte qui n'est pas un compte famille : contactez la crèche | `email_taken_not_family` |
| 422 | Ce responsable n'a pas d'adresse e-mail | `guardian_without_email` |
| 422 | Ce mot de passe est trop courant. (et les autres messages de la politique) | `password_policy` |

**Pointage et corrections** (`attendance/router.py`, `exports.py`)

| Statut | Message | Code |
|---|---|---|
| 403 | Cette personne n'est pas autorisée à venir chercher l'enfant : prévenir la direction | `pickup_not_authorized` |
| 404 | Enfant introuvable dans cette crèche | `child_not_found` |
| 404 | Présence introuvable dans cette crèche | `presence_not_found` |
| 409 | Enfant non attendu (suspendu, parti ou pas encore inscrit) | `child_not_expected` |
| 409 | Arrivée déjà pointée | `already_present` |
| 409 | Aucune arrivée pointée pour cet enfant | `not_present` |
| 409 | Présence de plus de 31 jours : elle ne se corrige plus | `correction_too_old` |
| 409 | Cette présence chevauche une autre présence de l'enfant ce jour-là | `presence_overlap` |
| 422 | Cette personne n'est pas un responsable de l'enfant | `unknown_guardian` |
| 422 | La correction ne change rien | `no_change` |
| 422 | L'heure d'arrivée ne peut pas être retirée | `arrival_required` |
| 422 | Une personne venue chercher l'enfant suppose une heure de départ | `pickup_without_departure` |
| 422 | L'arrivée doit rester le jour de la présence | `arrival_other_day` |
| 422 | Le départ précède l'arrivée | `departure_before_arrival` |
| 422 | Le départ doit être le jour de l'arrivée | `departure_other_day` |
| 422 | Une heure corrigée ne peut pas être dans le futur | `in_future` |
| 422 | Une présence d'un jour passé doit avoir une heure de départ | `open_in_past` |
| 422 | La date de début suit la date de fin | `period_inverted` |
| 422 | Période limitée à 366 jours par requête | `period_too_long` |

**Fiche de ménage** (`cleaning/router.py`)

| Statut | Message | Code |
|---|---|---|
| 404 | Tâche introuvable | `task_not_found` |
| 404 | Pièce introuvable | `room_not_found` |
| 404 | Tâche introuvable dans cette crèche | `room_task_not_found` |
| 409 | Une tâche du catalogue porte déjà ce nom | `task_name_taken` |
| 409 | Une pièce de cette crèche porte déjà ce nom | `room_name_taken` |
| 409 | Cette tâche vient d'être ajoutée à la pièce : recharger | `room_task_taken` |
| 409 | Cette tâche n'est pas prévue aujourd'hui | `task_not_planned` |
| 409 | Tâche déjà cochée aujourd'hui | `task_already_done` |
| 409 | Cette tâche n'est pas cochée aujourd'hui | `task_not_done` |
| 422 | Certains champs sont invalides. (`fields` : « Ne peut pas être vide » sous le champ envoyé à `null`) | `validation_error` |
| 422 | Tâche désactivée dans le catalogue | `task_inactive` |
| 422 | La date de début suit la date de fin · Période limitée à 366 jours par requête | `period_inverted`, `period_too_long` |

`GET /api/health` garde son propre corps (`{"status": "degraded", …}` en 503) :
c'est une sonde, pas une erreur affichée.

## 3. Identifiant de requête et erreurs serveur

**En place côté API depuis LUN-140** (`api/app/requests.py`, `api/app/errors.py`) :
en-tête `X-Request-ID` sur chaque réponse, journal JSON, 500 `internal_error`.
La passerelle (LUN-139) et l'affichage dans le front (LUN-141) restent à faire.

**Un identifiant par requête.** La passerelle nginx crée un `X-Request-ID`
(variable `$request_id`), ou reprend celui que le front envoie, et le transmet à
l'API. L'API :

- le renvoie dans l'en-tête `X-Request-ID` de **chaque** réponse ;
- l'écrit dans chaque ligne de son journal, en JSON sur la sortie standard
  (date, niveau, identifiant, méthode, chemin, statut, durée, et pour une
  erreur la classe d'exception et la pile) ;
- l'ajoute au journal d'accès de nginx.

Retrouver une erreur signalée par un utilisateur devient : lire la référence à
l'écran, puis `docker compose logs api | grep <référence>`.

**Une 500 ne montre rien d'interne.** Un gestionnaire d'exception global de
l'API transforme toute exception non prévue en :

```json
{
  "detail": "Une erreur est survenue de notre côté. Réessayez dans un instant ; si elle revient, donnez la référence à la crèche.",
  "code": "internal_error",
  "request_id": "6f1c0b0e9d2a4c51"
}
```

La pile d'appels part dans le journal, jamais dans la réponse.

**La passerelle parle JSON sous `/api/`.** Pour une 502, 503 ou 504 sur
`/api/`, nginx renvoie `{"detail": "Le service est momentanément indisponible.
Réessayez dans un instant.", "code": "service_unavailable", "request_id": …}`.
La page `indisponible.html` reste pour les pages du front.

## 4. Côté front : un traitement par catégorie

Une seule fonction classe chaque `ApiError` dans une catégorie. Le traitement
**global** (`app/app.tsx`) ne prend que ce qui vaut pour toute l'application ;
le reste est affiché par l'écran, dans `FormError`.

| Catégorie | Traité | Ce que voit l'utilisateur | Action proposée | Nouvel essai automatique |
|---|---|---|---|---|
| 422 avec `fields` | écran (formulaire) | message sous chaque champ (`setError` de React Hook Form), résumé en haut du formulaire | corriger la saisie | non |
| 422 sans `fields`, 400, 409 | écran | message de l'API | selon le message (recharger sur un conflit `*_taken`) | non |
| 401 | global (sauf connexion et tablette) | retour à la connexion, puis à la page demandée | se reconnecter | non |
| 403 `mfa_required` | global | écran du second facteur | présenter son second facteur | non |
| 403 autre | écran | message de l'API | aucune : l'action n'est pas permise | non |
| 404 | écran ; route inconnue : page « Page introuvable » | message de l'API, lien vers l'accueil | revenir en arrière | non |
| 423 | écran (tablette) | message, retour à la liste des employés | demander à la direction | non |
| 429 | écran | message et **compte à rebours** tiré de `Retry-After` ; bouton désactivé jusqu'au bout | attendre | non |
| Réseau (pas de réponse) | global : **bannière hors ligne** (`navigator.onLine` et échec réseau) ; écran : message | « Connexion au serveur impossible. Vérifiez le réseau. » | bouton « Réessayer » | lectures : 2 fois, attente croissante |
| 5xx | écran | message de l'API et **référence** (`request_id`) | bouton « Réessayer » ; donner la référence si ça revient | lectures : 2 fois, attente croissante |
| Erreur de rendu | routeur (`RootError`) | « Un problème est survenu » | bouton « Recharger la page » | non |

**Nouvel essai.** Seules les **lectures** sont rejouées automatiquement
(TanStack Query, 2 fois avec attente croissante, sur 5xx et réseau). Une
écriture n'est jamais rejouée sans l'utilisateur : rejouer un pointage ou une
coche pourrait l'enregistrer deux fois. L'écran propose alors « Réessayer ».

**Décider sur le code, afficher le message.** Les redirections et les cas
particuliers testent `error.code` (`mfa_required`, `pin_locked`…), plus jamais
le texte. `errorMessage()` reste la seule façon d'obtenir le texte à afficher.
En place depuis LUN-138 : `ERROR_CODES` (`front/src/api/errors.ts`) ; erreurs
par champ posées sous les champs par `useServerFieldErrors`
(`front/src/lib/server-field-errors.ts`), avec une correspondance explicite
entre les noms de l'API et ceux du formulaire.

**Pas de notification flottante (toast) pour une erreur.** Une erreur
s'affiche **à l'endroit de l'action**, avec `role="alert"` pour les lecteurs
d'écran : sur une tablette ou un écran 800×600, un toast qui disparaît se rate
facilement.

## 5. Pour le développeur

- **Un état d'erreur = une story.** Chaque composant qui peut échouer a une
  variante par catégorie utile (`Erreur`, `RefusParLApi`, `TropDeTentatives`,
  `HorsLigne`, `ErreurServeur`…), relue avec axe comme les autres stories.
- **Des réponses MSW partagées.** Les réponses d'erreur types vivent dans
  `front/test/handlers/errors.ts` (422 avec champs, 409, 429 avec `Retry-After`,
  500 avec `request_id`, coupure réseau `HttpResponse.error()`), réutilisées par
  les tests d'intégration au lieu d'être recopiées. Le même cas donne l'erreur
  d'une story (`raised(…)`) : test et story montrent la même erreur. En place
  depuis LUN-143 (mode d'emploi : `front/README.md`, règle « Erreurs dans les
  tests et les stories »).
- **Chaque catégorie a au moins un test d'intégration** côté front. Depuis
  LUN-143 : 5xx (résumé d'une crèche, pointage sur la tablette), coupure réseau
  (pointage sur la tablette, jamais rejoué tout seul), 422 avec champs (PIN,
  correction d'une présence).
- **Toute route déclare ses erreurs**, comme aujourd'hui (`@raises`,
  `error_responses`), **avec leur code**. Le test « levé = documenté »
  (`api/tests/conftest.py`) observe chaque erreur rendue pendant les tests,
  unitaires et d'intégration, et échoue si son couple (statut, code) manque au
  schéma Swagger de sa route.
- **Lire une erreur en local** : la référence affichée à l'écran se retrouve
  dans `docker compose logs api` ; Swagger (`/api/docs`) donne, pour chaque
  route, la liste exacte de ses erreurs avec un exemple.

## 6. Ajouter une erreur : la marche à suivre

À cocher dans la PR qui introduit une nouvelle erreur :

- [ ] **Service** : le refus est une exception métier avec une raison
  (`raise AttendanceRefused("overlap")`), pas une `HTTPException` levée au
  milieu de la logique.
- [ ] **Routeur** : une entrée dans `_REFUSALS` est un
  `ErrorSpec(statut, "code", "message")` (`app/errors.py`) ; le code suit la
  section 2 (`snake_case`, préfixé du domaine si besoin, jamais réutilisé pour un
  autre sens) ; l'erreur se lève par `ApiError(spec)`, avec `fields=` ou
  `retry_after=` si besoin.
- [ ] **Swagger** : l'erreur est déclarée sur la route (`error_responses`) ou sur
  la dépendance (`@raises`) ; une 429 déclare `Retry-After`.
- [ ] **Test de l'API** : un test provoque l'erreur et vérifie statut, code et
  message.
- [ ] **Front** : contrat régénéré (`pnpm api:types`) ; le cas est traité selon
  sa catégorie (section 4) ; une story montre l'état d'erreur ; un test
  d'intégration le couvre si l'écran réagit autrement qu'en affichant le
  message.
- [ ] **Catalogue** : une ligne ajoutée dans la section 2 de ce document.

Le message suit la section 0 : il dit ce qui s'est passé et, si besoin, quoi
faire.

## 7. Mise en œuvre

Le code viendra par quatre stories de l'épic **LUN-127 « Gestion des erreurs
(front et back) »**, dans cet ordre : A pose le contrat dont dépendent les
autres. Chaque story renvoie aux sections de ce document.

| | Story | Sous-tâches | Écarts | Sections |
|---|---|---|---|---|
| A | **LUN-133** Erreurs de l'API au contrat unique : message, code stable, champs en erreur | LUN-137 [Back] champ `code` tiré des raisons, 422 unifiées et traduites, `Retry-After` sur toute 429, test « erreur levée = erreur documentée » · LUN-138 [Front] `ApiError.code`, redirections sur le code, 422 affichées sous les champs | E1, E4, E6 | 2, 6 |
| B | **LUN-134** Retrouver une erreur serveur à partir de sa référence | LUN-139 [Infra] `X-Request-ID` dans nginx, JSON pour 502, 503 et 504 sous `/api/` · LUN-140 [Back] gestionnaire des 500, identifiant dans les réponses, journal JSON · LUN-141 [Front] référence affichée sur une 5xx | E2, E3, E7 | 3 |
| C | **LUN-135** Savoir quoi faire quand une action échoue | LUN-142 [Front] classement par catégorie, bouton « Réessayer », compte à rebours sur 429, bannière hors ligne | E5, E7 | 4 |
| D | **LUN-136** Couvrir chaque état d'erreur dans Storybook et les tests | LUN-143 [Front] réponses MSW partagées, story par état, tests 5xx, réseau et 422 avec champs | E8 | 5 |

Tickets créés dans Jira le 2026-11-19, estimés à 5, 5, 3 et 3 points (dans leur description, le champ Story Points n'existant pas dans le projet). Chaque story porte son user story, ses critères d'acceptation en Gherkin, sa définition de « fini » et son hors périmètre.
