// ============================================================
// Factures Cleaner - popup.js
// Gère l'interface du popup et la communication avec content.js
// ============================================================

const DEFAULT_SETTINGS = {
  filterCloture: true,
  filterAnnule: true,
  filterRefuse: true,
  filterEnCours: false,
  filterApprouve: false,
  filterApprouveFacturesCompletes: true,
};

// Liste de tous les toggles du popup
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

// ── Lire l'état actuel de tous les toggles ───────────────────

function getCurrentSettings() {
  const settings = {};
  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) settings[id] = el.checked;
  });
  return settings;
}

// ── Sauvegarder et envoyer à la page Lucca ───────────────────

function saveAndApply() {
  const settings = getCurrentSettings();

  // Sauvegarde dans chrome.storage.sync
  chrome.storage.sync.set({ facturesCleanerSettings: settings });

  // Envoie les nouveaux réglages à content.js dans l'onglet actif
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'UPDATE_SETTINGS',
      settings: settings,
    }).catch(() => {
      // La page n'est pas une page Lucca, on ignore silencieusement
    });
  });
}

// ── Détecter si on est sur la bonne page Lucca ───────────────

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

// ── Réinitialiser aux valeurs par défaut ─────────────────────

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

  // Écouter chaque toggle : sauvegarde + application immédiate
  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', saveAndApply);
    }
  });

  // Bouton réinitialiser
  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', resetSettings);
  }
});