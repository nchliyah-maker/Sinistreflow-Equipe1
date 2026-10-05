# Tests

État actuel : deux fichiers de tests unitaires écrits en 2022 (`tests/unit/`), lancés à la main
avec `npm test`. **Au moins un des tests existants valide un bug.**

Cible (voir le sujet du TP) :

| Dossier | Couche | Outil suggéré | Ce qu'on vérifie |
|---------|--------|---------------|------------------|
| `tests/unit/` | unitaire | Jest | `src/domain/*` : fonctions pures, sans base ni HTTP |
| `tests/integration/` | intégration | Jest + Supertest + vraie base PostgreSQL (dump restauré) | routes HTTP + SQL + contrats des API v1/v2/v3 |
| `tests/e2e/` | End-to-End | Playwright | parcours utilisateur réels dans un navigateur |
