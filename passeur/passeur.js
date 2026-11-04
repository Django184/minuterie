// Passeur de l'ancienne adresse (https://django184.github.io/minuterie/) — ECOSYSTEME.md §7.4.
// Lit les données de Ma journée gardées sur cet appareil à l'ancienne adresse et les transmet
// à la nouvelle dans le fragment de l'URL (jamais envoyé à un serveur), au format d'export commun.
// La nouvelle adresse demande confirmation avant d'écrire. Les données d'ici ne sont pas effacées.
(function () {
  const cible = document.querySelector('meta[name="cible"]').content;
  const lien = document.getElementById("lien");
  lien.href = cible;

  function base64url(texte) {
    const octets = new TextEncoder().encode(texte);
    let bin = "";
    for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  let adresse = cible;
  try {
    const brut = localStorage.getItem("journee-timers-v1");
    const state = brut ? JSON.parse(brut) : null;
    if (state && Array.isArray(state.items) && state.items.length) {
      const enveloppe = {
        format: "ecosysteme.export",
        formatVersion: 1,
        app: "ma-journee",
        appVersion: "passeur",
        schemaVersion: Number.isInteger(state.schemaVersion) ? state.schemaVersion : 1,
        exportedAt: new Date().toISOString(),
        data: { state: state }
      };
      adresse = cible + "#/demenagement/" + base64url(JSON.stringify(enveloppe));
    }
  } catch (e) {
    document.getElementById("etat").textContent =
      "Vos activités n'ont pas pu être lues ici. Ouvrez la nouvelle adresse et recréez-les, ou importez un export.";
    return;
  }
  lien.href = adresse;
  location.replace(adresse);
})();
