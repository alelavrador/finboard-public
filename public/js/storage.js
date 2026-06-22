import { APP, NAV, esc, escAttr, fmtBRL, fmtShort, fmtDate, monthKey, monthLabel, accountLabel, isCardAccount, txCategoryName, getItemName, _allUniqueCatsCache, allUniqueCats, _invalidateCatsCache, translateCat, PALETTE, catColor } from './utils.js';
import { normalizeData, populateFilters } from './normalize.js';
import { renderOverview, renderFinance, renderCreditCards, renderInvestments, renderEditar } from './render.js';

// ═════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  rules:          'pluggy_rules_allinone',
  manual:         'pluggy_manual_allinone',
  customNames:    'pluggy_custom_names_v1',
  catGroups:      'pluggy_cat_groups_v1',
  catNames:       'pluggy_cat_custom_names_v1',
  manualCards:    'pluggy_manual_cards_v1',
  manualCardTxs:  'pluggy_manual_card_txs_v1',
  exclCats:       'pluggy_excl_cats_v1',
  invCats:        'pluggy_inv_cats_v1',
  manualInvs:     'pluggy_manual_invs_v1',
};
const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);

const NAMES_KEY = STORAGE_KEYS.customNames;
const GROUPS_KEY = STORAGE_KEYS.catGroups;
const CAT_NAMES_KEY = STORAGE_KEYS.catNames;
const MANUAL_CARDS_KEY = STORAGE_KEYS.manualCards;
const MANUAL_CARD_TXS_KEY = STORAGE_KEYS.manualCardTxs;
const EXCL_CATS_KEY = STORAGE_KEYS.exclCats;
const INV_CATS_KEY = STORAGE_KEYS.invCats;
const MANUAL_INVS_KEY = STORAGE_KEYS.manualInvs;

const STORAGE_CACHE = {};      // chave → valor decodificado (object/array)
const STORAGE_PENDING = new Set(); // chaves com PUT pendente (não confirmado pelo servidor)
const STORAGE_STATE = {
  backendOnline: true,         // true = saves estão indo pro servidor
  bootDone: false,             // true após bootStorage completar
  lastError: null,
};

function storageDefault(k) {
  // {} para mapas, [] para listas
  if (k === STORAGE_KEYS.rules) return [];
  if (k === STORAGE_KEYS.catGroups) return [];
  if (k === STORAGE_KEYS.manualCards) return [];
  if (k === STORAGE_KEYS.manualCardTxs) return [];
  if (k === STORAGE_KEYS.exclCats) return [];
  if (k === STORAGE_KEYS.manualInvs) return [];
  return {};
}

function storageGet(k) {
  if (k in STORAGE_CACHE) return STORAGE_CACHE[k];
  // fallback: tenta ler do localStorage (caso bootStorage ainda não tenha rodado)
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw);
  } catch {}
  return storageDefault(k);
}

function storageSet(k, v) {
  STORAGE_CACHE[k] = v;
  // espelho local: continua escrevendo no localStorage para sobreviver a F5 sem rede
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  // dispara PUT no servidor em background
  if (STORAGE_STATE.bootDone) _storagePushKey(k, v);
}

