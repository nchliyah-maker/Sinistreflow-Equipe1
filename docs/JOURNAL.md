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
  l'utilisateur sinistreflow". En fait j'avais déjà PostgreSQL installé sur Windows qui prenait le port 5432, donc l'appli se connectait à lui
  et pas à la base Docker. J'ai arrêté les deux services Windows et redémarré le
  conteneur db, après ça la migration est passée.
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

- Mon premier test pour SF-107 était rouge pour une mauvaise raison : j'avais écrit
  res.body.dossiers alors que le champ s'appelle data, donc le test plantait sur
  une erreur JavaScript et pas sur le bug. Je retiens qu'il faut lire le message
  d'échec avant de corriger.
- Après un correctif, l'application lancée avec npm start tournait encore avec
  l'ancien code. Il faut l'arrêter et la relancer pour voir le changement.
- Les tests d'intégration et le connecteur modifient la vraie base locale. Les
  tests qui créent des dossiers les suppriment à la fin pour garder 425 dossiers.
- Jest prenait aussi les fichiers du dossier tests/e2e. Réglé dans package.json
  pour que Jest et Playwright aient chacun leurs tests.
- Les branches des derniers tickets étaient empilées les unes sur les autres, il a
  fallu fusionner les PR dans l'ordre.
- J'avais oublié la description de la PR de SF-114, je l'ai ajoutée après la fusion.

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
