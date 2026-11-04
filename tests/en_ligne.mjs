// Vérification du site publié (job « en_ligne » de la CI) : node tests/en_ligne.mjs https://ma-journee-2q9.pages.dev/
// En-têtes HTTP, manifeste, version affichée, lien de déménagement, puis rechargement hors ligne.
// Aucun contournement de la CSP : toute violation est une erreur.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const SITE = process.argv[2] || "https://ma-journee-2q9.pages.dev/";
const VERSION = (await readFile(new URL("../js/app.js", import.meta.url), "utf8")).match(/APP_VERSION = "([^"]+)"/)[1];

let echecs = 0;
// Les échecs sortent aussi en annotations, lisibles par l'API GitHub (les journaux ne le sont pas toujours).
const ok = (cond, msg) => { console.log((cond ? "✓ " : "✗ ") + msg); if (!cond) { echecs++; console.log("::error::Site publié : " + msg); } };
const base64url = (t) => Buffer.from(t, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext();
const page = await contexte.newPage();
const erreurs = [];
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", (e) => erreurs.push(String(e)));

// 1. En-têtes et premier lancement.
const reponse = await page.goto(SITE);
const h = reponse.headers();
ok((h["content-security-policy"] || "").includes("frame-ancestors 'none'"), "CSP en en-tête HTTP, avec frame-ancestors");
ok(h["x-content-type-options"] === "nosniff" && h["referrer-policy"] === "strict-origin-when-cross-origin", "nosniff et Referrer-Policy");
await page.waitForSelector(".row");
ok((await page.locator(".list > .row").count()) === 7, "premier lancement : 7 activités par défaut");
const manifeste = await page.evaluate(async () => (await fetch("manifest.webmanifest")).json());
ok(manifeste.id === "/" && manifeste.start_url === "./" && manifeste.scope === "./", "manifeste : id « / »");
await page.click("#options-toggle");
ok((await page.textContent("#version")).includes(VERSION), `version ${VERSION} affichée`);

// 2. Lien de déménagement (comme le passeur l'écrit) : confirmation demandée, rien n'est écrit avant.
const enveloppe = { format: "ecosysteme.export", formatVersion: 1, app: "ma-journee", appVersion: "passeur", schemaVersion: 2,
  exportedAt: new Date().toISOString(), data: { state: { schemaVersion: 2, date: "2000-01-01", single: true, sort: "progress",
    items: [{ id: "z1", name: "Test en ligne", type: "count", target: 3, desc: "", acc: 1, startedAt: null, notified: false }] } } };
await page.goto(SITE + "#/demenagement/" + base64url(JSON.stringify(enveloppe)));
await page.reload();   // le fragment change seul ne recharge pas la page
await page.waitForSelector("#import-yes");
ok((await page.textContent("#import-q")).includes("Reprendre les 1 activité"), "déménagement : résumé avant reprise");
await page.click("#import-no");

// 3. Hors ligne.
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
await contexte.setOffline(true);
await page.reload();
await page.waitForSelector(".row");
ok((await page.locator(".list > .row").count()) === 7, "hors ligne : l'app s'ouvre");
await contexte.setOffline(false);

ok(erreurs.length === 0, "aucune erreur ni violation de CSP" + (erreurs.length ? " : " + erreurs.join(" | ") : ""));
await navigateur.close();
console.log(echecs ? `\n${echecs} échec(s)` : "\nSite publié conforme.");
process.exit(echecs ? 1 : 0);
