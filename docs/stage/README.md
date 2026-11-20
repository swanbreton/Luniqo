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
| 2 | **LUN-128** « Suivre la mise en route d'une crèche avec des succès », puis **LUN-146** « Noter les transmissions de la journée sur un enfant » (migration de la base) | [#100](https://github.com/zharrow/Luniqo/issues/100), [#99](https://github.com/zharrow/Luniqo/issues/99) | — | à venir | — |

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

## Stage 2 : deux US

Le TD demande **deux US fullstack**, dont la seconde **modifie la base de
données** (migration). Choisies le 2026-11-20 (LUN-149), dans cet ordre :

| Ordre | US | Issue | Partie API | Partie interface |
|---|---|---|---|---|
| 1 | **LUN-128** « Suivre la mise en route d'une crèche avec des succès », réduite à 3 succès (personnel avec accès, tablette active, premier pointage) | [#100](https://github.com/zharrow/Luniqo/issues/100) | LUN-130 : `GET /nurseries/{id}/onboarding`, lecture seule | LUN-131 : page de la crèche |
| 2 | **LUN-146** « Noter les transmissions de la journée sur un enfant » | [#99](https://github.com/zharrow/Luniqo/issues/99) | LUN-147 : **migration `0015`** (table `child_note`), écriture et lecture | LUN-148 : sous chaque enfant des présences du jour |

**Écartées :**
- **LUN-64** (accès du personnel) : elle ne modifie pas la base, les colonnes
  existent. Elle reste au backlog de l'équipe, avec ses critères d'acceptation
  prêts ; sans elle, le succès « Personnel » de LUN-128 n'a pas de lien.
- **Sessions actives** : `user_session` stocke déjà l'appareil et la dernière
  activité.

**Durée de conservation des transmissions** : à décider par Florent. Elle
relève de la purge RGPD (LUN-54, section « Reste à faire »), hors du périmètre
de LUN-146.

## Rapports de fin de stage

- [RAPPORT-STAGIAIRE.md](RAPPORT-STAGIAIRE.md) : modèle du rapport du stagiaire.
- [RETOUR-MAITRE-DE-STAGE.md](RETOUR-MAITRE-DE-STAGE.md) : modèle du retour du maître de stage.

Chaque blocage relevé devient un ticket Jira pour améliorer l'onboarding ou la
documentation. Les rapports remplis sont versionnés ici, sans nom ni donnée
personnelle, si leurs auteurs l'acceptent.
