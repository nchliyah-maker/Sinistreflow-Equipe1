# Journal de bord - SinistreFlow équipe 1

## Équipe

- Nihad Chliyah (compte nchliyah-maker) : je fais le TP seule, donc je m'occupe de tout
  (corrections, tests, CI, déploiement, supervision).
- Mon deuxième compte nihadchliyah me sert à relire et approuver mes PR,
  vu que main demande une approbation.
- Formateur : Tom (tomDeprez), invité sur le dépôt. Je n'ai pas pu le mettre Admin,
  sur un dépôt perso GitHub propose seulement "Collaborator".

## Jour 1 - lundi 05/10/2026

### Ce que je veux faire aujourd'hui

- Finir la mission 0 : lancer l'appli avec le dump de prod
- Lancer le connecteur ExpertAuto et noter ici son erreur (état zéro)
- Commencer la cartographie
- Attaquer les premiers tickets

### Ce que j'ai fait

- Création du dépôt privé et push du code de départ
- Protection de main (PR obligatoire + 1 approbation). J'ai testé un push direct
  sur main, il est bien refusé.
- Première PR (ce journal) relue avec mon deuxième compte puis fusionnée.
- Lancement de la stack : npm install, base dans Docker, restauration du dump
  (migrations 1 à 9), puis npm run migrate pour la migration 10.
- L'appli tourne sur http://localhost:3000, /health répond UP et il y a bien
  425 dossiers dans la table claims.
- Connexion au back-office avec les identifiants trouvés dans le .env.
- Lancement du connecteur ExpertAuto : il échoue (voir état zéro ci-dessous).

### État zéro du connecteur ExpertAuto

Sortie du connecteur avant toute correction :

```
ExpertAuto - connecteur SinistreFlow v2.6.1
Cible : http://localhost:3000  |  05/10/2026 16:08:25

[1/5] Disponibilité de SinistreFlow
   OK   GET /health répond 200
   OK   statut applicatif UP

[2/5] Dossiers en attente d'expertise (API v1)
   KO   GET /api/v1/claims répond 200 (HTTP 500 {"error": "Clé API manquante", "stack": "UnauthorizedError: Clé API manquante\n    at apiKeyAuth (C:\\Users\\chliy\\Sinistreflow-Equipe1\\src\\api\\middlewares\...)

SYNCHRONISATION NON CONFORME : 1 contrôle(s) en échec sur 3
Merci de contacter le support MutuAlp avant toute nouvelle tentative.
code retour : 1
```

Ce que j'en retiens :

- Le connecteur s'arrête à l'étape 2 sur 5. Il envoie la clé API mais l'appli répond
  "Clé API manquante" : c'est le ticket SF-101.
- L'erreur sort en 500 alors que ça devrait être une 401, et on voit la stack trace
  avec les chemins de mon PC dans la réponse : c'est le ticket SF-114.
- Seulement 3 contrôles faits sur 25, donc il y a sûrement d'autres bugs derrière.

### Ce qui m'a bloquée

- J'avais créé le dépôt sur mon compte gratuit, mais on ne peut pas protéger une
  branche sur un dépôt privé sans compte payant. J'ai dû recréer le dépôt sur un
  compte Pro, ça m'a fait perdre du temps.
- npm run migrate échouait avec "authentification par mot de passe échouée pour
  l'utilisateur sinistreflow". Le message était en français alors que l'image
  Docker de PostgreSQL répond en anglais : j'avais déjà PostgreSQL installé sur
  Windows, qui occupait le port 5432. L'appli se connectait donc à lui et pas à la
  base Docker. J'ai arrêté les services Windows et redémarré le conteneur db, après
  ça la migration est passée.
- npm install annonce 28 vulnérabilités "high". Je n'ai pas lancé npm audit fix
  pour ne pas modifier les dépendances en dehors d'un ticket.

### Indices ouverts

- Aucun pour l'instant

