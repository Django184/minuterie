// Tests de bout en bout de Ma journée (Playwright, Chromium).
// Lancer : node tests/e2e.mjs   (playwright doit être installé : npm i --no-save playwright)
// Le site est servi sous /minuterie/ comme sur GitHub Pages, avec une VERSION injectée dans sw.js.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".woff2": "font/woff2" };
let version = "test-a";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/minuterie/")) { res.writeHead(404).end(); return; }
  let p = url.pathname.slice("/minuterie/".length) || "index.html";
  p = normalize(p).replace(/^(\.\.[/\\])+/, "");
  try {
    let body = await readFile(join(ROOT, p));
    if (p === "sw.js") body = Buffer.from(body.toString().replace("__VERSION__", version));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/minuterie/`;

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "✓ " : "✗ ") + msg); if (!cond) failures++; };

const browser = await chromium.launch();

async function newPage(init) {
  const context = await browser.newContext({ acceptDownloads: true });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return { context, page, errors };
}

// 1. Premier lancement : activités par défaut, aucune erreur, aucune violation de CSP, polices locales.
{
  const { context, page, errors } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector(".row");
  ok((await page.locator(".list > .row").count()) === 7, "7 activités par défaut");
  await page.evaluate(() => document.fonts.ready);
  ok(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"') && document.fonts.check('16px "IBM Plex Mono"')), "polices IBM Plex chargées depuis l'app");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("journee-timers-v1")));
  ok(stored.schemaVersion === 2, "schemaVersion 2 enregistrée au premier lancement");
  const muted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim());
  ok(muted.toUpperCase() === "#756C77", "texte secondaire foncé (#756C77)");
  ok(errors.length === 0, "aucune erreur ni violation de CSP" + (errors.length ? " : " + errors.join(" | ") : ""));
  await context.close();
}

// 2. Migration 1 → 2 : données existantes conservées, copie brute de sauvegarde.
{
  const d = new Date();
  const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const v1 = { date: day, single: false, sort: "alpha", items: [
    { id: "abc1234", name: "Allemand", type: "time", target: 5400, desc: "- verbes", acc: 600000, startedAt: null, notified: false },
    { id: "def5678", name: "Pompes", type: "count", target: 100, desc: "", acc: 40, startedAt: null, notified: false },
    { id: "ghi9012", name: "Courrier", type: "check", target: 1, desc: "", acc: 0, startedAt: null, notified: false, skip: true }
  ] };
  const raw = JSON.stringify(v1);
  const { context, page, errors } = await newPage(`if (!sessionStorage.getItem("seeded")) { localStorage.setItem("journee-timers-v1", ${JSON.stringify(raw)}); sessionStorage.setItem("seeded", "1"); }`);
  await page.goto(BASE);
  await page.waitForSelector(".row");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("journee-timers-v1")));
  const backup = await page.evaluate(() => localStorage.getItem("journee-timers-v1.avant-v2"));
  ok(s.schemaVersion === 2 && s.items.length === 3 && s.single === false && s.sort === "alpha", "migration : réglages et activités conservés");
  ok(s.items[0].acc === 600000 && s.items[1].acc === 40 && s.items[2].skip === true, "migration : progression et pause du jour conservées");
  ok(backup === raw, "migration : copie brute des données v1 gardée");

  // 3. Lancer un minuteur annonce le changement aux lecteurs d'écran.
  await page.locator('.row[role="button"]').first().click();
  await page.waitForTimeout(150);
  ok((await page.locator("#announce").textContent()).includes("minuteur lancé"), "annonce « minuteur lancé »");
  await page.locator('.row[role="button"]').first().click();

  // 4. Export : enveloppe commune.
  await page.click("#options-toggle");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#opt-export")]);
  const exported = JSON.parse(await readFile(await dl.path(), "utf8"));
  ok(dl.suggestedFilename() === `ma-journee-export-${day}.json`, "nom du fichier d'export");
  ok(exported.format === "ecosysteme.export" && exported.app === "ma-journee" && exported.schemaVersion === 2 && exported.data.state.items.length === 3, "contenu de l'export");

  // 5. Import : refus d'un fichier étranger, puis aller-retour.
  const bad = JSON.stringify({ format: "ecosysteme.export", app: "panier-temoin", schemaVersion: 1, data: {} });
  await page.setInputFiles("#import-file", { name: "x.json", mimeType: "application/json", buffer: Buffer.from(bad) });
  await page.waitForSelector("#notice.err");
  ok((await page.textContent("#notice")).includes("autre app"), "import refusé pour un export d'une autre app");

  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("journee-timers-v1")); s.items = s.items.slice(0, 1); localStorage.setItem("journee-timers-v1", JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector("#options-toggle");
  await page.click("#options-toggle");
  await page.setInputFiles("#import-file", { name: "e.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await page.waitForSelector("#import-yes");
  ok((await page.textContent("#import-q")).includes("vos 1 activité par les 3"), "résumé avant import");
  await page.click("#import-yes");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("journee-timers-v1")));
  ok(after.items.length === 3 && after.items.map((x) => x.name).join() === "Allemand,Pompes,Courrier", "import : activités restaurées");
  ok(errors.length === 0, "aucune erreur pendant migration, export et import" + (errors.length ? " : " + errors.join(" | ") : ""));
  await context.close();
}

// 6. Hors ligne, puis mise à jour proposée.
{
  const { context, page, errors } = await newPage();
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector(".row");
  ok((await page.locator(".list > .row").count()) === 7, "hors ligne : l'app s'ouvre avec ses données");
  ok(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"')), "hors ligne : polices disponibles");
  await context.setOffline(false);

  version = "test-b";
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.waitForSelector("#update:not([hidden])", { timeout: 10000 });
  ok(true, "bandeau « nouvelle version » affiché");
  await Promise.all([page.waitForEvent("load"), page.click("#update-reload")]);
  await page.waitForSelector(".row");
  const keys = await page.evaluate(() => caches.keys());
  ok(keys.includes("ma-journee-test-b") && !keys.includes("ma-journee-test-a"), "nouvelle version active, ancien cache supprimé");
  ok(errors.length === 0, "aucune erreur hors ligne ni à la mise à jour" + (errors.length ? " : " + errors.join(" | ") : ""));
  await context.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests passent.");
process.exit(failures ? 1 : 0);
