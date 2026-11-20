# Retour du maître de stage — modèle

À remplir par le maître de stage à la fin du stage, après la relecture de la
PR. Le retour est remis au stagiaire. Pas de nom ni de donnée personnelle si le
retour est versionné.

| | |
|---|---|
| Date | AAAA-MM-JJ |
| Maître de stage | Florent |
| US | LUN-<n> « titre de l'US » |
| PR | lien, état (fusionnée, en relecture, abandonnée) |

## 1. Résultat

- Critères d'acceptation tenus : n sur N, lesquels manquent.
- Definition of Done : cases cochées honnêtement ? Écarts constatés.

## 2. Grille

Niveaux : **acquis**, **en cours**, **à travailler**. Chaque niveau s'appuie sur
un fait vérifiable (un commit, un commentaire de relecture, un test).

| Critère | Niveau | Fait observé |
|---|---|---|
| Conventions : branche, commits, titre et modèle de PR | | |
| Isolation des données : dépendance d'accès (`ReadableNursery`, `ManagedNursery`), 403 et 404 testés | | |
| Erreurs : déclarées (`ErrorSpec`, `@raises`, visibles dans Swagger), affichées avec `ActionError`, réponses `apiErrors` dans les tests | | |
| Tests de l'API : unitaires et intégration, cas d'erreur compris | | |
| Tests du front : stories des états, test avec MSW | | |
| Design system : composants de `front/src/components/ui`, jetons, pas de couleur en dur | | |
| Accessibilité et petit écran (800 × 600, vérifié avec les styles réels) | | |
| Contrat de l'API régénéré, erreurs déclarées dans Swagger | | |
| Qualité de la PR : taille, description, réponses à la relecture | | |
| Autonomie : questions posées au bon moment, au bon endroit (issue) | | |

## 3. Points forts

## 4. Points à travailler

Deux ou trois, chacun avec une ressource ou un exercice pour progresser.

## 5. Ce que le stage apprend à l'équipe

Ce que l'onboarding, la documentation ou les outils ont mal préparé. Chaque
point devient un ticket Jira (clé notée ici).

| Constat | Ticket |
|---|---|
| | |