## Jour 2 - mardi 06/10/2026

### Ce que je voulais faire aujourd'hui

- Finir la mission 0 (cartographie) et corriger tout le lot A
- Faire la mission 2 : ADR sur le versioning de l'API puis correctif SF-109
- Corriger le ticket du lot B (SF-301)
- Voir le connecteur ExpertAuto passer au vert en local

### Ce qui a été fait

Mission 0 terminée : cartographie et état zéro du connecteur fusionnés (PR 2).

Tickets corrigés, chacun sur sa branche, avec son test dans le même commit et une PR :

- SF-114 : le gestionnaire d'erreurs lisait err.statusCode alors que nos erreurs
  portent err.status, donc tout sortait en 500. La stack trace partait aussi dans
  la réponse. Fait en premier parce qu'il faussait tous les codes d'erreur.
- SF-101 : le code cherchait l'en-tête "X-API-Key" avec des majuscules alors que
  Node range les noms d'en-têtes en minuscules.
- SF-107 : offset de pagination calculé avec page * limit au lieu de
  (page - 1) * limit. La page 1 sautait déjà une page entière.
- SF-102 : parseIsoDate donnait le mois tel quel à new Date(), alors que JavaScript
  compte les mois à partir de 0. Toutes les dates avaient un mois d'avance.
- SF-103 : daysBetween renvoyait des heures et pas des jours.
- SF-104 : référence de dossier calculée avec COUNT(*) + 1. La base a des trous
  (425 dossiers mais numéro maximum 460), donc le numéro existait déjà. Remplacé
  par la séquence claim_reference_seq de la migration 6, que Thomas n'avait jamais
  branchée (son commentaire TODO est dans la migration).
- SF-105 : le workflow autorisait REFUSE vers INDEMNISE et le test de 2022 validait
  ce bug. Le test est corrigé, pas supprimé.
- SF-106 : franchise en euros soustraite à un montant en centimes, sans plancher à 0.
- SF-108 : la recherche du back-office collait le texte dans la requête SQL.
  Requête paramétrée.
- SF-110 : PostgreSQL renvoie les BIGINT en texte. Réglé dans src/db/pool.js.
- SF-111 : formatDate passait par toISOString(), donc par l'UTC. Minuit à Paris
  devenait la veille. C'est pour ça que ça ne se reproduisait pas sur une machine
  en UTC.
- SF-112 : email comparé en tenant compte des majuscules. 23 assurés sur 90 ont
  des majuscules dans leur email en base.
- SF-113 : parseFloat s'arrête à l'espace et à la virgule, et 19.99 * 100 fait
  1998,99... en JavaScript.
- SF-115 : /health répondait UP sans interroger la base. Il fait maintenant un
  SELECT 1 et répond 503 si la base ne répond pas.
- SF-301 : dans wizard.js le formulaire envoyait state.complaint_number alors que
  le champ s'appelle complaintNumber. Premier test Playwright du projet.

Mission 2 :

- ADR 0001 (SF-603) fusionnée sur main avant le correctif. Décision : on garde les
  trois versions de l'API, branchées sur vehicles.plate_number. Chiffres tirés du
  dump : 90 dossiers sans plaque en v1 et v2, tous déclarés depuis le 13/03/2025.
- SF-109 corrigé en suivant l'ADR, avec un test de contrat par version (v1, v2, v3)
  et un test de cohérence entre les trois.

Tests à la fin de la journée : 71 tests Jest (unitaires et intégration) et 1 test
end-to-end Playwright, tous verts.

### Progression du connecteur ExpertAuto

| Moment | Résultat |
|---|---|
| État zéro (jour 1) | 1 échec sur 3 contrôles, arrêt à l'étape 2 |
| Après SF-101 | 1 échec sur 4 : "0 dossier reçu, total annoncé : 13" |
| Après SF-107 | 4 échecs sur 13 : plaque absente, montant en texte, date "dans le futur" |
| Fin du jour 2 | SYNCHRONISATION CONFORME : 25/25 contrôles OK, code retour 0 |

