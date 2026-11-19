# Fiche de travail — Cours « Coordination Front & Back » : POC d'organisation sur Luniqo

| | |
|---|---|
| Cours | Coordination Front & Back (M2, Ynov Toulouse), cours surtout consacré à la gestion de projet |
| Sujet | TD « POC » : documentation pour développeurs, branching et SemVer, workflow des tickets, outil de gestion de projet, automatisations (sujet complet : `coordination/TP.md`, non versionné) |
| Équipe | **Équipe réelle de 4 personnes, constituée pour ce cours seulement** : Florent (chef de projet), Thomas (fullstack), Pauline (front), Julien (back). Elle est distincte de l'équipe fictive du dossier RNCP |
| Échéance | Probablement février 2027 (à confirmer). Le TD sert de base aux travaux suivants (vision produit, MVP) |
| Rendu | Lien du dépôt `zharrow/Luniqo` et lien du projet Jira, sur la feuille de suivi du cours |
| Ticket | LUN-60 |
| Compétences RNCP | C3.1 (méthode et organisation), C3.2.1 (outil de suivi), C2.1.2 (protocole d'intégration continue) |
| Statut | En cours (2026-10-09) |

## Contraintes imposées par le sujet

1. Un outil de gestion de projet avec un **lien parent ↔ enfant** entre tâches.
2. Au moins **4 épics** détaillés ; au moins 2 fullstack ; chaque épic avec des sous-tâches front **et** back (le sujet se contredit : on rend 5 épics fullstack sur 7 pour satisfaire les deux lectures).
3. Outil fonctionnel : retrouver, trier, visualiser (étiquettes, estimations, champs, boards).
4. Documentation pour développeurs à la racine : contexte, installation, branching (SemVer), workflow des tickets ; fichiers comme `CONTRIBUTING.md`.
5. Automatisations basiques ; code au strict minimum pour démarrer.

## Barème et réponse

| Critère | Points | Réponse |
|---|---|---|
| Mise en forme du markdown | 1 | [README.md](../../README.md), [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| Contexte du projet | 1 | README, « Le projet » |
| Installation | 2 | README, « Installer le projet » (3 options : pile Docker, API, front v1) |
| Branching strategy | 2 | CONTRIBUTING, sections 2 et 3 : `develop` / `staging` / `main`, SemVer, versions candidates, correctif urgent ; branches protégées par GitHub ([Protections des branches](../../CONTRIBUTING.md#protections-des-branches-rulesets-github)) |
| Hiérarchie entre les tâches | 1 | Jira : épic → story → sous-tâche ([import CSV](../../docs/projet/jira-import.csv)) |
| Automation basique | 1 | Jira : 5 règles reliées à GitHub ; GitHub Actions : conventions de PR, étiquettes, CI ([guide](../../docs/projet/JIRA.md)) ; rulesets GitHub qui rendent ces contrôles obligatoires ([.github/rulesets/](../../.github/rulesets/)) |
| Labels, champs | 1 | composants Front / Back / Infra / Doc, étiquettes, Story Points, priorités, versions |
| Boards | 1 | board Scrum + boards Front, Back et Recette |

## Décisions de l'équipe `[RÉEL]` (2026-10-09)

| Décision | Raison | Écarté |
|---|---|---|
| **Jira** (offre gratuite), projet `LUN` | Proposé par Thomas ; hiérarchie native, boards, automatisations, lien GitHub gratuit jusqu'à 10 utilisateurs | Trello (pas de parent ↔ enfant sans extension payante) ; GitHub Projects (envisagé, l'équipe connaît Jira) |
| Branches `develop` (INT) → `staging` (PRÉ-PROD) → `main` (PROD) | Brouillon de l'équipe, adapté : plusieurs développeurs, une recette avant la production | GitHub Flow seul (pratiqué jusque-là en solo) |
| **Seul ce qui est fini entre dans `develop`** ; promotion en bloc ; un refus de recette se corrige sur `develop` | Convenu à l'oral par Florent et Thomas ; le brouillon proposait de fusionner une branche dans `develop` **et** `staging`, ce qui fait diverger les branches | Double fusion feature → staging |
| SemVer, versions candidates `-rc.N` sur `staging` | Demandé par le sujet ; une version = un tag = une entrée du journal | Versions sans règle |
| Nommage `feat/LUN-<n>-description` (convention existante), clé sans zéro devant | La clé Jira relie branche, commits et PR au ticket ; Jira n'écrit pas `LUN-006` | `feat/124-export_csv` (brouillon) |
| INT réel dès maintenant (pile éphémère de la CI), PRÉ-PROD et PROD documentées comme **cibles** | Pas encore de VPS ; il est prévu à court terme | Branches sans environnement non signalées |

## Protection des branches `[RÉEL]` (2026-10-27)

Mise en œuvre des protections prévues par CONTRIBUTING le 2026-10-09. Avant
cette date, aucune branche n'était protégée : un ruleset « main » existait
depuis le 2026-10-09, mais il était désactivé et ne visait aucune branche.
Détail des règles : [CONTRIBUTING, « Protections des branches »](../../CONTRIBUTING.md#protections-des-branches-rulesets-github).
Configuration exportée : [.github/rulesets/](../../.github/rulesets/).

| Décision (Florent, chef de projet) | Raison | Écarté |
|---|---|---|
| Rulesets GitHub plutôt que l'ancienne « protection de branche » | Plusieurs règles par cible, contournement réglable, export et import en JSON, tags couverts | Protection de branche classique (une règle par branche, pas d'import ni d'export en JSON, tags non couverts) |
| `develop` : 1 relecture ; `staging` : 0 ; `main` : 2 ; CI verte et contrôle des conventions obligatoires partout | Reprend le tableau des branches durables de CONTRIBUTING | CI seule, sans relecture (écart avec CONTRIBUTING) |
| Contournement réservé à l'administrateur, **uniquement par PR** | Florent écrit l'essentiel du code de la v2 et GitHub ne permet pas d'approuver sa propre PR : sans contournement, ses PR resteraient bloquées. Le push direct reste interdit, et GitHub consigne chaque contournement | Règles strictes pour tous (blocage dès que l'équipe ne relit pas) |
| Tags `v*` ni supprimables ni déplaçables | Une version publiée désigne toujours le même commit (journal des versions) | Tags libres |
| Branche par défaut `develop`, suppression automatique des branches fusionnées | Les PR ciblent `develop` d'office ; les branches de travail ne s'accumulent pas. Les branches durables restent protégées contre la suppression | Branche par défaut `main` (chaque PR de ticket devait être reciblée à la main) |

**Limite connue.** Sur un dépôt personnel, GitHub ne peut pas réserver la fusion
dans `staging` au chef de projet (fonction des organisations) : la « validation
du chef de projet » reste une règle d'équipe, non imposée techniquement.

**Vérification.** Le 2026-10-27, l'API GitHub (`GET /repos/zharrow/Luniqo/rules/branches/<branche>`)
confirme que suppression, push forcé, PR obligatoire et contrôles obligatoires
s'appliquent à `develop`, `staging` et `main`. Le comportement sur une vraie PR
(blocage, contournement de l'administrateur) est **à vérifier** à la prochaine PR.

## TD « Road to MVP » : préparation du stage `[RÉEL]` (2026-11-17)

Un développeur d'un autre groupe fait un stage dans l'équipe : il livre une
feature fullstack par une PR, en suivant l'onboarding. Le stage ne commence que
si les outils de pilotage sont prêts. Ticket de préparation : LUN-123 ; US du
stagiaire : LUN-124 (sous-tâches API et interface), recopiée dans
l'[issue #86](https://github.com/zharrow/Luniqo/issues/86). Mission et déroulé :
[docs/stage/](../../docs/stage/README.md).

| Décision (Florent, chef de projet) | Raison | Écarté |
|---|---|---|
| Le stagiaire contribue **par un fork**, sans droit d'écriture | Un dépôt personnel n'a pas de rôle intermédiaire : un collaborateur peut pousser, supprimer des branches, approuver les PR des autres, déclencher Vercel. Avec un fork, rien n'est à retirer après le stage | Collaborateur avec règles durcies ; organisation GitHub (transfert du dépôt, intégrations à rebrancher) |
| **Aucun compte Jira** pour le stagiaire : son US est recopiée dans une issue GitHub étiquetée `stage` | Sur l'offre gratuite, tout compte Jira administre tous les projets | Compte Jira ; offre Standard (payante, décision du propriétaire du site) |
| CI des forks lancée après l'accord d'un membre de l'équipe, **à chaque exécution** (`all_external_contributors`, au lieu de la première contribution seulement) | Le code d'un fork ne tourne pas sur nos machines sans qu'un humain ait lu le diff | Accord à la première contribution seulement (réglage d'origine) |
| Étiquetage automatique sauté sur une PR de fork, étiquettes posées à la main | Le jeton d'un fork est en lecture seule : le job échouait | `pull_request_target` (jeton en écriture sur un code non relu) |
| `staging` : **1 relecture** au lieu de 0 (la décision du 2026-10-27 est remplacée) | Un collaborateur pouvait promouvoir seul en pré-production ; une promotion demande désormais deux personnes | Garder 0 (la validation du chef de projet restait une règle orale) |

**Vérification `[RÉEL]`, 2026-11-17** : `GET /repos/zharrow/Luniqo/actions/permissions/fork-pr-contributor-approval`
répond `all_external_contributors` ; `GET /repos/zharrow/Luniqo/rules/branches/staging`
répond `required_approving_review_count` = 1 (export dans
[.github/rulesets/staging.json](../../.github/rulesets/staging.json)) ; étiquette
`stage` et issue #86 créées.

**À vérifier le jour du stage**, avec le compte du stagiaire : sa CI attend
l'accord ; il ne peut ni pousser sur le dépôt ni approuver une PR ; sa PR fait
avancer LUN-124 dans Jira. **À vérifier par Florent** : protection des forks
activée dans Vercel (*Git Fork Protection*), pour qu'aucune prévisualisation
de la v1 ne se construise avec ses variables sans accord.

## Assistance déclarée

L'assistant (Claude Code) a rédigé le README, CONTRIBUTING, le CHANGELOG, le
guide Jira, le CSV d'import et les workflows GitHub, à partir des décisions de
l'équipe et du brouillon de stratégie de branches rédigé par une membre du
groupe. Florent a validé chaque décision ; la configuration de Jira est faite
par l'équipe en suivant le guide. Le 2026-10-27, l'assistant a appliqué les
protections des branches sur GitHub (via `gh api`), après avoir proposé les
options à Florent, qui les a choisies ; il a rédigé la section correspondante
de CONTRIBUTING et cette fiche. Le 2026-11-17, pour la préparation du stage,
une session de l'assistant a rédigé le document de conception et appliqué la
relecture de `staging` ; une autre a créé les tickets Jira et l'issue du
stagiaire, appliqué le réglage des forks et l'étiquette `stage`, et rédigé
l'onboarding mis à jour et `docs/stage/`. Florent a pris chaque décision.

## Reste à faire

- [ ] Créer le site et le projet Jira, importer le CSV, rattacher les tickets d'origine, boards, règles (Florent, guide [JIRA.md](../../docs/projet/JIRA.md)).
- [ ] Relier Jira à GitHub et vérifier le panneau Développement.
- [x] Protections des branches, tags de version protégés, branche par défaut `develop`, suppression automatique des branches fusionnées (2026-10-27).
- [ ] Vérifier les protections sur une vraie PR : fusion bloquée sans relecture ni CI pour un membre de l'équipe, contournement par PR pour l'administrateur.
- [x] Stage, outils prêts : accès par fork, issue #86, onboarding mis à jour, modèles de rapport (2026-11-17, LUN-123).
- [ ] Stage : vérifications avec le compte du stagiaire, protection des forks dans Vercel, rapports de fin de stage.
- [x] TD « Road to MVP » : [story map v2](../../docs/produit/STORY-MAP.md) de Thomas intégrée (version interactive [story-map.html](../../docs/produit/story-map.html)), clés et avancement vérifiés dans Jira, personas imposés Alex et Margeritte dans [PERSONAS.md](../../docs/produit/PERSONAS.md), fiches illustrées (2026-11-17, LUN-126).
- [ ] TD « Road to MVP », reste du barème : stories induites par les personas (marquées « à créer » sur la carte), stratégie de gestion des erreurs, sprints Jira.
- [ ] Première version `v0.1.0` par le circuit complet : préparation → `develop` → `staging` (`v0.1.0-rc.1`) → `main` (`v0.1.0`).
- [x] Bonus du prof : [personas](../../docs/produit/PERSONAS.md) (4, fictifs) et [story map](../../docs/produit/STORY-MAP.md) avec la découpe du MVP (2026-10-09).
- [x] Diagrammes Mermaid de la stratégie de branches, suggérés par le prof : cycle du ticket, circuit complet (`gitGraph` avec recette refusée et correctif urgent), flux entre environnements, dans [CONTRIBUTING.md](../../CONTRIBUTING.md). Rendu vérifié avec mermaid-cli 12.0.0.
