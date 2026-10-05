# Tickets ouverts — SinistreFlow

> Export de l'outil de support au 01/10/2026. Les descriptions sont celles des **utilisateurs** :
> elles décrivent des **symptômes**, pas des causes. Plusieurs tickets peuvent avoir la même origine,
> un bug peut en masquer un autre.
>
> **Le message de commit de chaque correction est imposé** (colonne « Commit attendu »).

## Lot A — Application et API

### SF-101 · Le connecteur ExpertAuto est refusé · 🔴 Bloquant
*Signalé par : DSI ExpertAuto*
> « Depuis la mise à jour de la semaine dernière, tous nos appels à vos API v1/v2/v3 échouent
> (erreur 500, message *Clé API manquante*). Nous envoyons pourtant bien l'en-tête `X-API-Key`
> avec la clé que vous nous avez transmise. »

**Commit attendu** : `fix(SF-101): lire l'en-tête X-API-Key sans tenir compte de la casse`

### SF-102 · « La date du sinistre ne peut pas être dans le futur » · 🔴 Bloquant
*Signalé par : Centre de relation client*
> « Plusieurs assurés nous appellent : impossible de déclarer un sinistre survenu hier ou avant-hier,
> le formulaire répond que la date est dans le futur. Les sinistres plus anciens passent. »
> ExpertAuto signale le même message sur la date de rendez-vous d'expertise.

**Commit attendu** : `fix(SF-102): corriger le mois dans parseIsoDate`

### SF-103 · Tous les dossiers sont « déclaration tardive » · 🟠 Majeur
*Signalé par : Service Sinistres*
> « Un dégât des eaux survenu la veille est signalé *déclaration tardive* (bandeau orange) alors
> que l'assuré a 5 jours pour déclarer (2 jours pour un vol). Ça fausse nos statistiques. »
> *(Peut n'apparaître qu'une fois SF-102 corrigé.)*

**Commit attendu** : `fix(SF-103): calculer le délai de déclaration en jours et non en heures`

### SF-104 · Erreur à l'envoi de la déclaration · 🔴 Bloquant
*Signalé par : Centre de relation client*
> « Plus AUCUNE déclaration en ligne n'aboutit depuis ce matin : à la dernière étape, message
> *duplicate key value violates unique constraint*. En recette (base vide) ça marchait. »

**Commit attendu** : `fix(SF-104): générer les références de dossier avec claim_reference_seq`

### SF-105 · Un dossier refusé a été indemnisé · 🟠 Majeur
*Signalé par : Audit interne*
> « Le dossier SIN-2024-000212 a été refusé (fausse déclaration) puis indemnisé 2 300 € par erreur.
> Le back-office propose le bouton *→ INDEMNISE* sur les dossiers refusés. Le test automatique
> de l'ancienne équipe valide pourtant ce comportement ?! »

**Commit attendu** : `fix(SF-105): interdire la transition REFUSE vers INDEMNISE`

### SF-106 · Montants d'indemnité aberrants · 🔴 Bloquant
*Signalé par : Service Indemnisation*
> « Expertise à 1 000 €, franchise du contrat 150 € : SinistreFlow calcule une indemnité de
> 998,50 € au lieu de 850 €. Et sur un bris de glace à 120 € avec 150 € de franchise, on obtient
> une indemnité **négative**. »

**Commit attendu** : `fix(SF-106): convertir la franchise en centimes et borner l'indemnité à zéro`

### SF-107 · Listes vides ou incomplètes · 🟠 Majeur
*Signalé par : Gestionnaires + ExpertAuto*
> « Dans le back-office, filtre *EXPERTISE_EN_COURS* : la liste est vide alors que le compteur
> annonce 14 dossiers. ExpertAuto ne reçoit plus aucun dossier à expertiser. Les dossiers les plus
> récents n'apparaissent jamais en page 1. »

**Commit attendu** : `fix(SF-107): corriger le calcul de l'offset de pagination`

### SF-108 · Recherche back-office : erreur 500 + alerte sécurité · 🔴 Bloquant (sécurité)
*Signalé par : Gestionnaires + RSSI*
> « Rechercher l'assurée *D'Almeida* provoque une erreur *syntax error at or near "Almeida"*. »
> RSSI : « Le pentest a obtenu la liste complète des dossiers avec la recherche `%' OR 1=1 --`. »

**Commit attendu** : `fix(SF-108): paramétrer la requête de recherche du back-office`

### SF-109 · Immatriculation absente dans l'API · 🔴 Bloquant (partenaire)
*Signalé par : DSI ExpertAuto*
> « Pour tous les dossiers récents, `immatriculation` (v1) et `vehiclePlate` (v2) valent `null`.
> Sans plaque, nos experts ne peuvent pas planifier les rendez-vous. Les vieux dossiers sont OK.
> En v3 la plaque est bien là. »
>
> **Commentaire du CTO** : « On supprime v1 et v2, tout le monde passe en v3, problème réglé. »

⚠️ Ticket d'architecture : la correction est accompagnée d'une **ADR** (voir sujet, mission 2).

**Commit attendu** : `fix(SF-109): remonter l'immatriculation depuis vehicles dans les API v1 et v2`

### SF-110 · Montants renvoyés sous forme de texte · 🟠 Majeur (partenaire)
*Signalé par : DSI ExpertAuto + équipe mobile*
> « En v2, `estimatedAmountCents` et `indemnityCents` arrivent en JSON sous la forme `"125050"`
> (chaîne) et non `125050` (nombre). Notre validation de schéma rejette la réponse. »

