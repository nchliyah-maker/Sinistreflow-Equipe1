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
