# Changelog

Toutes les évolutions notables de Ma journée. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnement sémantique.

## [1.0.0] - 2026-11-03

Première version numérotée, alignée sur le socle de l'écosystème.

### Ajouté
- **Exporter mes données** et **Importer des données** dans Options : un fichier JSON au format commun de l'écosystème (`ma-journee-export-AAAA-MM-JJ.json`). L'import vérifie le fichier et demande confirmation avant de remplacer les activités.
- Bandeau « Une nouvelle version est disponible » (Recharger / Plus tard) : une mise à jour n'est plus appliquée sans prévenir.
- Annonces pour les lecteurs d'écran : minuteur lancé ou en pause, tâche faite, objectif atteint.
- Numéro de version affiché en bas des options.
- Tests de bout en bout (Playwright) lancés avant chaque publication.

### Modifié
- Les données portent un numéro de version de schéma (`schemaVersion: 2`). À la première ouverture, une copie brute des anciennes données est gardée sous la clé `journee-timers-v1.avant-v2`.
- Le texte secondaire est plus foncé en thème clair (contraste 4,67:1 au lieu de 3,51:1, conforme WCAG AA).
- Les polices IBM Plex sont hébergées avec l'app : plus aucune requête vers Google, et le premier lancement hors ligne a les bonnes polices.
- L'app fonctionne d'abord depuis son cache : la version installée reste cohérente. Le nom du cache vient du commit publié.
- Styles et script sortis du HTML (`css/`, `js/`), ce qui permet une politique de sécurité du contenu (CSP) stricte.

### Sécurité
- CSP : seuls les fichiers de l'app peuvent être chargés et exécutés.