async function _storagePushKey(k, v) {
  try {
    STORAGE_PENDING.add(k);
    const r = await fetch(`/api/kv/${encodeURIComponent(k)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: v }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    STORAGE_PENDING.delete(k);
    if (!STORAGE_STATE.backendOnline) {
      STORAGE_STATE.backendOnline = true;
      STORAGE_STATE.lastError = null;
      updateStorageBanner();
    }
  } catch (e) {
    STORAGE_STATE.backendOnline = false;
    STORAGE_STATE.lastError = e.message;
    updateStorageBanner();
  }
}

// Carga inicial: lê tudo do backend de uma vez
async function bootStorage() {
  try {
    const r = await fetch('/api/kv');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.message || 'backend retornou erro');

    const remote = j.data || {};
    // Para cada chave permitida, decide entre remote e localStorage
    for (const k of ALL_STORAGE_KEYS) {
      if (k in remote) {
        STORAGE_CACHE[k] = remote[k];
        try { localStorage.setItem(k, JSON.stringify(remote[k])); } catch {}
      } else {
        // Backend não tem essa chave. Se o localStorage tem, MIGRA: envia
        // o valor local para o servidor.
        let local = null;
        try {
          const raw = localStorage.getItem(k);
          if (raw) local = JSON.parse(raw);
        } catch {}
        if (local !== null) {
          STORAGE_CACHE[k] = local;
          _storagePushKey(k, local); // migração silenciosa
        } else {
          STORAGE_CACHE[k] = storageDefault(k);
        }
      }
    }
    STORAGE_STATE.backendOnline = true;
    STORAGE_STATE.lastError = null;
  } catch (e) {
    // Backend offline na carga: usa apenas localStorage
    console.warn('[storage] backend offline, modo somente local:', e.message);
    STORAGE_STATE.backendOnline = false;
    STORAGE_STATE.lastError = e.message;
    for (const k of ALL_STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        STORAGE_CACHE[k] = raw ? JSON.parse(raw) : storageDefault(k);
      } catch {
        STORAGE_CACHE[k] = storageDefault(k);
      }
    }
  } finally {
    STORAGE_STATE.bootDone = true;
    updateStorageBanner();
  }
}

// Tenta reenviar todas as chaves do cache para o servidor (botão "Sincronizar")
async function storageResyncAll() {
  try {
    const body = { data: STORAGE_CACHE };
    const r = await fetch('/api/kv/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.ok) throw new Error(j.message || 'falha bulk');
    STORAGE_PENDING.clear();
    STORAGE_STATE.backendOnline = true;
    STORAGE_STATE.lastError = null;
    updateStorageBanner();
    return { ok: true, written: j.written };
  } catch (e) {
    STORAGE_STATE.backendOnline = false;
    STORAGE_STATE.lastError = e.message;
    updateStorageBanner();
    return { ok: false, error: e.message };
  }
}

function updateStorageBanner() {
  const el = document.getElementById('storageBanner');
  if (!el) return;
  if (STORAGE_STATE.backendOnline) {
    el.style.display = 'none';
    el.innerHTML = '';
  } else {
    el.style.display = 'block';
    el.innerHTML = `
      <div class="storage-banner-inner">
        <span class="storage-banner-dot"></span>
        <div style="flex:1">
          <strong>Modo somente local</strong> · Servidor indisponível${STORAGE_STATE.lastError?': '+esc(STORAGE_STATE.lastError):''}. Suas alterações estão salvas no navegador, mas não foram replicadas para o backend.
        </div>
        <button id="btnStorageResync" class="btn" style="font-size:11px;padding:5px 10px">Tentar sincronizar</button>
      </div>`;
    const btn = document.getElementById('btnStorageResync');
    if (btn) {
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Sincronizando...';
        const r = await storageResyncAll();
        btn.disabled = false;
        btn.textContent = r.ok ? 'Sincronizado ✓' : 'Tentar sincronizar';
      };
    }
  }
}

// ─── Storage API pública (compatível com versão localStorage anterior) ───────
const getRules         = () => storageGet(STORAGE_KEYS.rules);
const saveRules        = v  => storageSet(STORAGE_KEYS.rules, v);
const getManual        = () => storageGet(STORAGE_KEYS.manual);
const saveManual       = v  => storageSet(STORAGE_KEYS.manual, v);
const getCustomNames   = () => storageGet(STORAGE_KEYS.customNames);
const saveCustomNames  = v  => storageSet(STORAGE_KEYS.customNames, v);
const getCatGroups     = () => storageGet(STORAGE_KEYS.catGroups);
const saveCatGroups    = v  => storageSet(STORAGE_KEYS.catGroups, v);
const getManualCards   = () => storageGet(STORAGE_KEYS.manualCards);
const saveManualCards  = v  => storageSet(STORAGE_KEYS.manualCards, v);
const getManualCardTxs = () => storageGet(STORAGE_KEYS.manualCardTxs);
const saveManualCardTxs= v  => storageSet(STORAGE_KEYS.manualCardTxs, v);
const getExclCats      = () => storageGet(STORAGE_KEYS.exclCats);
const saveExclCats     = v  => storageSet(STORAGE_KEYS.exclCats, v);
const getCatNames      = () => storageGet(STORAGE_KEYS.catNames);
const saveCatNames     = v  => storageSet(STORAGE_KEYS.catNames, v);
const getInvCats       = () => storageGet(STORAGE_KEYS.invCats);
const saveInvCats      = v  => storageSet(STORAGE_KEYS.invCats, v);
const getManualInvs    = () => storageGet(STORAGE_KEYS.manualInvs);
const saveManualInvs   = v  => storageSet(STORAGE_KEYS.manualInvs, v);

// ─── Export / Import JSON ────────────────────────────────────────────────────
function exportAllStorage() {
  const dump = {};
  for (const k of ALL_STORAGE_KEYS) dump[k] = storageGet(k);
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
  a.href = url; a.download = `finboard-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

async function importAllStorage(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { alert('Arquivo inválido: não é um JSON válido.'); return; }
  if (!parsed || typeof parsed !== 'object') {
    alert('Arquivo inválido: estrutura inesperada.'); return;
  }
  const keysToImport = Object.keys(parsed).filter(k => ALL_STORAGE_KEYS.includes(k));
  if (!keysToImport.length) {
    alert('Nenhuma chave conhecida encontrada no arquivo.'); return;
  }
  if (!confirm(`Importar ${keysToImport.length} chave(s) do arquivo? Dados atuais serão substituídos.`)) return;

  // Atualiza cache e localStorage imediatamente
  for (const k of keysToImport) {
    STORAGE_CACHE[k] = parsed[k];
    try { localStorage.setItem(k, JSON.stringify(parsed[k])); } catch {}
  }
  // Envia bulk pro backend
  try {
    const r = await fetch('/api/kv/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: parsed }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    alert(`Importado localmente, mas falha ao replicar no servidor: ${e.message}`);
  }
  // Recarrega dados e UI
  normalizeData(); populateFilters();
  renderOverview(); renderFinance(); renderCreditCards();
  renderInvestments(); renderEditar();
  alert(`Importadas ${keysToImport.length} chave(s) com sucesso.`);
}

const applyCatGroups  = cat => { const g=getCatGroups().find(g=>(g.categories||[]).includes(cat)); return g?g.groupName:cat; };


export { STORAGE_KEYS, ALL_STORAGE_KEYS, NAMES_KEY, GROUPS_KEY, CAT_NAMES_KEY, MANUAL_CARDS_KEY, MANUAL_CARD_TXS_KEY, EXCL_CATS_KEY, INV_CATS_KEY, MANUAL_INVS_KEY, STORAGE_CACHE, STORAGE_PENDING, STORAGE_STATE, storageDefault, storageGet, storageSet, _storagePushKey, bootStorage, storageResyncAll, updateStorageBanner, getRules, saveRules, getManual, saveManual, getCustomNames, saveCustomNames, getCatGroups, saveCatGroups, getManualCards, saveManualCards, getManualCardTxs, saveManualCardTxs, getExclCats, saveExclCats, getCatNames, saveCatNames, getInvCats, saveInvCats, getManualInvs, saveManualInvs, exportAllStorage, importAllStorage, applyCatGroups };
