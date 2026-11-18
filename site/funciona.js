/* Turno · "Cómo funciona": España se dibuja, las farmacias se encienden y las de guardia arden. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const nf=new Intl.NumberFormat('es-ES');

// reloj de Madrid
const clk=$('#clk'), fmt=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const tickClock=()=>{clk.textContent=fmt.format(new Date())}; tickClock(); setInterval(tickClock,10000);

// ---------- datos ----------
const hasData=typeof FARM!=='undefined'&&typeof GEO!=='undefined';
const P=hasData?FARM.prov:[];
const CAN=new Set(['35','38']);
// proyección: península y Baleares; Canarias en un recuadro abajo a la izquierda
function geo2(lon,lat){ if(lat<30){lon=-9.6+(lon+18.2)*.9;lat=34.15+(lat-27.6)*.9} return [lon,lat] }
const B={w:-9.9,e:4.6,s:34,n:43.95}, KX=Math.cos(39.5*Math.PI/180);
let rings=[],ph=[],guard=[],cov=[],provCount=P.length;
if(hasData){
  rings=GEO.map((g,i)=>g.r.map(s=>s.split(' ').map(p=>{const[a,b]=p.split(',').map(Number);return geo2(a,b)})));
  const MAD=[-3.7038,40.4168];
  const gset=new Set(FARM.g.map(x=>x[0]));
  ph=FARM.f.map((r,i)=>{const[x,y]=geo2(r[1],r[0]);return {x,y,g:gset.has(i),d:Math.hypot((r[1]-MAD[0])*KX,r[0]-MAD[1])+(r[0]<30?6:0)}});
  ph.sort((a,b)=>a.d-b.d);
  guard=ph.filter(p=>p.g);
  cov=P.map(p=>!!p.cov);
}
const totalF=ph.length, totalG=guard.length, totalCov=cov.filter(Boolean).length;

// ---------- lienzo ----------
const cv=$('#spain'), ctx=cv.getContext('2d');
let W=0,H=0,dpr=1,sc=1,ox=0,oy=0,paths=[],per=[],spriteG=null;
function proj([lon,lat]){return [ox+(lon-B.w)*KX*sc, oy+(B.n-lat)*sc]}
function layout(){
  const r=cv.getBoundingClientRect(); if(!r.width||!r.height)return;
  dpr=Math.min(2,devicePixelRatio||1); W=r.width; H=r.height;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  const gw=(B.e-B.w)*KX, gh=B.n-B.s; sc=Math.min(W/gw,H/gh)*.96;
  ox=(W-gw*sc)/2; oy=(H-gh*sc)/2;
  paths=rings.map(rs=>{const p=new Path2D();let L=0;rs.forEach(r=>{r.forEach((pt,k)=>{const[x,y]=proj(pt);k?p.lineTo(x,y):p.moveTo(x,y)});p.closePath();
    for(let k=1;k<r.length;k++){const a=proj(r[k-1]),b=proj(r[k]);L+=Math.hypot(b[0]-a[0],b[1]-a[1])}});return {p,L}});
  ph.forEach(p=>{const[x,y]=proj([p.x,p.y]);p.px=x;p.py=y});
  // halo de las guardias: luz real, como el letrero
  const s=document.createElement('canvas'),z=Math.ceil(26*dpr);s.width=s.height=z;const g=s.getContext('2d'),m=z/2;
  const rg=g.createRadialGradient(m,m,0,m,m,m);rg.addColorStop(0,'rgba(255,120,90,1)');rg.addColorStop(.2,'rgba(255,90,58,.8)');rg.addColorStop(1,'rgba(255,90,58,0)');
  g.fillStyle=rg;g.fillRect(0,0,z,z);spriteG=s;
  draw(prog);
}
const seg=(p,a,b)=>Math.max(0,Math.min(1,(p-a)/(b-a)));
let prog=reduce?1:0;
function draw(p){
  if(!W)return;
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const pA=seg(p,0,.2), pB=seg(p,.22,.55), pC=seg(p,.57,.8), pD=seg(p,.82,.97);
  // provincias integradas
  if(pD>0){ctx.fillStyle=`rgba(255,90,58,${.16*pD})`;paths.forEach((q,i)=>{if(cov[i])ctx.fill(q.p,'evenodd')})}
  // fronteras que se dibujan
  ctx.lineWidth=1; ctx.strokeStyle=`rgba(233,242,238,${.18+.1*(1-pB)})`;
  paths.forEach(q=>{ctx.setLineDash([q.L,q.L]);ctx.lineDashOffset=q.L*(1-pA);ctx.stroke(q.p)});
  ctx.setLineDash([]);
  if(pD>0){ctx.strokeStyle=`rgba(255,90,58,${.7*pD})`;ctx.lineWidth=1.4;paths.forEach((q,i)=>{if(cov[i])ctx.stroke(q.p)})}
  // recuadro de Canarias
  if(pA>0){const a=proj([-9.75,36.05]),b=proj([-5.0,34.05]);ctx.strokeStyle=`rgba(233,242,238,${.14*pA})`;ctx.lineWidth=1;ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1])}
  // farmacias
  const n=Math.floor(totalF*pB), dim=1-.55*pC;
  ctx.fillStyle=`rgba(53,240,140,${.75*dim})`;
  const s=Math.max(1,sc/90);
  for(let k=0;k<n;k++){const q=ph[k];ctx.fillRect(q.px-s/2,q.py-s/2,s,s)}
  // frente de onda
  if(pB>0&&pB<1&&n>0){const f=ph[Math.min(n,totalF-1)];const c=proj([-3.7038,40.4168]);const R=Math.hypot(f.px-c[0],f.py-c[1]);
    ctx.strokeStyle='rgba(53,240,140,.35)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(c[0],c[1],R,0,7);ctx.stroke()}
  // guardias
  if(pC>0){const m=Math.floor(totalG*pC),z=spriteG.width/dpr,h=z/2;
    for(let k=0;k<m;k++){const q=guard[k];ctx.globalAlpha=.55;ctx.drawImage(spriteG,q.px-h,q.py-h,z,z)}
    ctx.globalAlpha=1;ctx.fillStyle='#FFD2C6';for(let k=0;k<m;k++){const q=guard[k];ctx.fillRect(q.px-.9,q.py-.9,1.8,1.8)}}
}

// ---------- marcador ----------
const mNum=$('#mNum'),mLab=$('#mLab'),mBar=$('#mBar'),steps=$$('.step');
let curStep=-1;
function meter(p){
  const i=p<.21?0:p<.56?1:p<.81?2:3;
  let v,l,c='var(--night-ink)';
  if(i===0){v=Math.round(provCount*seg(p,0,.2));l='provincias'}
  else if(i===1){v=Math.round(totalF*seg(p,.22,.55));l='farmacias en el mapa';c='var(--led)'}
  else if(i===2){v=Math.round(totalG*seg(p,.57,.8));l='farmacias con turno de guardia';c='var(--fire)'}
  else{v=Math.max(1,Math.round(totalCov*seg(p,.82,.97)));l=`de ${provCount} turnos integrados`;c='var(--fire)'}
  mNum.textContent=nf.format(v); mNum.style.color=c; mLab.textContent=l;
  mBar.style.transform=`scaleX(${p})`;
  if(i!==curStep){
    const prev=steps[curStep],next=steps[i];curStep=i;
    if(typeof gsap!=='undefined'&&!reduce){if(prev)gsap.to(prev,{opacity:0,y:-24,duration:.4,ease:'power2.in',overwrite:true});gsap.fromTo(next,{opacity:0,y:28},{opacity:1,y:0,duration:.7,delay:.12,ease:'expo.out',overwrite:true})}
    else steps.forEach((s,k)=>{s.style.opacity=k===i?1:0;s.style.transform='none'});
  }
}

new ResizeObserver(layout).observe(cv);
if(!hasData){mLab.textContent='Datos no disponibles en esta vista previa';return}
if(reduce||typeof gsap==='undefined'){draw(1);steps.forEach(s=>{s.style.opacity=1});meter(1);steps.forEach(s=>{s.style.opacity=1;s.style.transform='none'});return}

// ---------- movimiento ----------
gsap.registerPlugin(ScrollTrigger);
const lenis=new Lenis({lerp:.1});
lenis.on('scroll',ScrollTrigger.update);
gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
const nav=$('#topnav');
lenis.on('scroll',({scroll,direction,velocity})=>nav.classList.toggle('hide',scroll>innerHeight*.9&&direction===1&&Math.abs(velocity)>1.2));

function split(el){const out=[];const wrap=n=>{const w=document.createElement('span');w.className='w';const i=document.createElement('span');i.className='wi';w.appendChild(i);i.appendChild(n);out.push(i);return w};
  [...el.childNodes].forEach(n=>{if(n.nodeType===3){const f=document.createDocumentFragment();n.textContent.split(/(\s+)/).forEach(p=>{if(!p)return;f.appendChild(/^\s+$/.test(p)?document.createTextNode(' '):wrap(document.createTextNode(p)))});el.replaceChild(f,n)}else el.replaceChild(wrap(n.cloneNode(true)),n)});return out}

// apertura
const hw=split($('.cf-hero h1'));
gsap.timeline({defaults:{ease:'expo.out'}})
  .from('.topnav .bar',{y:-30,opacity:0,duration:.9},0)
  .from('.cf-hero .eyebrow',{y:14,opacity:0,duration:.8},.1)
  .from(hw,{yPercent:115,rotate:4,duration:1.2,stagger:.06},.15)
  .from('.cf-hero .lede',{y:20,opacity:0,duration:1},.6)
  .from('.clock',{x:40,opacity:0,duration:1.4},.3)
  .from('.cue',{opacity:0,duration:1},1);
gsap.to('.clock',{yPercent:-40,ease:'none',scrollTrigger:{trigger:'.cf-hero',start:'top top',end:'bottom top',scrub:true}});

// el mapa avanza con el scroll
const st={p:0};
ScrollTrigger.create({trigger:'#scene',start:'top top',end:'bottom bottom',scrub:.6,onUpdate:self=>{gsap.to(st,{p:self.progress,duration:.35,ease:'power2.out',overwrite:true,onUpdate:()=>{prog=st.p;draw(prog);meter(prog)}})}});
meter(0);

// un día: carril horizontal fijado
const rail=$('#rail');
const dist=()=>Math.max(0,rail.scrollWidth-innerWidth);
gsap.to(rail,{x:()=>-dist(),ease:'none',scrollTrigger:{trigger:'#day',start:'top top',end:()=>'+='+dist(),pin:'.dayin',scrub:.8,invalidateOnRefresh:true}});
gsap.to('#trk',{scaleX:1,ease:'none',scrollTrigger:{trigger:'#day',start:'top top',end:()=>'+='+dist(),scrub:true,invalidateOnRefresh:true}});
const dw=split($('.dayhead .title'));
gsap.from(dw,{yPercent:115,duration:1,stagger:.05,ease:'expo.out',scrollTrigger:{trigger:'#day',start:'top 70%',once:true}});

// principios
const rw=split($('.rules .title'));
gsap.from(rw,{yPercent:115,duration:1,stagger:.05,ease:'expo.out',scrollTrigger:{trigger:'.rules',start:'top 75%',once:true}});
gsap.from('.rule',{y:60,opacity:0,rotateX:-12,duration:1.1,stagger:.08,ease:'expo.out',scrollTrigger:{trigger:'.rules .grid',start:'top 85%',once:true}});
if(fine)$$('.rule,.tcard').forEach(c=>{
  c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;gsap.to(c,{rotateY:x*6,rotateX:-y*6,duration:.5,ease:'power3.out',transformPerspective:900})});
  c.addEventListener('pointerleave',()=>gsap.to(c,{rotateY:0,rotateX:0,duration:.8,ease:'elastic.out(1,.6)'}));
});

// cierre
const bw=split($('.outro .big'));
gsap.from(bw,{yPercent:115,duration:1.2,stagger:.06,ease:'expo.out',scrollTrigger:{trigger:'.outro .big',start:'top 85%',once:true}});
gsap.from('.outro .row2 .btn,.outro .n112',{y:20,opacity:0,duration:.9,stagger:.08,ease:'expo.out',scrollTrigger:{trigger:'.outro .row2',start:'top 92%',once:true}});
addEventListener('load',()=>ScrollTrigger.refresh());
})();
