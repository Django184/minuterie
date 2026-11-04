// Garde l'application disponible hors ligne.
// VERSION est remplacée au déploiement par l'empreinte du commit (voir .github/workflows/pages.yml).
const VERSION = "__VERSION__";
const CACHE = "ma-journee-" + VERSION;
// La page est précachée sous « ./ » seulement : Cloudflare Pages redirige « index.html » vers « / »,
// et une réponse redirigée servie à une navigation est refusée par le navigateur.
const FILES = [
  "./", "manifest.webmanifest",
  "css/socle.css", "css/app.css", "js/app.js",
  "fonts/IBMPlexSans-Regular-Latin1.woff2", "fonts/IBMPlexSans-Medium-Latin1.woff2", "fonts/IBMPlexSans-SemiBold-Latin1.woff2",
  "fonts/IBMPlexMono-Regular-Latin1.woff2", "fonts/IBMPlexMono-Medium-Latin1.woff2",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"
];

// Installation : précache complet. Pas de skipWaiting automatique : la page propose la mise à jour.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Activation : on supprime les caches des versions précédentes (dont ma-journee-v1 à v9).
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ma-journee-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fichiers de l'app : cache d'abord (la version installée reste cohérente), réseau en secours.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(caches.match("./", { cacheName: CACHE }).then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(e.request))
  );
});
