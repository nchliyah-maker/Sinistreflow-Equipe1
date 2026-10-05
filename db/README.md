# Base de données SinistreFlow

## Le dump de production

`dump/sinistreflow_prod_2026-09-28.sql` est un export **anonymisé** (RGPD) de la base de production,
réalisé par l'équipe d'exploitation le 28/09/2026 à 02:00 (`pg_dump`, PostgreSQL 16).

- 90 assurés, 116 contrats, 425 dossiers sinistres (2022 → 2026)
- toutes les migrations jusqu'à la **version 9** y sont appliquées (table `schema_migrations`)
- les dossiers supprimés (doublons, tests de recette) laissent des trous dans la numérotation

> C'est **la** base de référence : l'application doit fonctionner avec ces données,
> pas seulement avec une base vide.

## Restaurer le dump (stack docker compose)

```bash
docker compose up -d db
bash db/restore.sh
```

Le script vide le schéma `public` puis rejoue le dump : il sert aussi à **remettre la base à zéro**
(par exemple pour rejouer le connecteur ExpertAuto).

## Comptes de démonstration

| Assuré | Contrat | Email à saisir | Produit |
|--------|---------|----------------|---------|
| Camille Durand | `MA-AUTO-001001` | `camille.durand@example.test` | AUTO (franchise 300 €) |
| Lucas Bernard | `MA-HAB-002001` | `lucas.bernard@example.test` | HABITATION |
| Inès D'Almeida | `MA-AUTO-001002` | `ines.dalmeida@example.test` | AUTO (franchise 150 €) |
| Lucas Bernard | `MA-AUTO-001060` | `lucas.bernard@example.test` | AUTO **résilié** |

Back-office : identifiants dans la configuration de l'application.

## Migrations

Les fichiers SQL sont dans `migrations/`. Ils sont appliqués par `npm run migrate`
qui tient à jour la table `schema_migrations`.
