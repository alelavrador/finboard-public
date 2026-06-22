import { APP, NAV, esc, escAttr, fmtBRL, fmtShort, fmtDate, monthKey, monthLabel, accountLabel, isCardAccount, txCategoryName, getItemName, _allUniqueCatsCache, allUniqueCats, _invalidateCatsCache, translateCat, PALETTE, catColor } from './utils.js';
import { STORAGE_KEYS, ALL_STORAGE_KEYS, NAMES_KEY, GROUPS_KEY, CAT_NAMES_KEY, MANUAL_CARDS_KEY, MANUAL_CARD_TXS_KEY, EXCL_CATS_KEY, INV_CATS_KEY, MANUAL_INVS_KEY, STORAGE_CACHE, STORAGE_PENDING, STORAGE_STATE, storageDefault, storageGet, storageSet, _storagePushKey, bootStorage, storageResyncAll, updateStorageBanner, getRules, saveRules, getManual, saveManual, getCustomNames, saveCustomNames, getCatGroups, saveCatGroups, getManualCards, saveManualCards, getManualCardTxs, saveManualCardTxs, getExclCats, saveExclCats, getCatNames, saveCatNames, getInvCats, saveInvCats, getManualInvs, saveManualInvs, exportAllStorage, importAllStorage, applyCatGroups } from './storage.js';
import { ruleBasedCategory, normalizeData, INVEST_CAT_PATTERNS, TRANSFER_CAT_PATTERNS, INVEST_ACCOUNT_TYPES, isInvestTx, filteredTransactions, filteredFinTransactions, filteredTransactionsAllMonths, populateFilters, monthlyCashflow, monthlyInvested, isCreditCardPayment, monthlyCardInvoices, topCategories } from './normalize.js';

