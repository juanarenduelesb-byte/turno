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

// tiempo estimado y guardia restante, calculados con lo que ya muestra la tarjeta
const ICO={walk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 12l3-4 4 1 2 4M11 15l-1-4"/></svg>',car:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2-5H7l-2 5zM5 12h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/></svg>',clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'};
function nowMin(tz){const o={};new Intl.DateTimeFormat('en-CA',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(p=>o[p.type]=p.value);return (+o.hour)*60+(+o.minute)}
const dur=m=>m<60?m+' min':Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'');
function enrich(b){
  const side=b.querySelector('.side'),big=b.querySelector('.big');
  if(!side||!big||!b.classList.contains('on')||side.querySelector('.eta'))return null;
  const t=(big.firstChild&&big.firstChild.textContent||'').trim(),m=t.match(/^([\d,]+)\s*(m|km)$/);
  const chips=[];
  if(m){const meters=parseFloat(m[1].replace(',','.'))*(m[2]==='km'?1000:1);
    if(meters<=2000)chips.push(`<span class="chip">${ICO.walk}≈ ${Math.max(1,Math.round(meters/80))} min a pie</span>`);
    else chips.push(`<span class="chip">${ICO.car}≈ ${Math.round(meters/1000/35*60+3)} min en coche</span>`)}
  const txt=[...b.querySelectorAll('p')].map(p=>p.textContent).join(' ');
  const h=txt.match(/hasta (mañana )?(\d{2}):(\d{2})/);
  if(h){const tz=/Palmas|Tenerife|Canaria/i.test($('#q').value)?'Atlantic/Canary':'Europe/Madrid';
    let end=(+h[2])*60+(+h[3])+(h[1]?1440:0),left=end-nowMin(tz);if(left<=0&&!h[1])left+=1440;
    if(left>0&&left<2880)chips.push(`<span class="chip g">${ICO.clock}Quedan ${dur(left)} de guardia</span>`)}
  if(!chips.length)return null;
  const e=document.createElement('div');e.className='eta';e.innerHTML=chips.join('');big.after(e);return {e,big,m};
}
new MutationObserver(()=>{
  const b=$('#best'),s=sig(b);
  document.body.classList.toggle('has-loc',!!$('#status').textContent.trim());
  const x=enrich(b);
  if(s===bestSig)return; bestSig=s;
  if(g){g.fromTo(b,{opacity:0,y:8},{opacity:1,y:0,duration:.24,ease:OUT,clearProps:'opacity,transform'});
    if(x&&x.m){const end=parseFloat(x.m[1].replace(',','.')),dec=x.m[1].includes(',')?1:0,o={v:0},node=x.big.firstChild;
      g.to(o,{v:end,duration:.5,ease:'power2.out',onUpdate:()=>{node.textContent=o.v.toFixed(dec).replace('.',',')+' '+x.m[2]}})}
    if(x)g.fromTo(x.e.children,{opacity:0,y:4},{opacity:1,y:0,duration:.2,delay:.25,stagger:.05,ease:OUT,clearProps:'opacity,transform'})}
  toAnswer();
}).observe($('#best'),{childList:true});
enrich($('#best'));
document.body.classList.toggle('has-loc',!!$('#status').textContent.trim());

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
