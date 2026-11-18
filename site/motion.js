/* Turno · movimiento de la web (GSAP + ScrollTrigger + Lenis).
   Solo presentación: no toca los datos ni la lógica de app.js; observa el DOM que app.js pinta. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const hasG=typeof gsap!=='undefined';
document.documentElement.classList.add('js');
if(!hasG||reduce){$$('.rv').forEach(e=>{e.style.opacity=1;e.style.transform='none'});initStatic();return}
gsap.registerPlugin(ScrollTrigger);
const EASE='expo.out';

// ---------- scroll suave ----------
let lenis=null;
if(typeof Lenis!=='undefined'){
  lenis=new Lenis({lerp:.1,wheelMultiplier:1,smoothWheel:true});
  lenis.on('scroll',ScrollTrigger.update);
  gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
}
const scrollTo=(target,off)=>{if(lenis)lenis.scrollTo(target,{offset:off||0,duration:1.1,easing:t=>1-Math.pow(1-t,4)});else{const el=typeof target==='string'?$(target):target;(el&&el.scrollIntoView)?el.scrollIntoView({behavior:'smooth'}):window.scrollTo(0,0)}};

// ---------- texto partido en palabras ----------
function split(el){
  if(!el||el.dataset.done)return [];el.dataset.done='1';
  const out=[];
  const wrap=node=>{const w=document.createElement('span');w.className='w';const i=document.createElement('span');i.className='wi';w.appendChild(i);i.appendChild(node);out.push(i);return w};
  [...el.childNodes].forEach(n=>{
    if(n.nodeType===3){const frag=document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(p=>{if(!p)return;if(/^\s+$/.test(p))frag.appendChild(document.createTextNode(' '));else frag.appendChild(wrap(document.createTextNode(p)))});
      el.replaceChild(frag,n)}
    else el.replaceChild(wrap(n.cloneNode(true)),n);
  });
  return out;
}

// ---------- navegación: píldora que se desliza ----------
const seg=$('.topnav .seg'), pill=$('.topnav .pill-bg');
function movePill(){const a=seg&&seg.querySelector('a.on');if(!a||!pill)return;pill.style.width=a.offsetWidth+'px';pill.style.transform=`translateX(${a.offsetLeft}px)`}
addEventListener('resize',movePill);
const nav=$('#topnav');
if(lenis)lenis.on('scroll',({scroll,direction,velocity})=>{nav.classList.toggle('hide',scroll>window.innerHeight*.9&&direction===1&&Math.abs(velocity)>1.2)});

// ---------- héroe ----------
const band=$('#band');
if(fine)band.addEventListener('pointermove',e=>{const r=band.getBoundingClientRect();band.style.setProperty('--mx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');band.style.setProperty('--my',((e.clientY-r.top)/r.height*100).toFixed(1)+'%')},{passive:true});

const words=split($('#h1'));
const topo=$$('#bgTopo path');
topo.forEach(p=>{const L=p.getTotalLength();p.style.strokeDasharray=L;p.style.strokeDashoffset=L});
const intro=gsap.timeline({defaults:{ease:EASE}});
intro.from('.topnav .bar',{y:-30,opacity:0,duration:.9},0)
  .from('#eyebrow',{y:14,opacity:0,duration:.8},.15)
  .from(words,{yPercent:115,rotate:4,duration:1.15,stagger:.055},.2)
  .from('#lede',{y:18,opacity:0,duration:.9},.65)
  .from('#sign',{scale:.86,opacity:0,duration:1.4},.1)
  .from('#tool',{y:26,opacity:0,scale:.985,duration:1},.75)
  .from('#quick .qchip',{y:12,opacity:0,duration:.6,stagger:.04},.95)
  .to(topo,{strokeDashoffset:0,duration:2.6,stagger:.08,ease:'power2.out'},.2)
  .add(countKpis,.9);

function countKpis(){
  $$('#kpis .kpi').forEach((k,i)=>{
    const b=k.querySelector('b');if(!b)return;
    const raw=b.textContent, m=raw.match(/^([\d.]+)(.*)$/);if(!m)return;
    const end=parseInt(m[1].replace(/\./g,''),10), rest=m[2], o={v:0};
    gsap.from(k,{y:20,opacity:0,duration:.9,delay:i*.08,ease:EASE});
    gsap.to(o,{v:end,duration:1.6,delay:i*.08,ease:'power3.out',onUpdate:()=>{b.textContent=new Intl.NumberFormat('es-ES').format(Math.round(o.v))+rest}});
  });
}

// el letrero y el texto se van con el scroll
gsap.fromTo('.sign canvas',{yPercent:0,scale:1,opacity:1},{yPercent:18,scale:.92,opacity:.25,ease:'none',immediateRender:false,scrollTrigger:{trigger:band,start:'top top',end:'bottom top',scrub:true}});
gsap.to('.hero .copy',{yPercent:-10,ease:'none',scrollTrigger:{trigger:band,start:'top top',end:'bottom top',scrub:true}});

// ---------- cinta de provincias con turno integrado ----------
(function(){
  const tr=$('#tickerTrack'); if(!tr||typeof FARM==='undefined')return;
  const cov=FARM.prov.filter(p=>p.cov);
  const cross='<svg class="x" viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 2.5h5.6v5.7h5.7v5.6h-5.7v5.7H9.2v-5.7H3.5V8.2h5.7z"/></svg>';
  const one=cov.map(p=>`<span class="item">${cross}${p.n}<small>${p.cov.dias>=7?'7 días':'hoy'}</small><em>turno oficial</em></span>`).join('')+`<span class="item">${cross}52 colegios<em>enlazados</em></span>`;
  tr.innerHTML=one+one;
  let x=0,w=0;const base=40; // px/s
  const measure=()=>{w=tr.scrollWidth/2};measure();addEventListener('resize',measure);
  gsap.ticker.add((t,dt)=>{const v=lenis?lenis.velocity:0;x-=(base+Math.min(900,Math.abs(v)*22))*(dt/1000)*(v<0?-1:1);if(x<=-w)x+=w;if(x>0)x-=w;tr.style.transform=`translate3d(${x}px,0,0)`});
})();

// ---------- revelados al hacer scroll ----------
function reveal(sel,opts){$$(sel).forEach(el=>gsap.fromTo(el,{y:28,opacity:0},{y:0,opacity:1,duration:1,ease:EASE,scrollTrigger:{trigger:el,start:'top 88%',once:true},...opts}))}
reveal('.rv');
$$('.sechead .title').forEach(t=>{const ws=split(t);gsap.from(ws,{yPercent:110,duration:1,stagger:.05,ease:EASE,scrollTrigger:{trigger:t,start:'top 88%',once:true}})});
$$('.sechead .kicker').forEach(k=>gsap.from(k,{x:-14,opacity:0,duration:.8,ease:EASE,scrollTrigger:{trigger:k,start:'top 90%',once:true}}));
gsap.from('#best',{y:40,opacity:0,duration:1.1,ease:EASE,scrollTrigger:{trigger:'#best',start:'top 90%',once:true}});
gsap.fromTo('#mapbox',{clipPath:'inset(8% 8% 8% 8% round 40px)'},{clipPath:'inset(0% 0% 0% 0% round 30px)',duration:1.4,ease:EASE,scrollTrigger:{trigger:'#mapbox',start:'top 85%',once:true},onComplete:()=>{$('#mapbox').style.clipPath=''}});
const big=$('.outro .big');
if(big){const ws=split(big);gsap.from(ws,{yPercent:115,duration:1.2,stagger:.06,ease:EASE,scrollTrigger:{trigger:big,start:'top 85%',once:true}})}
gsap.from('.outro .row2 .btn,.outro .n112',{y:20,opacity:0,duration:.9,stagger:.08,ease:EASE,scrollTrigger:{trigger:'.outro .row2',start:'top 92%',once:true}});

// ---------- reaccionar a lo que pinta app.js ----------
let picked=0;
const markPick=()=>{picked=Date.now()};
$('#sug').addEventListener('mousedown',markPick,true);
$('#quick').addEventListener('click',markPick,true);
$('#gps').addEventListener('click',markPick,true);
$('#tool').addEventListener('submit',markPick,true);

const sig=el=>el.querySelector('h2,h3')?.textContent||'';
let bestSig=sig($('#best'));
let refreshT=0;const refresh=()=>{clearTimeout(refreshT);refreshT=setTimeout(()=>ScrollTrigger.refresh(),120)};
new MutationObserver(()=>{
  const b=$('#best'),s=sig(b); if(s===bestSig)return; bestSig=s;
  const tl=gsap.timeline({defaults:{ease:EASE}});
  tl.fromTo(b,{clipPath:'inset(0 100% 0 0 round 30px)'},{clipPath:'inset(0 0% 0 0 round 30px)',duration:.9,clearProps:'clipPath'})
    .from(b.querySelector('.ic'),{scale:.6,rotate:-20,opacity:0,duration:.8},.15)
    .from(b.querySelectorAll('.k,h2,p'),{y:16,opacity:0,duration:.7,stagger:.05},.2)
    .from(b.querySelectorAll('.big,.acts .btn'),{y:14,opacity:0,duration:.6,stagger:.05},.35);
  const bigN=b.querySelector('.big');
  if(bigN&&bigN.firstChild&&bigN.firstChild.nodeType===3){const txt=bigN.firstChild.textContent,m=txt.match(/^([\d,]+)\s*(m|km)$/);
    if(m){const end=parseFloat(m[1].replace(',','.')),dec=m[1].includes(',')?1:0,o={v:0};gsap.to(o,{v:end,duration:1.2,delay:.3,ease:'power3.out',onUpdate:()=>{bigN.firstChild.textContent=o.v.toFixed(dec).replace('.',',')+' '+m[2]}})}}
  if(Date.now()-picked<12000){picked=0;scrollTo('#v-cerca',-96)}
  refresh();
}).observe($('#best'),{childList:true});

let listSig='';
new MutationObserver(()=>{
  const rows=$$('#list .row,#list .grp');
  const s=rows.slice(0,12).map(r=>r.dataset.sel||r.textContent).join('|');
  if(s===listSig)return; listSig=s;
  gsap.from(rows.slice(0,16),{y:12,opacity:0,duration:.5,stagger:.028,ease:'power3.out',clearProps:'all'});
  refresh();
}).observe($('#list'),{childList:true});

let cardSig='';
new MutationObserver(()=>{
  const c=$('#card'); if(c.hidden){cardSig='';return}
  const s=sig(c); if(s===cardSig)return; cardSig=s;
  gsap.fromTo(c,{y:18,scale:.97,opacity:0},{y:0,scale:1,opacity:1,duration:.5,ease:'power3.out',clearProps:'transform,opacity'});
  gsap.from(c.querySelectorAll('.fact'),{y:8,opacity:0,duration:.4,stagger:.03,delay:.08,ease:'power3.out'});
}).observe($('#card'),{childList:true,attributes:true,attributeFilter:['hidden']});

let weekSig='';
new MutationObserver(()=>{
  const s=($('#wbody .dchip[aria-pressed=true]')||{}).textContent+($('#wtitle').textContent);
  if(s===weekSig)return; weekSig=s;
  gsap.from('#wbody .wrow',{y:12,opacity:0,duration:.5,stagger:.03,ease:'power3.out',clearProps:'all'});
  refresh();
}).observe($('#wbody'),{childList:true});
let firstDays=true;
new MutationObserver(()=>{if(!firstDays)return;const d=$$('#wbody .dchip');if(!d.length)return;firstDays=false;gsap.from(d,{y:16,opacity:0,duration:.6,stagger:.04,ease:EASE})}).observe($('#wbody'),{childList:true});

new MutationObserver(()=>{gsap.from('#cofs .cof',{y:20,opacity:0,duration:.6,stagger:{each:.018,from:'start'},ease:EASE,clearProps:'transform,opacity'});refresh()}).observe($('#cofs'),{childList:true});

// ---------- cambio de vista ----------
function onView(){
  requestAnimationFrame(movePill);
  const v=(location.hash||'#cerca').slice(1);
  const sec=$('#v-'+v); if(!sec)return;
  gsap.fromTo(sec,{y:20,opacity:0},{y:0,opacity:1,duration:.6,ease:EASE,clearProps:'transform,opacity'});
  if(v!=='cerca'){const top=$('#app').getBoundingClientRect().top;if(top>120)scrollTo('#app',-70)}
  refresh();
}
addEventListener('hashchange',onView);
movePill(); setTimeout(movePill,300);

// botones que vuelven arriba al buscador
document.addEventListener('click',e=>{const a=e.target.closest('[data-top]');if(!a)return;e.preventDefault();if(location.hash!=='#cerca')location.hash='cerca';scrollTo(0);setTimeout(()=>$('#q').focus({preventScroll:true}),900)});

// ---------- botones magnéticos (solo con ratón) ----------
if(fine){
  document.addEventListener('pointermove',e=>{
    const b=e.target.closest('#gps,.outro .btn,.best .btn.guard');
    $$('.mag').forEach(m=>{if(m!==b){m.classList.remove('mag');gsap.to(m,{x:0,y:0,duration:.6,ease:'elastic.out(1,.5)'})}});
    if(!b)return; b.classList.add('mag');
    const r=b.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    gsap.to(b,{x:dx*.18,y:dy*.28,duration:.4,ease:'power3.out'});
  },{passive:true});
}

addEventListener('load',()=>ScrollTrigger.refresh());

function initStatic(){
  const seg=document.querySelector('.topnav .seg'),pill=document.querySelector('.topnav .pill-bg');
  const mv=()=>{const a=seg&&seg.querySelector('a.on');if(a&&pill){pill.style.width=a.offsetWidth+'px';pill.style.transform=`translateX(${a.offsetLeft}px)`}};
  mv();addEventListener('hashchange',()=>requestAnimationFrame(mv));addEventListener('resize',mv);
  document.addEventListener('click',e=>{const a=e.target.closest('[data-top]');if(!a)return;e.preventDefault();location.hash='cerca';window.scrollTo(0,0);document.getElementById('q').focus()});
  const tr=document.getElementById('tickerTrack');
  if(tr&&typeof FARM!=='undefined')tr.innerHTML=FARM.prov.filter(p=>p.cov).map(p=>`<span class="item">${p.n}<em>turno oficial</em></span>`).join('');
}
})();
