# Architecture SinistreFlow

*(document rédigé en 2024, partiellement à jour)*

## Composants

```
 Assuré (navigateur) ──► public/index.html ──┐
 Gestionnaire ─────────► public/backoffice.html ─┤
                                                 ▼
                                   ┌──────────────────────────┐
 ExpertAuto ───► /api/v1 + v2 + v3 │                          │
 Appli mobile ─► /api/v2           │  SinistreFlow (Node.js / │──► PostgreSQL 16
 AssurCompare ─► /api/v1           │  Express)  port 3000     │
   (en-tête X-API-Key)             │                          │
                                   └──────────────────────────┘
```

Une seule application Node.js sert le front statique, l'API publique (formulaire), l'API interne
(back-office, authentification HTTP Basic) et l'API partenaires versionnée.

## Couches du code

```
api/ (HTTP, sérialisation par version)  →  services/ (orchestration)  →  domain/ (règles pures)
                                                    ↓
                                          repositories/ (SQL)  →  PostgreSQL
```

`domain/` ne dépend de rien (ni Express ni base) : c'est la partie à tester en **unitaire**.

## Modèle de données (après migration 10)

```
policyholders 1──n contracts 1──n claims 1──1 vehicles        (depuis migration 8)
                                    │  1──1 expertises ──n..1 partners (migration 10)
                                    └─ 1──n claim_status_history
```

- `contracts.franchise_eur` : franchise **en euros** (héritée de l'outil de souscription).
- `claims.estimated_amount_cents`, `claims.indemnity_cents`, `expertises.assessed_amount_cents` :
  montants en **centimes** (`BIGINT`).
- `claims.incident_date`, `expertises.appointment_date` : type SQL `DATE` (sans heure ni fuseau).
- `claims.immatriculation` : **obsolète** depuis la migration 8 (voir commentaire SQL de la colonne).
- `claims.reference` : `SIN-<année>-<numéro sur 6 chiffres>`. Le numéro est unique toutes années
  confondues (index `uq_claims_reference_number`) ; séquence `claim_reference_seq` (migration 6).

## Cycle de vie d'un dossier

```
DECLARE ──► EN_INSTRUCTION ──► EXPERTISE_EN_COURS ──► EXPERTISE_TERMINEE ──► ACCEPTE ──► INDEMNISE ──► CLOS
   │              │                                          │
   └──────────────┴──────────────► REFUSE ◄─────────────────┘
                                      │
                                      └──► CLOS
```

Règle métier (Service Indemnisation, 2022) : **seul un dossier accepté peut être indemnisé**.
Un dossier refusé ne peut qu'être clos.

## Règles de déclaration

- Délai de déclaration : **5 jours** après le sinistre, **2 jours** pour un vol / cambriolage
  (au-delà, le dossier est marqué `late_declaration`, il n'est pas refusé).
- Vol / cambriolage : numéro de dépôt de plainte obligatoire.
- Auto : immatriculation obligatoire au format `AA-123-AA`.

## Ce qui n'existe pas (encore)

- Intégration continue, tests automatisés (à part 2 fichiers de 2022)
- Supervision, métriques, alerting, logs centralisés
- Procédure de déploiement écrite
