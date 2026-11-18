/* Turno · "Cómo funciona": mapa de cobertura estático, dibujado una vez con los datos del día. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const nf=new Intl.NumberFormat('es-ES');
if(typeof FARM==='undefined'||typeof GEO==='undefined')return;
const P=FARM.prov, gset=new Set(FARM.g.map(x=>x[0]));
const cov=P.map(p=>!!p.cov);
$('#sF').textContent=nf.format(FARM.f.length);
$('#sG').textContent=nf.format(gset.size);
$('#sC').textContent=cov.filter(Boolean).length+' de '+P.length;
const b=FARM.meta&&FARM.meta.built;
if(b)$('#sDate').textContent='Datos del '+b.slice(8,10)+'/'+b.slice(5,7)+'/'+b.slice(0,4)+' a las '+b.slice(11,16)+'.';

// Canarias en un recuadro abajo a la izquierda, como en los mapas de España
const geo2=(lon,lat)=>lat<30?[-9.6+(lon+18.2)*.9,34.15+(lat-27.6)*.9]:[lon,lat];
const B={w:-9.9,e:4.6,s:34,n:43.95}, KX=Math.cos(39.5*Math.PI/180);
const rings=GEO.map(g=>g.r.map(s=>s.split(' ').map(p=>{const[a,c]=p.split(',').map(Number);return geo2(a,c)})));
const pts=FARM.f.map((r,i)=>{const[x,y]=geo2(r[1],r[0]);return [x,y,gset.has(i)]});
const cv=$('#spain'), ctx=cv.getContext('2d');
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function draw(){
  const r=cv.getBoundingClientRect(); if(!r.width)return;
  const dpr=Math.min(2,devicePixelRatio||1),W=r.width,H=r.height;
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const gw=(B.e-B.w)*KX,gh=B.n-B.s,sc=Math.min(W/gw,H/gh)*.94,ox=(W-gw*sc)/2,oy=(H-gh*sc)/2;
  const pr=(lon,lat)=>[ox+(lon-B.w)*KX*sc,oy+(B.n-lat)*sc];
  const land=css('--land'),border=css('--border'),guard=css('--guard'),muted=css('--muted');
  rings.forEach((rs,i)=>{const p=new Path2D();rs.forEach(rg=>{rg.forEach(([a,c],k)=>{const[x,y]=pr(a,c);k?p.lineTo(x,y):p.moveTo(x,y)});p.closePath()});
    ctx.fillStyle=land;ctx.fill(p,'evenodd');
    if(cov[i]){ctx.globalAlpha=.16;ctx.fillStyle=guard;ctx.fill(p,'evenodd');ctx.globalAlpha=1}
    ctx.strokeStyle=cov[i]?guard:border;ctx.lineWidth=cov[i]?1.2:.7;ctx.stroke(p)});
  const a=pr(-9.75,36.05),z=pr(-5,34.05);ctx.strokeStyle=border;ctx.lineWidth=.8;ctx.strokeRect(a[0],a[1],z[0]-a[0],z[1]-a[1]);
  const s=Math.max(1,sc/100);
  ctx.globalAlpha=.4;ctx.fillStyle=muted;
  for(const[x,y,gg]of pts)if(!gg){const[px,py]=pr(x,y);ctx.fillRect(px-s/2,py-s/2,s,s)}
  ctx.globalAlpha=1;ctx.fillStyle=guard;const t=s*1.8;
  for(const[x,y,gg]of pts)if(gg){const[px,py]=pr(x,y);ctx.fillRect(px-t/2,py-t/2,t,t)}
}
new ResizeObserver(draw).observe(cv);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',draw);
})();
