<p align="center">
  <img src="icon-192.png" width="96" height="96" alt="Icône de Ma journée">
</p>

<h1 align="center">Ma journée</h1>

<p align="center">
  Un minuteur par activité pour suivre sa journée type, d'un simple toucher.<br>
  <a href="https://django184.github.io/minuterie/"><b>Ouvrir l'application →</b></a>
</p>

---

## Ce que fait l'application

Chaque activité de la journée a son propre minuteur et un objectif de temps. On touche une activité pour lancer son minuteur, on la retouche pour le mettre en pause. Une barre se remplit au fil du temps. Quand l'objectif est atteint, un petit son retentit, le minuteur s'arrête et l'activité est masquée.

| Activité    | Objectif |
|-------------|----------|
| Recrutement | 2 h      |
| Guitare     | 1 h      |
| Allemand    | 1 h 30   |
| Cours EPFL  | 2 h      |
| Lecture     | 45 min   |
| Yoga        | 20 min   |
| Pompes      | 100      |

Cette liste est celle de départ. On peut la changer dans l'application.

## Fonctions

- **Lancer ou mettre en pause** un minuteur en touchant l'activité.
- **Activités terminées masquées** : quand une activité atteint son objectif, son minuteur s'arrête et elle quitte la liste. Le lien « Afficher les activités terminées » les fait réapparaître.
- **Tri des activités** : par avancement (les plus avancées en haut, puis par nom) ou par ordre alphabétique.
- **Un seul minuteur à la fois** (option) : en lancer un met les autres en pause.
- **Compteurs** pour les activités qui se comptent plutôt qu'elles ne se chronomètrent, comme les pompes (−1, +1, +10).
- **Ajuster le temps** : ajouter ou retirer 1, 5 ou 15 minutes à une activité, par exemple quand on a oublié de lancer ou d'arrêter son minuteur.
- **Modifier les activités** : renommer, changer les objectifs, en ajouter ou en supprimer.
- **Résumé de la journée** : temps fait sur temps prévu et nombre d'activités terminées.
- **Remise à zéro automatique** chaque nouveau jour, ou à la main avec « Remettre à zéro ».
- **Hors ligne** : une fois installée, l'application fonctionne sans connexion.
- **Thème clair ou sombre**, selon le réglage du téléphone.

Le temps reste juste même si l'application est fermée ou si l'écran se verrouille, car il est calculé à partir de l'heure de départ. Le son de fin ne retentit que si l'application est ouverte à ce moment-là.

## Installer sur le téléphone

**Android (Chrome)**
1. Ouvrir https://django184.github.io/minuterie/ dans Chrome.
2. Toucher le bandeau « Installer l'application », ou le menu ⋮ puis « Installer l'application ».

**iPhone (Safari)**
1. Ouvrir https://django184.github.io/minuterie/ dans Safari.
2. Toucher Partager, puis « Sur l'écran d'accueil ».

L'application apparaît alors avec son icône et s'ouvre en plein écran. Elle se met à jour toute seule la prochaine fois qu'on l'ouvre avec une connexion.

## Données

Tout est enregistré sur le téléphone, dans le stockage du navigateur. Rien n'est envoyé ailleurs. Les données ne passent donc pas d'un appareil à l'autre.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | L'application entière (page, styles et code) |
| `manifest.webmanifest` | Nom, icônes et couleurs pour l'installation |
| `sw.js` | Garde l'application disponible hors ligne |
| `icon-*.png`, `apple-touch-icon.png` | Icônes de l'application |

Le site est publié avec GitHub Pages depuis la branche `main`, à la racine du dépôt. Aucune étape de construction n'est nécessaire.