Chaque exécution réussie du connecteur fait passer un dossier en EXPERTISE_TERMINEE.
Le dossier SIN-2026-000450 a été remis dans son état d'origine après la vérification.

### Ce qui m'a bloquée

- Les tests d'intégration et le connecteur modifient la vraie base locale. Les
  tests qui créent des dossiers les suppriment à la fin pour garder 425 dossiers.
- Jest prenait aussi les fichiers du dossier tests/e2e. Réglé dans package.json
  pour que Jest et Playwright aient chacun leurs tests.
- Les branches des derniers tickets étaient empilées les unes sur les autres, il a
  fallu fusionner les PR dans l'ordre.

### Indices ouverts

- Aucun indice du sujet ouvert.

### À revoir plus tard

- Limite de mon correctif SF-114 : pour une vraie erreur 500 (panne imprévue,
  erreur SQL), la réponse contient encore err.message, qui peut être un message
  technique. On le voit dans le ticket SF-108 : le client reçoit
  `syntax error at or near "Almeida"`. Or docs/API.md dit qu'une erreur serveur
  doit répondre « 500 (sans détail technique) ».
- Le ticket SF-114 ne demande que le bon code HTTP et la suppression de la stack
  trace, donc je laisse le correctif comme ça pour l'instant.
- À faire quand les tickets bloquants seront passés : dans errorHandler.js,
  remplacer le message par un texte générique quand le code est 500, avec un test
  qui vérifie que le message technique ne sort plus.

## Jour 3 - mercredi 07/10/2026

### Ce que je voulais faire aujourd'hui

- Finir le lot C (conteneurs) et les trois commits de tests
- Avoir le pipeline GitHub Actions vert sur main, avec le connecteur ExpertAuto
- Mettre en place la supervision et les scripts de déploiement
- Déployer sur une VM et faire le test de panne

### Ce qui a été fait

Lot C (commencé la veille au soir), chaque ticket avec son test :

- SF-201 : l'application n'écoutait que sur localhost, donc invisible depuis l'extérieur
  du conteneur. Elle écoute sur 0.0.0.0.
- SF-203 : migrations triées par ordre alphabétique, 10 passait avant 2. Tri par numéro.
  Le test applique les 10 migrations sur une base vide créée pour l'occasion.
- SF-202 : DB_HOST=db, healthcheck pg_isready, ports liés à 127.0.0.1.
- SF-206 : service migrate qui joue les migrations avant le démarrage de l'application.
- SF-205 : image passée de 1,74 Go à 248 Mo, utilisateur node, .dockerignore.
- SF-204 : .env retiré du dépôt, .env.example, plus aucun mot de passe par défaut dans le
  code. Les anciens secrets restent dans l'historique Git (pas de push forcé sur main) :
  ils sont considérés comme compromis, la VM utilise des secrets neufs.

Tests (SF-401, 402, 403) : 174 tests unitaires avec 100 % de couverture des lignes du
domaine, 160 tests d'intégration sur le dump restauré, 13 scénarios Playwright.

CI (SF-404, 405) : pipeline commits, unit, integration, e2e, partner, puis docker sur main.
Le job partner lance le connecteur ExpertAuto non modifié contre l'image construite :
25/25 dans GitHub Actions. L'image est publiée sur GHCR avec le SHA du commit.

Supervision (SF-501 à 504) : /metrics, journaux JSON, Prometheus, Grafana provisionné par
fichiers, 7 règles d'alerte, Alertmanager.

Déploiement (SF-601, 602, 604) : scripts de provisionnement et de déploiement avec retour
arrière, nginx, sauvegarde quotidienne, runbook.

