import { APP, NAV, esc, escAttr, fmtBRL, fmtShort, fmtDate, monthKey, monthLabel, accountLabel, isCardAccount, txCategoryName, getItemName, _allUniqueCatsCache, allUniqueCats, _invalidateCatsCache, translateCat, PALETTE, catColor } from './utils.js';
import { STORAGE_KEYS, ALL_STORAGE_KEYS, NAMES_KEY, GROUPS_KEY, CAT_NAMES_KEY, MANUAL_CARDS_KEY, MANUAL_CARD_TXS_KEY, EXCL_CATS_KEY, INV_CATS_KEY, MANUAL_INVS_KEY, STORAGE_CACHE, STORAGE_PENDING, STORAGE_STATE, storageDefault, storageGet, storageSet, _storagePushKey, bootStorage, storageResyncAll, updateStorageBanner, getRules, saveRules, getManual, saveManual, getCustomNames, saveCustomNames, getCatGroups, saveCatGroups, getManualCards, saveManualCards, getManualCardTxs, saveManualCardTxs, getExclCats, saveExclCats, getCatNames, saveCatNames, getInvCats, saveInvCats, getManualInvs, saveManualInvs, exportAllStorage, importAllStorage, applyCatGroups } from './storage.js';

// ─── Data ────────────────────────────────────────────────────────────────────
const ruleBasedCategory = desc => {
  const rules=getRules(), low=String(desc||'').toLowerCase();
  const f=rules.find(r=>low.includes(String(r.keyword||'').toLowerCase()));
  return f?f.category:null;
};

function normalizeData(){
  const manual=getManual();
  const invCats=getInvCats();
  const accounts=(APP.raw.accounts||[]).filter(a=>!isCardAccount(a));
  const cards=(APP.raw.accounts||[]).filter(a=>isCardAccount(a));
  // 1) Investimentos vindos da Pluggy
  const pluggyInvs=(APP.raw.investments||[]).map((inv,idx)=>{
    // invId estável: usa inv.id, senão code/isin, senão hash do nome+tipo+índice.
    // Necessário para persistir a categoria customizada de cada ativo.
    const invId = inv.id
                || inv.code
                || inv.isin
                || `inv_${(inv.name||inv.description||'x').replace(/\s+/g,'_')}_${inv.type||'?'}_${idx}`;
    const baseCat = inv.type || inv.subtype || 'Outros';
    return {
      ...inv,
      invId,
      currentValue:Number(inv.balance??inv.amount??inv.value??inv.currentAmount??inv.currentValue??0),
      displayName:inv.name||inv.description||inv.type||'Investimento',
      // categoryEditable reflete a escolha do usuário; fallback para o type da Pluggy
      categoryEditable: invCats[invId] || baseCat,
      _manual: false
    };
  });
  // 2) Investimentos manuais: usa último snapshot como currentValue
  const manualInvs=getManualInvs().map(inv=>{
    const snaps=inv.snapshots||{};
    const months=Object.keys(snaps).sort();
    const latestMonth=months[months.length-1]||null;
    const currentValue=latestMonth?Number(snaps[latestMonth]||0):0;
    return {
      id: inv.id,
      invId: inv.id,
      displayName: inv.name||'Investimento',
      name: inv.name,
      type: inv.category||'Outros',
      categoryEditable: invCats[inv.id] || inv.category || 'Outros',
      currentValue,
      snapshots: snaps,
      _manual: true,
      _latestMonth: latestMonth
    };
  });
  const investments=[...pluggyInvs,...manualInvs];
  const transactions=[];
  // ── Fallback de ID determinístico: account+date+description+amount+sequência ──
  // Resolve colisões quando duas transações do mesmo dia têm descrição e valor iguais.
  (APP.raw.accounts||[]).forEach(acc=>{
    const seenIds=new Map(); // chave→contador para suffix de desambiguação
    (acc.transactions||[]).forEach(tx=>{
      let id=tx.id;
      if(!id){
        const amount=Number(tx.amount||0);
        const baseKey=`${acc.id}|${tx.date}|${tx.description||''}|${amount}`;
        const seq=(seenIds.get(baseKey)||0);
        seenIds.set(baseKey,seq+1);
        id=seq===0?baseKey:`${baseKey}#${seq}`;
      }
      const nativeCategory=translateCat(txCategoryName(tx));
      const rawCategory=manual[id]||ruleBasedCategory(tx.description)||nativeCategory||'Sem categoria';
      const finalCategory=applyCatGroups(rawCategory);
      const amount=Number(tx.amount||0);
      transactions.push({...tx,id,accountId:acc.id,accountName:accountLabel(acc),itemId:acc.itemId,
        isCard:isCardAccount(acc),accountType:acc.type||'',accountSubtype:acc.subtype||'',
        nativeCategory,categoryFinal:finalCategory,
        amountAbs:Math.abs(amount),direction:amount>0?'income':'expense'});
    });
  });
  const manualCards=getManualCards();
  const manualTxs=getManualCardTxs().map(tx=>({...tx,amountAbs:Math.abs(Number(tx.amount||0)),direction:'expense',isCard:true}));
  transactions.push(...manualTxs);
  transactions.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  APP.data={accounts,cards:[...cards,...manualCards],investments,transactions};
  _invalidateCatsCache();
}

