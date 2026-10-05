# Connecteur ExpertAuto ⇄ SinistreFlow

> ⚠️ **Code propriété d'ExpertAuto SAS — NE PAS MODIFIER.**
> Ce connecteur est fourni par notre partenaire et tourne sur le serveur de MutuAlp.
> MutuAlp n'a pas le droit de le modifier (contrat d'interconnexion EA-MA-2023-07).
> Si le connecteur échoue, c'est **SinistreFlow** qui doit être corrigé, pas le connecteur.

## Ce que fait le connecteur

| Étape | Appel | Version d'API |
|-------|-------|---------------|
| 1 | `GET /health` | – |
| 2 | `GET /api/v1/claims?statut=EXPERTISE_EN_COURS&page=1&limit=50` | **v1** |
| 3 | `GET /api/v2/claims/{reference}` | **v2** |
| 4 | `POST /api/v2/claims/{reference}/expertise` | **v2** |
| 5 | `GET /api/v3/claims/{reference}` puis `GET /api/v1/claims/{reference}` | **v3** + **v1** |

Authentification : en-tête HTTP `X-API-Key`.

## Lancer le connecteur

Python 3.8+ suffit (aucune dépendance).

```bash
export SINISTREFLOW_URL=http://localhost:3000
export EXPERTAUTO_API_KEY=<clé fournie par MutuAlp>
python3 expertauto_sync.py
echo "code retour : $?"      # 0 = conforme, 1 = non conforme
```

Option : `EXPERTAUTO_REPORT=rapport.json` écrit le rapport de contrôle au format JSON.

## Important

Chaque exécution réussie **consomme** un dossier en attente d'expertise
(il passe en `EXPERTISE_TERMINEE`). La base de production en contient 14 (dont 10 dossiers auto).
Pour rejouer à l'infini, restaurez la base (voir `db/README.md`).