VM : Ubuntu 24.04 LTS créée avec Vagrant dans VirtualBox (2 vCPU, 4 Go), décrite dans
deploy/vm/Vagrantfile. Provisionnement, déploiement et connecteur lancés sur la VM :
SYNCHRONISATION CONFORME, 25/25 contrôles OK. Preuves dans docs/preuves/.

La note "À revoir plus tard" du jour 2 est traitée : une erreur 500 répond maintenant
"Erreur interne du serveur", le détail va dans les journaux (SF-504).

### Ce qui m'a bloquée

- Le pipeline a échoué à sa première exécution. Un test Playwright cliquait sur la liste
  du back-office avant qu'elle soit rafraîchie : ça passait sur mon PC et pas sur la
  machine de GitHub, plus rapide. Le test attend maintenant la réponse du serveur.
- Un test qui interroge Docker était rangé dans les tests unitaires, qui tournent sans
  fichier .env dans la CI. Déplacé dans les tests d'intégration.
- Lancés en parallèle, les tests d'intégration se gênaient sur la base partagée (deux
  fichiers créaient des dossiers en même temps). Ils tournent en série.
- Mon fichier .env local a disparu après un git pull, puisque le commit SF-204 le supprime
  du dépôt. Il faut le recréer à partir de .env.example.
- Sur la VM, la connexion SSH par mot de passe restait active après le provisionnement :
  le fichier 50-cloud-init.conf d'Ubuntu la réactive et passait avant le mien (sshd garde
  la première valeur lue). Mon fichier s'appelle maintenant 00-sinistreflow.conf et le
  script vérifie le résultat avec sshd -T.
- L'image GHCR est privée : sans jeton sur la VM, docker pull est refusé. L'image a été
  construite sur la VM à partir du même commit, puis déployée par deploy.sh. Le dépôt
  étant passé en public, j'ai ensuite rendu le paquet public lui aussi (le dépôt et le
  paquet ont chacun leur réglage de visibilité) : à 14:04, deploy.sh a téléchargé l'image
  du commit 8673615 publiée par le pipeline, en 5 secondes, et le connecteur est resté à
  25/25. Preuve dans docs/preuves/vm-deploiement-image-ghcr.txt.
- Pas assez de mémoire pour faire tourner Docker Desktop et la VM en même temps : il faut
  arrêter Docker sur le PC pendant qu'on travaille sur la VM.
- Le webhook Discord n'existait pas pendant le premier test de panne : les alertes
  s'arrêtaient à Alertmanager. Je l'ai créé ensuite et j'ai rejoué le scénario 1 (voir
  plus bas).
- Le fichier du webhook, créé avec nano sous le compte deploy, n'était lisible que par
  deploy : Alertmanager, qui tourne sous un autre compte dans son conteneur, n'aurait pas
  pu le lire. Il faut un chmod 644, comme l'indique le runbook.

### Test de panne (game day) sur la VM

Détails, chronologies complètes et captures dans docs/preuves/ (fichiers gameday-*).
Les heures sont celles de la VM (UTC).

#### Scénario 1 : panne de la base (docker compose stop db)

| Moment | Événement |
|---|---|
| 10:35:51 | arrêt de PostgreSQL |
| + 7 s | /health répond 503 |
| + 22 s | alertes BaseDeDonneesInjoignable et SanteEnEchec en attente (pending) |
| + 80 s | alertes déclenchées (firing) et reçues par Alertmanager |
| 10:38:33 | redémarrage de PostgreSQL |
| + 5 s | /health répond 200, sans redémarrer l'application |
| + 21 s | alertes résolues |

- Temps de détection : 80 secondes. Temps de retour à la normale : 5 secondes.
- Sur Grafana pendant la panne : base et sonde "EN PANNE", 52 % d'erreurs 5xx, latence
  p95 à 2,4 s.
- SanteEnEchec est masquée par BaseDeDonneesInjoignable dans Alertmanager : une seule
  notification au lieu de deux pour la même cause.