// Palavras-chave para identificar transações de investimento/transferência.
// Centralizadas para facilitar manutenção; podem ser estendidas via APP.config.
const INVEST_CAT_PATTERNS = [
  /invest/i, /aplica[cç][aã]o/i, /resgate/i,
  /tesouro/i, /cdb/i, /lci|lca/i, /\bfii?\b/i, /a[cç][oõ]es?/i,
  /renda\s+fixa|renda\s+vari[aá]vel/i, /previd[eê]ncia/i, /fundo/i
];
const TRANSFER_CAT_PATTERNS = [
  /transfer/i, /\bted\b/i, /\bdoc\b/i, /\bpix\b/i
];
const INVEST_ACCOUNT_TYPES = new Set(['INVESTMENT','INVESTMENTS','SECURITIES','BROKERAGE']);

const isInvestTx = tx => {
  if(!tx || tx.isCard) return false;

  // 1) Sinal estrito: tipo de conta = investimento (padrão Pluggy)
  const accType=String(tx.accountType||'').toUpperCase();
  const accSub=String(tx.accountSubtype||'').toUpperCase();
  if(INVEST_ACCOUNT_TYPES.has(accType) || INVEST_ACCOUNT_TYPES.has(accSub)) return true;
  if(/INVEST/.test(accType) || /INVEST/.test(accSub)) return true;

  // 2) Categoria configurável (regex tolerante a variações)
  const cat = (tx.categoryFinal||tx.nativeCategory||'').toString();
  if(INVEST_CAT_PATTERNS.some(p => p.test(cat))) return true;
  if(TRANSFER_CAT_PATTERNS.some(p => p.test(cat))) return true;

  // 3) Lista de exclusão definida pelo usuário (case-insensitive)
  const exclCats=getExclCats().map(c=>c.toLowerCase());
  if(exclCats.includes(cat.toLowerCase())) return true;

  return false;
};
function filteredTransactions(){
  const f=APP.filters, now=new Date();
  return APP.data.transactions.filter(tx=>{
    if(isInvestTx(tx)) return false;
    if(f.institution!=='all'&&tx.accountId!==f.institution) return false;
    if(f.category!=='all'&&tx.categoryFinal!==f.category) return false;
    if(f.period!=='all'){const diff=(now-new Date(tx.date))/(864e5); if(diff>Number(f.period)) return false}
    if(f.month!=='all'&&monthKey(tx.date)!==f.month) return false;
    return true;
  });
}

function filteredFinTransactions(){
  const base=filteredTransactions(), ff=APP.fin;
  const INVEST_CATS=['Investimento','Investments','investment','Renda Fixa','Renda Variável','Fundos','CDB','Tesouro','Ações','FII','Previdência','Blocked balances'];
  return base.filter(tx=>{
    // Exclude investment-type transactions
    if(ff.direction!=='all'&&tx.direction!==ff.direction) return false;
    if(ff.search){const low=ff.search.toLowerCase(); if(!String(tx.description||'').toLowerCase().includes(low)) return false}
    return true;
  });
}

