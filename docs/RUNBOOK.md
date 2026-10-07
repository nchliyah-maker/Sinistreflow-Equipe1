# Runbook d'exploitation de SinistreFlow

Ce document répond à trois questions : comment mettre en service, comment livrer une version,
et quoi faire quand une alerte sonne.

> État de validation : les commandes de déploiement, de retour arrière et de supervision ont été
> répétées sur un poste de développement (voir `docs/preuves/`). Les étapes propres à la VM
> (provisionnement, pare-feu, nginx) sont à cocher lors de la première mise en service.

## 1. Vue d'ensemble

```
Internet ──► ufw (22, 80, 443) ──► nginx (hôte) ──► 127.0.0.1:3000  app      ─┐
                                        │                                      ├─ Docker compose
                                        └─ /grafana/ ► 127.0.0.1:3001 grafana ─┘
connecteur ExpertAuto (cron, hôte) ──► http://127.0.0.1:3000
```

- Un seul point d'entrée public : nginx. Tous les ports Docker sont liés à `127.0.0.1`.
- `/metrics` répond 403 depuis l'extérieur. Prometheus (9090) et Alertmanager (9093) ne sont
  accessibles que par tunnel SSH.
- La base PostgreSQL n'est joignable que depuis la machine elle-même.

| Élément | Emplacement |
|---------|-------------|
| Dépôt et `.env` (chmod 600) | `/opt/sinistreflow` |
| Image en service et historique des déploiements | `/opt/sinistreflow/.deploy/` |
| Sauvegardes de la base | `/var/backups/sinistreflow/` |
| Journaux des tâches planifiées | `/var/log/sinistreflow-backup.log`, `/var/log/sinistreflow-connecteur.log` |
| Journaux de l'application (JSON) | `docker compose logs app` |

## 2. Première mise en service sur une VM neuve

Prérequis : Ubuntu 24.04 LTS, 2 vCPU, 4 Go de RAM, 20 Go de disque, un accès SSH par clé.

1. **Provisionner** (en root, une seule fois) :
   ```bash
   scp deploy/provision-vm.sh <utilisateur>@<ip>:/tmp/
   ssh <utilisateur>@<ip> 'sudo bash /tmp/provision-vm.sh'
   ```
2. **Vérifier l'accès avant de fermer la session** : dans un autre terminal,
   `ssh deploy@<ip>` doit fonctionner. Sinon, corriger depuis la session encore ouverte.
3. **Vérifier le pare-feu depuis son poste** : `nc -zv <ip> 5432` doit échouer, `nc -zv <ip> 80`
   doit réussir.
4. **Récupérer le dépôt** (en tant que `deploy`) :
   ```bash
   git clone git@github.com:nchliyah-maker/Sinistreflow-Equipe1.git /opt/sinistreflow
   cd /opt/sinistreflow
   ```
   Le dépôt est privé : utiliser une clé de déploiement GitHub en lecture seule.
