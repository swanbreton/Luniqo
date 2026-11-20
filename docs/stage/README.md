# Stages dans l'équipe Luniqo

TD « Road to MVP » du cours Coordination Front & Back `[RÉEL]` : un développeur
d'un autre groupe rejoint l'équipe (Florent, Thomas, Pauline, Julien) le temps
d'un stage. Il intègre une feature fullstack en respectant les pratiques du
projet : design system, gestion des erreurs, tests, PR relue. Le stage ne
commence que si les outils de pilotage sont prêts.

Ce dossier ne cite pas les stagiaires par leur nom (dépôt public) : leur
identifiant GitHub apparaît de lui-même sur leur PR.

## Les stages

| Stage | US | Issue | PR | Dates | Rapports |
|---|---|---|---|---|---|
| 1 | **LUN-124** « Voir l'état de chaque crèche depuis l'accueil » (sous-tâches LUN-84 API, LUN-125 interface) | [#86](https://github.com/zharrow/Luniqo/issues/86) | [#89](https://github.com/zharrow/Luniqo/pull/89), fusionnée le 2026-11-19 | 2026-11-17 → 2026-11-19 | non rendus |
| 2 | à choisir par Florent (LUN-128 proposée, voir plus bas) | à créer | — | à venir | — |

**Ce que le stage 1 a appris** (relevé dans les traces, faute de rapport ;
corrigé par LUN-145) :
- titre de PR réduit à la clé ;
- modèle laissé tel quel ;
- fusion sans approbation ;
- issue restée ouverte ;
- sous-tâches restées « À faire » dans Jira ;
- onboarding antérieur aux règles d'erreurs.

## Préparer et suivre un stage : la checklist du maître de stage

**Avant**

- [ ] US choisie : fullstack, en lecture de préférence, à la taille du stage
  (le stage 1 a duré 2 jours), critères d'acceptation vérifiés dans le code
  (les écrans et les données cités existent).
- [ ] Issue GitHub étiquetée `stage`, copie de la story Jira avec ses critères
  (le stagiaire n'a pas de compte Jira).
- [ ] [ONBOARDING.md](../../ONBOARDING.md) relu : il suit les règles du moment.

**Pendant**

- [ ] Story **et sous-tâches** passées « En cours » dans Jira au début du stage.
- [ ] À chaque push : diff lu, puis *Approve and run* pour la CI ; étiquettes
  posées à la main.
- [ ] Relecture par Julien ou Thomas (API), Pauline ou Thomas (interface), avec
  une **approbation enregistrée sur GitHub** ; jamais de fusion par
  contournement.

**Après**

- [ ] Sous-tâches passées « Intégré » à la fusion (la PR ne fait avancer que la
  story).
- [ ] Issue fermée par le `Closes #<n>` de la PR, sinon à la main.
- [ ] Rapport du stagiaire et retour du maître de stage rendus dans la semaine ;
  chaque blocage devient un ticket.

## Ses droits

Le minimum utile, rien à retirer à la fin (matrice complète dans
[ONBOARDING.md](../../ONBOARDING.md#0-obtenir-les-accès)) :

- **GitHub** : lecture du dépôt public et PR depuis son fork. Aucune écriture,
  aucune approbation qui compte, aucun accès à `staging`, `main` ni aux tags ;
- **CI** : celle d'un fork ne s'exécute qu'après l'accord d'un membre de
  l'équipe ;
- **Jira** : aucun compte. Sur l'offre gratuite, tout compte administre les
  projets. Décision du 2026-11-17, reconduite le 2026-11-20 : le groupe Jira
  `luniqo-stagiaire` n'est pas utilisé ;
- **Vercel, Supabase, secrets** : aucun accès.

## Réglages en attente (Florent)

- Protection des forks dans Vercel : le check Vercel est en échec sur une PR de
  fork (#89).
- Contournement administrateur des rulesets : à réserver aux urgences, une PR
  de stage passe par une approbation.

## US proposée pour le stage 2

**LUN-128** « Suivre la mise en route d'une crèche avec des succès »
(sous-tâches LUN-130 API, LUN-131 interface). Cette US est en lecture seule et
suit le même schéma que LUN-124. Avant de la confier, trois points à trancher :

1. **US de l'équipe** : la story map en fait l'US fullstack de l'équipe pour le
   TD ([STORY-MAP.md](../produit/STORY-MAP.md)).
2. **Taille** : 8 points et 5 domaines (second facteur, accès, tablettes,
   présences, ménage), pour un stage d'environ 2 jours. Possibilité de la
   réduire à 3 succès.
3. **Critères d'acceptation à corriger** :
   - liens vers des écrans qui n'existent pas encore dans le front v2
     (employés, ménage, second facteur) ;
   - succès « second facteur » toujours obtenu : sans lui, la direction n'ouvre
     pas la page.

## Rapports de fin de stage

- [RAPPORT-STAGIAIRE.md](RAPPORT-STAGIAIRE.md) : modèle du rapport du stagiaire.
- [RETOUR-MAITRE-DE-STAGE.md](RETOUR-MAITRE-DE-STAGE.md) : modèle du retour du maître de stage.

Chaque blocage relevé devient un ticket Jira pour améliorer l'onboarding ou la
documentation. Les rapports remplis sont versionnés ici, sans nom ni donnée
personnelle, si leurs auteurs l'acceptent.
