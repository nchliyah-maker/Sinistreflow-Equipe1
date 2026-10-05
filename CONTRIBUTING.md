# Règles de contribution

## Branches

- `main` est protégée : on n'y pousse **jamais** directement.
- Une branche par ticket : `fix/SF-104-reference-sequence`, `feat/SF-501-metrics`, `test/SF-402-integration`...
- Fusion dans `main` par **Pull Request** relue par un autre membre de l'équipe, CI verte obligatoire.

## Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/) avec le numéro du ticket :

```
<type>(SF-<numéro>): <description>
```

| type | quand |
|------|-------|
| `fix` | correction d'un bug |
| `feat` | nouvelle fonctionnalité (métriques, scripts...) |
| `test` | ajout / correction de tests uniquement |
| `ci` | pipeline d'intégration / livraison continue |
| `docs` | documentation (ADR, runbook...) |
| `refactor`, `chore`, `build`, `perf` | le reste |

**Pour les tickets du support, le message est imposé** : c'est le titre exact indiqué dans
`docs/TICKETS.md` (colonne « Commit attendu »). Un commit = une correction.
Le correctif et le test qui le prouve vont dans le **même** commit.

```bash
git switch -c fix/SF-107-pagination
# ... correction + test ...
git add -p
git commit -m "fix(SF-107): corriger le calcul de l'offset de pagination"
git push -u origin fix/SF-107-pagination
```