// ─── Charts ───────────────────────────────────────────────────────────────────
function svgCashflow(series){
  const fmtK=v=>{const n=Number(v||0);const a=Math.abs(n);let s=a>=1e6?(a/1e6).toFixed(1)+'M':a>=1e3?(a/1e3).toFixed(1)+'k':a.toFixed(0);return (n<0?'-':'')+s;};
  if(!series.length) return '<div class="empty">Sem dados de fluxo mensal.</div>';
  const W=900,H=260,P={t:44,r:16,b:36,l:16};
  const cW=W-P.l-P.r, cH=H-P.t-P.b;
  const allV=series.flatMap(s=>[s.income,s.expense,s.balance]);
  const maxV=Math.max(...allV,0), minV=Math.min(...allV,0);
  const range=maxV-minV||1;
  const toY=v=>P.t+((maxV-v)/range)*cH;
  const zeroY=toY(0);
  const n=series.length, slot=cW/n;
  const bW=Math.min(slot*0.26,16);

  const gridSteps=4;
  const gridLines=Array.from({length:gridSteps+1},(_,i)=>{
    const v=minV+(range/gridSteps)*i;
    const y=toY(v);
    return `<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${(W-P.r).toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.045)" stroke-width="1"/>
<text x="${P.l}" y="${(y-4).toFixed(1)}" fill="#3d5470" font-size="8.5" font-family="IBM Plex Mono,monospace">${fmtK(v)}</text>`;
  }).join('');

  const defs=`<defs>
    <linearGradient id="cfInc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#06f7b4" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#06f7b4" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="cfExp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff4d6d" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#ff4d6d" stop-opacity=".4"/>
    </linearGradient>
    <linearGradient id="cfBal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4fa3fb" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#4fa3fb" stop-opacity=".45"/>
    </linearGradient>
    <filter id="cfGlow"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;

  const bars=series.map((s,i)=>{
    const cx=P.l+i*slot+slot/2;
    const gap=3, ix=cx-(bW*1.5)-gap*2, ex=cx-bW/2, bx=cx+bW/2+gap;
    const ih=Math.abs(toY(s.income)-zeroY), eh=Math.abs(toY(s.expense)-zeroY), bh=Math.abs(toY(s.balance)-zeroY);
    const iy=Math.min(toY(s.income),zeroY), ey=Math.min(toY(s.expense),zeroY), by=Math.min(toY(s.balance),zeroY);
    const incLbl=s.income>0?`<text x="${(ix+bW/2).toFixed(1)}" y="${(iy-4).toFixed(1)}" text-anchor="middle" fill="#06f7b4" font-size="8" font-family="IBM Plex Mono,monospace" opacity=".9">${fmtK(s.income)}</text>`:'';
    const expLbl=s.expense>0?`<text x="${(ex+bW/2).toFixed(1)}" y="${(ey-4).toFixed(1)}" text-anchor="middle" fill="#ff4d6d" font-size="8" font-family="IBM Plex Mono,monospace" opacity=".9">${fmtK(s.expense)}</text>`:'';
    const balLbl=`<text x="${(bx+bW/2).toFixed(1)}" y="${(by-4).toFixed(1)}" text-anchor="middle" fill="#4fa3fb" font-size="8" font-family="IBM Plex Mono,monospace" opacity=".9">${fmtK(s.balance)}</text>`;
    return `<rect x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(ih,.5).toFixed(1)}" fill="url(#cfInc)" rx="3"/>
${incLbl}
<rect x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(eh,.5).toFixed(1)}" fill="url(#cfExp)" rx="3"/>
${expLbl}
<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(bh,.5).toFixed(1)}" fill="url(#cfBal)" rx="3"/>
${balLbl}`;
  }).join('');

  const lpts=series.map((s,i)=>`${(P.l+i*slot+slot/2).toFixed(1)},${toY(s.balance).toFixed(1)}`).join(' ');
  const firstX=(P.l+slot/2).toFixed(1), lastX=(P.l+(n-1)*slot+slot/2).toFixed(1);
  const aStr=`${firstX},${(P.t+cH).toFixed(1)} ${lpts} ${lastX},${(P.t+cH).toFixed(1)}`;
  const dots=series.map((s,i)=>{
    const cx=(P.l+i*slot+slot/2).toFixed(1), cy=toY(s.balance).toFixed(1);
    const balLbl=`<text x="${cx}" y="${(toY(s.balance)-9).toFixed(1)}" text-anchor="middle" fill="#4fa3fb" font-size="8" font-family="IBM Plex Mono,monospace" opacity=".85">${fmtK(s.balance)}</text>`;
    return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#4fa3fb" stroke="#070c14" stroke-width="2" filter="url(#cfGlow)"/>${balLbl}`;
  }).join('');
  const lbls=series.map((s,i)=>`<text x="${(P.l+i*slot+slot/2).toFixed(1)}" y="${H-4}" text-anchor="middle" fill="#4a6080" font-size="9.5" font-family="DM Sans,sans-serif">${esc(s.label)}</text>`).join('');
  const zLine=`<line x1="${P.l}" y1="${zeroY.toFixed(1)}" x2="${(W-P.r).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="rgba(255,255,255,.1)" stroke-width="1" stroke-dasharray="4,3"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">
    ${defs}${gridLines}${zLine}${bars}
    ${lbls}
  </svg>`;
}