5. **Créer le `.env` avec des secrets neufs** (les anciens sont dans l'historique Git) :
   ```bash
   cp .env.example .env && chmod 600 .env
   openssl rand -base64 24     # une valeur par mot de passe
   ```
   Renseigner `NODE_ENV=production`, `DB_PASSWORD`, `BACKOFFICE_USER`, `BACKOFFICE_PASSWORD`,
   `GRAFANA_ADMIN_PASSWORD` et `EXPERTAUTO_API_KEY`. Cette dernière est la clé transmise à
   ExpertAuto : la base n'en stocke que le hachage, elle ne peut pas être changée de notre côté.
6. **Autoriser la VM à lire l'image** (paquet GHCR privé) : `docker login ghcr.io` avec un jeton
   GitHub limité à `read:packages`.
7. **Démarrer la base et restaurer le dump** :
   ```bash
   docker compose up -d --wait db
   bash db/restore.sh
   ```
8. **Déployer** (les migrations se jouent toutes seules) :
   ```bash
   bash deploy/deploy.sh ghcr.io/nchliyah-maker/sinistreflow-equipe1:<sha du commit>
   ```
9. **Installer nginx et les tâches planifiées** : `sudo bash deploy/install-host.sh`
10. **Contrôler** :
    ```bash
    curl -si http://127.0.0.1:3000/health        # 200, database UP
    curl -si http://<ip>/                         # 200 par nginx
    curl -si http://<ip>/metrics                  # 403
    sudo ufw status verbose
    ```
    La sortie « SYNCHRONISATION CONFORME : 25/25 contrôles OK » du connecteur et celle de
    `ufw status` vont dans `docs/preuves/`.

## 3. Livrer une nouvelle version

Chaque fusion sur `main` publie `ghcr.io/nchliyah-maker/sinistreflow-equipe1:<sha>` (job `docker`
du pipeline). Sur la VM :

```bash
cd /opt/sinistreflow && git pull
bash deploy/deploy.sh ghcr.io/nchliyah-maker/sinistreflow-equipe1:<sha>
```

Le script récupère l'image, joue les migrations, démarre l'application, attend `/health` puis lance
le connecteur ExpertAuto. Si une étape échoue, il **revient seul à l'image précédente** et sort en
erreur. L'historique est dans `.deploy/historique.log` : il donne la fréquence de déploiement et le
taux d'échec des changements.

Options : `RUN_CONNECTOR=0` pour ne pas lancer le connecteur, `WITH_MONITORING=0` pour ne pas
toucher à la supervision.

### Retour arrière manuel

```bash
cat .deploy/historique.log                       # retrouver la dernière image en état OK
bash deploy/deploy.sh <image précédente>
```

### Migrations et retour arrière

Revenir à l'image précédente ne « dé-migre » pas la base. Une migration doit donc rester compatible
avec la version N-1 du code : on **ajoute** une colonne ou une table, on ne renomme ni ne supprime
dans la même livraison (stratégie expand / contract). La suppression se fait dans une livraison
ultérieure, quand plus aucun code ne lit l'ancien champ. Exemple : `claims.immatriculation`, encore
en base alors que plus aucune version de l'API ne la lit (ADR 0001).

## 4. Sauvegarde et restauration

- Sauvegarde automatique chaque nuit à 2 h 30 (`deploy/backup.sh`), 14 fichiers conservés dans
  `/var/backups/sinistreflow/`. Sauvegarde à la demande : `bash deploy/backup.sh`.
- **Restaurer une sauvegarde** (écrase la base) :
  ```bash
  docker compose stop app
  docker compose exec -T db psql -U sinistreflow -d sinistreflow -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  gunzip -c /var/backups/sinistreflow/<fichier>.sql.gz | docker compose exec -T db psql -U sinistreflow -d sinistreflow
  docker compose up -d --wait app
  ```
- **Repartir du dump de production** (pour rejouer le connecteur, qui consomme un dossier à chaque
  exécution réussie) :
  ```bash
  bash db/restore.sh && docker compose run --rm migrate
  ```

## 5. Supervision

| Outil | Accès |
|-------|-------|
| Grafana | `http://<ip>/grafana/`, compte `admin`, mot de passe `GRAFANA_ADMIN_PASSWORD` |
| Prometheus | `ssh -L 9090:127.0.0.1:9090 deploy@<ip>` puis http://127.0.0.1:9090 |
| Alertmanager | `ssh -L 9093:127.0.0.1:9093 deploy@<ip>` puis http://127.0.0.1:9093 |

Pour recevoir les alertes sur Discord : créer un webhook dans le salon `#sinistreflow-alertes`, puis

```bash
mkdir -p monitoring/alertmanager/secrets
printf '%s' '<url du webhook>' > monitoring/alertmanager/secrets/discord_webhook_url
chmod 644 monitoring/alertmanager/secrets/discord_webhook_url
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml restart alertmanager
```

Journaux de l'application, une ligne JSON par événement :

```bash
docker compose logs --since 15m app | grep '"level":"error"'
```

## 6. Réagir à une alerte

Premier réflexe dans tous les cas : ouvrir le tableau de bord Grafana « SinistreFlow - Vue
d'ensemble », ligne « État ».

| Alerte | Gravité | Ce que ça veut dire | Quoi faire |
|--------|---------|---------------------|------------|
| `ApplicationInjoignable` | critique | Prometheus n'arrive plus à lire `/metrics` : le conteneur `app` est arrêté ou bloqué. | `docker compose ps` puis `docker compose logs --tail 100 app`. Relancer avec `docker compose up -d --wait app`. Si l'arrêt suit une livraison : retour arrière (section 3). |
| `SanteEnEchec` | critique | `/health` ne répond pas 200. L'application tourne mais ne peut pas servir. | `curl -s http://127.0.0.1:3000/health`. Si `database: DOWN`, traiter comme `BaseDeDonneesInjoignable`. |
| `BaseDeDonneesInjoignable` | critique | PostgreSQL ne répond plus. | `docker compose ps db`, `docker compose logs --tail 100 db`. Disque plein ? (`df -h`). Relancer : `docker compose up -d --wait db`. L'application se reconnecte seule ; vérifier `/health`. |
| `TauxErreurs5xxEleve` | avertissement | Plus de 5 % des requêtes échouent côté serveur depuis 5 minutes. | Chercher la cause dans les journaux : `docker compose logs --since 15m app \| grep '"level":"error"'`. Le champ `route` indique la route touchée. Si le début coïncide avec une livraison : retour arrière. |
| `LatenceP95Elevee` | avertissement | 95 % des requêtes mettent plus d'une seconde. | Panneau « Latence p95 par route » pour trouver la route lente. Regarder le CPU, la mémoire et le pool PostgreSQL. |
| `DisquePresquePlein` | avertissement | Moins de 10 % d'espace libre. | `df -h`, `docker system df`. Libérer : `docker image prune -a` (anciennes images), anciennes sauvegardes. Un disque plein arrête PostgreSQL. |
| `PoolPostgresSature` | avertissement | Des requêtes attendent une connexion à la base. | Requêtes lentes ou bloquées : `docker compose exec db psql -U sinistreflow -c "SELECT pid, state, now() - query_start AS duree, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' ORDER BY duree DESC;"` |

Après chaque incident : rédiger un post-mortem sans recherche de coupable dans `docs/JOURNAL.md`
(chronologie, temps de détection, temps de résolution, actions d'amélioration).

## 7. Secrets

| Secret | Où il vit | Comment le changer |
|--------|-----------|--------------------|
| `DB_PASSWORD` | `.env` de la VM | `ALTER USER sinistreflow PASSWORD '...'` dans psql, puis mettre à jour `.env` et relancer la stack |
| `BACKOFFICE_PASSWORD` | `.env` de la VM | modifier `.env`, puis `docker compose up -d app` |
| `GRAFANA_ADMIN_PASSWORD` | `.env` de la VM | lu au premier démarrage seulement ; ensuite, le changer dans Grafana |
| `EXPERTAUTO_API_KEY` | `.env` de la VM, secrets GitHub | clé du partenaire : changement à coordonner avec ExpertAuto, nouveau hachage dans la table `partners` |
| URL du webhook Discord | `monitoring/alertmanager/secrets/` | recréer le webhook, remplacer le fichier, relancer Alertmanager |
| Secrets de la CI | GitHub, *Settings → Secrets and variables → Actions* | remplacer la valeur dans GitHub |

Aucun secret n'est commité. Ceux d'avant le ticket SF-204 sont dans l'historique Git et sont
considérés comme compromis.

## 8. Commandes utiles

```bash
docker compose ps                         # état des conteneurs
docker compose logs -f app                # journaux de l'application
docker compose run --rm migrate           # jouer les migrations à la main
docker compose exec db psql -U sinistreflow
bash deploy/run-connector.sh              # lancer le connecteur ExpertAuto
sudo ufw status verbose                   # règles du pare-feu
sudo nginx -t && sudo systemctl reload nginx
```
