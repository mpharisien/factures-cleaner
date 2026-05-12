// ============================================================
// Factures Filter - popup.js
// Gère l'interface du popup et la communication avec content.js
// ============================================================

//Toggle ON = afficher, toggle OFF = masquer
const DEFAULT_SETTINGS = {
  filterCloture: false,
  filterAnnule: false,
  filterRefuse: false,
  filterApprobation: true,
  filterApprouve: true,
  filterFacturesCompletes: true, // masque les DA qui sont approuvées et qui ont toutes leurs factures
  filterAbonnements: false,  // masque les DA qui ont plus d'une facture à déposer
};
 
const TOGGLE_IDS = [
  'filterCloture',
  'filterAnnule',
  'filterRefuse',
  'filterApprobation',
  'filterApprouve',
  'filterFacturesCompletes',
  'filterAbonnements'
];
 
// ── Afficher les compteurs ───────────────────────────────────

function updateCounts(counts) {
  if (!counts) return;
  console.log('counts reçus:', counts);
  const map = {
    filterCloture:                   counts.filterCloture,
    filterAnnule:                    counts.filterAnnule,
    filterRefuse:                    counts.filterRefuse,
    filterApprobation:               counts.filterApprobation,
    filterApprouve:                  counts.filterApprouve,
    filterFacturesCompletes:         counts.filterFacturesCompletes,
    filterAbonnements:               counts.filterAbonnements,
  };
  Object.entries(map).forEach(([key, val]) => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = val > 0 ? `(${val})` : '';
  });
}

// ── Charger les préférences et remplir les toggles ───────────
 
function loadAndRender() {
  chrome.storage.sync.get(['facturesFilterSettings'], (result) => {
    const settings = result.facturesFilterSettings
      ? { ...DEFAULT_SETTINGS, ...result.facturesFilterSettings }
      : { ...DEFAULT_SETTINGS };

    TOGGLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!settings[id];
    });
  });
}
 
// ── Demander les compteurs à content.js ─────────────────────

function requestCounts() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_COUNTS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.counts) updateCounts(response.counts);
    });
  });
}

// ── Lire l'état actuel des toggles ──────────────────────────
 
function getCurrentSettings() {
  const settings = {};
  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) settings[id] = el.checked;
  });
  return settings;
}
 
// ── Sauvegarder et envoyer à content.js ─────────────────────
 
function saveAndApply() {
  const settings = getCurrentSettings();
  chrome.storage.sync.set({ facturesFilterSettings: settings });
 
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'UPDATE_SETTINGS',
      settings: settings,
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.counts) updateCounts(response.counts);
    });
  });
}
 
// ── Détecter si on est sur la bonne page ────────────────────
 
function checkActivePage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const url = tabs[0].url || '';
    const badge = document.getElementById('page-status');
    if (!badge) return;
 
    if (url.includes('ilucca.net/cleemy-procurement/purchases-mine')) {
      badge.textContent = '✅ Page Lucca active';
      badge.className = 'page-badge';
      requestCounts();
    } else {
      badge.textContent = '⚠️ Ouvrez la page Lucca pour appliquer les filtres';
      badge.className = 'page-badge page-badge-inactive';
    }
  });
}
 
// ── Réinitialiser ────────────────────────────────────────────
 
function resetSettings() {
  chrome.storage.sync.set({ facturesFilterSettings: DEFAULT_SETTINGS }, () => {
    TOGGLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!DEFAULT_SETTINGS[id];
    });
    saveAndApply();
  });
}
 
// ── Initialisation ───────────────────────────────────────────
 
document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  checkActivePage();
 
  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveAndApply);
  });
 
  const btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.addEventListener('click', resetSettings);
});