function filteredTransactionsAllMonths(){
  // Like filteredTransactions but ignores month filter — used for card evolution chart
  const f=APP.filters, now=new Date();
  return APP.data.transactions.filter(tx=>{
    if(isInvestTx(tx)) return false;
    if(f.institution!=='all'&&tx.accountId!==f.institution) return false;
    if(f.category!=='all'&&tx.categoryFinal!==f.category) return false;
    if(f.period!=='all'){const diff=(now-new Date(tx.date))/(864e5); if(diff>Number(f.period)) return false}
    return true;
  });
}

function populateFilters(){
  APP._populatingFilters=true;
  // Populate month filter
  const mf=document.getElementById('monthFilter');
  if(mf){
    const months=[...new Set(APP.data.transactions.map(tx=>monthKey(tx.date)).filter(Boolean))].sort().reverse();
    mf.innerHTML=`<option value="all">Todos</option>${months.map(m=>`<option value="${m}" ${APP.filters.month===m?'selected':''}>${monthLabel(m)}</option>`).join('')}`;
  }
  const inst=document.getElementById('institutionFilter');
  const instLabel=document.getElementById('institutionFilterLabel');
  const cat=document.getElementById('categoryFilter');
  const isCCView=APP.view==='creditcards';
  // label dinâmico
  if(instLabel) instLabel.textContent=isCCView?'Cartão':'Conta';
  // opções dinâmicas: cartões na aba de cartões, contas correntes nas demais
  const accs=isCCView?APP.data.cards:APP.data.accounts;
  const allLabel=isCCView?'Todos':'Todas';
  inst.innerHTML=`<option value="all">${allLabel}</option>${accs.map(a=>`<option value="${esc(a.id)}">${esc(accountLabel(a))}</option>`).join('')}`;
  // Na aba Investimentos: dropdown mostra categorias de investimento.
  // Nas demais: categorias de transações (gastos/recebimentos).
  const isInvView = APP.view === 'investments';
  const cats = isInvView
    ? [...new Set((APP.data.investments||[]).map(i => i.categoryEditable||i.type||'Outros'))].sort()
    : [...new Set(APP.data.transactions.map(t => t.categoryFinal||'Sem categoria'))].sort();
  cat.innerHTML=`<option value="all">Todas</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}`;
  inst.value=APP.filters.institution; cat.value=APP.filters.category;
  APP._populatingFilters=false;
}

function monthlyCashflow(list){
  const map={};
  list.filter(tx=>!tx.isCard&&!isInvestTx(tx)).forEach(tx=>{
    const k=monthKey(tx.date); if(!k) return;
    if(!map[k]) map[k]={income:0,expense:0};
    map[k][tx.direction==='income'?'income':'expense']+=tx.amountAbs;
  });
  return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([month,v])=>({month,label:monthLabel(month),income:v.income,expense:v.expense,balance:v.income-v.expense}));
}

