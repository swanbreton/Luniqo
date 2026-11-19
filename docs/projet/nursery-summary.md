# Résumé des crèches sur l'accueil

LUN-124 — [issue #86](https://github.com/zharrow/Luniqo/issues/86).

## Comportement

`GET /api/v2/nurseries/{nursery_id}/summary` renvoie trois entiers positifs ou
nuls :

```json
{ "children": 2, "present": 1, "staff": 3 }
```

- `children` : enfants de cette crèche aux statuts `active` et `adaptation`,
  selon `CAN_ATTEND` ; les enfants suspendus ou partis sont exclus.
- `present` : présences de cette crèche dont le jour est aujourd'hui à Paris,
  sans départ. Les retours dans la journée ne doublent pas le compteur ; une
  présence annulée ne compte plus. Un départ oublié la veille est exclu.
- `staff` : comptes de rôle `employee`, actifs et disposant d'un accès à cette
  crèche. Un employé affecté à deux crèches compte une fois dans chacune.

La route utilise `ReadableNursery` : employé sans accès et direction d'une
autre entreprise reçoivent le même 404 qu'une crèche inexistante. La session,
le second facteur et le rôle sont contrôlés par les dépendances existantes.
Les erreurs 401, 403, 404 et 422 figurent dans OpenAPI.

Les trois compteurs sont calculés par des sous-requêtes indépendantes dans
une seule requête SQL, sans charger les fiches ni multiplier les lignes par
jointure. Aucun changement du schéma de la base n'est nécessaire.

Chaque carte de l'accueil charge son résumé indépendamment et le relit toutes
les 30 secondes. Elle présente les états chargement, valeurs, zéro et erreur.
L'erreur remplace les chiffres, y compris après un échec de rafraîchissement ;
« Réessayer » relance la lecture. Les liens et les autres cartes restent
utilisables. L'interface réutilise les composants et les jetons du front v2.

## Vérifications du 17 novembre 2026 `[RÉEL]`

Versions : API `663d77c`, interface `7bf9db1`, depuis `7a1eb2c`.
Données synthétiques uniquement ; base PostgreSQL de test dédiée et pile
Docker `luniqo-summary-e2e` séparée de la pile locale existante.
La pile et la base jetables ont été supprimées après les vérifications.

| Vérification | Commande | Résultat observé |
|---|---|---|
| API, unitaires et intégration PostgreSQL | Depuis `api/`, `TEST_DB_ADDR=127.0.0.1:55439 TEST_DB_NAME=luniqo_test TEST_DB_PASSWORD=luniqo-test pytest -q` | 634 tests passants, dont les deux 404, les statuts, les employés inactifs, les retours, l'annulation et minuit à Paris en été et en hiver |
| Lint API | `ruff check .` depuis `api/` | Passant |
| Contrat front | `corepack pnpm api:types`, puis `git diff --exit-code -- src/api/openapi.json src/api/schema.d.ts` depuis `front/` | Contrat régénéré, aucune dérive |
| Lint et typage front | `corepack pnpm lint` et `corepack pnpm typecheck` | Passants |
| Composants, règles et stories | `corepack pnpm test --no-file-parallelism` | 178 tests passants ; quatre nouvelles stories et cinq tests MSW pour le résumé et l'accueil |
| Compilation | `corepack pnpm build` et `corepack pnpm build-storybook` | Passantes |
| Parcours réels | `E2E_BASE_URL=http://localhost:8089 E2E_PASSWORD=… corepack pnpm test:e2e` | 8 parcours passants contre la pile isolée, console contrôlée |
| Petit écran | Tests MSW et parcours direction Playwright en 800 × 600 | Aucun défilement horizontal ; capture relue, libellés visibles et chiffres alignés |

Le Python de l'API est requis pour `api:types` (`PYTHON=…` si son environnement
n'est pas activé). La base de test a été créée avec
`TEST_DB_CONTAINER=luniqo-summary-test-db TEST_DB_PORT=55439 scripts/test-db.sh up`.
Le mot de passe E2E est généré pour la pile jetable, hors dépôt.

Neuf mutations manuelles ont chacune fait échouer un test : suppression du
filtre de statut ou de crèche des enfants ; du jour, du départ ou de la crèche
des présences ; de l'activité, du rôle ou de la crèche du personnel ; du
contrôle d'accès en lecture. Les sources ont été restaurées, puis la suite API
complète a été exécutée avec succès.

La CI distante et la relecture humaine restent à effectuer après publication
de la branche et ouverture de la PR.

Assistance déclarée : implémentation et vérifications réalisées avec Codex,
à la demande du contributeur.