- Ce que le test a révélé, et qui est corrigé :
  1. en répétition sur mon PC, l'application s'arrêtait avec la base (événement "error"
     du pool de connexions non géré). Elle reste debout et se reconnecte seule ;
  2. sur la VM, /health ne répondait pas pendant la panne, la connexion à la base restait
     en attente. /health est limité à 2 secondes et répond 503.
- À améliorer : la durée "for" d'une minute pourrait descendre à 30 secondes pour les
  alertes critiques.

Scénario rejoué à 13:37 avec la notification Discord branchée (panne de 3 min 37 s) :

| Moment | Événement |
|---|---|
| 13:37:38 | arrêt de PostgreSQL |
| + 7 s | /health répond 503 |
| + 78 s | BaseDeDonneesInjoignable déclenchée, notification envoyée à Discord |
| 13:41:15 | redémarrage de PostgreSQL |
| + 5 s | /health répond 200 |
| + 26 s | alertes résolues, notification de résolution |
| 13:43:16 | TauxErreurs5xxEleve et LatenceP95Elevee se déclenchent, deux minutes après la reprise |
| 13:46:26 | plus aucune alerte |

- Alertmanager a envoyé 6 notifications à Discord, aucune en échec (compteurs
  alertmanager_notifications_total et alertmanager_notifications_failed_total).
- Ce que ce deuxième passage a révélé : les deux alertes de qualité de service arrivent
  en retard. Elles calculent sur 5 minutes et attendent 5 minutes : avec une panne de plus
  de 3 minutes, elles préviennent alors que tout est déjà reparti. Au premier passage, la
  panne était plus courte et elles ne s'étaient pas déclenchées.
- Non corrigé, à améliorer : raccourcir leur fenêtre et leur durée "for", et les masquer
  quand BaseDeDonneesInjoignable est active ou vient d'être résolue.

#### Scénario 2 : pluie d'erreurs (200 appels avec une mauvaise clé API)

- 200 appels en 17 secondes depuis le PC, à travers nginx : 200 réponses 401.
- Le compteur sinistreflow_http_requests_total{status="401"} passe de 0 à 200. Le panneau
  "Requêtes par seconde, par code HTTP" montre la courbe des 401, et chaque refus est
  dans les journaux ("requête refusée", sans la clé envoyée).
- Aucune alerte ne se déclenche : les règles surveillent les erreurs 5xx, et un 401 est
  une erreur du client. Le taux de 5xx reste à 0 %.
- À améliorer : ajouter une alerte sur le taux de 401 (clé partenaire périmée ou tentative
  d'intrusion) et limiter le débit par adresse dans nginx.

#### Scénario 3 : mauvaise livraison

- Déploiement volontaire d'une image dont la commande de démarrage échoue.
- deploy.sh détecte l'application "unhealthy" au bout de 23 secondes, revient seul à
  l'image précédente et sort en erreur. Durée totale : 42 secondes. /health répond 200.
- L'échec et le retour arrière sont tracés dans .deploy/historique.log.
- Les migrations ne sont pas annulées par le retour arrière : elles doivent rester
  compatibles avec la version précédente du code (voir le runbook).
- À améliorer : rejouer le scénario avec une vraie image tirée de GHCR.

### Où on en est sur les métriques DORA

| Métrique | Au départ | Mesuré |
|---|---|---|
| Fréquence de déploiement | "quand Thomas avait le temps" | une image publiée à chaque fusion sur main ; déploiement sur la VM par deploy.sh |
| Délai de mise en production | des semaines | pipeline de 3 minutes environ, puis 25 secondes de déploiement |
| Taux d'échec des changements | inconnu | mesuré dans .deploy/historique.log : 1 échec (volontaire) sur 4 livraisons |
| Temps de restauration | inconnu | 80 secondes pour être prévenue, 42 secondes pour un retour arrière |

### Indices ouverts

- Aucun indice du sujet ouvert.
