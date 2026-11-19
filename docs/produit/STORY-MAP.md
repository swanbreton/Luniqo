# Story map

Carte du parcours des utilisateurs de Luniqo, selon la méthode de Jeff Patton
(*User Story Mapping*). Elle répond à deux questions : **que fait chaque
persona, dans l'ordre**, et **qu'est-ce qui entre dans le MVP**.

**Version 2**, conçue par Thomas Abadie (équipe du cours « Coordination Front &
Back »), intégrée au dépôt le 2026-11-17 (LUN-126). Cette page en est la
transcription pour GitHub, qui n'affiche pas le HTML : la **version interactive**,
avec les fiches des personas et la carte en post-it, est
[story-map.html](story-map.html), à ouvrir dans un navigateur après avoir
cloné le dépôt.

Personas : [PERSONAS.md](PERSONAS.md). Tickets : Jira, projet `LUN`. Clés et
statuts vérifiés un à un dans Jira le 2026-11-17 ; écrans vérifiés dans le code
de `develop` le même jour. La version 1 (2026-10-09, LUN-60) reste dans
l'historique git.

## Comment la lire

- **Trois niveaux**, comme le modèle du cours :
  - les **activités** sont les épics Jira, de gauche à droite dans l'ordre du
    récit : se connecter, mettre en place la crèche, accueillir les familles,
    vivre la journée (présences, ménage). C'est l'**épine dorsale** (*backbone*) ;
  - les **étapes** sont les user stories : ce que l'utilisateur traverse pour
    réaliser l'activité ;
  - les **détails** sont les sous-tâches, écrits du point de vue de
    l'utilisateur, avec leur ticket.
- **De haut en bas**, la priorité. Chaque version a un objectif et des critères
  de réussite (ci-dessous).
- Repères :
  - **API ✓** : la partie back de l'étape est faite.
  - **Écran ✓** / **Écran en partie** : les écrans du front v2 sont livrés, ou
    une partie seulement.
  - **✓** après une clé : tous les tickets du détail sont « Intégré » ou
    « Terminé » dans Jira.
  - *à créer* : le besoin n'a pas encore de ticket dans Jira.
  - Personas : **H** Hélène, **Y** Yasmine, **M** Marc, **N** Nadia,
    🕹️ Alex et 🖥️ Margeritte (imposés par le TD).
  - 🎓 **US du stagiaire** et 🤝 **US de l'équipe** : les deux US fullstack
    demandées par le TD « Road to MVP ».

## Versions

| Version | Objectif | Critères de réussite |
|---|---|---|
| **P0 · MVP** (v1.0.0) | Une crèche abandonne le papier. | Aucune fiche papier de présence ni de ménage pendant un mois ; un pointage en moins de 10 s ; aucun départ avec un adulte non autorisé |
| **P1 · Release 1.1** | Gagner du temps et être prêt pour un contrôle. | Connexion par Face ID ; fiches et présences exportables ; parents prévenus sans ouvrir l'application |
| **P2 · Plus tard** | Couvrir les groupes de crèches et la vie de la crèche au-delà des présences. | — |

