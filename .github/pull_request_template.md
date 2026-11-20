<!-- Titre : Conventional Commit terminé par la clé Jira de la branche, par exemple « feat(api): pointage groupé (LUN-65) ». Vérifié par la CI, comme ce modèle : clé et lien du ticket renseignés, « Ce qui change » rempli. -->

## Ticket

LUN-<n> : <!-- lien Jira -->

<!-- Contribution depuis un fork (stage) : ajouter « Closes #<numéro de l'issue> » pour fermer l'issue à la fusion. -->

## Ce qui change

-

## Comment c'est vérifié

<!-- Commandes lancées et résultats ; « à vérifier » si ce n'est pas fait. -->

- [ ] Tests unitaires et d'intégration au vert (`cd api && pytest`)
- [ ] Parcours rejoué sur la pile Docker, si l'API ou le front change
- [ ] Documentation à jour (README, CONTRIBUTING, registre des choix techniques)
- [ ] Entrée ajoutée dans `CHANGELOG.md`, section « Non publié »

## Definition of Done

- [ ] Code relu par au moins une autre personne
- [ ] CI verte
