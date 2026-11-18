/* Turno · movimiento con propósito.
   Solo anima cuando cambia la respuesta, para que se note qué ha cambiado. Rápido (≤ 250 ms),
   sin adornos y nada con prefers-reduced-motion. No toca la lógica de app.js: observa su DOM. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

// fecha de actualización, en claro
(function(){
  const el=$('#fresh'); if(!el||typeof FARM==='undefined'||!FARM.meta||!FARM.meta.built)return;
  const b=FARM.meta.built, d=b.slice(0,10), t=b.slice(11,16);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date());
  el.textContent='Turnos oficiales · actualizados '+(d===today?'hoy a las '+t:'el '+d.slice(8,10)+'/'+d.slice(5,7)+' a las '+t);
})();

const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const g=typeof gsap!=='undefined'&&!reduce?gsap:null;
const OUT='power3.out';

// al elegir un lugar en el móvil, baja hasta la respuesta
let picked=0; const mark=()=>{picked=Date.now()};
['#sug','#quick','#gps'].forEach(s=>$(s).addEventListener(s==='#sug'?'mousedown':'click',mark,true));
$('#tool').addEventListener('submit',mark,true);
function toAnswer(){
  if(Date.now()-picked>12000)return; picked=0;
  const r=$('#answer').getBoundingClientRect();
  if(r.top>innerHeight*.55||r.top<0)scrollTo({top:scrollY+r.top-74,behavior:reduce?'auto':'smooth'});
}

const sig=el=>(el.querySelector('h2,h3')||{}).textContent||'';
let bestSig=sig($('#best'));
new MutationObserver(()=>{
  const b=$('#best'),s=sig(b); if(s===bestSig)return; bestSig=s;
  if(g)g.fromTo(b,{opacity:0,y:8},{opacity:1,y:0,duration:.24,ease:OUT,clearProps:'opacity,transform'});
  toAnswer();
}).observe($('#best'),{childList:true});

let listSig='';
new MutationObserver(()=>{
  const rows=$$('#list .row,#list .grp');
  const s=rows.slice(0,10).map(r=>r.dataset.sel||r.textContent).join('|');
  if(s===listSig)return; listSig=s;
  if(g)g.fromTo(rows.slice(0,10),{opacity:0,y:6},{opacity:1,y:0,duration:.22,stagger:.02,ease:OUT,clearProps:'opacity,transform'});
}).observe($('#list'),{childList:true});

let cardSig='';
new MutationObserver(()=>{
  const c=$('#card'); if(c.hidden){cardSig='';return}
  const s=sig(c); if(s===cardSig)return; cardSig=s;
  if(g)g.fromTo(c,{opacity:0,y:10},{opacity:1,y:0,duration:.22,ease:OUT,clearProps:'opacity,transform'});
}).observe($('#card'),{childList:true,attributes:true,attributeFilter:['hidden']});

let daySig='';
new MutationObserver(()=>{
  const s=(($('#wbody .dchip[aria-pressed=true]')||{}).textContent||'')+$('#wtitle').textContent;
  if(s===daySig)return; daySig=s;
  if(g)g.fromTo('#wbody .wrow',{opacity:0,y:6},{opacity:1,y:0,duration:.22,stagger:.02,ease:OUT,clearProps:'opacity,transform'});
}).observe($('#wbody'),{childList:true});

addEventListener('hashchange',()=>{
  const v=(location.hash||'#cerca').slice(1), sec=$('#v-'+v); if(!sec)return;
  if(g)g.fromTo(sec,{opacity:0},{opacity:1,duration:.18,ease:'none',clearProps:'opacity'});
});
})();
