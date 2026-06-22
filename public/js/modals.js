// Helpers e handlers de modais (focus trap, ESC, backdrop click)
// Sem deps de outros módulos — só DOM.

// ── Modais: helpers com focus trap + ARIA sync ─────────────────────────────
let _lastFocused=null;
function openModal(modal){
  if(!modal) return;
  _lastFocused=document.activeElement;
  modal.style.display='flex';
  modal.setAttribute('aria-hidden','false');
  // Foca o primeiro campo interativo (skip cancel/close)
  const focusables=modal.querySelectorAll('input:not([type=hidden]), select, textarea, button');
  const first=[...focusables].find(el=>!/cancel|close/i.test(el.id))||focusables[0];
  if(first) setTimeout(()=>first.focus(),50);
}
function closeModal(modal){
  if(!modal) return;
  modal.style.display='none';
  modal.setAttribute('aria-hidden','true');
  delete modal.dataset.editId;
  if(_lastFocused && _lastFocused.focus) _lastFocused.focus();
}
function _isModalOpen(m){ return m && m.style.display!=='none' && m.style.display!==''; }

// Backdrop click → fecha
document.addEventListener('click', e => {
  ['modalNewCard','modalNewCardTx','modalEditCardTx','modalNewInv','modalSnapInv','modalEditInv'].forEach(id=>{
    if(e.target && e.target.id===id) closeModal(e.target);
  });
});

// ESC → fecha qualquer modal aberto
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){
    ['modalNewCard','modalNewCardTx','modalEditCardTx','modalNewInv','modalSnapInv','modalEditInv'].forEach(id=>{
      const m=document.getElementById(id);
      if(_isModalOpen(m)) closeModal(m);
    });
  }
});

// Focus trap: Tab/Shift+Tab dentro do modal não escapa para a página
document.addEventListener('keydown', e => {
  if(e.key!=='Tab') return;
  const openOne=['modalNewCard','modalNewCardTx','modalEditCardTx','modalNewInv','modalSnapInv','modalEditInv']
    .map(id=>document.getElementById(id))
    .find(_isModalOpen);
  if(!openOne) return;
  const focusables=[...openOne.querySelectorAll('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')]
    .filter(el=>el.offsetParent!==null); // só visíveis
  if(!focusables.length) return;
  const first=focusables[0], last=focusables[focusables.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});

export { openModal, closeModal };
