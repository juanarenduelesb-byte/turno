/* Turno · mapa en directo del héroe: todas las farmacias y, en rojo, las que están de guardia ahora. */
(function(){
'use strict';
const cv=document.getElementById('liveMap'); if(!cv||typeof FARM==='undefined'||typeof GEO==='undefined')return;
const ctx=cv.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf=new Intl.NumberFormat('es-ES');

// hora local como la usa app.js (Península y Canarias)
function nowIso(tz){const o={};new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(p=>o[p.type]=p.value);return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`}
const CAN=new Set(['35','38']);
const P=FARM.prov;
const geo2=(lon,lat)=>lat<30?[-9.6+(lon+18.2)*.9,34.15+(lat-27.6)*.9]:[lon,lat];
const B={w:-9.9,e:4.6,s:34,n:43.95},KX=Math.cos(39.5*Math.PI/180),MAD=[-3.7038,40.4168];
const rings=GEO.map(g=>g.r.map(s=>s.split(' ').map(p=>{const[a,c]=p.split(',').map(Number);return geo2(a,c)})));
const cov=P.map(p=>!!p.cov);
const pts=FARM.f.map(r=>{const[x,y]=geo2(r[1],r[0]);return {x,y,d:Math.hypot((r[1]-MAD[0])*KX,r[0]-MAD[1])}});
let on=new Set();
function computeOn(){
  const pen=nowIso('Europe/Madrid'),can=nowIso('Atlantic/Canary');on=new Set();
  FARM.g.forEach(([i,a,b])=>{const n=CAN.has(P[FARM.f[i][5]].cod)?can:pen;if(a<=n&&n<b)on.add(i)});
}
computeOn();
const maxD=Math.max(...pts.map(p=>p.d));
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

let t=reduce?1:0;
function draw(){
  const r=cv.getBoundingClientRect(); if(!r.width)return;
  const dpr=Math.min(2,devicePixelRatio||1),W=r.width,H=r.height;
  if(cv.width!==Math.round(W*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  const gw=(B.e-B.w)*KX,gh=B.n-B.s,sc=Math.min(W/gw,H/gh)*.96,ox=(W-gw*sc)/2,oy=(H-gh*sc)/2;
  const pr=(lon,lat)=>[ox+(lon-B.w)*KX*sc,oy+(B.n-lat)*sc];
  const land=css('--land'),border=css('--border'),guard=css('--guard'),muted=css('--muted'),card=css('--card');
  rings.forEach((rs,i)=>{const p=new Path2D();rs.forEach(rg=>{rg.forEach(([a,c],k)=>{const[x,y]=pr(a,c);k?p.lineTo(x,y):p.moveTo(x,y)});p.closePath()});
    ctx.fillStyle=land;ctx.fill(p,'evenodd');
    if(cov[i]){ctx.globalAlpha=.1;ctx.fillStyle=guard;ctx.fill(p,'evenodd');ctx.globalAlpha=1}
    ctx.strokeStyle=border;ctx.lineWidth=.6;ctx.stroke(p)});
  const a=pr(-9.75,36.05),z=pr(-5,34.05);ctx.strokeStyle=border;ctx.lineWidth=.7;ctx.strokeRect(a[0],a[1],z[0]-a[0],z[1]-a[1]);
  // el encendido avanza desde Madrid hacia fuera
  const front=t*maxD*1.05, s=Math.max(1,sc/110);
  ctx.fillStyle=muted;
  for(const q of pts){if(q.d>front)continue;ctx.globalAlpha=.32;const[px,py]=pr(q.x,q.y);ctx.fillRect(px-s/2,py-s/2,s,s)}
  ctx.globalAlpha=1;
  const R=Math.max(2.2,sc/34);
  on.forEach(i=>{const q=pts[i];if(q.d>front)return;const[px,py]=pr(q.x,q.y);
    ctx.beginPath();ctx.arc(px,py,R+1.4,0,7);ctx.fillStyle=card;ctx.fill();
    ctx.beginPath();ctx.arc(px,py,R,0,7);ctx.fillStyle=guard;ctx.fill()});
}

// cifra: la misma que calcula app.js en sus indicadores
const nEl=document.getElementById('liveN'),sub=document.getElementById('liveSub');
function appCount(){const b=document.querySelector('#kpis .kpi.g b');const n=b?parseInt(b.textContent.replace(/\D/g,''),10):NaN;return isNaN(n)?on.size:n}
const nCov=cov.filter(Boolean).length;
sub.textContent=`en las ${nCov} provincias con turno integrado`;
function setN(v){nEl.textContent=nf.format(Math.round(v))}

new ResizeObserver(draw).observe(cv);
new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
setInterval(()=>{computeOn();draw();setN(appCount())},60000);

if(reduce||typeof gsap==='undefined'){t=1;draw();setN(appCount());return}
const o={t:0,n:0};
gsap.to(o,{t:1,n:appCount(),duration:1.3,delay:.15,ease:'power2.out',onUpdate:()=>{t=o.t;draw();setN(o.n)}});
})();
