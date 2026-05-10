// ============================================================
// Factures Cleaner - popup.js
// Gère l'interface du popup et la communication avec content.js
// ============================================================

//Toggle ON = afficher, toggle OFF = masquer
const DEFAULT_SETTINGS = {
  filterCloture: false,   // OFF par défaut = Clôturé masqué
  filterAnnule: false,    // OFF par défaut = Annulé masqué
  filterRefuse: false,    // OFF par défaut = Refusé masqué
  filterEnCours: true,    // ON  par défaut = En cours affiché
  filterApprouve: true,   // ON  par défaut = Approuvé affiché
  filterApprouveFacturesCompletes: true, // ON = règle active (masque les DA approuvées + toutes factures)
};
 
const TOGGLE_IDS = [
  'filterCloture',
  'filterAnnule',
  'filterRefuse',
  'filterEnCours',
  'filterApprouve',
  'filterApprouveFacturesCompletes',
];
 
// ── Charger les préférences et remplir les toggles ───────────
 
function loadAndRender() {
  chrome.storage.sync.get(['facturesCleanerSettings'], (result) => {
    const settings = result.facturesCleanerSettings
      ? { ...DEFAULT_SETTINGS, ...result.facturesCleanerSettings }
      : { ...DEFAULT_SETTINGS };
 
    TOGGLE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!settings[id];
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
  chrome.storage.sync.set({ facturesCleanerSettings: settings });
 
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'UPDATE_SETTINGS',
      settings: settings,
    }).catch(() => {});
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
    } else {
      badge.textContent = '⚠️ Ouvrez la page Lucca pour appliquer les filtres';
      badge.className = 'page-badge page-badge-inactive';
    }
  });
}
 
// ── Réinitialiser ────────────────────────────────────────────
 
function resetSettings() {
  chrome.storage.sync.set({ facturesCleanerSettings: DEFAULT_SETTINGS }, () => {
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