> Objectif du MVP : une micro-crèche **remplace ses fiches papier de présence et
> de ménage**, et les parents voient la journée de leur enfant, **sans aucune
> donnée de santé**. Le MVP correspond à la version **1.0.0**, la première mise
> en production chez une crèche (voir SemVer dans
> [CONTRIBUTING.md](../../CONTRIBUTING.md#3-versions-semver)).

## La carte

### 1. Se connecter en sécurité (épic LUN-32)

| Étape (US) | P0 · MVP | P1 · 1.1 | P2 · plus tard |
|---|---|---|---|
| **LUN-61** Se connecter avec un second facteur · H N 🕹️ · API ✓ · Écran en partie | Saisir e-mail et mot de passe, message clair si le compte est bloqué : LUN-74 ✓<br>Activer le TOTP en scannant un QR code : LUN-75<br>Garder ses 10 codes de secours, affichés une seule fois : LUN-75<br>Taper son code TOTP ou un code de secours : LUN-76 ✓<br>Comprendre pourquoi un code est refusé : LUN-77 | Voir ses sessions actives et l'historique de ses connexions 🕹️ : *à créer* | |
| **LUN-62** Se connecter avec Face ID (passkey) · H N 🕹️ · API ✓ | | Enregistrer Face ID, Touch ID ou Windows Hello : LUN-78, LUN-80<br>Se connecter sans mot de passe, la passkey vaut second facteur : LUN-79, LUN-80<br>Nommer et retirer ses passkeys : LUN-81 | |

### 2. Mettre en place la crèche (épic LUN-33)

| Étape (US) | P0 · MVP | P1 · 1.1 | P2 · plus tard |
|---|---|---|---|
| **LUN-63** Gérer ses crèches · H N · API ✓ · Écran en partie | Voir ses crèches et choisir la crèche courante : LUN-82<br>Créer, modifier, fermer une crèche : LUN-83 | | Administration par l'éditeur, sans accès aux données des crèches : LUN-56<br>Facturation : *à créer* |
| 🤝 **LUN-128** Suivre la mise en route d'une crèche avec des succès · 🕹️ H | Gagner un succès à chaque étape (2FA activé, tablette enrôlée, 1re fiche de ménage remplie) : LUN-130<br>Voir la page de mise en route de sa crèche et les succès qui restent : LUN-131 | | |
| 🎓 **LUN-124** Voir l'état de chaque crèche depuis l'accueil · N H | | Lire le résumé d'une crèche (inscrits, présents, personnel) : LUN-84<br>Voir une carte de résumé par crèche sur l'accueil : LUN-125 | |
| **LUN-64** Donner accès au personnel · H N · API ✓ | Inviter un employé, qui crée son compte : LUN-55 ✓<br>Accorder ou retirer l'accès à une crèche : LUN-85<br>Débloquer le PIN d'un employé : LUN-85 | Retrouver un employé par nom ou e-mail : LUN-86 | Rôle de responsable de crèche, entre direction et employé : *à créer* |

### 3. Accueillir les familles (épic LUN-35)

| Étape (US) | P0 · MVP | P1 · 1.1 | P2 · plus tard |
|---|---|---|---|
| **LUN-67** Créer la fiche d'une famille · H · API ✓ | Créer une famille, ses enfants et ses responsables : LUN-94<br>Dire qui a l'autorité parentale et qui peut venir chercher l'enfant : LUN-95<br>Générer le lien d'invitation d'un parent (usage unique) : LUN-68 | Retrouver un enfant par son nom : LUN-96 | Allergies et PAI, après l'analyse RGPD et HDS : LUN-57 |
| **LUN-68** Suivre son enfant depuis le portail · M 🖥️ · API ✓ | Accepter l'invitation et choisir son mot de passe : LUN-97<br>Voir la présence du jour et l'historique de chaque enfant : LUN-98<br>Portail utilisable sur un ordinateur en 800×600 et avec le texte agrandi 🖥️ : *à créer* | Recevoir l'invitation par e-mail, sans donnée d'enfant : LUN-99, LUN-59<br>Être prévenu à l'arrivée et au départ : *à créer*<br>Imprimer un relevé de présence en PDF très contrasté 🖥️ : *à créer* | Messagerie avec la crèche : *à créer* |

### 4. Vivre la journée : les présences (épic LUN-34)

| Étape (US) | P0 · MVP | P1 · 1.1 | P2 · plus tard |
|---|---|---|---|
| **LUN-65** Pointer arrivées et départs sur la tablette · Y · API ✓ · Écran ✓ | Enrôler la tablette de la crèche (direction) : LUN-87 ✓<br>Choisir ou changer son PIN depuis son accueil : LUN-119 ✓<br>Choisir son nom et taper son PIN, avec de grands boutons : LUN-88 ✓<br>Pointer un enfant d'un geste : LUN-89 ✓<br>Choisir l'adulte qui vient chercher, départ refusé s'il n'est pas autorisé : LUN-89 ✓ | Pointer une fratrie d'un seul geste : LUN-90 | Transmissions de la journée : *à créer* |
| **LUN-66** Voir qui est présent · H N · API ✓ · Écran ✓ | Voir les présents du jour, par crèche : LUN-91 ✓ | Consulter l'historique des présences sur une période : LUN-92 ✓<br>Exporter les présences en CSV : LUN-93 ✓ | Statistiques multi-crèches (occupation, régularité du ménage, classement) 🕹️ : *à créer* |
| **LUN-58** Corriger un pointage · H · API ✓ · Écran en partie | | Corriger un pointage avec un motif obligatoire : LUN-120, LUN-121 ✓<br>Voir l'historique des corrections : LUN-120, LUN-121 ✓<br>Corriger depuis les présences du jour : LUN-122 | |

### 5. Vivre la journée : le ménage (épic LUN-36)

| Étape (US) | P0 · MVP | P1 · 1.1 | P2 · plus tard |
|---|---|---|---|
| **LUN-69** Décrire les pièces et les tâches · H N · API ✓ | Créer les pièces de la crèche : LUN-100, LUN-101<br>Décrire les tâches et leur fréquence : LUN-100, LUN-101 | | Traçabilité HACCP de la cuisine : *à créer* |
| **LUN-70** Remplir la fiche de ménage · Y · API ✓ | Voir les tâches du jour, par pièce : LUN-103<br>Cocher une tâche, l'heure et l'auteur étant fixés par le serveur : LUN-102, LUN-103 | Séries et badges de régularité pour l'équipe 🕹️ : *à créer* | |
| **LUN-71** Retrouver et présenter les fiches · H N · API ✓ | Consulter l'historique des fiches, filtré par pièce et par période : LUN-104, LUN-105 | Exporter les fiches pour un contrôle : LUN-104, LUN-105 | |

## Fondations : invisibles pour l'utilisateur, bloquantes pour le MVP

| Travail | Tickets | État |
|---|---|---|
| Socle du front v2 | LUN-72 : ADR-002 (LUN-106), squelette et client TypeScript généré (LUN-107), schéma OpenAPI publié par la CI (LUN-108) | ✓ fait |
| Environnements PRÉ-PROD et PROD | LUN-73 : VPS, domaine et HTTPS, requis par les passkeys (LUN-109) ; images taguées et déploiement (LUN-110) ; retour arrière par tag (LUN-111) | à faire : pas de crèche pilote sans production |
| **Gestion des erreurs (front et back)**, imposée par le TD | Épic LUN-127 : stratégie (LUN-129) ; codes d'erreur stables du second facteur (LUN-77) | à faire. Existant : réponses `{"detail"}` en français déclarées dans Swagger, classe `ApiError` et erreurs sous les champs côté front, error boundary du routeur ; pas encore de notifications |
| Purge RGPD des sessions et du journal au-delà de 6 mois | LUN-54 | ✓ fait ; reste à la planifier chaque jour sur le VPS |
| Revoir le parcours central pour y intégrer la fiche de ménage | LUN-50 | à faire : cette carte en est la version de travail |

## Ce que la carte apprend

- **Le front rattrape l'API.** L'API couvre tout le MVP. Les écrans du pointage
  sur tablette et du suivi des présences sont livrés ; il reste ceux du ménage
  (LUN-101, LUN-103, LUN-105), des familles et du portail (LUN-94 à LUN-98), du
  personnel (LUN-85), de la gestion des crèches (LUN-83) et des passkeys
  (LUN-80, LUN-81).
- **La fiche de ménage, besoin d'origine, est maintenant le plus gros reste du
  MVP** : API complète, aucun écran.
- **Les personas imposés font apparaître des besoins absents du backlog** :
  portail en 800×600 et relevé PDF pour Margeritte, sessions actives, séries,
  badges et statistiques pour Alex. Ils sont notés *à créer*. Le succès de mise
  en route d'Alex est devenu l'US de l'équipe (LUN-128).
- **Les personas 3 et 4 restent ouverts** : notifications aux parents, rôle de
  responsable de crèche.

## Ce qui change par rapport à la version 1

| Version 1 | Version 2 |
|---|---|
| Un tableau : activités, tâches et stories mélangées dans la même cellule | Trois niveaux distincts : activités (épics), étapes (US), détails (sous-tâches) |
| Activités inventées pour la carte | Les activités sont les épics Jira ; chaque ligne d'activité est une US |
| Détails écrits comme des tickets techniques (`[Front]`, `[Back]`) | Détails écrits du point de vue de l'utilisateur, le ticket reste noté |
| 4 personas | 6 personas, dont Alex et Margeritte imposés par le TD ; leurs besoins sont marqués 🕹️ et 🖥️ |
| Chaque version n'a qu'un nom | Chaque version a un objectif et des critères de réussite |
| Un seul repère (✅ = API faite), posé à tort sur la fiche de ménage | Trois repères tirés de Jira et du code : API, écrans, tickets faits |
| Socle technique dans la carte | Socle dans une bande de fondations, avec la gestion des erreurs |
| — | Les deux US fullstack du TD ont leur ligne : LUN-124 (stagiaire), LUN-128 (équipe) |

## Actions Jira qui découlent de la carte

| Action | Pourquoi |
|---|---|
| Créer les stories *à créer* : portail en 800×600, sessions actives, séries et badges d'équipe, notifications, relevé PDF, statistiques multi-crèches… | Besoins apportés par les personas, absents du backlog. Le TD demande qu'ils se voient dans l'outil de gestion de projet |
| Décider si LUN-55 (invitation des employés) reste sous l'épic « Authentification » ou passe sous « Crèches et personnel » | La carte la range dans « Donner accès au personnel » |
| Vérifier avec la crèche pilote l'hypothèse « un grand-parent n'a pas besoin de compte » | Margeritte la contredit lorsqu'elle a la délégation d'autorité parentale |
