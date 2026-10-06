
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
| SF-101 | oui         | connecteur ExpertAuto : "Clé API manquante" alors que la clé est envoyée | src/api/middlewares/ (fonction apiKeyAuth) |
| SF-114 | oui         | même appel : HTTP 500 au lieu de 401, avec la stack trace dans la réponse | à chercher                                |
| SF-102 | pas encore  |                                                                             |                                            |
| SF-103 | pas encore  |                                                                             |                                            |
| SF-104 | pas encore  |                                                                             |                                            |
| SF-105 | pas encore  |                                                                             |                                            |
| SF-106 | pas encore  |                                                                             |                                            |
| SF-107 | pas encore  |                                                                             |                                            |
| SF-108 | pas encore  |                                                                             |                                            |
| SF-109 | pas encore  |                                                                             |                                            |
| SF-110 | pas encore  |                                                                             |                                            |
| SF-111 | pas encore  |                                                                             |                                            |
| SF-112 | pas encore  |                                                                             |                                            |
| SF-113 | pas encore  |                                                                             |                                            |
| SF-115 | pas encore  |                                                                             |                                            |
| SF-301 | pas encore  |                                                                             |                                            |
| SF-201 | pas encore  |                                                                             |                                            |
| SF-202 | pas encore  |                                                                             |                                            |
| SF-203 | pas encore  |                                                                             |                                            |
| SF-204 | pas encore  |                                                                             |                                            |
| SF-205 | pas encore  |                                                                             |                                            |
| SF-206 | pas encore  |                                                                             |                                            |
