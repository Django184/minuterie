<p align="center">
  <img src="icon-192.png" width="96" height="96" alt="Icône de Ma journée">
</p>

<h1 align="center">Ma journée</h1>

<p align="center">
  Un minuteur par activité pour suivre sa journée type, d'un simple toucher.<br>
  <a href="https://ma-journee.pages.dev/"><b>Ouvrir l'application →</b></a>
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

L'écran principal reste épuré : la liste des activités, chacune avec une fine barre de progression. Les réglages sont rangés dans **Options**, en bas de l'écran.


- **Lancer ou mettre en pause** un minuteur en touchant l'activité.
- **Activités terminées masquées** : quand une activité atteint son objectif, son minuteur s'arrête et elle quitte la liste. Le lien « … terminée · afficher » sous la liste les fait réapparaître.
- **Tri des activités** (Options) : par avancement (les plus avancées en haut, puis par nom) ou par ordre alphabétique.
- **Un seul minuteur à la fois** (Options) : en lancer un met les autres en pause.
- **Compteurs** pour les activités qui se comptent plutôt qu'elles ne se chronomètrent, comme les pompes (−1, +1, +10).
- **Activités à cocher** pour ce qu'on fait une seule fois dans la journée. On touche la ligne pour cocher ; l'activité quitte la liste comme les autres activités terminées. Dans « Modifier les activités », choisir « à cocher » au lieu de « min » ou « fois ».
- **Mettre en pause aujourd'hui** (Options) : désactiver les activités qu'on ne fera pas aujourd'hui. Elles disparaissent de la liste et du résumé de la journée, puis reviennent automatiquement le lendemain. Le lien « … en pause aujourd'hui · gérer » sous la liste permet de les réactiver.
- **Ajuster le temps** (Options) : ajouter ou retirer 1, 5 ou 15 minutes à une activité, par exemple quand on a oublié de lancer ou d'arrêter son minuteur.
- **Modifier les activités** (Options) : renommer, changer les objectifs et l'unité (min, fois ou à cocher), en ajouter ou en supprimer. Changer l'unité remet la progression du jour de cette activité à zéro.
- **Descriptions** : chaque activité peut avoir une description, par exemple le détail d'une séance. Dans « Modifier les activités », l'icône ≡ ouvre le champ. Dans la liste, une petite flèche à côté du nom déplie ou replie la description. Les lignes qui commencent par « - » ou « • » s'affichent en liste, et `**texte**` s'affiche en gras.
- **Résumé de la journée** : temps fait sur temps prévu et nombre d'activités terminées.
- **Remise à zéro automatique** chaque nouveau jour, ou à la main avec « Remettre à zéro ».
- **Hors ligne** : une fois installée, l'application fonctionne sans connexion.
- **Thème clair ou sombre**, selon le réglage du téléphone.
- **Exporter et importer** (Options) : enregistrer ses activités dans un fichier, et les retrouver sur un autre appareil ou après avoir effacé les données du navigateur.

Le temps reste juste même si l'application est fermée ou si l'écran se verrouille, car il est calculé à partir de l'heure de départ. Le son de fin ne retentit que si l'application est ouverte à ce moment-là.

## Installer sur le téléphone

**Android (Chrome)**
1. Ouvrir https://ma-journee.pages.dev/ dans Chrome.
2. Toucher le bandeau « Installer l'application », ou le menu ⋮ puis « Installer l'application ».

**iPhone (Safari)**
1. Ouvrir https://ma-journee.pages.dev/ dans Safari.
2. Toucher Partager, puis « Sur l'écran d'accueil ».

L'application apparaît alors avec son icône et s'ouvre en plein écran. Quand une nouvelle version est publiée, un bandeau « Une nouvelle version est disponible » propose de recharger ; rien ne change tant qu'on ne l'a pas touché.

**Venir de l'ancienne adresse** (`django184.github.io/minuterie/`) : ouvrir l'ancienne app une fois avec du réseau. Elle passe la main à la nouvelle adresse, qui propose de reprendre les activités (« Reprendre »). Installer ensuite l'app depuis la nouvelle adresse et supprimer l'ancienne icône. En cas de souci : exporter depuis l'ancienne app, importer dans la nouvelle.

## Données

Tout est enregistré sur le téléphone, dans le stockage du navigateur. Rien n'est envoyé ailleurs, et l'app ne contacte aucun autre site (polices comprises). Pour garder une copie ou changer d'appareil : Options → Exporter mes données, puis Importer des données sur l'autre appareil.

Les données portent un numéro de version de schéma (`schemaVersion`). Avant toute migration, l'app garde une copie brute des anciennes données dans le stockage du navigateur.

## Licence

Code sous licence MIT (`LICENSE`). Polices IBM Plex sous licence SIL Open Font License 1.1 (`fonts/OFL.txt`).

## Fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | La page (structure seulement, avec sa politique de sécurité) |
| `css/socle.css` | Tokens communs de l'écosystème (à ne pas modifier ici) |
| `css/app.css` | Styles et identité de l'application |
| `js/app.js` | Le code de l'application |
| `fonts/` | IBM Plex Sans et Mono (licence OFL, `fonts/OFL.txt`) |
| `manifest.webmanifest` | Nom, icônes et couleurs pour l'installation |
| `sw.js` | Garde l'application disponible hors ligne et propose les mises à jour |
| `icon-*.png`, `apple-touch-icon.png` | Icônes de l'application |
| `_headers` | En-têtes HTTP servis par Cloudflare Pages (CSP, etc.) |
| `passeur/` | Page laissée à l'ancienne adresse : transmet les données et désinstalle l'ancienne app |
| `tests/e2e.mjs` | Tests de bout en bout (Playwright) |
| `tests/demenagement.mjs` | Changement d'adresse de bout en bout |
| `tests/en_ligne.mjs` | Vérification du site publié |
| `CHANGELOG.md` | Historique des versions |

Le site est publié sur Cloudflare Pages (projet `ma-journee`) depuis la branche `main`. Aucune étape de construction n'est nécessaire : la CI lance les tests, publie les fichiers en remplaçant `__VERSION__` dans `sw.js` par l'empreinte du commit, puis vérifie le site publié. Son résultat est lisible sur la branche `ci-statut` (`statut.json`). Secrets nécessaires : `CLOUDFLARE_API_TOKEN` (Cloudflare Pages · Edit) et `CLOUDFLARE_ACCOUNT_ID`.

Pour publier une nouvelle version : changer `APP_VERSION` dans `js/app.js`, ajouter une entrée à `CHANGELOG.md`, pousser sur `main`.
