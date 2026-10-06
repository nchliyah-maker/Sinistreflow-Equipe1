
# Cartographie de SinistreFlow

## Qui appelle quoi

```
Assuré (navigateur) ───────► /  (formulaire) ───────► /api/public
Gestionnaire (navigateur) ─► /backoffice.html ──────► /api/internal  (login + mot de passe)

ExpertAuto ────► /api/v1 + /api/v2 + /api/v3   (en-tête X-API-Key)
Appli mobile ──► /api/v2
AssurCompare ──► /api/v1
Load-balancer ─► /health

Tout arrive sur la même appli Node.js / Express (port 3000) ──► PostgreSQL 16 (port 5432)
```

Dans le code : api/ (routes HTTP) → services/ → domain/ (règles métier) et repositories/ (SQL).

Ce que je retiens de docs/API.md :

- ExpertAuto utilise les 3 versions de l'API et ne peut pas modifier son code
  (contrat EA-MA-2023-07, 6 mois pour une demande de changement).
- AssurCompare utilise la v1 et ne peut pas modifier son code non plus.
- L'appli mobile utilise la v2, il faut environ 3 mois pour la faire évoluer.

## Tables de la base

Après restauration du dump et migration 10 :

| Table                | Lignes | Contenu                                          |
| -------------------- | ------ | ------------------------------------------------ |
| policyholders        | 90     | les assurés                                     |
| contracts            | 116    | les contrats (franchise en euros)                |
| claims               | 425    | les dossiers de sinistre (montants en centimes)  |
| vehicles             | 259    | le véhicule d'un dossier, depuis la migration 8 |
| expertises           | 346    | les rapports d'expertise                         |
| claim_status_history | 2540   | l'historique des changements de statut           |
| partners             | 1      | les partenaires et leur clé API (migration 10)  |
| schema_migrations    | 10     | les migrations déjà jouées                    |

## Reproduction des tickets

| Ticket | Reproduit ? | Comment je le reproduis                                                     | Fichier suspect                            |
| ------ | ----------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| SF-101 | oui | `curl -i -H "X-API-Key: <clé>" localhost:3000/api/v1/claims` : "Clé API manquante" | src/api/middlewares/apiKey.js |
| SF-102 | oui | `parseIsoDate('2026-10-05')` renvoie le 5 novembre | src/domain/dates.js |
| SF-103 | oui | `daysBetween` entre le 4 et le 5 octobre renvoie 24 | src/domain/dates.js |
| SF-104 | oui | envoi d'une déclaration : "duplicate key value violates unique constraint" | src/repositories/claimRepository.js (nextReference) |
| SF-105 | oui | back-office : bouton "→ INDEMNISE" proposé sur un dossier REFUSE (SIN-2024-000212) | src/domain/workflow.js |
| SF-106 | oui | `computeIndemnityCents(100000, 150)` renvoie 99850 au lieu de 85000 | src/domain/indemnity.js |
| SF-107 | oui | `/api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=20` : data vide, total 13 | src/repositories/claimRepository.js (list) |
| SF-108 | oui | recherche back-office `D'Almeida` : erreur 500 "syntax error at or near Almeida" | src/repositories/claimRepository.js (search) |
| SF-109 | oui | `/api/v1/claims/SIN-2026-000450` : immatriculation null (v2 : vehiclePlate null) | src/repositories/claimRepository.js, src/api/v1 et v2 |
| SF-110 | oui | `/api/v2/claims/SIN-2026-000450` : estimatedAmountCents vaut "254900" (texte) | src/db/pool.js |
| SF-111 | oui | même dossier : sinistre du 07/08/2026 en base, l'API renvoie 2026-08-06 | src/domain/dates.js (formatDate) |
| SF-112 | oui | `POST /api/public/contracts/verify` avec camille.durand@example.test : 404 | src/repositories/contractRepository.js |
| SF-113 | oui | `parseAmountToCents('1 250,50')` renvoie 100, `'19.99'` renvoie 1998 | src/domain/money.js |
| SF-114 | oui | `curl -i localhost:3000/api/v1/claims` sans clé : 500 avec la stack trace | src/api/middlewares/errorHandler.js |
| SF-115 | oui | `/health` répond UP sans interroger la base (vu dans le code) | src/api/health.js |
| SF-301 | oui | formulaire, cambriolage avec numéro de plainte saisi : "numéro de plainte obligatoire" | public/js/wizard.js |
| SF-201 | pas encore | vu au démarrage : "SinistreFlow démarré sur http://localhost:3000" | src/index.js |
| SF-202 | pas encore | vu avec `docker compose ps` : port 0.0.0.0:5432 ouvert | docker-compose.yml |
| SF-203 | pas encore | | |
| SF-204 | pas encore | le fichier .env avec ses mots de passe est dans le dépôt | .env, src/config.js |
| SF-205 | pas encore | | Dockerfile |
| SF-206 | pas encore | | |
