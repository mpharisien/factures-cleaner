// ============================================================
// Factures Cleaner - content.js
// S'injecte sur la page Lucca et applique les filtres/tris
// ============================================================

const DEFAULT_SETTINGS = {
  filterCloture: true,
  filterAnnule: true,
  filterRefuse: true,
  filterEnCours: false,
  filterApprouve: false,
  filterApprouveFacturesCompletes: true,
  sortColumn: null,
  sortDirection: null,
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Mapping statuts affichés → clé de setting
const STATUS_MAP = {
  'approuvé':  'filterApprouve',
  'clôturé':   'filterCloture',
  'annulé':    'filterAnnule',
  'refusé':    'filterRefuse',
  'en cours':  'filterEnCours',
};

// ── Récupération des lignes du tableau ───────────────────────

function getTableRows() {
  return Array.from(document.querySelectorAll('table tbody tr'));
}

// ── Lecture du statut d'une ligne ────────────────────────────

function getStatusFromRow(row) {
  // Lucca affiche le statut dans un badge coloré
  const badge = row.querySelector('[class*="badge"], [class*="status"], [class*="chip"], [class*="tag"]');
  if (badge) return badge.textContent.trim().toLowerCase();

  // Fallback : parcourir toutes les cellules
  for (const cell of row.querySelectorAll('td')) {
    const text = cell.textContent.trim().toLowerCase();
    if (STATUS_MAP[text] !== undefined) return text;
  }
  return null;
}

// ── Lecture des factures reçues d'une ligne ──────────────────

function getFacturesFromRow(row) {
  for (const cell of row.querySelectorAll('td')) {
    const match = cell.textContent.trim().match(/^(\d+)\/(\d+)$/);
    if (match) {
      return { received: parseInt(match[1]), total: parseInt(match[2]) };
    }
  }
  return null;
}

function isFacturesComplete(row) {
  const f = getFacturesFromRow(row);
  return f !== null && f.total > 0 && f.received === f.total;
}

// ── Application des filtres ──────────────────────────────────

function applyFilters() {
  const rows = getTableRows();

  rows.forEach(row => {
    const status = getStatusFromRow(row);
    let shouldHide = false;

    if (status) {
      // Filtre statut simple
      const key = STATUS_MAP[status];
      if (key && currentSettings[key]) {
        shouldHide = true;
      }

      // Règle combinée : Approuvé + toutes les factures reçues
      if (
        !shouldHide &&
        status === 'approuvé' &&
        currentSettings.filterApprouveFacturesCompletes &&
        isFacturesComplete(row)
      ) {
        shouldHide = true;
      }
    }

    row.style.display = shouldHide ? 'none' : '';
  });
}

// ── Tri des colonnes ─────────────────────────────────────────

let sortState = { column: null, direction: null };

function getCellValue(row, colIndex) {
  const cells = row.querySelectorAll('td');
  return cells[colIndex] ? cells[colIndex].textContent.trim() : '';
}

function parseValue(text) {
  // Montant : "48 000,00 €" ou "8 107,50 CHF" → nombre
  const cleaned = text.replace(/\s/g, '').replace(',', '.').replace(/[€CHF]/g, '').trim();
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  // Factures "3/12" → trier sur le ratio reçu/total
  const facture = text.match(/^(\d+)\/(\d+)$/);
  if (facture) return parseInt(facture[1]) / Math.max(parseInt(facture[2]), 1);

  return text.toLowerCase();
}

function sortTable(colIndex) {
  const tbody = document.querySelector('table tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));

  // Toggle direction si même colonne, sinon asc par défaut
  if (sortState.column === colIndex) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = colIndex;
    sortState.direction = 'asc';
  }

  rows.sort((a, b) => {
    const va = parseValue(getCellValue(a, colIndex));
    const vb = parseValue(getCellValue(b, colIndex));
    if (va < vb) return sortState.direction === 'asc' ? -1 : 1;
    if (va > vb) return sortState.direction === 'asc' ? 1 : -1;
    return 0;
  });

  rows.forEach(row => tbody.appendChild(row));

  // Sauvegarde le tri
  currentSettings.sortColumn = colIndex;
  currentSettings.sortDirection = sortState.direction;
  saveSettings();

  updateSortIndicators();
  applyFilters();
}

function updateSortIndicators() {
  document.querySelectorAll('.fc-sort-btn').forEach((btn, i) => {
    btn.classList.remove('fc-sort-asc', 'fc-sort-desc');
    if (i === sortState.column) {
      btn.classList.add(sortState.direction === 'asc' ? 'fc-sort-asc' : 'fc-sort-desc');
    }
  });
}

function injectSortButtons() {
  const headers = document.querySelectorAll('table thead th');
  if (!headers.length) return;

  headers.forEach((th, i) => {
    if (th.querySelector('.fc-sort-btn')) return; // déjà injecté

    const btn = document.createElement('button');
    btn.className = 'fc-sort-btn';
    btn.setAttribute('aria-label', 'Trier cette colonne');
    btn.innerHTML = `<span class="fc-sort-icon">⇅</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortTable(i);
    });

    th.appendChild(btn);
  });

  // Restaurer le tri sauvegardé au chargement
  if (currentSettings.sortColumn !== null && currentSettings.sortDirection) {
    sortState.column = currentSettings.sortColumn;
    sortState.direction = currentSettings.sortDirection;
    updateSortIndicators();
  }
}

// ── Persistance via chrome.storage.sync ──────────────────────

function saveSettings() {
  chrome.storage.sync.set({ facturesCleanerSettings: currentSettings });
}

function loadSettings(callback) {
  chrome.storage.sync.get(['facturesCleanerSettings'], (result) => {
    if (result.facturesCleanerSettings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...result.facturesCleanerSettings };
    }
    callback();
  });
}

// ── Écoute les messages du popup ─────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_SETTINGS') {
    currentSettings = { ...currentSettings, ...message.settings };
    saveSettings();
    applyFilters();
    sendResponse({ ok: true });
  }
  if (message.type === 'GET_SETTINGS') {
    sendResponse({ settings: currentSettings });
  }
  return true; // Nécessaire pour les réponses async
});

// ── Observation DOM (Lucca est une Single Page App) ──────────

let debounceTimer = null;

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    injectSortButtons();
    applyFilters();
  }, 300);
});

// ── Initialisation ───────────────────────────────────────────

function init() {
  loadSettings(() => {
    injectSortButtons();
    applyFilters();

    // Observer les changements du tableau (navigation SPA sans rechargement)
    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}