// Changement d'origine (chantier B, ECOSYSTEME.md §7.4), de bout en bout dans Chromium :
//   1. l'ancienne adresse sert l'app actuelle, installée avec des données ;
//   2. l'ancienne adresse passe au passeur (passeur/) : le service worker d'autodestruction
//      prend la place de l'ancien, efface ses caches, se désinscrit et recharge la fenêtre ;
//   3. le passeur transmet les données à la nouvelle adresse (#/demenagement/…) ;
//   4. la nouvelle adresse demande confirmation, puis reprend les activités.
// Deux serveurs sur deux ports = deux origines, comme django184.github.io et ma-journee-2q9.pages.dev.
// Lancer : node tests/demenagement.mjs   (playwright doit être installé : npm i --no-save playwright)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
let ancienneEnPasseur = false;
let nouvelle = "";

function serveur(prefixe, dossier) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith(prefixe)) { res.writeHead(404).end(); return; }
    let p = url.pathname.slice(prefixe.length) || "index.html";
    p = normalize(p).replace(/^(\.\.[/\\])+/, "");
    const base = dossier();
    try {
      let corps = await readFile(join(base, p));
      if (p === "sw.js") corps = Buffer.from(corps.toString().replace("__VERSION__", "test"));
      if (p === "index.html" && base.endsWith("passeur")) {
        corps = Buffer.from(corps.toString().replaceAll("https://ma-journee-2q9.pages.dev/", nouvelle));
      }
      res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(corps);
    } catch { res.writeHead(404).end(); }
  });
}

const ancien = serveur("/minuterie/", () => (ancienneEnPasseur ? join(ROOT, "passeur") : ROOT));
const neuf = serveur("/", () => ROOT);
await new Promise((r) => ancien.listen(0, r));
await new Promise((r) => neuf.listen(0, r));
const ANCIENNE = `http://localhost:${ancien.address().port}/minuterie/`;
nouvelle = `http://127.0.0.1:${neuf.address().port}/`;   // autre hôte : autre origine, comme en vrai

// Attend que la page arrive à une adresse (les navigations intermédiaires interrompues sont normales).
async function attendreAdresse(p, debut, delai = 15000) {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    if (p.url().startsWith(debut)) { await p.waitForLoadState("load").catch(() => {}); return true; }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let echecs = 0;
const ok = (cond, msg) => { console.log((cond ? "✓ " : "✗ ") + msg); if (!cond) echecs++; };

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext();
const page = await contexte.newPage();
const erreurs = [];
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", (e) => erreurs.push(String(e)));

// 1. Ancienne adresse : l'app installée, avec des activités personnelles et un minuteur commencé.
await page.goto(ANCIENNE);
await page.waitForSelector(".row");
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("journee-timers-v1"));
  s.items = [
    { id: "a1", name: "Piano", type: "time", target: 1800, desc: "- gammes", acc: 600000, startedAt: null, notified: false },
    { id: "a2", name: "Courrier", type: "check", target: 1, desc: "", acc: 0, startedAt: null, notified: false },
  ];
  s.sort = "alpha";
  localStorage.setItem("journee-timers-v1", JSON.stringify(s));
});
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
ok((await page.evaluate(() => caches.keys())).includes("ma-journee-test"), "ancienne adresse : app installée et en cache");

// 2. L'ancienne adresse sert désormais le passeur ; le navigateur vérifie la mise à jour.
ancienneEnPasseur = true;
await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update())).catch(() => {});
ok(await attendreAdresse(page, nouvelle), "fenêtre rechargée puis renvoyée vers la nouvelle adresse");

// 3. Nouvelle adresse : confirmation, puis reprise.
await page.waitForSelector("#import-yes");
ok(new URL(page.url()).hash === "", "lien de déménagement retiré de l'adresse");
ok((await page.textContent("#import-q")).includes("Reprendre les 2 activités de l'ancienne adresse"), "résumé avant reprise");
ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "import-yes"), "focus sur « Reprendre »");
await page.click("#import-yes");
const repris = await page.evaluate(() => JSON.parse(localStorage.getItem("journee-timers-v1")));
ok(repris.items.map((x) => x.name).join() === "Piano,Courrier" && repris.items[0].acc === 600000 && repris.items[0].desc === "- gammes" && repris.sort === "alpha",
  "activités, progression du jour et réglages repris");

// 4. Ancienne adresse : plus de service worker ni de cache de l'app, données d'origine intactes.
const p2 = await contexte.newPage();
await p2.goto(ANCIENNE + "passeur.css");   // une page de l'ancienne origine qui ne redirige pas
const etat = await p2.evaluate(async () => ({
  regs: (await navigator.serviceWorker.getRegistrations()).length,
  caches: (await caches.keys()).filter((c) => c.startsWith("ma-journee-")).length,
  donnees: !!localStorage.getItem("journee-timers-v1"),
}));
ok(etat.regs === 0 && etat.caches === 0, "ancienne adresse : service worker désinscrit, caches effacés");
ok(etat.donnees, "ancienne adresse : données d'origine conservées");

// 5. Sans données à l'ancienne adresse : simple redirection, aucune question.
const vierge = await navigateur.newContext();
const p3 = await vierge.newPage();
await p3.goto(ANCIENNE).catch(() => {});
await attendreAdresse(p3, nouvelle);
await p3.waitForSelector(".row");
ok(new URL(p3.url()).hash === "" && (await p3.locator("#import-yes").count()) === 0, "sans données : redirection simple");
await vierge.close();

ok(erreurs.length === 0, "aucune erreur ni violation de CSP" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));

await navigateur.close();
ancien.close(); neuf.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nTous les tests passent.");
process.exit(echecs ? 1 : 0);