**Commit attendu** : `fix(SF-110): renvoyer les montants BIGINT en nombres entiers`

### SF-111 · Les dates reculent d'un jour · 🟠 Majeur
*Signalé par : ExpertAuto + Centre de relation client*
> « Nous déposons un rapport avec un rendez-vous le 02/10, la relecture du dossier affiche le 01/10.
> L'écran de confirmation du formulaire affiche aussi la veille de la date saisie. »
> *(Le développeur qui a testé sur la CI dit qu'il ne reproduit pas.)*

**Commit attendu** : `fix(SF-111): supprimer le décalage de fuseau horaire sur les dates`

### SF-112 · « Aucun contrat ne correspond » · 🟠 Majeur
*Signalé par : Centre de relation client*
> « Mme Camille Durand (contrat MA-AUTO-001001) ne peut pas s'identifier avec
> `camille.durand@example.test`, l'adresse figurant sur son contrat. Environ un quart des
> assurés seraient concernés. »

**Commit attendu** : `fix(SF-112): comparer l'email de l'assuré sans tenir compte de la casse`

### SF-113 · Montant estimé faux · 🟡 Mineur
*Signalé par : Gestionnaires*
> « L'assuré saisit `1 250,50` € et le dossier affiche 1,00 €. Pour `19.99` on obtient 19,98 €. »

**Commit attendu** : `fix(SF-113): accepter les montants saisis au format français`

### SF-114 · Erreurs 500 partout + fuite d'informations · 🟠 Majeur (sécurité)
*Signalé par : RSSI + ExpertAuto*
> « Toutes les erreurs remontent en HTTP 500, même un dossier inexistant ou une saisie invalide.
> Les réponses contiennent la stack trace complète (chemins du serveur, versions des librairies). »

**Commit attendu** : `fix(SF-114): renvoyer le bon code HTTP et masquer la stack trace`

### SF-115 · /health dit « UP » alors que tout est en panne · 🟡 Mineur
*Signalé par : Exploitation*
> « Lors de la panne PostgreSQL du 14/09, `/health` répondait `{"status":"UP"}` pendant que
> toutes les pages étaient en erreur. Le load-balancer n'a rien détecté. »

**Commit attendu** : `fix(SF-115): vérifier la base de données dans le endpoint /health`

## Lot B — Front

### SF-301 · Impossible de déclarer un vol ou un cambriolage · 🔴 Bloquant
*Signalé par : Centre de relation client*
> « Pour un cambriolage, le formulaire refuse l'envoi : *Le numéro de dépôt de plainte est
> obligatoire pour un vol*, alors que l'assuré l'a bien saisi. »

**Commit attendu** : `fix(SF-301): transmettre le numéro de plainte saisi dans le formulaire`

## Lot C — Conteneurs, configuration, déploiement

### SF-201 · Application injoignable dans Docker · 🔴 Bloquant
*Signalé par : Exploitation*
> « Conteneur `app` démarré, logs OK (*SinistreFlow démarré sur http://localhost:3000*), mais
> `curl http://localhost:3000` depuis l'hôte : *connection reset / empty reply*. »

**Commit attendu** : `fix(SF-201): écouter sur toutes les interfaces réseau`

### SF-202 · `docker compose up` : l'application ne trouve pas la base · 🔴 Bloquant
*Signalé par : Exploitation*
> « `connect ECONNREFUSED 127.0.0.1:5432` dans le conteneur `app`. Et au premier démarrage
> l'application démarre avant que PostgreSQL soit prêt. Au passage, l'audit réseau signale que
> PostgreSQL est joignable depuis l'extérieur. »

**Commit attendu** : `fix(SF-202): configurer l'hôte de la base et le healthcheck dans docker compose`

### SF-203 · Migrations impossibles sur une base neuve · 🟠 Majeur
*Signalé par : Équipe d'un nouvel environnement de recette*
> « `npm run migrate` sur une base vide : *Migration échouée : 10_partners_api_keys.sql : relation
> "expertises" does not exist*. Sur la base de prod ça passe. »

**Commit attendu** : `fix(SF-203): trier les migrations par numéro de version`

### SF-204 · Secrets dans le dépôt Git · 🔴 Bloquant (sécurité)
*Signalé par : RSSI*
> « Le mot de passe de la base de production, celui du back-office et la clé API d'ExpertAuto
> sont lisibles dans le dépôt (et dans tout l'historique Git). Des valeurs par défaut sont aussi
> codées en dur dans le code. »

**Commit attendu** : `fix(SF-204): retirer les secrets du dépôt`

### SF-205 · Image Docker de plus d'1 Go, exécutée en root · 🟡 Mineur
*Signalé par : RSSI + Exploitation*
> « L'image contient les dépendances de dev, le fichier `.env`, les tests, le dump de la base…
> et le process tourne en root. »

**Commit attendu** : `fix(SF-205): image Docker de production légère et sans root`

### SF-206 · Erreur 500 après chaque mise en production · 🔴 Bloquant
*Signalé par : Exploitation*
> « Après la dernière livraison : *relation "partners" does not exist*. Personne n'a lancé les
> migrations. Ça ne doit plus dépendre de la mémoire de quelqu'un. »

**Commit attendu** : `fix(SF-206): jouer les migrations à chaque déploiement`
