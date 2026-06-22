// Navegação: setView (troca aba) + buildNav (sidebar). Isolado em módulo próprio
// para evitar ciclo api.js ↔ app.js. api.js precisa de setView ao final do loadAll,
// e app.js precisa de loadAll no boot.
import { APP, NAV } from './utils.js';
import { populateFilters } from './normalize.js';
import { renderOverview, renderFinance, renderCreditCards } from './render.js';

function buildNav(){
  const el=document.getElementById('nav');
  el.innerHTML=NAV.map(n=>`
    <button data-view="${n.id}" class="nav-btn ${APP.view===n.id?'active':''}">
      <span class="nav-icon"><svg viewBox="0 0 24 24">${n.icon}</svg></span>
      <span class="nav-text"><strong>${n.title}</strong><small>${n.sub}</small></span>
    </button>`).join('');
  el.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
}

function setView(view){
  const prev=APP.view;
  APP.view=view;buildNav();
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById(view).classList.add('active');
  const cur=NAV.find(n=>n.id===view);
  document.getElementById('pageTitle').textContent=cur.title;
  document.getElementById('pageSubtitle').textContent=cur.sub;
  if(prev!==view && ((prev==='creditcards')||(view==='creditcards'))){
    APP.filters.institution='all';
  }
  // Reset filtro de categoria ao entrar/sair da aba Investimentos: a lista
  // de categorias muda (investimentos vs transações), então o valor anterior
  // pode não existir mais. Evita "selected" inválido.
  if(prev!==view && ((prev==='investments')||(view==='investments'))){
    APP.filters.category='all';
  }
  populateFilters();
  if(view==='creditcards') renderCreditCards();
  else if(view==='finance') renderFinance();
  else if(view==='overview') renderOverview();
}

export { setView, buildNav };
