// ============================================================
// Factures Cleaner - content.js
// Filtres et tri pour la page Lucca "Mes demandes d'achat"
// ============================================================

const DEFAULT_SETTINGS = {
  filterCloture: false,
  filterAnnule: false,
  filterRefuse: false,
  filterEnCours: true,
  filterApprouve: true,
  filterApprouveFacturesCompletes: true,
  sortColumn: null,
  sortDirection: null,
};
 
let currentSettings = { ...DEFAULT_SETTINGS };
 
// ── Lecture du statut ────────────────────────────────────────
// Lucca : <span class="statusBadge ..."><span ...> Approuvé </span></span>
 
function getStatusFromRow(row) {
  const badge = row.querySelector('.statusBadge span');
  if (badge) return badge.textContent.trim().toLowerCase();
  return null;
}
 
// ── Lecture des factures reçues ──────────────────────────────
// Lucca : <td class="... mod-cellReceivedInvoices"> 0/8 </td>
 
function getFacturesFromRow(row) {
  const cell = row.querySelector('.mod-cellReceivedInvoices');
  if (!cell) return null;
  const match = cell.textContent.trim().match(/(\d+)\/(\d+)/);
  if (match) return { received: parseInt(match[1]), total: parseInt(match[2]) };
  return null;
}
 
function isFacturesComplete(row) {
  const f = getFacturesFromRow(row);
  return f !== null && f.total > 0 && f.received === f.total;
}
 
// ── Application des filtres ──────────────────────────────────
// toggle OFF (false) = masquer ce statut
// toggle ON  (true)  = afficher ce statut
 
function applyFilters() {
  const rows = document.querySelectorAll('table.indexTable tbody tr.indexTable-body-row');
 
  rows.forEach(row => {
    const status = getStatusFromRow(row);
    let shouldHide = false;
 
    if (status) {
      // Si le toggle du statut est OFF → masquer
      if (status === 'clôturé'  && !currentSettings.filterCloture)  shouldHide = true;
      if (status === 'annulé'   && !currentSettings.filterAnnule)    shouldHide = true;
      if (status === 'refusé'   && !currentSettings.filterRefuse)    shouldHide = true;
      if (status === 'en cours' && !currentSettings.filterEnCours)   shouldHide = true;
      if (status === 'approuvé' && !currentSettings.filterApprouve)  shouldHide = true;
 
      // Règle avancée : masquer les DA Approuvées avec toutes les factures reçues
      // (cette règle s'applique EN PLUS, même si filterApprouve est ON)
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
 
function getCellText(row, colIndex) {
  const cells = row.querySelectorAll('th, td');
  return cells[colIndex] ? cells[colIndex].textContent.trim() : '';
}
 
function parseForSort(text) {
  const amount = text.replace(/\s/g, '').replace(',', '.').replace(/[€CHF]/g, '');
  const num = parseFloat(amount);
  if (!isNaN(num)) return num;
 
  const facture = text.match(/^(\d+)\/(\d+)$/);
  if (facture) return parseInt(facture[1]) / Math.max(parseInt(facture[2]), 1);
 
  return text.toLowerCase();
}
 
function sortTable(colIndex) {
  const tbody = document.querySelector('table.indexTable tbody');
  if (!tbody) return;
 
  const rows = Array.from(tbody.querySelectorAll('tr.indexTable-body-row'));
 
  if (sortState.column === colIndex) {
    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.column = colIndex;
    sortState.direction = 'asc';
  }
 
  rows.sort((a, b) => {
    const va = parseForSort(getCellText(a, colIndex));
    const vb = parseForSort(getCellText(b, colIndex));
    if (va < vb) return sortState.direction === 'asc' ? -1 : 1;
    if (va > vb) return sortState.direction === 'asc' ? 1 : -1;
    return 0;
  });
 
  rows.forEach(row => tbody.appendChild(row));
 
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
  const headers = document.querySelectorAll('table.indexTable thead th');
  if (!headers.length) return;
 
  headers.forEach((th, i) => {
    if (th.querySelector('.fc-sort-btn')) return;
 
    const btn = document.createElement('button');
    btn.className = 'fc-sort-btn';
    btn.setAttribute('aria-label', 'Trier cette colonne');
    btn.innerHTML = '<span class="fc-sort-icon">⇅</span>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortTable(i);
    });
 
    th.appendChild(btn);
  });
 
  if (currentSettings.sortColumn !== null && currentSettings.sortDirection) {
    sortState.column = currentSettings.sortColumn;
    sortState.direction = currentSettings.sortDirection;
    updateSortIndicators();
  }
}
 
// ── Persistance ──────────────────────────────────────────────
 
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
 
// ── Messages depuis le popup ─────────────────────────────────
 
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
  return true;
});
 
// ── Observation DOM (SPA Angular) ────────────────────────────
 
let debounceTimer = null;
 
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    injectSortButtons();
    applyFilters();
  }, 400);
});
 
// ── Initialisation ───────────────────────────────────────────
 
function init() {
  loadSettings(() => {
    injectSortButtons();
    applyFilters();
 
    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  });
}
 
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}