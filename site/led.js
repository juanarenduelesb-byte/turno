/* Turno · letrero LED de farmacia en canvas.
   Cruz de 27×27 puntos que alterna cruz, hora, "GUARDIA" y cuántas hay de guardia ahora. */
(function(){
'use strict';
const cv=document.getElementById('led'); if(!cv)return;
const ctx=cv.getContext('2d');
const N=27,A0=9,A1=17;                        // brazo de 9 puntos de ancho
const inMask=(r,c)=>(r>=A0&&r<=A1)||(c>=A0&&c<=A1);
const GREEN=[53,240,140],FIRE=[255,90,58];
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// fuente de 3×5 puntos
const F={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111',':':'01010','G':'111100101101111','U':'101101101101111','A':'111101111101101','R':'110101110101101','D':'110101101101110','I':'111010010010111','H':'101101111101101',' ':'000000000000000'};
const gw=ch=>ch===':'?1:3;
function textCols(str){ // columnas de puntos para un texto
  const cols=[];
  [...str].forEach((ch,k)=>{const g=F[ch]||F[' '],w=gw(ch);
    for(let x=0;x<w;x++){const col=[];for(let y=0;y<5;y++)col.push(g[y*w+x]==='1');cols.push(col)}
    if(k<str.length-1)cols.push([0,0,0,0,0].map(()=>false))});
  return cols;
}

const dots=[];
for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(inMask(r,c))dots.push({r,c,b:0,t:0,col:GREEN,boot:Math.random(),d:Math.hypot(r-13,c-13)});
const at={};dots.forEach(d=>at[d.r*N+d.c]=d);

// sprite con halo (el único brillo de la web: es una luz real)
let W=0,P=0,sprite=null,spriteFire=null,dpr=1;
function makeSprite(rgb){
  const s=document.createElement('canvas'),z=Math.ceil(P*2.6*dpr);s.width=s.height=z;
  const g=s.getContext('2d'),m=z/2;
  const rad=g.createRadialGradient(m,m,0,m,m,m);
  rad.addColorStop(0,`rgba(${rgb},1)`);rad.addColorStop(.18,`rgba(${rgb},.95)`);rad.addColorStop(.32,`rgba(${rgb},.35)`);rad.addColorStop(1,`rgba(${rgb},0)`);
  g.fillStyle=rad;g.fillRect(0,0,z,z);
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(m,m,P*.16*dpr,0,7);g.fill();
  return s;
}
function size(){
  const r=cv.getBoundingClientRect(); if(!r.width)return;
  dpr=Math.min(2,devicePixelRatio||1); W=r.width; P=W/N;
  cv.width=Math.round(W*dpr); cv.height=Math.round(W*dpr);
  sprite=makeSprite(GREEN.join(',')); spriteFire=makeSprite(FIRE.join(','));
}

// modos
const madrid=new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function guardCount(){const b=document.querySelector('#kpis .kpi.g b');const n=b?parseInt(b.textContent.replace(/\D/g,''),10):NaN;return isNaN(n)?null:n}
const cap=document.getElementById('signCap');
const SEQ=[
  {k:'cross',dur:3.6,cap:()=>'Letrero en directo'},
  {k:'clock',dur:3.2,cap:()=>'Hora en Madrid'},
  {k:'word',dur:4.2,cap:()=>'Turno de guardia'},
  {k:'count',dur:3.4,cap:()=>'Farmacias de guardia ahora'}
];
let mode=-1,modeT=0,bootT=0,words=null,count=null;
function nextMode(){
  mode=(mode+1)%SEQ.length; modeT=0;
  if(SEQ[mode].k==='count'){count=guardCount(); if(count===null){nextMode();return}}
  if(SEQ[mode].k==='word')words=textCols('GUARDIA');
  if(cap)cap.textContent=SEQ[mode].cap();
}
function targetFor(d,t){
  const m=SEQ[mode]?SEQ[mode].k:'cross';
  if(m==='cross'){return {b:.62+.38*Math.sin(t*2.4-d.d*.42),col:GREEN}}
  const inBand=d.r>=11&&d.r<=15;
  let cols=null,off=0,col=GREEN;
  if(m==='clock'){const s=madrid.format(new Date());cols=textCols(s);off=Math.floor((N-cols.length)/2);
    if(cols.length>=8&&Math.floor(t*1.6)%2===0)cols[7]=cols[7].map(()=>false)} // dos puntos que parpadean
  else if(m==='count'){cols=textCols(String(Math.min(count,9999)));off=Math.floor((N-cols.length)/2);col=FIRE}
  else if(m==='word'){cols=words;col=FIRE;off=Math.round(N-(t/SEQ[mode].dur)*(N+cols.length))}
  if(inBand){const x=d.c-off;if(x>=0&&x<cols.length&&cols[x][d.r-11])return {b:1,col}}
  return {b:.05,col};
}

// interacción: el letrero responde al dedo o al puntero
let px=-1e4,py=-1e4;
addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top},{passive:true});

let last=0,running=false,visible=true;
function frame(now){
  if(!running)return;
  const dt=Math.min(.05,(now-(last||now))/1000);last=now;
  bootT+=dt; modeT+=dt;
  if(mode<0&&bootT>1.3)nextMode();
  if(mode>=0&&modeT>SEQ[mode].dur)nextMode();
  draw(bootT,dt);
  requestAnimationFrame(frame);
}
function draw(t,dt){
  if(!W)size(); if(!W)return;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
  const z=sprite.width, h=z/2;
  for(const d of dots){
    let tg;
    if(mode<0){tg={b:d.boot<t/1.1?(.6+.4*Math.sin(t*2.4-d.d*.42)):0,col:GREEN}}
    else tg=targetFor(d,modeT);
    const cx=(d.c+.5)*P, cy=(d.r+.5)*P;
    const near=Math.max(0,1-Math.hypot(cx-px,cy-py)/(P*4.5));
    const target=Math.min(1,tg.b+near*.55*(tg.b>.3?0:1)+near*.15);
    d.b+=(target-d.b)*Math.min(1,dt*(target>d.b?22:9)); d.col=tg.col;
    const X=cx*dpr, Y=cy*dpr;
    // punto apagado: la rejilla del letrero se intuye
    ctx.globalAlpha=1; ctx.fillStyle='rgba(233,242,238,.055)';
    ctx.beginPath(); ctx.arc(X,Y,P*.2*dpr,0,7); ctx.fill();
    if(d.b>.02){ctx.globalAlpha=d.b; ctx.drawImage(d.col===FIRE?spriteFire:sprite,X-h,Y-h)}
  }
  ctx.globalAlpha=1;
}
function start(){if(running||!visible||document.hidden)return;running=true;last=0;requestAnimationFrame(frame)}
function stop(){running=false}

new ResizeObserver(()=>{size();if(!running)draw(bootT,0)}).observe(cv);
if(reduce){size();mode=0;dots.forEach(d=>d.b=.9);draw(10,1);return}
new IntersectionObserver(es=>{visible=es[0].isIntersecting;visible?start():stop()}).observe(cv);
document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
start();
})();