// monthlyInvested: calcula evolução do patrimônio investido por mês.
//
// Estratégia: o valor ATUAL é tomado como verdade no mês corrente. Para meses
// anteriores, subtraímos aportes líquidos (aportes - resgates) feitos depois.
// Isso aproxima a evolução SEM contar rendimento (impossível sem dados
// históricos de cotação). É uma aproximação honesta: "patrimônio sem
// considerar variação de mercado".
//
// Se não houver transações de investimento, cai num fallback que mostra apenas
// o snapshot atual.
// monthlyInvested: calcula evolução do patrimônio investido por mês.
//
// Estratégia em camadas:
//  1) Para cada investimento MANUAL com snapshots, usa o valor real do mês
//     (preenchido com forward-fill quando faltar — vale o último valor conhecido)
//  2) Para investimentos Pluggy (sem histórico), usa o currentValue como
//     constante no mês atual e reconstrói meses passados descontando aportes
//     líquidos detectados nas transações de investimento
//  3) Se não houver nenhuma fonte, retorna apenas o snapshot do mês atual
function monthlyInvested(items){
  const manualInvs = items.filter(i=>i._manual);
  const pluggyInvs = items.filter(i=>!i._manual);

  // Conjunto de meses relevantes: união dos meses dos snapshots manuais +
  // meses das transações de investimento Pluggy + mês atual
  const invTxs = (APP.data.transactions||[]).filter(tx=>{
    if(tx.isCard) return false;
    const accType=String(tx.accountType||'').toUpperCase();
    if(/INVEST/.test(accType)) return true;
    const cat=(tx.categoryFinal||tx.nativeCategory||'').toString();
    return INVEST_CAT_PATTERNS.some(p=>p.test(cat));
  });

  const manualMonths = manualInvs.flatMap(inv=>Object.keys(inv.snapshots||{}));
  const txMonths = invTxs.map(tx=>monthKey(tx.date)).filter(Boolean);
  const allMonths = [...new Set([
    ...manualMonths,
    ...txMonths,
    monthKey(new Date())
  ])].sort();

  if(!allMonths.length){
    const totalAtual = items.reduce((s,i)=>s+Number(i.currentValue||0),0);
    return [{month:monthKey(new Date()),label:monthLabel(monthKey(new Date())),total:totalAtual}];
  }

  // 1) Valor manual por mês com forward-fill
  // (se Tesouro Selic tem snapshots em jan e mar, fev usa o valor de jan)
  const manualPorMes = {};
  manualInvs.forEach(inv=>{
    const snaps=inv.snapshots||{};
    const monthsAsc=Object.keys(snaps).sort();
    if(!monthsAsc.length) return;
    let lastKnown=0;
    allMonths.forEach(m=>{
      // Pega o snapshot do mês exato, OU o último mês <= m
      if(snaps[m]!==undefined){
        lastKnown=Number(snaps[m]||0);
      } else {
        const prior=monthsAsc.filter(k=>k<=m);
        if(prior.length) lastKnown=Number(snaps[prior[prior.length-1]]||0);
        else lastKnown=0; // antes do primeiro snapshot, ignora
      }
      manualPorMes[m]=(manualPorMes[m]||0)+lastKnown;
    });
  });

  // 2) Pluggy: reconstrução por fluxo (mesma estratégia anterior)
  const totalPluggyAtual = pluggyInvs.reduce((s,i)=>s+Number(i.currentValue||0),0);
  const fluxoLiq={};
  invTxs.forEach(tx=>{
    const k=monthKey(tx.date); if(!k) return;
    const sinal = tx.direction==='expense' ? 1 : -1;
    fluxoLiq[k]=(fluxoLiq[k]||0)+sinal*Number(tx.amountAbs||0);
  });
  const pluggyPorMes={};
  let saldo=totalPluggyAtual;
  [...allMonths].reverse().forEach(m=>{
    pluggyPorMes[m]=Math.max(0,saldo);
    saldo -= (fluxoLiq[m]||0);
  });

  // Soma final por mês
  return allMonths.map(m=>({
    month:m,
    label:monthLabel(m),
    total:(manualPorMes[m]||0)+(pluggyPorMes[m]||0)
  }));
}

const isCreditCardPayment=t=>{
  const cat=[t.nativeCategory||'',t.categoryFinal||''].join(' ').toLowerCase();
  return cat.includes('credit card')||cat.includes('card payment')||cat.includes('pagamento de cartão')||cat.includes('pagamento cartao');
};

function monthlyCardInvoices(card){
  const map={};
  const exclCats=getExclCats().map(c=>c.toLowerCase());
  filteredTransactionsAllMonths().filter(t=>t.accountId===card.id&&!exclCats.includes((t.categoryFinal||'').toLowerCase())&&!isCreditCardPayment(t)).forEach(tx=>{
    const k=monthKey(tx.date); if(!k) return;
    if(!map[k]) map[k]=0; map[k]+=tx.amountAbs;
  });
  return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([m,total])=>({month:m,label:monthLabel(m),total}));
}

function topCategories(list){
  const g={};
  list.filter(t=>t.direction==='expense').forEach(t=>{const c=t.categoryFinal||'Sem categoria'; g[c]=(g[c]||0)+t.amountAbs});
  return Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,8);
}


export { ruleBasedCategory, normalizeData, INVEST_CAT_PATTERNS, TRANSFER_CAT_PATTERNS, INVEST_ACCOUNT_TYPES, isInvestTx, filteredTransactions, filteredFinTransactions, filteredTransactionsAllMonths, populateFilters, monthlyCashflow, monthlyInvested, isCreditCardPayment, monthlyCardInvoices, topCategories };