function svgArea(series,key,color){
  if(!series.length) return '<div class="empty">Sem dados de investimentos.</div>';
  const W=800,H=180,P={t:16,r:12,b:34,l:12};
  const cW=W-P.l-P.r, cH=H-P.t-P.b;
  const maxV=Math.max(...series.map(s=>s[key]||0),1);
  const n=series.length;
  const px=i=>P.l+(n===1?cW/2:(i/(n-1))*cW);
  const py=v=>P.t+cH-(v/maxV)*cH;
  const pts=series.map((s,i)=>`${px(i).toFixed(1)},${py(s[key]||0).toFixed(1)}`);
  const lStr=pts.join(' ');
  const aStr=`${P.l.toFixed(1)},${(P.t+cH).toFixed(1)} ${lStr} ${(W-P.r).toFixed(1)},${(P.t+cH).toFixed(1)}`;
  const gId=`ga${color.replace('#','')}`;
  const lbls=series.map((s,i)=>{
    if(n>8&&i%2!==0) return '';
    return `<text x="${px(i).toFixed(1)}" y="${H-3}" text-anchor="middle" fill="#5a7099" font-size="9.5" font-family="DM Sans,sans-serif">${esc(s.label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">
    <defs><linearGradient id="${gId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${aStr}" fill="url(#${gId})"/>
    ${n>1?`<polyline points="${lStr}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`:''}
    ${series.map((s,i)=>`<circle cx="${px(i).toFixed(1)}" cy="${py(s[key]||0).toFixed(1)}" r="2.5" fill="${color}" stroke="#070c14" stroke-width="1.5"/>`).join('')}
    ${lbls}
  </svg>`;
}

function svgBar(series,key,color){
  if(!series.length) return '<div class="empty">Sem transações de cartão disponíveis.</div>';
  const W=800,H=230,P={t:36,r:12,b:34,l:12};
  const cW=W-P.l-P.r, cH=H-P.t-P.b;
  const maxV=Math.max(...series.map(s=>s[key]||0),1);
  const n=series.length, slot=cW/n;
  const bW=Math.min(slot*0.55,38);
  const bars=series.map((s,i)=>{
    const x=P.l+i*slot+(slot-bW)/2;
    const h=((s[key]||0)/maxV)*cH;
    const y=P.t+cH-h;
    const cx=(P.l+i*slot+slot/2).toFixed(1);
    const val=s[key]||0;
    const valLbl=val>0?`<text x="${cx}" y="${(y-6).toFixed(1)}" text-anchor="middle" fill="${color}" font-size="8.5" font-family="IBM Plex Mono,monospace" opacity=".95" font-weight="500">${fmtShort(val)}</text>`:'';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(h,.5).toFixed(1)}" fill="${color}" rx="4" opacity=".83"/>${valLbl}`;
  }).join('');
  const lbls=series.map((s,i)=>`<text x="${(P.l+i*slot+slot/2).toFixed(1)}" y="${H-3}" text-anchor="middle" fill="#5a7099" font-size="9.5" font-family="DM Sans,sans-serif">${esc(s.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">${bars}${lbls}</svg>`;
}

// ─── Components ──────────────────────────────────────────────────────────────
const empty  = msg => `<div class="empty">${esc(msg)}</div>`;
const kpi    = (label,value,sub,tone) => `<div class="kpi-card k${tone.charAt(0)}"><div class="klabel">${esc(label)}</div><div class="kval">${esc(value)}</div><div class="ksub">${esc(sub)}</div></div>`;
const chip   = cat => { const co=catColor(cat); const _lbl=getCatNames()[cat]||cat; return `<span class="chip" style="background:${co}1a;color:${co};border:1px solid ${co}33">${esc(_lbl)}</span>` };
const badge2 = (txt,ok) => `<span class="chip" style="background:${ok?'rgba(6,247,180,.12)':'rgba(255,77,109,.12)'};color:${ok?'var(--income)':'var(--expense)'};border:1px solid ${ok?'rgba(6,247,180,.28)':'rgba(255,77,109,.28)'}">${esc(txt)}</span>`;

function txTable(list,limit=2000){
  if(!list.length) return empty('Nenhum lançamento encontrado.');
  const s=APP.fin.sort, sd=APP.fin.sortDir;
  const sorted=[...list].sort((a,b)=>{
    if(s==='value') return sd==='asc'?a.amountAbs-b.amountAbs:b.amountAbs-a.amountAbs;
    return sd==='asc'?new Date(a.date)-new Date(b.date):new Date(b.date)-new Date(a.date);
  });
  const arrow=f=>s===f?(sd==='asc'?' ↑':' ↓'):'';
  return `<div class="txwrap" style="max-height:520px;overflow-y:auto"><table class="txtable">
    <thead><tr>
      <th style="cursor:pointer;user-select:none" data-sort="date">Data${arrow('date')}</th>
      <th>Descrição</th><th>Banco</th><th>Categoria</th>
      <th style="text-align:right;cursor:pointer;user-select:none" data-sort="value">Valor${arrow('value')}</th>
    </tr></thead>
    <tbody>${sorted.slice(0,limit).map(tx=>{
      const srchText=[tx.description||'',tx.accountName||'',getItemName(tx.itemId)||'',tx.categoryFinal||'',fmtBRL(tx.amountAbs),fmtDate(tx.date)].join(' ').toLowerCase();
      return `<tr data-dir="${tx.direction}" data-txt="${escAttr(srchText)}">
      <td><span class="num c-d" style="font-size:12px">${fmtDate(tx.date)}</span></td>
      <td><div class="txdesc">${esc(tx.description||'Transação')}</div><div class="txmeta">${esc(tx.accountName)}${tx.isCard?' · 💳':''}</div></td>
      <td class="c-m" style="font-size:12px">${esc(getItemName(tx.itemId))}</td>
      <td>
        <div class="fin-cat-wrap" style="position:relative;display:inline-block">
          ${chip(tx.categoryFinal||'Sem categoria')}
          <select class="fin-cat-sel" data-txid="${tx.id}" aria-label="Alterar categoria da transação" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%">
            ${allUniqueCats().map(c=>`<option value="${esc(c)}" ${c===tx.categoryFinal?'selected':''}>${esc(getCatNames()[c]||c)}</option>`).join('')}
          </select>
        </div>
      </td>
      <td style="text-align:right"><span class="num ${tx.direction==='income'?'c-i':'c-e'}" style="font-size:13px;font-weight:500">${tx.direction==='income'?'+':'-'}${fmtBRL(tx.amountAbs)}</span></td>
    </tr>`;}).join('')}</tbody>
  </table>${list.length>limit?`<div style="padding:11px 16px;font-size:12px;color:var(--muted);text-align:center">Mostrando ${limit} de ${list.length} lançamentos</div>`:''}</div>`;
}

// ─── Gráfico de fluxo consolidado de contas (entradas/saídas + linha de net) ───
function accFlowChart(series){
  if(!series || !series.length){
    return '<div class="empty">Sem dados de fluxo no período.</div>';
  }
  const W=820, H=300;
  const P={t:30, r:24, b:42, l:60};
  const cW=W-P.l-P.r, cH=H-P.t-P.b;
  const n=series.length;
  // Para o eixo Y precisamos do máximo absoluto entre inflow/outflow
  const allVals=series.flatMap(s=>[s.inflow,s.outflow]);
  const maxV=Math.max(...allVals,1);
  // Topo "nice"
  const niceMax=(v=>{
    const mag=Math.pow(10,Math.floor(Math.log10(v)));
    const norm=v/mag;
    let nm;
    if(norm<=1) nm=1;
    else if(norm<=2) nm=2;
    else if(norm<=2.5) nm=2.5;
    else if(norm<=5) nm=5;
    else nm=10;
    return nm*mag;
  })(maxV*1.1);
  const slot=cW/n;
  // 2 barras lado a lado por mês: entrada (verde) + saída (vermelho)
  const groupW = Math.min(slot*0.7, 56);
  const bW = (groupW-4)/2;

  const gridLines=[0.25,0.5,0.75,1].map(p=>{
    const y=P.t+cH-cH*p;
    const v=niceMax*p;
    return `<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${(P.l+cW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width=".5" stroke-dasharray="3,4" opacity=".6"/>
            <text x="${P.l-8}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9.5" font-family="JetBrains Mono,monospace">${fmtShort(v)}</text>`;
  }).join('');
  const baseline=`<line x1="${P.l}" y1="${(P.t+cH).toFixed(1)}" x2="${(P.l+cW).toFixed(1)}" y2="${(P.t+cH).toFixed(1)}" stroke="var(--border2)" stroke-width="1"/>`;

  // Barras
  const bars=series.map((s,i)=>{
    const gx = P.l + i*slot + (slot-groupW)/2;
    const hIn=(s.inflow/niceMax)*cH;
    const hOut=(s.outflow/niceMax)*cH;
    const yIn=P.t+cH-hIn;
    const yOut=P.t+cH-hOut;
    const isLast=(i===n-1);
    const opIn = isLast?1:.85;
    const opOut = isLast?1:.85;
    return `
      <rect class="cc-evo-bar" x="${gx.toFixed(1)}" y="${yIn.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(hIn,.5).toFixed(1)}" fill="url(#accGradIn)" rx="4" opacity="${opIn}"><title>${esc(s.label)} · Entradas: ${fmtBRL(s.inflow)}</title></rect>
      <rect class="cc-evo-bar" x="${(gx+bW+4).toFixed(1)}" y="${yOut.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(hOut,.5).toFixed(1)}" fill="url(#accGradOut)" rx="4" opacity="${opOut}"><title>${esc(s.label)} · Saídas: ${fmtBRL(s.outflow)}</title></rect>
    `;
  }).join('');

  // Linha de saldo líquido (net) sobre as barras
  const netVals = series.map(s=>s.net);
  const netMaxAbs = Math.max(...netVals.map(Math.abs),1);
  // O net pode ser negativo; vamos plotar usando a mesma escala absoluta
  // (a linha some no eixo X quando net=0; sobe para verde, desce escala-down quando negativo)
  const netPts = series.map((s,i)=>{
    const x = P.l + i*slot + slot/2;
    // mapeamos o net no espaço da escala atual (mesmo max)
    const yFrac = s.net/niceMax;
    const y = P.t + cH - yFrac*cH;
    return {x,y,v:s.net,label:s.label};
  });
  let netPath='';
  if(netPts.length>1){
    netPath = `M ${netPts[0].x.toFixed(1)} ${netPts[0].y.toFixed(1)}`;
    for(let i=1;i<netPts.length;i++){
      const p0=netPts[i-1], p1=netPts[i];
      const cx1=p0.x+(p1.x-p0.x)/2, cy1=p0.y;
      const cx2=p0.x+(p1.x-p0.x)/2, cy2=p1.y;
      netPath += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
  }
  const netDots = netPts.map((p,i)=>{
    const isLast=(i===n-1);
    const color = p.v>=0?'var(--income)':'var(--expense)';
    return isLast
      ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${color}" stroke="var(--card)" stroke-width="2"><title>${esc(p.label)} · Líquido: ${fmtBRL(p.v)}</title></circle>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" opacity=".7"><title>${esc(p.label)} · Líquido: ${fmtBRL(p.v)}</title></circle>`;
  }).join('');

  const lbls=series.map((s,i)=>{
    const isLast=(i===n-1);
    return `<text x="${(P.l+i*slot+slot/2).toFixed(1)}" y="${(H-12).toFixed(1)}" text-anchor="middle" fill="${isLast?'var(--text)':'var(--muted)'}" font-size="10" font-family="Inter,sans-serif" font-weight="${isLast?'600':'400'}">${esc(s.label)}</text>`;
  }).join('');

  // Legenda
  const legend = `<g transform="translate(${P.l},${P.t-20})">
    <rect x="0" y="-9" width="11" height="11" fill="url(#accGradIn)" rx="2"/><text x="16" y="0" fill="var(--dim)" font-size="10.5" font-family="Inter,sans-serif">Entradas</text>
    <rect x="78" y="-9" width="11" height="11" fill="url(#accGradOut)" rx="2"/><text x="94" y="0" fill="var(--dim)" font-size="10.5" font-family="Inter,sans-serif">Saídas</text>
    <line x1="146" y1="-3" x2="160" y2="-3" stroke="var(--income)" stroke-width="2"/><circle cx="153" cy="-3" r="2" fill="var(--income)"/><text x="166" y="0" fill="var(--dim)" font-size="10.5" font-family="Inter,sans-serif">Saldo líquido</text>
  </g>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">
    <defs>
      <linearGradient id="accGradIn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34e8b8" stop-opacity=".9"/>
        <stop offset="100%" stop-color="#06f7b4" stop-opacity=".45"/>
      </linearGradient>
      <linearGradient id="accGradOut" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ff7791" stop-opacity=".9"/>
        <stop offset="100%" stop-color="#ff4d6d" stop-opacity=".45"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${baseline}
    ${bars}
    ${netPath?`<path d="${netPath}" fill="none" stroke="var(--income)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/>`:''}
    ${netDots}
    ${lbls}
    ${legend}
  </svg>`;
}


// ─── Gráfico de evolução de faturas (área + linha + barras suaves) ───────────
// Renderização customizada para a aba de cartões: área degradê, linha de tendência,
// pontos destacados, valores no topo das barras, grid horizontal, eixo X com meses.
function ccEvolutionChart(series){
  if(!series || !series.length){
    return '<div class="empty">Sem dados de fatura no período.</div>';
  }
  const W=820, H=280;
  const P={t:30, r:24, b:42, l:60};
  const cW=W-P.l-P.r, cH=H-P.t-P.b;
  const n=series.length;
  const vals=series.map(s=>s.total||0);
  const maxV=Math.max(...vals,1);
  // Arredonda topo do eixo Y para múltiplo "redondo" (250 / 500 / 1000…)
  const niceMax=(v=>{
    const mag=Math.pow(10,Math.floor(Math.log10(v)));
    const norm=v/mag;
    let nm;
    if(norm<=1) nm=1;
    else if(norm<=2) nm=2;
    else if(norm<=2.5) nm=2.5;
    else if(norm<=5) nm=5;
    else nm=10;
    return nm*mag;
  })(maxV*1.1);
  const slot=cW/n;
  const bW=Math.min(slot*0.62,46);

  // Linhas de grid horizontais (4 níveis)
  const gridLines=[0.25,0.5,0.75,1].map(p=>{
    const y=P.t+cH-cH*p;
    const v=niceMax*p;
    return `<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${(P.l+cW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width=".5" stroke-dasharray="3,4" opacity=".6"/>
            <text x="${P.l-8}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="9.5" font-family="JetBrains Mono,monospace">${fmtShort(v)}</text>`;
  }).join('');
  // Baseline (eixo X)
  const baseline=`<line x1="${P.l}" y1="${(P.t+cH).toFixed(1)}" x2="${(P.l+cW).toFixed(1)}" y2="${(P.t+cH).toFixed(1)}" stroke="var(--border2)" stroke-width="1"/>`;

  // Pontos para a linha/área
  const pts=series.map((s,i)=>{
    const v=s.total||0;
    const x=P.l+i*slot+slot/2;
    const y=P.t+cH-(v/niceMax)*cH;
    return {x,y,v,label:s.label};
  });

  // Path da área (mais suave: curvas Bézier entre pontos)
  // Como temos barras embaixo, a área é decorativa — usa stroke leve + fill com gradient
  let linePath='';
  if(pts.length>1){
    linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for(let i=1;i<pts.length;i++){
      const p0=pts[i-1], p1=pts[i];
      const cx1=p0.x+(p1.x-p0.x)/2, cy1=p0.y;
      const cx2=p0.x+(p1.x-p0.x)/2, cy2=p1.y;
      linePath += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
  }
  const areaPath = linePath
    ? `${linePath} L ${pts[pts.length-1].x.toFixed(1)} ${(P.t+cH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(P.t+cH).toFixed(1)} Z`
    : '';

  // Barras + valores + label do mês
  const bars=series.map((s,i)=>{
    const v=s.total||0;
    const x=P.l+i*slot+(slot-bW)/2;
    const h=(v/niceMax)*cH;
    const y=P.t+cH-h;
    const cx=(P.l+i*slot+slot/2).toFixed(1);
    const isLast=(i===n-1);
    const fill=isLast?'url(#ccGradLast)':'url(#ccGradBar)';
    const valLbl=v>0?`<text x="${cx}" y="${(y-7).toFixed(1)}" text-anchor="middle" fill="${isLast?'var(--text)':'var(--dim)'}" font-size="10" font-family="JetBrains Mono,monospace" font-weight="${isLast?'600':'500'}">${fmtShort(v)}</text>`:'';
    return `<rect class="cc-evo-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${Math.max(h,.5).toFixed(1)}" fill="${fill}" rx="5"><title>${esc(s.label)}: ${fmtBRL(v)}</title></rect>${valLbl}`;
  }).join('');

  // Pontos no topo de cada barra (estilo line+bar)
  const dots = pts.map((p,i)=>{
    const isLast=(i===n-1);
    return isLast
      ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="var(--cc)" stroke="var(--card)" stroke-width="2"/>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--balance)" opacity=".7"/>`;
  }).join('');

  const lbls=series.map((s,i)=>{
    const isLast=(i===n-1);
    return `<text x="${(P.l+i*slot+slot/2).toFixed(1)}" y="${(H-12).toFixed(1)}" text-anchor="middle" fill="${isLast?'var(--text)':'var(--muted)'}" font-size="10" font-family="Inter,sans-serif" font-weight="${isLast?'600':'400'}">${esc(s.label)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">
    <defs>
      <linearGradient id="ccGradBar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#79b8fc" stop-opacity=".85"/>
        <stop offset="100%" stop-color="#4fa3fb" stop-opacity=".35"/>
      </linearGradient>
      <linearGradient id="ccGradLast" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c2a9ff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#a78bfa" stop-opacity=".75"/>
      </linearGradient>
      <linearGradient id="ccGradArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4fa3fb" stop-opacity=".12"/>
        <stop offset="100%" stop-color="#4fa3fb" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${baseline}
    ${areaPath?`<path d="${areaPath}" fill="url(#ccGradArea)" stroke="none"/>`:''}
    ${bars}
    ${linePath?`<path d="${linePath}" fill="none" stroke="#4fa3fb" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".5"/>`:''}
    ${dots}
    ${lbls}
  </svg>`;
}



export { svgCashflow, svgArea, svgBar, empty, kpi, chip, badge2, txTable, accFlowChart, ccEvolutionChart };
