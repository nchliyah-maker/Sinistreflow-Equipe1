# ADR 0001 — Stratégie de versioning de l'API partenaires

- Statut : accepté
- Date : 06/10/2026
- Décideurs : équipe 1 (Nihad Chliyah)
- Ticket : SF-109 (immatriculation absente dans les API v1 et v2), SF-603

## Contexte

### Le symptôme

Pour les dossiers récents, `immatriculation` (v1) et `vehiclePlate` (v2) valent `null`.
En v3 la plaque est présente. ExpertAuto ne peut plus planifier ses rendez-vous d'expertise.

### La cause

En mars 2025, la migration 8 a sorti le véhicule de la table `claims` vers une nouvelle table
`vehicles` (`plate_number`). Elle a recopié l'existant et marqué la colonne
`claims.immatriculation` comme obsolète. Depuis, les nouveaux dossiers n'écrivent plus que dans
`vehicles`.

Seule la v3, écrite pour ce projet, lit la nouvelle table. Les v1 et v2 lisent toujours
l'ancienne colonne (`src/api/v1/claims.js` et `src/api/v2/claims.js` utilisaient
`claim.immatriculation`). La donnée a bougé, mais pas tout le code.

### Les chiffres (dump de production du 28/09/2026)

```sql
SELECT count(*) FILTER (WHERE v.plate_number IS NOT NULL)                               AS avec_vehicule,
       count(*) FILTER (WHERE v.plate_number IS NOT NULL AND c.immatriculation IS NULL) AS plaque_absente_v1_v2
FROM claims c LEFT JOIN vehicles v ON v.claim_id = c.id;
```

| Mesure | Valeur |
|---|---|
| Dossiers avec un véhicule | 259 |
| Dossiers dont la plaque est absente en v1 et v2 | 90 |
| Premier dossier touché | déclaré le 13/03/2025 |
| Dernier dossier correct | déclaré le 09/03/2025 |
| Dossiers où l'ancienne colonne et `vehicles` se contredisent | 0 |

Le bug dépend des données : sur une base vide ou ancienne il ne se voit pas. Il n'y avait aucun
test de contrat pour le détecter au moment de la migration.

### Qui consomme quoi (docs/API.md, recensement du 12/09/2026)

| Consommateur | Versions utilisées | Peut modifier son code ? |
|---|---|---|
| ExpertAuto | v1, v2 et v3 | Non. Contrat EA-MA-2023-07, 6 mois pour une demande de changement |
| Application mobile MutuAlp | v2 | Oui, mais environ 3 mois (publication sur les stores et adoption) |
| AssurCompare | v1 | Non |
| Back-office | API interne | Oui |

Le connecteur ExpertAuto (`partner-client/`) appelle les trois versions dans la même
synchronisation et compare leurs réponses entre elles. Nous n'avons pas le droit de le modifier.

## Options étudiées

### Option A — ne garder que la v3 (proposition du CTO)

- Avantages : un seul format à maintenir, le bug disparaît puisque la v3 est correcte.
- Inconvénients : supprimer une route est un changement cassant. ExpertAuto et AssurCompare
  reçoivent des 404 sur v1 et v2, l'application mobile ne fonctionne plus.
- Variante « rediriger v1 et v2 vers la v3 » : les routes répondent, mais avec un autre format
  (champs imbriqués, statuts en anglais, montants en centimes au lieu d'euros en v1). Les clients
  cassent quand même, de façon moins visible.
- Risque : le connecteur ExpertAuto reste en échec pendant au moins 6 mois, donc plus aucune
  expertise et plus aucune indemnisation. C'est la situation qu'on nous demande de résoudre.

### Option B — garder les trois versions, avec une lecture commune

- Les trois versions lisent la plaque au même endroit (`vehicles.plate_number`). Chaque version
  garde son propre format de sortie.
- Avantages : aucun consommateur n'est impacté, aucun changement de contrat, correctif petit et
  livrable tout de suite.
- Inconvénients : trois formats à maintenir et à tester à chaque évolution du schéma.

### Option C — réalimenter l'ancienne colonne `claims.immatriculation`

- Avantage : aucun changement dans le code des API.
- Inconvénients : la même donnée vit à deux endroits et peut diverger, on revient sur la décision
  de la migration 8, et le prochain champ déplacé posera le même problème.

## Décision

**Nous gardons les trois versions de l'API (option B) et nous les branchons sur une seule source
de vérité, `vehicles.plate_number`.**

Détail :

- La lecture utilisée par les v1 et v2 (`BASE_SELECT` dans `claimRepository.js`) joint désormais la
  table `vehicles`. Les v1 et v2 renvoient `plate_number` dans leurs champs historiques
  (`immatriculation`, `vehiclePlate`). Les formats de sortie ne changent pas.
- Chaque version servie a un test de contrat (liste exacte des champs et types), et un test de
  cohérence vérifie que les trois versions décrivent le même dossier de la même façon (plaque,
  date, montants).
- On ne retire aucune version tant qu'on n'a pas mesuré qu'elle n'a plus de trafic.

## Conséquences

- Coût : trois sérialisations à maintenir. Toute modification du schéma ou d'une requête doit
  faire passer les trois tests de contrat avant la fusion.
- La colonne `claims.immatriculation` n'est plus lue par aucune version. Elle reste en base pour
  l'instant : la supprimer dans la même livraison empêcherait un retour arrière vers l'ancienne
  version du code (stratégie expand / contract). Sa suppression fera l'objet d'une migration
  séparée, plus tard.
- Plan pour retirer un jour une version :
  1. mesurer l'usage par version et par partenaire (métrique prévue en mission 7) ;
  2. annoncer la dépréciation dans `docs/API.md` et par les en-têtes HTTP `Deprecation` et
     `Sunset` (RFC 8594) ;
  3. respecter les délais contractuels (6 mois pour ExpertAuto) ;
  4. retirer la version seulement quand la mesure montre qu'il n'y a plus de trafic.
- Aujourd'hui aucune version n'est candidate au retrait : la v1 est utilisée par deux partenaires
  qui ne peuvent pas modifier leur code, la v2 par ExpertAuto et l'application mobile.
