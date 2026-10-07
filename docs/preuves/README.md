# Preuves

Ce qui ne se voit pas dans le code. Relevé le 07/10/2026 sur la VM de déploiement :
Ubuntu 24.04 LTS, 2 vCPU, 4 Go, créée avec `deploy/vm/Vagrantfile` (VirtualBox), adresse
`192.168.56.10`. Les heures des fichiers texte sont celles de la VM (UTC).

## Déploiement et sécurité

| Fichier | Ce qu'il montre |
|---------|-----------------|
| [vm-deploiement-connecteur-25-sur-25.txt](vm-deploiement-connecteur-25-sur-25.txt) | `deploy.sh` sur la VM, puis le connecteur ExpertAuto lancé depuis la VM : 25/25 |
| [vm-deploiement-image-ghcr.txt](vm-deploiement-image-ghcr.txt) | `deploy.sh` avec l'image publiée par le pipeline, téléchargée depuis GHCR : connecteur à 25/25 |
| [vm-securite-acces.txt](vm-securite-acces.txt) | `ufw status`, réglages SSH effectifs, connexions root et par mot de passe refusées, ports joignables depuis le poste, `/metrics` en 403 |
| [grafana-vm-etat-normal.png](grafana-vm-etat-normal.png) | tableau de bord Grafana, état normal |

## Test de panne (game day)

Les post-mortems sont dans [../JOURNAL.md](../JOURNAL.md), jour 3.

| Fichier | Ce qu'il montre |
|---------|-----------------|
| [gameday-1-panne-base.txt](gameday-1-panne-base.txt) | arrêt de PostgreSQL : chronologie de `/health` et des alertes, avant et après correction |
| [gameday-1-panne-base-grafana.png](gameday-1-panne-base-grafana.png) | tableau de bord pendant la panne |
| [gameday-1-panne-base-prometheus-alertes.png](gameday-1-panne-base-prometheus-alertes.png) | règles d'alerte déclenchées dans Prometheus |
| [gameday-1-panne-base-alertmanager.png](gameday-1-panne-base-alertmanager.png) | alertes reçues par Alertmanager |
| [gameday-1-panne-base-discord.txt](gameday-1-panne-base-discord.txt) | même panne rejouée avec le webhook Discord : 6 notifications envoyées, 0 échec |
| [gameday-1-panne-base-discord.png](gameday-1-panne-base-discord.png) | les 6 messages reçus dans le salon Discord `#alertes` (heure de Paris) |
| [gameday-2-pluie-erreurs.txt](gameday-2-pluie-erreurs.txt) | 200 appels avec une mauvaise clé API |
| [gameday-2-pluie-erreurs-grafana.png](gameday-2-pluie-erreurs-grafana.png) | tableau de bord après la pluie d'erreurs |
| [gameday-3-mauvaise-livraison.txt](gameday-3-mauvaise-livraison.txt) | image cassée : retour arrière automatique en 42 secondes |

## Répétition sur le poste de développement

| Fichier | Ce qu'il montre |
|---------|-----------------|
| [repetition-locale-retour-arriere.txt](repetition-locale-retour-arriere.txt) | premier essai de `deploy.sh` et du retour arrière, avant la VM |

## Ce qui n'est pas prouvé ici

- Le retour arrière (scénario 3) a été joué avec une image cassée construite sur la VM, pas
  avec une image tirée de GHCR.
