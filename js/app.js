// Ma journée — script de l'app (aucune dépendance, aucun module, aucune étape de build).
(function () {
  const APP_VERSION = "1.0.0";
  const KEY = "journee-timers-v1";          // nom historique de la clé, conservé tel quel
  const SCHEMA = 2;                          // version du schéma des données enregistrées
  const BACKUP_V1 = KEY + ".avant-v2";       // copie brute faite avant la migration 1 → 2
  const DEFAULTS = [
    { name: "Recrutement", type: "time", target: 120 * 60 },
    { name: "Guitare", type: "time", target: 60 * 60 },
    { name: "Allemand", type: "time", target: 90 * 60 },
    { name: "Cours EPFL", type: "time", target: 120 * 60 },
    { name: "Lecture", type: "time", target: 45 * 60 },
    { name: "Yoga", type: "time", target: 20 * 60 },
    { name: "Pompes", type: "count", target: 100 }
  ];
  const TYPES = ["time", "count", "check"];

  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const fresh = (it) => ({ id: it.id || uid(), name: it.name, type: it.type, target: it.target, desc: it.desc || "", acc: 0, startedAt: null, notified: false });

  // Migrations de schéma : chacune passe de la version N à N+1 et conserve les champs inconnus.
  const MIGRATIONS = {
    // 1 → 2 : les données n'avaient pas de numéro de version. Rien d'autre ne change.
    1: (s) => Object.assign({}, s, { schemaVersion: 2 })
  };
  function migrate(s) {
    let v = Number.isInteger(s.schemaVersion) ? s.schemaVersion : 1;
    while (v < SCHEMA) { s = MIGRATIONS[v](s); v = s.schemaVersion; }
    return s;
  }

  // Valeurs par défaut tolérantes (données anciennes ou importées).
  function normalize(s) {
    if (s.date !== today()) { s.items = s.items.map(fresh); s.date = today(); }
    if (typeof s.single !== "boolean") s.single = true;
    if (s.sort !== "alpha" && s.sort !== "progress") s.sort = "progress";
    s.schemaVersion = SCHEMA;
    return s;
  }

  function load() {
    let raw = null, s = null;
    try { raw = localStorage.getItem(KEY); s = JSON.parse(raw); } catch (e) {}
    if (!s || !Array.isArray(s.items)) {
      return normalize({ schemaVersion: SCHEMA, date: today(), single: true, items: DEFAULTS.map(fresh) });
    }
    if (!Number.isInteger(s.schemaVersion) || s.schemaVersion < SCHEMA) {
      // Sauvegarde automatique avant la première migration : rien n'est perdu.
      try { if (raw && localStorage.getItem(BACKUP_V1) === null) localStorage.setItem(BACKUP_V1, raw); } catch (e) {}
      s = migrate(s);
    }
    return normalize(s);
  }
  let state = load();
  let editing = false;
  let adjusting = false;
  let skipping = false;   // écran « Mettre en pause aujourd'hui »
  let showDone = false;
  let optionsOpen = false;
  let confirmReset = false;
  let pendingImport = null;   // données lues dans un fichier, en attente de confirmation
  let notice = null;          // { text, err } affiché sous les options
  let needsRender = false;
  const openIds = new Set();   // descriptions dépliées

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // Annonce pour les lecteurs d'écran (région role="status").
  const announceEl = document.getElementById("announce");
  function announce(text) {
    announceEl.textContent = "";
    setTimeout(() => { announceEl.textContent = text; }, 50);
  }

  const isTime = (it) => it.type === "time";
  const elapsed = (it) => !isTime(it) ? it.acc : it.acc + (it.startedAt ? Date.now() - it.startedAt : 0);
  const progress = (it) => it.target > 0 ? (!isTime(it) ? it.acc / it.target : elapsed(it) / (it.target * 1000)) : 0;

  function fmtClock(ms) {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  }
  function fmtShort(sec) {
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (!h) return m + " min";
    return h + "h" + (m ? String(m).padStart(2, "0") : "");
  }
  function fmtTotal(ms) {
    const t = Math.floor(ms / 60000);
    return Math.floor(t / 60) + "h" + String(t % 60).padStart(2, "0");
  }
  function descHTML(text) {
    const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    let html = "", list = [];
    const flush = () => { if (list.length) { html += "<ul>" + list.map(l => "<li>" + inline(l) + "</li>").join("") + "</ul>"; list = []; } };
    String(text).split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line) { flush(); return; }
      const m = line.match(/^[-•*–]\s+(.*)$/);
      if (m) list.push(m[1]); else { flush(); html += "<p>" + inline(line) + "</p>"; }
    });
    flush();
    return html;
  }
  const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
  // Nom + petite flèche si l'activité a une description, et le bloc de description.
  function nameHTML(it) {
    const has = (it.desc || "").trim();
    const open = has && openIds.has(it.id);
    return '<span class="name"><span>' + esc(it.name) + '</span>' +
      (has ? '<button type="button" class="desc-toggle" aria-expanded="' + open + '" aria-label="Description de ' + esc(it.name) + '">' + CHEVRON + '</button>' : '') +
      '</span>';
  }
  function descBlock(it) {
    const has = (it.desc || "").trim();
    return has ? '<div class="desc"' + (openIds.has(it.id) ? '' : ' hidden') + '>' + descHTML(it.desc) + '</div>' : '';
  }
  function wireDesc(row, it) {
    const b = row.querySelector(".desc-toggle"), d = row.querySelector(".desc");
    if (!b || !d) return;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      d.hidden = !d.hidden;
      b.setAttribute("aria-expanded", String(!d.hidden));
      if (d.hidden) openIds.delete(it.id); else openIds.add(it.id);
    });
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Largeur d'une barre posée par le CSSOM (les attributs style sont refusés par la CSP).
  const setBar = (row, pct) => { const b = row.querySelector(".track > span"); if (b) b.style.width = pct + "%"; };

  // Petit son quand un objectif est atteint (seulement après une interaction).
  let actx = null;
  function chime() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((delay, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = i ? 880 : 660; o.type = "sine";
        g.gain.setValueAtTime(0.0001, actx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + delay + 0.5);
        o.connect(g).connect(actx.destination);
        o.start(actx.currentTime + delay); o.stop(actx.currentTime + delay + 0.55);
      });
    } catch (e) {}
  }

  const listEl = document.getElementById("list");
  const footEl = document.getElementById("footer");
  const modeEl = document.getElementById("mode");

  const pauseAll = () => state.items.forEach(x => { if (x.startedAt) { x.acc += Date.now() - x.startedAt; x.startedAt = null; } });

  function toggle(id) {
    const it = state.items.find(x => x.id === id);
    if (!it) return;
    if (it.startedAt) {
      it.acc += Date.now() - it.startedAt; it.startedAt = null;
      announce(it.name + " : en pause");
    } else {
      if (state.single) pauseAll();
      it.startedAt = Date.now();
      if (actx && actx.state === "suspended") actx.resume();
      announce(it.name + " : minuteur lancé");
    }
    save(); render();
  }
  function bump(id, n) {
    const it = state.items.find(x => x.id === id);
    if (!it) return;
    const before = it.acc;
    it.acc = Math.max(0, it.acc + n);
    if (before < it.target && it.acc >= it.target) { chime(); announce("Objectif atteint : " + it.name); }
    save(); render();
  }
  function check(id) {
    const it = state.items.find(x => x.id === id);
    if (!it) return;
    it.acc = it.acc >= 1 ? 0 : 1;
    save();
    announce(it.name + (it.acc >= 1 ? " : fait" : " : à faire"));
    const row = listEl.querySelector('[data-id="' + id + '"]');
    if (row) {
      row.classList.toggle("done", it.acc >= 1);
      row.setAttribute("aria-checked", String(it.acc >= 1));
    }
    if (it.acc >= 1 && !showDone) setTimeout(render, 450); else render();
  }

  // Ajoute ou retire des minutes au temps déjà fait, sans arrêter le minuteur.
  function adjust(id, minutes) {
    const it = state.items.find(x => x.id === id);
    if (!it) return;
    const running = it.startedAt ? Date.now() - it.startedAt : 0;
    it.acc = Math.max(-running, it.acc + minutes * 60000);
    it.notified = progress(it) >= 1;
    // Un minuteur en cours qui dépasse l'objectif par ajustement s'arrête aussi.
    if (it.notified && it.startedAt) { it.acc += Date.now() - it.startedAt; it.startedAt = null; }
    save(); tick();
  }

  // Ordre d'affichage : le plus avancé d'abord (égalités par nom), ou par nom.
  // Calculé seulement au rendu, pour que les lignes ne bougent pas pendant qu'un minuteur tourne.
  const byName = (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });
  function sorted() {
    const list = state.items.slice();
    if (state.sort === "alpha") return list.sort(byName);
    return list.sort((a, b) => (Math.min(1, progress(b)) - Math.min(1, progress(a))) || byName(a, b));
  }

  function render() {
    listEl.innerHTML = "";
    renderMode();
    if (editing) { renderEdit(); renderFooter(); return; }
    if (skipping) { renderSkip(); tick(); renderFooter(); return; }

    // Les activités terminées sont masquées, sauf si un minuteur tourne encore ou si on les affiche.
    const all = sorted().filter(x => !x.skip);
    const skipCount = state.items.length - all.length;
    const doneCount = all.filter(x => progress(x) >= 1 && !x.startedAt).length;
    const visible = all.filter(x => showDone || progress(x) < 1 || x.startedAt);

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = all.length
        ? "<b>Tout est fait pour aujourd'hui.</b><span>Toutes vos activités ont atteint leur objectif.</span>"
        : "<b>Rien de prévu aujourd'hui.</b><span>Toutes vos activités sont en pause. Elles reviendront demain.</span>";
      listEl.appendChild(empty);
    }

    visible.forEach(it => {
      if (it.type === "check") {
        const done = it.acc >= 1;
        const row = document.createElement("div");
        row.className = "row check" + (done ? " done" : " idle");
        row.dataset.id = it.id;
        row.setAttribute("role", "checkbox");
        row.setAttribute("aria-checked", String(done));
        row.tabIndex = 0;
        row.innerHTML =
          '<div class="line">' + nameHTML(it) + '<span class="box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6l4.5-5"/></svg></span></div>' +
          descBlock(it) +
          '<div class="track"><span></span></div>';
        setBar(row, done ? 100 : 0);
        row.addEventListener("click", (e) => { if (!e.target.closest(".desc-toggle, .desc")) check(it.id); });
        row.addEventListener("keydown", (e) => {
          if (e.target === row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); check(it.id); }
        });
        wireDesc(row, it);
        listEl.appendChild(row);
        return;
      }
      if (it.type === "count") {
        const p = progress(it), done = p >= 1;
        const row = document.createElement("div");
        row.className = "row" + (done ? " done" : it.acc > 0 ? " started" : " idle");
        row.innerHTML =
          '<div class="line">' +
            nameHTML(it) +
            '<span class="steps">' +
              '<button class="step" data-n="-1" aria-label="Retirer 1">−1</button>' +
              '<button class="step" data-n="1" aria-label="Ajouter 1">+1</button>' +
              '<button class="step" data-n="10" aria-label="Ajouter 10">+10</button>' +
              '<span class="time">' + it.acc + '<span class="tg">/ ' + it.target + '</span></span>' +
            '</span>' +
          '</div>' +
          descBlock(it) +
          '<div class="track"><span></span></div>';
        setBar(row, Math.min(100, p * 100));
        row.querySelectorAll(".step").forEach(b => b.addEventListener("click", () => bump(it.id, +b.dataset.n)));
        wireDesc(row, it);
        listEl.appendChild(row);
        return;
      }
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.id = it.id;
      row.innerHTML =
        '<div class="line">' +
          nameHTML(it) +
          '<span class="time"><span class="el"></span><span class="tg"></span></span>' +
        '</div>' +
        descBlock(it) +
        '<div class="track"><span></span></div>' +
        (adjusting ? '<div class="adjust-steps">' + [-15, -5, -1, 1, 5, 15].map(m =>
          '<button class="step' + (m > 0 ? " plus" : "") + '" data-m="' + m + '" aria-label="' + (m < 0 ? "Retirer " : "Ajouter ") + Math.abs(m) + ' minutes">' +
          (m < 0 ? "−" : "+") + Math.abs(m) + '</button>').join("") + '</div>' : '');
      if (adjusting) {
        row.querySelectorAll(".step").forEach(b => b.addEventListener("click", () => adjust(it.id, +b.dataset.m)));
      } else {
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        row.setAttribute("aria-pressed", it.startedAt ? "true" : "false");
        // Toucher la ligne lance ou met en pause ; toucher la description ne fait rien.
        row.addEventListener("click", (e) => { if (!e.target.closest(".desc-toggle, .desc")) toggle(it.id); });
        row.addEventListener("keydown", (e) => {
          if (e.target === row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(it.id); }
        });
      }
      wireDesc(row, it);
      listEl.appendChild(row);
    });

    if (doneCount) {
      const t = document.createElement("button");
      t.type = "button"; t.className = "more"; t.id = "toggle-done";
      t.setAttribute("aria-expanded", showDone ? "true" : "false");
      t.textContent = showDone
        ? "Masquer les activités terminées"
        : (doneCount === 1 ? "1 activité terminée · afficher" : doneCount + " activités terminées · afficher");
      t.onclick = () => { showDone = !showDone; render(); };
      listEl.appendChild(t);
    }
    if (skipCount && !adjusting) {
      const t = document.createElement("button");
      t.type = "button"; t.className = "more"; t.id = "skip-link";
      t.textContent = (skipCount === 1 ? "1 activité en pause aujourd'hui" : skipCount + " activités en pause aujourd'hui") + " · gérer";
      t.onclick = () => { skipping = true; render(); window.scrollTo({ top: 0 }); };
      if (doneCount) t.style.marginTop = "0";
      listEl.appendChild(t);
    }
    tick();
    renderFooter();
  }

  function tick() {
    let doneMs = 0, planMs = 0, finished = 0;
    const active = state.items.filter(x => !x.skip);
    active.forEach(it => {
      if (!isTime(it)) { if (it.acc >= it.target) finished++; return; }
      const el = elapsed(it), p = progress(it);
      doneMs += Math.min(el, it.target * 1000); planMs += it.target * 1000;
      if (p >= 1) finished++;
      if (p >= 1 && !it.notified) {
        it.notified = true;
        // Objectif atteint pendant que le minuteur tourne : on l'arrête, puis l'activité quitte la liste.
        if (it.startedAt) {
          it.acc += Date.now() - it.startedAt; it.startedAt = null; chime();
          announce("Objectif atteint : " + it.name);
          if (!adjusting && !editing) needsRender = true;
        }
        save();
      }
      const row = listEl.querySelector('[data-id="' + it.id + '"]');
      if (!row) return;
      const done = p >= 1, running = !!it.startedAt, started = el >= 1000 || running;
      row.classList.toggle("running", running);
      row.classList.toggle("done", done && !running);
      row.classList.toggle("started", started && !done && !running);
      row.classList.toggle("idle", !started);
      setBar(row, Math.min(100, p * 100));
      row.querySelector(".el").textContent = started ? fmtClock(el) : "";
      const tg = row.querySelector(".tg");
      tg.textContent = started ? "/ " + fmtShort(it.target) : fmtShort(it.target);
      tg.classList.toggle("alone", !started);
    });
    document.getElementById("sumDone").textContent = fmtTotal(doneMs);
    document.getElementById("sumPlan").textContent = fmtTotal(planMs);
    document.getElementById("sumCount").textContent = finished + "/" + active.length;
    document.getElementById("sumBar").style.width = (planMs ? Math.min(100, doneMs / planMs * 100) : 0) + "%";
    const r = state.items.find(x => x.startedAt);
    document.title = r ? fmtClock(elapsed(r)) + " · " + r.name : "Ma journée";
  }

  // Bandeau des modes « Ajuster le temps » et « Modifier les activités ».
  function renderMode() {
    modeEl.hidden = !(adjusting || editing || skipping);
    if (modeEl.hidden) return;
    modeEl.innerHTML = '<p></p><button class="pill" type="button" id="mode-done">Terminé</button>';
    modeEl.querySelector("p").textContent = skipping
      ? "Désactivez les activités à mettre de côté aujourd'hui. Elles reviennent automatiquement demain."
      : adjusting
      ? "Ajoutez ou retirez des minutes, par exemple si vous avez oublié de lancer ou d'arrêter un minuteur."
      : "Renommez, changez les objectifs, ajoutez ou supprimez des activités. L'icône ≡ ajoute une description.";
    modeEl.querySelector("button").onclick = () => {
      if (editing) state.items = state.items.filter(x => x.name.trim());
      editing = false; adjusting = false; skipping = false; save(); render();
    };
  }

  // ----- Export et import (enveloppe commune de l'écosystème, ECOSYSTEME.md §6) -----

  function exportData() {
    const envelope = {
      format: "ecosysteme.export",
      formatVersion: 1,
      app: "ma-journee",
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA,
      exportedAt: new Date().toISOString(),
      data: { state: JSON.parse(JSON.stringify(state)) }
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ma-journee-export-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notice = { text: "Export enregistré : " + a.download + "." };
    announce(notice.text);
    renderFooter();
  }

  const validItem = (x) => x && typeof x === "object" && typeof x.name === "string" &&
    TYPES.includes(x.type) && typeof x.target === "number" && x.target > 0;

  // Lit un fichier d'export et renvoie l'état prêt à remplacer l'actuel, ou lève une erreur en clair.
  function parseImport(text) {
    let e;
    try { e = JSON.parse(text); } catch (err) { throw new Error("Ce fichier n'est pas un export lisible."); }
    if (!e || e.format !== "ecosysteme.export") throw new Error("Ce fichier n'est pas un export de l'écosystème.");
    if (e.app !== "ma-journee") throw new Error("Cet export vient d'une autre app (" + String(e.app) + ").");
    if (!Number.isInteger(e.schemaVersion) || e.schemaVersion > SCHEMA) throw new Error("Cet export vient d'une version plus récente de l'app. Mettez l'app à jour, puis réessayez.");
    const s = e.data && e.data.state;
    if (!s || !Array.isArray(s.items) || !s.items.length || !s.items.every(validItem)) throw new Error("La liste d'activités de ce fichier est vide ou abîmée.");
    let next = migrate(Object.assign({}, s, { schemaVersion: e.schemaVersion }));
    next.items = next.items.map(x => Object.assign({}, x, {
      id: typeof x.id === "string" && x.id ? x.id : uid(),
      desc: typeof x.desc === "string" ? x.desc : "",
      acc: typeof x.acc === "number" && x.acc >= 0 ? x.acc : 0,
      startedAt: typeof x.startedAt === "number" ? x.startedAt : null,
      notified: !!x.notified
    }));
    return { state: normalize(next), exportedAt: e.exportedAt };
  }

  const fileInput = document.getElementById("import-file");
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    f.text().then(text => {
      try {
        pendingImport = parseImport(text);
        notice = null;
      } catch (err) {
        pendingImport = null;
        notice = { text: err.message, err: true };
        announce(err.message);
      }
      renderFooter();
    });
  });

  function renderFooter() {
    footEl.innerHTML = "";
    if (editing || adjusting || skipping) return;
    const tgl = document.createElement("button");
    tgl.type = "button"; tgl.className = "options-toggle"; tgl.id = "options-toggle";
    tgl.setAttribute("aria-expanded", optionsOpen ? "true" : "false");
    tgl.innerHTML = 'Options <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>';
    tgl.onclick = () => { optionsOpen = !optionsOpen; confirmReset = false; pendingImport = null; notice = null; renderFooter(); };
    footEl.appendChild(tgl);
    if (!optionsOpen) return;

    const panel = document.createElement("div");
    panel.className = "panel";
    const running = state.items.some(x => x.startedAt);
    const n = state.items.length;
    panel.innerHTML =
      '<div class="opt"><span>Trier par</span><span class="seg">' +
        '<button type="button" data-sort="progress" id="sort-progress">Avancement</button>' +
        '<button type="button" data-sort="alpha" id="sort-alpha">A–Z</button></span></div>' +
      '<div class="opt"><label for="single">Un seul minuteur à la fois</label>' +
        '<span class="switch"><input type="checkbox" id="single" role="switch"><span></span></span></div>' +
      '<button type="button" class="opt" id="opt-adjust"><span>Ajuster le temps</span><span class="chev">›</span></button>' +
      '<button type="button" class="opt" id="opt-skip"><span>Mettre en pause aujourd\'hui</span><span class="chev">' +
        (state.items.some(x => x.skip) ? state.items.filter(x => x.skip).length + ' ›' : '›') + '</span></button>' +
      '<button type="button" class="opt" id="opt-edit"><span>Modifier les activités</span><span class="chev">›</span></button>' +
      (running ? '<button type="button" class="opt" id="opt-pause"><span>Tout mettre en pause</span></button>' : '') +
      '<button type="button" class="opt" id="opt-export"><span>Exporter mes données<span class="sub">Un fichier à garder en lieu sûr</span></span><span class="chev">↓</span></button>' +
      (pendingImport
        ? '<div class="opt"><span id="import-q"></span><span class="confirm"><button type="button" class="no" id="import-no">Annuler</button><button type="button" class="yes" id="import-yes">Remplacer</button></span></div>'
        : '<button type="button" class="opt" id="opt-import"><span>Importer des données<span class="sub">Remplace les activités actuelles</span></span><span class="chev">↑</span></button>') +
      (confirmReset
        ? '<div class="opt"><span>Tout remettre à zéro ?</span><span class="confirm"><button type="button" class="no" id="reset-no">Annuler</button><button type="button" class="yes" id="reset-yes">Remettre à zéro</button></span></div>'
        : '<button type="button" class="opt danger" id="opt-reset"><span>Remettre à zéro</span></button>') +
      (notice ? '<p class="notice' + (notice.err ? ' err' : '') + '" id="notice"></p>' : '') +
      '<p class="hint">Touchez une activité pour lancer ou mettre en pause son minuteur. Une activité disparaît quand elle atteint son objectif. Tout repart à zéro chaque nouveau jour, et les activités mises en pause reviennent.</p>' +
      '<p class="hint" id="version">Version ' + APP_VERSION + '</p>';

    panel.querySelectorAll(".seg button").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.sort === state.sort ? "true" : "false");
      b.onclick = () => { state.sort = b.dataset.sort; save(); render(); };
    });
    const single = panel.querySelector("#single");
    single.checked = state.single;
    single.onchange = () => { state.single = single.checked; save(); };
    panel.querySelector("#opt-adjust").onclick = () => { adjusting = true; optionsOpen = false; render(); window.scrollTo({ top: 0 }); };
    panel.querySelector("#opt-skip").onclick = () => { skipping = true; optionsOpen = false; render(); window.scrollTo({ top: 0 }); };
    panel.querySelector("#opt-edit").onclick = () => { editing = true; optionsOpen = false; render(); window.scrollTo({ top: 0 }); };
    if (running) panel.querySelector("#opt-pause").onclick = () => { pauseAll(); save(); render(); };
    panel.querySelector("#opt-export").onclick = exportData;
    if (pendingImport) {
      const m = pendingImport.state.items.length;
      panel.querySelector("#import-q").textContent = "Remplacer vos " + n + " activité" + (n > 1 ? "s" : "") + " par les " + m + " du fichier ?";
      panel.querySelector("#import-no").onclick = () => { pendingImport = null; renderFooter(); };
      panel.querySelector("#import-yes").onclick = () => {
        state = pendingImport.state; pendingImport = null; showDone = false;
        save();
        notice = { text: "Import terminé : " + state.items.length + " activités." };
        announce(notice.text);
        render();
      };
    } else {
      panel.querySelector("#opt-import").onclick = () => { notice = null; fileInput.click(); };
    }
    if (confirmReset) {
      panel.querySelector("#reset-no").onclick = () => { confirmReset = false; renderFooter(); };
      panel.querySelector("#reset-yes").onclick = () => { state.items = state.items.map(it => Object.assign(fresh(it), it.skip ? { skip: true } : {})); confirmReset = false; showDone = false; save(); render(); };
    } else {
      panel.querySelector("#opt-reset").onclick = () => { confirmReset = true; renderFooter(); };
    }
    if (notice) panel.querySelector("#notice").textContent = notice.text;
    footEl.appendChild(panel);
  }

  // Liste de toutes les activités avec un interrupteur : désactivé = en pause aujourd'hui.
  function renderSkip() {
    state.items.slice().sort(byName).forEach(it => {
      const row = document.createElement("label");
      row.className = "skiprow" + (it.skip ? " off" : "");
      row.innerHTML =
        '<span class="name"><span>' + esc(it.name) + '</span></span>' +
        '<span class="right"><span class="state">' + (it.skip ? "en pause" : "") + '</span>' +
        '<span class="switch"><input type="checkbox" role="switch" id="s-' + it.id + '"><span></span></span></span>';
      const cb = row.querySelector("input");
      cb.checked = !it.skip;
      cb.setAttribute("aria-label", it.name + " aujourd'hui");
      cb.onchange = () => {
        it.skip = !cb.checked;
        if (it.skip && it.startedAt) { it.acc += Date.now() - it.startedAt; it.startedAt = null; }
        row.classList.toggle("off", it.skip);
        row.querySelector(".state").textContent = it.skip ? "en pause" : "";
        save(); tick();
      };
      listEl.appendChild(row);
    });
  }

  const UNIT_OPTIONS = '<option value="time">min</option><option value="count">fois</option><option value="check">à cocher</option>';

  function renderEdit() {
    state.items.forEach(it => {
      const row = document.createElement("div");
      row.className = "edit-row";
      row.innerHTML =
        '<input type="text" id="n-' + it.id + '" aria-label="Nom de l\'activité">' +
        '<span class="unit">' +
          '<input type="number" min="1" inputmode="numeric" id="t-' + it.id + '" aria-label="Objectif">' +
          '<select id="u-' + it.id + '" aria-label="Unité">' + UNIT_OPTIONS + '</select>' +
        '</span>' +
        '<button class="descbtn" type="button" aria-label="Description"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 3.5h10M2 7h10M2 10.5h6"/></svg></button>' +
        '<button class="del" type="button" aria-label="Supprimer">×</button>' +
        '<div class="edit-desc" hidden></div>';
      const n = row.querySelector('input[type="text"]'), t = row.querySelector('input[type="number"]');
      const box = row.querySelector(".edit-desc"), dbtn = row.querySelector(".descbtn");
      const showArea = (focus) => {
        box.hidden = false; dbtn.classList.add("on"); dbtn.setAttribute("aria-expanded", "true");
        box.innerHTML = '<textarea id="d-' + it.id + '" rows="2" aria-label="Description de l\'activité" placeholder="Description\n- Side plank : 2×45 s / côté\n- Hollow hold : 3×30 s"></textarea>';
        const ta = box.querySelector("textarea");
        const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
        ta.value = it.desc || "";
        ta.oninput = () => { it.desc = ta.value; save(); grow(); };
        requestAnimationFrame(grow);
        if (focus) ta.focus();
      };
      dbtn.setAttribute("aria-expanded", "false");
      if ((it.desc || "").trim()) showArea(false);
      dbtn.onclick = () => {
        if (box.hidden) showArea(true);
        else if (!(it.desc || "").trim()) { box.hidden = true; box.innerHTML = ""; dbtn.classList.remove("on"); dbtn.setAttribute("aria-expanded", "false"); }
        else box.querySelector("textarea").focus();
      };
      n.value = it.name;
      n.oninput = () => { it.name = n.value; save(); };
      const u = row.querySelector("select");
      const showNumber = () => { const c = it.type === "check"; t.style.visibility = c ? "hidden" : ""; t.disabled = c; };
      u.value = it.type;
      t.value = it.type === "time" ? Math.round(it.target / 60) : it.type === "count" ? it.target : "";
      showNumber();
      t.oninput = () => { const v = Math.max(1, +t.value || 1); it.target = it.type === "time" ? v * 60 : v; it.notified = progress(it) >= 1; save(); };
      // Changer d'unité : on garde le nombre affiché, mais la progression du jour repart de zéro
      // (des minutes ne se convertissent pas en répétitions).
      u.onchange = () => {
        const type = u.value, v = Math.max(1, +t.value || (type === "time" ? 30 : 10));
        it.type = type;
        it.target = type === "time" ? v * 60 : type === "check" ? 1 : v;
        it.acc = 0; it.startedAt = null; it.notified = false;
        t.value = type === "check" ? "" : v;
        showNumber(); save();
      };
      row.querySelector(".del").onclick = () => { state.items = state.items.filter(x => x.id !== it.id); save(); render(); };
      listEl.appendChild(row);
    });
    const form = document.createElement("form");
    form.className = "add";
    form.innerHTML =
      '<input name="name" id="add-name" placeholder="Nouvelle activité" required>' +
      '<input name="target" id="add-target" type="number" min="1" inputmode="numeric" placeholder="30" required aria-label="Objectif">' +
      '<span class="sel"><select name="type" id="add-type" aria-label="Unité">' + UNIT_OPTIONS + '</select></span>' +
      '<button class="addbtn" type="submit">Ajouter</button>';
    const tgt = form.querySelector("#add-target"), typ = form.querySelector("#add-type");
    typ.onchange = () => {
      const c = typ.value === "check";
      tgt.disabled = c; tgt.required = !c; tgt.style.visibility = c ? "hidden" : "";
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(form), type = f.get("type"), v = Math.max(1, +f.get("target") || 1);
      state.items.push(fresh({ name: f.get("name").trim() || "Activité", type, target: type === "time" ? v * 60 : type === "check" ? 1 : v }));
      save(); render();
    };
    listEl.appendChild(form);
  }

  document.getElementById("date").textContent = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });

  save();   // enregistre la version de schéma dès le premier chargement
  render();
  setInterval(() => {
    if (state.date !== today()) { state = load(); save(); render(); return; }
    if (!editing) tick();
    if (needsRender) { needsRender = false; render(); }
  }, 500);

  // Garde les données si le navigateur manque de place (aucune donnée n'existe ailleurs).
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ----- Service worker : mise à jour proposée, jamais imposée (D-005) -----
  if ("serviceWorker" in navigator) {
    const banner = document.getElementById("update");
    let waiting = null, reloading = false;
    const offer = (w) => { waiting = w; banner.hidden = false; };
    document.getElementById("update-later").onclick = () => { banner.hidden = true; };
    document.getElementById("update-reload").onclick = () => {
      if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading && waiting) { reloading = true; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
        });
      });
      // Vérifie les mises à jour quand on revient dans l'app.
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  }
})();
