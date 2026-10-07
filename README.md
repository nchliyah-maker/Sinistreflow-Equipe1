# SinistreFlow

[![CI SinistreFlow](https://github.com/nchliyah-maker/Sinistreflow-Equipe1/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nchliyah-maker/Sinistreflow-Equipe1/actions/workflows/ci.yml)

Plateforme de **déclaration et de suivi des sinistres** de **MutuAlp Assurances** (mutuelle fictive,
région Auvergne-Rhône-Alpes, ~45 000 sociétaires).

- Les **assurés** déclarent leurs sinistres en ligne (formulaire en 4 étapes).
- Les **gestionnaires** instruisent les dossiers dans le back-office.
- Les **partenaires** (cabinets d'expertise) récupèrent les dossiers et déposent leurs rapports via
  l'**API partenaires** versionnée (v1, v2, v3).

---

## ✉️ Note de passation (Thomas R., lead dev, parti le 29/08/2026)

> Salut la nouvelle équipe,
>
> Je vous laisse SinistreFlow. Ça tourne en prod depuis 2021, ça a été codé vite, par beaucoup de
> monde, et il n'y a jamais eu ni CI, ni supervision, ni vraie stratégie de tests. Désolé.
>
> - Le dump de prod anonymisé est dans `db/dump/` (voir `db/README.md`). **Testez avec lui**, pas
>   avec une base vide, la prod a 5 ans d'historique.
> - Les migrations sont dans `migrations/`. La 10 (comptes partenaires) a été mergée la semaine où je
>   suis parti, elle n'a **jamais été passée en prod**.
> - Le connecteur d'**ExpertAuto** (`partner-client/`) tourne chez nous mais **c'est leur code** :
>   interdiction contractuelle d'y toucher. S'il plante, c'est nous qui avons cassé quelque chose.
> - Le support a ouvert une pile de tickets (`docs/TICKETS.md`). Certains sont liés entre eux.
> - Le CTO veut supprimer les API v1 et v2 « pour simplifier ». Je n'ai pas eu le temps de regarder
>   qui les utilise vraiment… lisez `docs/API.md` avant de faire quoi que ce soit.
> - Le `docker-compose.yml`, je l'utilisais juste pour la base. L'appli, je la lançais avec `npm start`.
>
> Bon courage. — Thomas

---

## Démarrage rapide (méthode « historique »)

Prérequis : Node.js ≥ 20, Docker Desktop (ou Docker Engine), Python 3 (pour le connecteur partenaire).

```bash
cp .env.example .env             # puis renseigner les mots de passe et la clé API
npm install
docker compose up -d db          # base PostgreSQL 16
bash db/restore.sh               # restaure le dump de production
npm run migrate                  # migrations en attente
npm start                        # http://localhost:3000
```

| URL | Quoi |
|-----|------|
| http://localhost:3000/ | formulaire de déclaration (assurés) |
| http://localhost:3000/backoffice.html | back-office (gestionnaires) |
| http://localhost:3000/health | état de l'application |
| http://localhost:3000/api/v1 … /api/v3 | API partenaires (en-tête `X-API-Key`) |

## Lancer toute la stack dans Docker

```bash
cp .env.example .env             # puis renseigner les mots de passe et la clé API
docker compose up -d db          # la base seule
bash db/restore.sh               # restaure le dump de production
docker compose up -d --build     # migrations puis application, sur http://127.0.0.1:3000
```

Les migrations sont jouées automatiquement par le service `migrate` avant le démarrage de
l'application. Les ports ne sont publiés que sur `127.0.0.1`.

## Tests

| Commande | Couche | Ce qui tourne |
|----------|--------|---------------|
| `npm run test:unit` | unitaire | `tests/unit/`, fonctions de `src/domain/`, couverture exigée ≥ 90 % |
| `npm run test:integration` | intégration | `tests/integration/`, routes HTTP et SQL réels sur le dump restauré |
| `npm run test:e2e` | end-to-end | `tests/e2e/`, parcours dans Chromium avec Playwright |
| `npm test` | unitaire + intégration | toute la suite Jest |

Les tests d'intégration et end-to-end ont besoin de la base (`docker compose up -d db`, dump restauré
et migrations jouées). Ils suppriment à la fin les dossiers qu'ils créent.

## Intégration continue

Le pipeline `.github/workflows/ci.yml` tourne sur chaque Pull Request et sur `main` :
`commits` (format des messages) et `unit`, puis `integration` et `e2e` sur une base PostgreSQL 16
restaurée depuis le dump, puis `partner` qui construit l'image, démarre la stack et exécute le
connecteur ExpertAuto non modifié.

Sur `main` uniquement, le job `docker` publie l'image sur GitHub Container Registry :
`ghcr.io/nchliyah-maker/sinistreflow-equipe1:<sha du commit>` (et `:latest`).

Secrets à définir dans *Settings → Secrets and variables → Actions* : `DB_PASSWORD`,
`BACKOFFICE_PASSWORD` (valeurs libres, propres à la CI) et `EXPERTAUTO_API_KEY`.

## Supervision

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build
```

| Outil | Adresse (machine locale uniquement) | Rôle |
|-------|-------------------------------------|------|
| Grafana | http://127.0.0.1:3001/grafana/ (compte `admin`, mot de passe `GRAFANA_ADMIN_PASSWORD`) | tableau de bord « SinistreFlow - Vue d'ensemble » |
| Prometheus | http://127.0.0.1:9090 | métriques, cibles, état des alertes |
| Alertmanager | http://127.0.0.1:9093 | alertes actives, envoi sur Discord |

- L'application expose ses métriques sur `/metrics` (RED par route, pool PostgreSQL, métriques
  métier) et écrit ses journaux en JSON, une ligne par événement, sur la sortie standard
  (`docker compose logs app`).
- Tout est configuré par fichiers versionnés dans `monitoring/` : cibles Prometheus, règles
  d'alerte (`monitoring/prometheus/alerts.yml`), source de données et tableau de bord Grafana.
- Pour recevoir les alertes, placer l'URL du webhook Discord dans
  `monitoring/alertmanager/secrets/discord_webhook_url` (dossier ignoré par Git).

## Configuration et secrets

La configuration passe par des variables d'environnement, listées dans `.env.example`.
En local elles sont lues dans un fichier `.env`, qui n'est **jamais commité** (voir `.gitignore`).
Sans `DB_PASSWORD`, `BACKOFFICE_USER` ou `BACKOFFICE_PASSWORD`, l'application refuse de démarrer :
il n'y a plus aucun mot de passe par défaut dans le code.

Les anciens secrets (base, back-office, clé API ExpertAuto) restent lisibles dans l'historique Git
d'avant le ticket SF-204. Ils sont à considérer comme compromis : tout environnement réel doit
utiliser des secrets neufs (`openssl rand -base64 24`).

## Arborescence

```
src/
  index.js, app.js        démarrage du serveur, assemblage Express
  config.js               configuration (variables d'environnement)
  db/                     pool PostgreSQL, script de migration
  domain/                 règles métier pures (dates, montants, workflow, indemnité)
  repositories/           accès SQL
  services/               orchestration métier
  api/                    routes HTTP : public/, internal/, v1/, v2/, v3/, middlewares/
public/                   front (HTML/CSS/JS sans framework)
migrations/               scripts SQL numérotés
db/                       dump de production + script de restauration
partner-client/           connecteur ExpertAuto (NE PAS MODIFIER)
tests/                    tests (presque vide...)
docs/                     documentation fonctionnelle et technique
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — composants, modèle de données, workflow
- [`docs/API.md`](docs/API.md) — contrats des API partenaires v1 / v2 / v3
- [`docs/TICKETS.md`](docs/TICKETS.md) — tickets ouverts par le support
- [`db/README.md`](db/README.md) — dump, restauration, comptes de démonstration
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — règles Git de l'équipe
