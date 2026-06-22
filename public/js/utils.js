import { getCustomNames } from './storage.js';



// ─── State ───────────────────────────────────────────────────────────────────
const APP = {
  view: 'overview',
  raw: {settings:null,health:null,items:[],accounts:[],investments:[],identities:[],loans:[]},
  data: {accounts:[],cards:[],investments:[],transactions:[]},
  filters: {period:'all',month:'all',institution:'all',category:'all'},
  fin: {direction:'all',search:'',sort:'date',sortDir:'desc'},
  edit: {search:''},
  config: {
    categories:['Sem categoria','Alimentação','Assinaturas','Cartão','Compras','Educação','Entretenimento','Farmácia','Impostos','Investimentos','Lazer','Moradia','Outros','Restaurante','Saúde','Serviços','Supermercado','Transporte','Transferência','Salário','Freelance'],
    ruleStorageKey:'pluggy_rules_allinone',
    manualStorageKey:'pluggy_manual_allinone'
  }
};

const NAV = [
  {id:'overview',    title:'Visão Geral',        sub:'Resumo consolidado',
   icon:'<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'},
  {id:'finance',     title:'Contas',              sub:'Lançamentos e saldos',
   icon:'<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>'},
  {id:'creditcards',  title:'Cartões de Crédito',  sub:'Evolução das faturas',
   icon:'<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'},
  {id:'investments',  title:'Investimentos',        sub:'Patrimônio e evolução',
   icon:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'},
  {id:'connections', title:'Conexões',            sub:'Bancos e itens Pluggy',
   icon:'<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'},
  {id:'editar',      title:'Editar dados',        sub:'Nomes, categorias e grupos',
   icon:'<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>'},
  {id:'admin',       title:'Admin',               sub:'Secrets e configurações',
   icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'},
];

// ─── Utils ───────────────────────────────────────────────────────────────────
const esc     = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const escAttr = s => esc(s); // alias semântico para uso em atributos HTML
const fmtBRL  = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const fmtShort= v => { const n=Number(v||0); if(n>=1e6) return `R$${(n/1e6).toFixed(1)}M`; if(n>=1e3) return `R$${(n/1e3).toFixed(1)}k`; return `R$${n.toFixed(0)}`; };
const fmtDate = v => { if(!v) return '-'; try{return new Date(v).toLocaleDateString('pt-BR')}catch{return v} };
const monthKey   = d => { const x=new Date(d); if(isNaN(x)) return null; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}` };
const monthLabel = k => { if(!k) return '-'; const[y,m]=k.split('-'); return `${m}/${y.slice(2)}` };
const accountLabel   = a => { const cn=getCustomNames(); return cn[a.id]||a.name||a.marketingName||a.number||a.id||'Conta'; };
// isCardAccount: usa sinais estritos da Pluggy (creditData + type==='CREDIT')
// antes de cair para substring matching. Evita falsos positivos em contas
// com palavras como "Cartão" no nome marketing.
const isCardAccount  = a => {
  if(!a) return false;
  if(a.creditData) return true;
  const type=String(a.type||'').toUpperCase();
  const subtype=String(a.subtype||'').toUpperCase();
  // Sinais estritos do padrão Pluggy
  if(type==='CREDIT' || type==='CREDIT_CARD') return true;
  if(subtype==='CREDIT_CARD') return true;
  // Fallback por substring — só se outros sinais não baterem
  if(/credit[_\s-]?card|cartao[_\s-]?credito|cart[aã]o de cr[eé]dito/i.test(type+' '+subtype)) return true;
  return false;
};
const txCategoryName = tx => typeof tx.category==='string'?tx.category:(tx.category?.description||tx.category?.name||'Sem categoria');
const getItemName    = id => { const it=(APP.raw.items||[]).find(i=>i.id===id); return it?.connector?.name||'-' };



// Cache de categorias únicas — invalidado em normalizeData/populateFilters.
let _allUniqueCatsCache=null;
function allUniqueCats(){
  if(_allUniqueCatsCache) return _allUniqueCatsCache;
  _allUniqueCatsCache=[...new Set(APP.data.transactions.map(t => t.nativeCategory || t.categoryFinal).filter(Boolean))].sort();
  return _allUniqueCatsCache;
}
function _invalidateCatsCache(){ _allUniqueCatsCache=null; }
const translateCat = c => c || 'Sem categoria';
const PALETTE = ['#06f7b4','#4fa3fb','#f6a93b','#ff4d6d','#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#818cf8','#f87171','#94a3b8'];
const catColor = c => { let h=0; for(let i=0;i<c.length;i++) h=(h*31+c.charCodeAt(i))&0xfffffff; return PALETTE[h%PALETTE.length] };

// ═════════════════════════════════════════════════════════════════════════
// Storage: cache em memória sincronizado com backend SQLite.
//
// Estratégia:
//  - Carga inicial (bootStorage) lê tudo do backend em uma chamada e popula
//    STORAGE_CACHE. Faz fallback para localStorage se o backend falhar.
//  - APIs síncronas (getX/saveX) operam sobre o cache. saveX dispara um PUT
//    em background (fire-and-forget); falhas vão para uma fila de retry.
//  - localStorage funciona como espelho local: sobrevive a quedas do backend
//    e permite leitura offline.
//  - Modo readonly: quando o backend está offline, um banner avisa; tudo
//    continua funcionando localmente, mas o usuário sabe que mudanças não
//    estão sendo persistidas no servidor até a fila ser drenada.

export { APP, NAV, esc, escAttr, fmtBRL, fmtShort, fmtDate, monthKey, monthLabel, accountLabel, isCardAccount, txCategoryName, getItemName, _allUniqueCatsCache, allUniqueCats, _invalidateCatsCache, translateCat, PALETTE, catColor };
