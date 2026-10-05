# API partenaires SinistreFlow

Authentification : en-tête HTTP `X-API-Key: <clé du partenaire>` (une clé par partenaire, table `partners`).

## Qui utilise quoi ? (recensement du 12/09/2026, source : logs nginx de la prod)

| Consommateur | Type | v1 | v2 | v3 | Peut-on modifier son code ? |
|--------------|------|----|----|----|-----------------------------|
| **ExpertAuto** (cabinet d'expertise auto) | partenaire externe | `GET /claims` (liste) · `GET /claims/{ref}` | `GET /claims/{ref}` · `POST /claims/{ref}/expertise` | `GET /claims/{ref}` | ❌ Non — contrat EA-MA-2023-07, demande de changement : 6 mois |
| **Application mobile MutuAlp** | interne (équipe mobile) | – | `GET /claims/{ref}` | – | ⚠️ Oui, mais publication sur les stores + adoption ≈ 3 mois |
| **AssurCompare** (comparateur) | partenaire externe | `GET /claims/{ref}` (lecture) | – | – | ❌ Non |
| Back-office SinistreFlow | interne | – | – | via `/api/internal` | ✅ Oui |

## Statuts

| Base de données / v1 / v2 | v3 |
|---------------------------|----|
| `DECLARE` | `DECLARED` |
| `EN_INSTRUCTION` | `UNDER_REVIEW` |
| `EXPERTISE_EN_COURS` | `ASSESSMENT_PENDING` |
| `EXPERTISE_TERMINEE` | `ASSESSMENT_DONE` |
| `ACCEPTE` | `ACCEPTED` |
| `REFUSE` | `REJECTED` |
| `INDEMNISE` | `PAID` |
| `CLOS` | `CLOSED` |

---

## v1 (2021) — format historique

`GET /api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=20` (page commence à **1**, limit ≤ 100)

```json
{
  "data": [
    {
      "id": 432,
      "reference": "SIN-2026-000432",
      "numero_contrat": "MA-AUTO-001037",
      "type_sinistre": "AUTO_COLLISION",
      "date_sinistre": "2026-08-30",
      "statut": "EXPERTISE_EN_COURS",
      "description": "Collision au carrefour...",
      "montant_estime": 1250.5,
      "immatriculation": "AB-123-CD"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 14
}
```

`GET /api/v1/claims/{reference}` → un objet au même format que les éléments de `data`.

Montants en **euros** (nombre décimal). Dates au format `AAAA-MM-JJ`.

---

## v2 (2023)

`GET /api/v2/claims/{reference}`

```json
{
  "reference": "SIN-2026-000432",
  "contractNumber": "MA-AUTO-001037",
  "type": "AUTO_COLLISION",
  "incidentDate": "2026-08-30",
  "incidentLocation": "rue Victor Hugo, Grenoble",
  "status": "EXPERTISE_EN_COURS",
  "description": "Collision au carrefour...",
  "estimatedAmountCents": 125050,
  "indemnityCents": null,
  "vehiclePlate": "AB-123-CD",
  "lateDeclaration": false,
  "thirdParty": { "involved": true, "name": "Jean Martin", "insurer": "MAAF" }
}
```

`POST /api/v2/claims/{reference}/expertise` — dépôt du rapport d'expertise
(dossier au statut `EXPERTISE_EN_COURS` uniquement)

```json
{
  "expertName": "Cabinet ExpertAuto - J. Morel",
  "appointmentDate": "2026-10-02",
  "assessedAmountCents": 112545,
  "conclusion": "Dommages conformes à la déclaration."
}
```

Réponse `201` : le dossier au format v2, statut `EXPERTISE_TERMINEE`, `indemnityCents` calculé
(= montant expertisé − franchise du contrat, jamais négatif).

Montants en **centimes** (entiers JSON).

---

## v3 (2025)

`GET /api/v3/claims?status=ASSESSMENT_PENDING&page=1&limit=20`

```json
{
  "items": [
    {
      "reference": "SIN-2026-000432",
      "status": "ASSESSMENT_PENDING",
      "contract": { "number": "MA-AUTO-001037", "product": "AUTO" },
      "incident": { "type": "AUTO_COLLISION", "date": "2026-08-30" },
      "declaredAt": "2026-09-03T08:12:44.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 14 }
}
```

`GET /api/v3/claims/{reference}`

```json
{
  "reference": "SIN-2026-000432",
  "status": "ASSESSMENT_DONE",
  "declaredAt": "2026-09-03T08:12:44.000Z",
  "lateDeclaration": false,
  "contract": { "number": "MA-AUTO-001037", "product": "AUTO", "deductibleCents": 15000 },
  "incident": { "type": "AUTO_COLLISION", "date": "2026-08-30", "location": "...", "description": "...", "complaintNumber": null },
  "vehicle": { "plate": "AB-123-CD", "brand": "Renault", "model": "Clio" },
  "thirdParty": { "involved": true, "name": "Jean Martin", "insurer": "MAAF" },
  "amounts": { "estimatedCents": 125050, "assessedCents": 112545, "indemnityCents": 97545 },
  "expertise": { "expert": { "name": "Cabinet ExpertAuto - J. Morel" }, "appointmentDate": "2026-10-02", "conclusion": "..." },
  "history": [
    { "from": null, "to": "DECLARED", "at": "2026-09-03T08:12:44.000Z", "by": "assure" },
    { "from": "ASSESSMENT_PENDING", "to": "ASSESSMENT_DONE", "at": "2026-10-04T10:00:00.000Z", "by": "partenaire:ExpertAuto" }
  ]
}
```

`POST /api/v3/claims/{reference}/expertise`

```json
{ "expert": { "name": "..." }, "appointmentDate": "2026-10-02", "assessedCents": 112545, "conclusion": "..." }
```

---

## Codes de retour attendus (toutes versions)

| Situation | Code |
|-----------|------|
| OK | `200` / `201` |
| Données invalides | `400` + `{ "error": "...", "details": [...] }` |
| Clé API absente ou invalide | `401` |
| Dossier inconnu | `404` |
| Transition de statut interdite | `409` |
| Erreur serveur | `500` (sans détail technique) |
