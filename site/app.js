(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store=k=>k==='theme'?localStorage:sessionStorage;
const LS={get(k){try{return JSON.parse(store(k).getItem('turno.'+k))}catch(e){return null}},set(k,v){try{store(k).setItem('turno.'+k,JSON.stringify(v))}catch(e){}}};
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const fmtKm=m=>m<950?Math.round(m/10)*10+' m':(m<9950?(m/1000).toFixed(1).replace('.',','):Math.round(m/1000))+' km';
const nf=new Intl.NumberFormat('es-ES');

// ---------- datos ----------
const P=FARM.prov, F=FARM.f.map((r,i)=>({i,lat:r[0],lon:r[1],name:r[2],street:r[3],city:r[4],pv:r[5],cp:r[6],tel:r[7],oh:r[8],ohx:r[9],src:r[10],hoy:r[11],h24:r[12],osm:r[13]}));
const SRCN=['OpenStreetMap','COF Madrid','COF Cádiz','Ayto. Zaragoza','COF Sevilla','COFs Castilla-La Mancha'];
F.forEach(f=>{f.label=f.name||('Farmacia · '+(f.street||f.city||'sin nombre'));f.g=[]});
FARM.g.forEach(([i,a,b,t,z,s])=>F[i].g.push({a,b,t,z,s}));
F.forEach(f=>f.g.sort((x,y)=>x.a<y.a?-1:1));
const PLACES=LUG.p.map(p=>({n:p[0],pv:p[1],lat:p[2],lon:p[3],pop:p[4],k:norm(p[0])}));
const CPS=LUG.cp;
const CANARY=new Set(['35','38']);
// cobertura de guardias por provincia: rango de fechas
const COV={};
FARM.g.forEach(([i,a,b])=>{const pv=F[i].pv;const c=COV[pv]||(COV[pv]={min:a,max:b});if(a<c.min)c.min=a;if(b>c.max)c.max=b});

// ---------- hora local (Península / Canarias) ----------
const fmts={};
function nowIn(tz){
  const f=fmts[tz]||(fmts[tz]=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'}));
  const o={};f.formatToParts(new Date()).forEach(p=>o[p.type]=p.value);
  const dow=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(o.weekday);
  return {iso:`${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`,date:`${o.year}-${o.month}-${o.day}`,dow,min:(+o.hour)*60+(+o.minute)};
}
let NOW={}; function tick(){NOW={pen:nowIn('Europe/Madrid'),can:nowIn('Atlantic/Canary')}}
tick();
const nowFor=f=>CANARY.has(P[f.pv].cod)?NOW.can:NOW.pen;
const hm=m=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const DOWS=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const dlabel=iso=>{const d=new Date(iso.slice(0,10)+'T12:00:00');return DOWS[(d.getDay()+6)%7]+' '+d.getDate()};
const tlabel=(iso,ref)=>{const t=iso.slice(11,16);if(iso.slice(0,10)===ref)return t;const d=new Date(iso.slice(0,10)+'T12:00:00');return (iso.slice(0,10)>ref?'mañana ':'')+t};

function weekOf(f){
  if(!f.oh)return null;
  if(f.oh==='24')return '24';
  return f.oh.split('|').map(d=>d?d.split(',').map(s=>s.split('-').map(Number)):[]);
}
// estado de una farmacia ahora
function status(f){
  const n=nowFor(f);
  for(const g of f.g){
    if(g.a<=n.iso&&n.iso<g.b){const loc=/Localizada/i.test(g.t);return {k:'guardia',t:loc?'Guardia localizada':'De guardia',d:(loc?'llamar · ':'')+'hasta '+tlabel(g.b,n.date),g,loc}}
  }
  const later=f.g.find(g=>g.a>n.iso&&g.a.slice(0,10)===n.date);
  let open=null;
  if(f.hoy){ // horario oficial de hoy (COF Madrid)
    if(f.hoy==='00:00-00:00')open={o:true,d:'abierta 24 h'};
    else{const ps=f.hoy.split(/[,\s]+/).map(s=>s.split('-').map(t=>{const[a,b]=t.split(':');return +a*60+ +b}));
      let o=null,nx=null;ps.forEach(([a,b])=>{if(b<=a)b+=1440;if(n.min>=a&&n.min<b)o=b;if(a>n.min&&(nx===null||a<nx))nx=a});
      open=o!==null?{o:true,d:'hasta '+hm(o)}:{o:false,d:nx!==null?'abre a las '+hm(nx):'cerrada hasta mañana'};}
  }else{
    const w=weekOf(f);
    if(w==='24')open={o:true,d:'abierta 24 h'};
    else if(w){
      const t=n.dow*1440+n.min; let o=null,nx=null;
      for(let d=0;d<7;d++)for(const[a,b]of w[d]){const s=d*1440+a,e=d*1440+b;
        for(const off of[0,-10080,10080]){if(t>=s+off&&t<e+off)o=e+off;const ss=s+off;if(ss>t&&(nx===null||ss<nx))nx=ss}}
      if(o!==null)open={o:true,d:'hasta '+hm(o)};
      else if(nx!==null){const dd=Math.floor(nx/1440)-Math.floor(t/1440);open={o:false,d:dd===0?'abre a las '+hm(nx):(dd===1?'abre mañana '+hm(nx):'abre el '+DOWS[Math.floor(nx/1440)%7]+' '+hm(nx))}}
      else open={o:false,d:'cerrada'};
      if(!f.ohx)open.d+=' (aprox.)';
    }
  }
  if(later&&!(open&&open.o))return {k:'luego',t:'Guardia hoy',d:'desde las '+later.a.slice(11,16),g:later};
  if(open)return open.o?{k:'abierta',t:'Abierta',d:open.d,later}:{k:'cerrada',t:'Cerrada',d:open.d,later};
  return {k:'nd',t:'Sin horario',d:'horario no publicado',later};
}

// ---------- distancia ----------
function dist(a,b,c,d){const R=6371000,r=Math.PI/180,p1=a*r,p2=c*r,dp=(c-a)*r,dl=(d-b)*r;const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h))}

// ---------- estado de la app ----------
let WDAY=null; let LOC=LS.get('loc'); let RAD=+(LS.get('rad')||10); let FILT=LS.get('filt')||'todas'; let SEL=null; let NEAR=[]; let VIEW='cerca';
$('#rad').value=String(RAD);

// ---------- buscador ----------
const q=$('#q'), sug=$('#sug');
let hits=[],hl=-1;
function search(s){
  const k=norm(s); if(!k)return [];
  if(/^\d{3,5}$/.test(k)){
    return CPS.filter(c=>c[0].startsWith(k)).slice(0,8).map(c=>({n:c[0]+(c[3]?' · '+c[3]:''),lat:c[1],lon:c[2],sub:'Código postal',pv:null}));
  }
  const out=[];
  for(const p of PLACES){ if(p.k.startsWith(k)){out.push(p); if(out.length>=40)break;} }
  if(out.length<8){for(const p of PLACES){ if(!p.k.startsWith(k)&&p.k.includes(' '+k)){out.push(p); if(out.length>=40)break;}}}
  out.sort((a,b)=>(b.k===k)-(a.k===k)||b.pop-a.pop);
  return out.slice(0,8).map(p=>({n:p.n,lat:p.lat,lon:p.lon,sub:P[p.pv].n,pv:p.pv}));
}
function showSug(){
  hits=search(q.value); hl=-1;
  if(!q.value.trim()){sug.hidden=true;return}
  sug.innerHTML=hits.length?hits.map((h,i)=>`<button type="button" data-i="${i}">${esc(h.n)}<span>${esc(h.sub)}</span></button>`).join(''):'<div class="none">No encuentro ese lugar. Prueba con el municipio o el código postal.</div>';
  sug.hidden=false;
}
q.addEventListener('input',showSug);
q.addEventListener('focus',()=>{if(q.value.trim())showSug()});
q.addEventListener('keydown',e=>{
  if(sug.hidden)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();hl=(hl+(e.key==='ArrowDown'?1:-1)+hits.length)%hits.length;[...sug.querySelectorAll('button')].forEach((b,i)=>b.classList.toggle('hl',i===hl))}
  if(e.key==='Escape')sug.hidden=true;
});
sug.addEventListener('mousedown',e=>{const b=e.target.closest('button');if(b){e.preventDefault();pick(hits[+b.dataset.i])}});
document.addEventListener('click',e=>{if(!e.target.closest('#tool'))sug.hidden=true});
$('#tool').addEventListener('submit',e=>{e.preventDefault();if(!hits.length)hits=search(q.value);if(hits.length)pick(hits[Math.max(0,hl)])});
function pick(h){
  if(!h)return; sug.hidden=true;
  setLoc({lat:h.lat,lon:h.lon,label:h.n.split(' · ')[0]+(h.sub&&h.sub!=='Código postal'?', '+h.sub:''),cp:h.sub==='Código postal'?h.n:null});
}
$('#rad').addEventListener('change',e=>{RAD=+e.target.value;LS.set('rad',RAD);update(true)});
$('#gps').addEventListener('click',()=>{
  const m=$('#gmsg'); m.hidden=false; m.textContent='Pidiendo tu ubicación…';
  const fail=()=>{m.textContent='No he podido leer tu ubicación (permiso denegado o no disponible). Escribe tu municipio, barrio o código postal.';};
  try{
    if(!navigator.geolocation)return fail();
    navigator.geolocation.getCurrentPosition(p=>{m.hidden=true;setLoc({lat:p.coords.latitude,lon:p.coords.longitude,label:'Tu ubicación'})},fail,{timeout:8000,maximumAge:60000});
  }catch(e){fail()}
});
const QUICK=[['Sotogrande',36.2825,-5.2945,'Sotogrande, Cádiz'],['San Sebastián de los Reyes',40.5474,-3.6261,'San Sebastián de los Reyes, Madrid'],['Madrid centro',40.4168,-3.7038,'Puerta del Sol, Madrid'],['Jerez',36.6866,-6.1372,'Jerez de la Frontera, Cádiz'],['Zaragoza',41.6488,-0.8891,'Zaragoza'],['Barcelona',41.3874,2.1686,'Barcelona'],['Sevilla',37.3891,-5.9845,'Sevilla'],['Toledo',39.8628,-4.0273,'Toledo']];
function renderQuick(){
  $('#quick').innerHTML=QUICK.map((x,i)=>{
    const on=LOC&&Math.abs(LOC.lat-x[1])<1e-3&&Math.abs(LOC.lon-x[2])<1e-3;
    const near=F.reduce((a,f)=>a||(f.g.length&&Math.abs(f.lat-x[1])<.3&&Math.abs(f.lon-x[2])<.3),false);
    return `<button type="button" class="qchip" data-i="${i}" aria-pressed="${on}">${near?'<i class="dot"></i>':''}${esc(x[0])}</button>`}).join('');
}
$('#quick').addEventListener('click',e=>{const b=e.target.closest('.qchip');if(!b)return;const x=QUICK[+b.dataset.i];setLoc({lat:x[1],lon:x[2],label:x[3]})});

function provAt(lat,lon){ // provincia por la farmacia más próxima
  let best=-1,bd=1e12;for(const f of F){const d=(f.lat-lat)**2+((f.lon-lon)*Math.cos(lat*Math.PI/180))**2;if(d<bd){bd=d;best=f.pv}}return best;
}
function setLoc(l){
  l.pv=provAt(l.lat,l.lon); LOC=l; LS.set('loc',l); SEL=null; q.value=l.label;
  MAP.center(l.lat,l.lon,RAD); update(true);
  if(VIEW!=='cerca'&&VIEW!=='semana')location.hash='cerca';
}

// ---------- cálculo y render ----------
function compute(){
  if(!LOC){NEAR=[];return}
  const cosl=Math.cos(LOC.lat*Math.PI/180), dl=(RAD*1000+2000)/111320, dlo=dl/cosl;
  const arr=[];
  for(const f of F){
    if(Math.abs(f.lat-LOC.lat)>dl||Math.abs(f.lon-LOC.lon)>dlo)continue;
    const d=dist(LOC.lat,LOC.lon,f.lat,f.lon); if(d>RAD*1000)continue;
    arr.push({f,d,s:status(f)});
  }
  arr.sort((a,b)=>a.d-b.d); NEAR=arr;
}
function nearestWhere(pred,maxKm=80){
  if(!LOC)return null; let best=null,bd=maxKm*1000;
  const cosl=Math.cos(LOC.lat*Math.PI/180), dl=maxKm*1000/111320;
  for(const f of F){ if(Math.abs(f.lat-LOC.lat)>dl||Math.abs(f.lon-LOC.lon)>dl/cosl)continue;
    const d=dist(LOC.lat,LOC.lon,f.lat,f.lon); if(d<bd){const s=status(f); if(pred(f,s)){best={f,d,s};bd=d}}}
  return best;
}
const ICON={
  cross:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 2.5h5.6a1 1 0 0 1 1 1v4.7h4.7a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1h-4.7v4.7a1 1 0 0 1-1 1H9.2a1 1 0 0 1-1-1v-4.7H3.5a1 1 0 0 1-1-1V9.2a1 1 0 0 1 1-1h4.7V3.5a1 1 0 0 1 1-1z"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.2a9.8 9.8 0 1 0 7.3 13.4 7.6 7.6 0 0 1-7.3-13.4z"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  go:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 21 3l-8.5 18-2-7.5z"/></svg>',
  tel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/></svg>',
  ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
};
const route=f=>`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}`;
const telFmt=t=>t?t.replace(/^\+?34/,'').replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3'):'';
function covInfo(pv){
  const p=P[pv]; const c=COV[pv]; const n=nowFor({pv});
  if(!p||!p.cov)return {has:false};
  const stale=!c||c.max<=n.iso;
  return {has:true,stale,q:p.cov.q,s:p.cov.s,max:c&&c.max};
}
function renderBest(){
  const el=$('#best'); el.className='best glass';
  if(!LOC){
    el.innerHTML=`<div class="ic">${ICON.moon}</div><div><p class="k">Empieza aquí</p><h2>Dime dónde estás y te digo cuál está de guardia</h2><p>Escribe tu municipio, urbanización o código postal arriba, o prueba con uno de los ejemplos.</p></div><div class="side"></div>`;return;
  }
  const pv=LOC.pv, p=P[pv], ci=covInfo(pv);
  const g=nearestWhere((f,s)=>s.k==='guardia'&&!s.loc,60)||nearestWhere((f,s)=>s.k==='guardia',60);
  const gl=g&&!g.s.loc?nearestWhere((f,s)=>s.k==='guardia'&&s.loc,60):null;
  const cofBtn=p&&p.cof?`<a class="btn ghost" href="${esc(p.cof.u)}" target="_blank" rel="noopener">${ICON.ext}Turno oficial · ${esc(p.n)}</a>`:'';
  if(g){
    const f=g.f; el.classList.add('on');
    el.innerHTML=`<div class="ic">${ICON.cross}</div><div><p class="k"><i class="pulse"></i>${g.s.loc?'Guardia localizada · la más cercana':'De guardia ahora · la más cercana'}</p><h2>${esc(f.label)}</h2><p>${esc([f.street,f.city].filter(Boolean).join(', '))} · ${esc(g.s.g.t)} · ${esc(g.s.d)}</p>${g.s.loc?'<p>Localizada: la farmacia está cerrada; se llama al teléfono y el farmacéutico acude.</p>':''}${gl&&gl.d<g.d?`<p>Más cerca hay una de guardia localizada (hay que llamar): <button class="btn ghost" style="height:30px;font-size:13px" type="button" data-sel="${gl.f.i}">${esc(gl.f.label)} · ${fmtKm(gl.d)}</button></p>`:''}</div>
    <div class="side"><div class="big num">${fmtKm(g.d)}<small>desde ${esc(LOC.label.split(',')[0])}</small></div><div class="acts"><a class="btn guard" href="${route(f)}" target="_blank" rel="noopener">${ICON.go}Cómo llegar</a>${f.tel?`<a class="btn ghost" href="tel:${esc(f.tel)}">${ICON.tel}${esc(telFmt(f.tel))}</a>`:''}<button class="btn ghost" type="button" data-sel="${f.i}">Ver en el mapa</button></div></div>`;
    return;
  }
  // sin guardia conocida: lo más útil que sí sabemos
  const op=nearestWhere((f,s)=>s.k==='abierta',40);
  let why;
  if(ci.has&&ci.stale)why=`Los turnos de ${esc(p.n)} que tengo cubren hasta el ${esc(dlabel(ci.max))}. Para hoy, consulta el turno oficial.`;
  else if(ci.has)why=`Tengo el turno oficial de ${esc(p.n)} (${esc(ci.q.toLowerCase())}), pero ahora mismo no hay ninguna de guardia a menos de 60 km.`;
  else why=`Aún no tengo conectado el turno del Colegio de Farmacéuticos de ${esc(p?p.n:'tu provincia')}. Consulta su turno oficial; abajo tienes las farmacias de tu zona.`;
  const opTxt=op?`Abierta ahora más cercana según su horario publicado: <b>${esc(op.f.label)}</b> a ${fmtKm(op.d)} (${esc(op.s.d)}).`:'Ninguna farmacia cercana tiene horario publicado en OpenStreetMap, así que no puedo saber cuál está abierta.';
  el.innerHTML=`<div class="ic mut">${ICON.moon}</div><div><p class="k mut">Guardia sin dato en tu zona</p><h2>${why}</h2><p>${opTxt}</p></div><div class="side"><div class="acts">${cofBtn}${op?`<a class="btn primary" href="${route(op.f)}" target="_blank" rel="noopener">${ICON.go}Ir a la abierta</a>`:''}</div></div>`;
}
const FL=[['todas','Todas'],['guardia','De guardia'],['abierta','Abiertas ahora'],['24','24 horas']];
function filtered(){
  return NEAR.filter(x=>FILT==='todas'||(FILT==='guardia'&&(x.s.k==='guardia'||x.s.k==='luego'))||(FILT==='abierta'&&(x.s.k==='abierta'||x.s.k==='guardia'))||(FILT==='24'&&(x.f.oh==='24'||x.f.hoy==='00:00-00:00'||x.f.h24)));
}
function renderList(){
  const st=$('#status'), li=$('#list');
  if(!LOC){st.innerHTML='';
    const cov=P.map((p,i)=>[p,i]).filter(([p])=>p.cov);
    li.innerHTML=`<div class="empty"><b>Sin ubicación todavía</b>Elige un lugar para ver las farmacias de alrededor.</div>`+cov.map(([p,i])=>{const n=F.filter(f=>f.pv===i&&status(f).k==='guardia').length;return `<div class="row" style="cursor:default"><i class="dot s-guardia"></i><span class="t"><b>${esc(p.n)}</b><span>${esc(p.cov.q)}</span></span><span class="km num">${n}</span><span class="st s-guardia">de guardia<small>ahora mismo</small></span></div>`}).join('')+`<div class="lfoot"><span>Otras ${52-cov.length} provincias: enlace al turno oficial de su colegio.</span><a href="#colegios">Ver fuentes</a></div>`;return}
  const cnt=k=>NEAR.filter(x=>x.s.k===k).length;
  const ng=cnt('guardia')+cnt('luego');
  st.innerHTML=`<span><span class="count num">${nf.format(NEAR.length)}</span> farmacias a menos de ${RAD} km de ${esc(LOC.label.split(',')[0])}</span>`+
    FL.map(([k,t])=>`<button type="button" class="qchip" data-f="${k}" aria-pressed="${FILT===k}">${t}${k==='guardia'?` <span class="n">${ng}</span>`:''}${k==='abierta'?` <span class="n">${cnt('abierta')+cnt('guardia')}</span>`:''}</button>`).join('');
  const arr=filtered();
  if(!arr.length){li.innerHTML=`<div class="empty"><b>Nada con este filtro</b>${FILT==='guardia'?'No tengo el turno de guardia de esta zona. Mira el enlace oficial del colegio.':'Prueba a ampliar el radio o quitar el filtro.'}</div>`;return}
  const MAX=150;
  const isG=x=>x.s.k==='guardia'||x.s.k==='luego';
  const gs=arr.filter(isG), rest=arr.filter(x=>!isG(x));
  const rowH=({f,d,s})=>`<button class="row${isG({s})?' g':''}" type="button" data-sel="${f.i}" aria-selected="${SEL===f.i}"><i class="dot s-${s.k}"></i><span class="t"><b>${esc(f.label)}</b><span>${esc([f.street,f.city].filter(Boolean).join(', ')||P[f.pv].n)}</span></span><span class="km num">${fmtKm(d)}</span><span class="st s-${s.k}">${esc(s.t)}<small>${esc(s.d)}</small></span></button>`;
  li.innerHTML=(gs.length&&rest.length?`<div class="grp g">De guardia hoy · ${gs.length}</div>`:'')+gs.map(rowH).join('')+
    (gs.length&&rest.length?`<div class="grp">Resto de farmacias · ${nf.format(rest.length)}</div>`:'')+rest.slice(0,MAX).map(rowH).join('')+
    (rest.length>MAX?`<div class="lfoot">Mostrando las ${MAX} más cercanas de ${nf.format(rest.length)}.</div>`:'');
}
$('#status').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;FILT=b.dataset.f;LS.set('filt',FILT);renderList();MAP.draw()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-sel]');if(!b)return;select(+b.dataset.sel,true)});
function select(i,pan){
  SEL=i; const f=F[i]; renderCard(); renderList(); if(pan)MAP.focus(f.lat,f.lon);
  MAP.draw();
  if(VIEW!=='cerca')location.hash='cerca';
  if(innerWidth<900)$('.mapbox').scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('click',e=>{if(e.target.id==='cx'){SEL=null;renderCard();renderList();MAP.draw()}});
function renderCard(){
  const c=$('#card'); if(SEL===null){c.hidden=true;return}
  const f=F[SEL], s=status(f), d=LOC?dist(LOC.lat,LOC.lon,f.lat,f.lon):null, n=nowFor(f);
  const up=f.g.filter(g=>g.b>n.iso).slice(0,4);
  const p=P[f.pv];
  c.hidden=false;
  c.innerHTML=`<button class="x" type="button" id="cx" aria-label="Cerrar">×</button><h3>${esc(f.label)}</h3><p class="sub">${esc([f.street,f.cp,f.city].filter(Boolean).join(', '))} · ${esc(p.n)}</p>
  <div class="facts"><div class="fact ${s.k==='guardia'||s.k==='luego'?'g':''}"><span>Ahora</span><b class="s-${s.k}">${esc(s.t)} · ${esc(s.d)}</b></div><div class="fact"><span>Distancia</span><b class="num">${d!==null?fmtKm(d):'—'}</b></div>
  ${up.length?`<div class="fact g wide"><span>Próximas guardias</span><b>${up.map(g=>esc(dlabel(g.a))+' '+g.a.slice(11,16)+'–'+(g.b.slice(0,10)!==g.a.slice(0,10)?'día sig. ':'')+g.b.slice(11,16)+' · '+esc(g.t)).join('<br>')}</b></div>`:''}
  ${f.tel?`<div class="fact"><span>Teléfono</span><b class="num">${esc(telFmt(f.tel))}</b></div>`:''}<div class="fact"><span>Fuente</span><b>${[...new Set([SRCN[f.src],...f.g.map(g=>SRCN[{cofm:1,cofcadiz:2,zaragoza:3,cofsevilla:4,cofclm:5}[g.s]])])].join(' + ')}</b></div></div>
  <div class="cacts"><a class="btn guard" href="${route(f)}" target="_blank" rel="noopener">${ICON.go}Cómo llegar</a>${f.tel?`<a class="btn ghost" href="tel:${esc(f.tel)}">${ICON.tel}Llamar</a>`:''}${p.cof?`<a class="btn ghost" href="${esc(p.cof.u)}" target="_blank" rel="noopener">${ICON.ext}Colegio</a>`:''}</div>
  ${s.k==='guardia'&&/Localizada/i.test(s.g.t)?'<p class="note">Guardia localizada: la farmacia está cerrada y el farmacéutico atiende llamando al teléfono indicado en la puerta o en el colegio.</p>':''}
  ${''}${s.k==='nd'||(f.src===0&&!f.ohx&&f.oh)?'<p class="note">El horario procede de OpenStreetMap y puede no estar al día. Llama antes de ir si es urgente.</p>':''}`;
}

// ---------- mapa vectorial ----------
const MAP=(function(){
  const box=$('#map'), svg=$('#msvg');
  let cLat=39.9,cLon=-3.4,ppk=0.55,inited=false; // píxeles por km
  let W=0,H=0;
  const KM_LAT=111.32;
  const proj=(lat,lon)=>[W/2+(lon-cLon)*KM_LAT*Math.cos(cLat*Math.PI/180)*ppk, H/2-(lat-cLat)*KM_LAT*ppk];
  const unproj=(x,y)=>[cLat-(y-H/2)/(KM_LAT*ppk), cLon+(x-W/2)/(KM_LAT*Math.cos(cLat*Math.PI/180)*ppk)];
  const RINGS=GEO.map(g=>({b:g.b,r:g.r.map(s=>s.split(' ').map(p=>p.split(',').map(Number)))}));
  function size(){const r=box.getBoundingClientRect();W=r.width;H=r.height;svg.setAttribute('viewBox',`0 0 ${W} ${H}`)}
  function view(){const [n,w]=unproj(0,0),[s,e]=unproj(W,H);return {n,s,w,e}}
  function draw(){
    if(!W)size(); if(!W)return;
    const v=view(), out=[];
    // tierra
    RINGS.forEach((g,i)=>{
      if(g.b[0]>v.e||g.b[2]<v.w||g.b[1]>v.n||g.b[3]<v.s)return;
      const d=g.r.map(r=>'M'+r.map(([x,y])=>proj(y,x).map(z=>z.toFixed(1)).join(',')).join('L')+'Z').join('');
      out.push(`<path class="land${P[i].cov?' cov':''}" d="${d}"/>`);
    });
    const km=W/ppk;
    // etiquetas de provincia en vista amplia
    if(km>500){RINGS.forEach((g,i)=>{const lat=(g.b[1]+g.b[3])/2,lon=(g.b[0]+g.b[2])/2;const[x,y]=proj(lat,lon);if(x<0||x>W||y<0||y>H)return;out.push(`<text class="pv" x="${x}" y="${y}" text-anchor="middle">${esc(P[i].n)}</text>`)})}
    // anillos
    if(LOC){const[x,y]=proj(LOC.lat,LOC.lon);[1,2,5,10,25,50].forEach(r=>{const rp=r*ppk;if(rp<28||rp>Math.max(W,H)*1.2)return;out.push(`<circle class="ring" cx="${x}" cy="${y}" r="${rp}"/><text class="rl" x="${x+rp*0.707+4}" y="${y-rp*0.707-4}">${r} km</text>`)})}
    // lugares
    if(km<400){
      const minPop=km<15?0:km<40?800:km<90?4000:km<200?20000:80000; let n=0; const used=[];
      for(const p of PLACES){ if(p.pop<minPop&&!(km<15))continue; if(p.lat>v.n||p.lat<v.s||p.lon<v.w||p.lon>v.e)continue;
        const[x,y]=proj(p.lat,p.lon); if(used.some(([a,b])=>Math.abs(a-x)<90&&Math.abs(b-y)<18))continue; used.push([x,y]);
        out.push(`<text class="pl${p.pop>50000?' big':''}" x="${x}" y="${y}" text-anchor="middle">${esc(p.n)}</text>`); if(++n>=(km<15?40:28))break;}
    }
    // farmacias
    const vis=[]; for(const f of F){if(f.lat>v.n||f.lat<v.s||f.lon<v.w||f.lon>v.e)continue;vis.push(f)}
    const dense=vis.length>2500;
    const r=km<6?7:km<20?5.5:km<60?4:km<200?2.6:1.6;
    const order={nd:0,cerrada:1,abierta:2,luego:3,guardia:4};
    const items=[];
    for(const f of vis){const s=status(f);if(dense&&s.k!=='guardia'&&s.k!=='luego'&&f.i!==SEL)continue;
      if(FILT!=='todas'&&LOC){const ok=(FILT==='guardia'&&(s.k==='guardia'||s.k==='luego'))||(FILT==='abierta'&&(s.k==='abierta'||s.k==='guardia'))||(FILT==='24'&&(f.oh==='24'||f.hoy==='00:00-00:00'||f.h24));if(!ok&&f.i!==SEL)continue}
      items.push([order[s.k]+(f.i===SEL?10:0),f,s])}
    items.sort((a,b)=>a[0]-b[0]);
    const ref=LOC||{lat:cLat,lon:cLon};
    const lab=new Set(items.filter(([,f,s])=>s.k==='guardia').map(([,f])=>[f.i,(f.lat-ref.lat)**2+((f.lon-ref.lon)*Math.cos(ref.lat*Math.PI/180))**2]).sort((a,b)=>a[1]-b[1]).slice(0,km<8?10:6).map(x=>x[0]));
    for(const[,f,s]of items){const[x,y]=proj(f.lat,f.lon);const big=(s.k==='guardia'||f.i===SEL)?r+3:r;
      out.push(`<g class="ph s-${s.k}${f.i===SEL?' sel':''}" data-sel="${f.i}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big}"/>${big>=8?`<path class="cross" transform="translate(${(x-big*.5).toFixed(1)} ${(y-big*.5).toFixed(1)}) scale(${(big/24).toFixed(3)})" d="M9.2 4h5.6v5.2H20v5.6h-5.2V20H9.2v-5.2H4V9.2h5.2z"/>`:''}<title>${esc(f.label)} · ${esc(s.t)}</title></g>`);
      if((lab.has(f.i)||f.i===SEL)&&km<40)out.push(`<text class="gl" x="${(x+big+5).toFixed(1)}" y="${(y+4).toFixed(1)}">${esc(f.label.replace(/^Farmacia\s*(·\s*)?/,'').slice(0,34))}</text>`)}
    // yo
    if(LOC){const[x,y]=proj(LOC.lat,LOC.lon);out.push(`<g class="me"><circle class="h" cx="${x}" cy="${y}" r="16"/><circle class="c" cx="${x}" cy="${y}" r="7"/></g>`)}
    svg.innerHTML=out.join('');
    // escala
    const nice=[.1,.2,.5,1,2,5,10,20,50,100,200,500].find(k=>k*ppk>=60)||500;
    $('#mscale').textContent=`${nice<1?nice*1000+' m':nice+' km'} ≈ ${Math.round(nice*ppk)} px`;
    const hint=$('#mhint');
    if(dense&&LOC){hint.hidden=false;hint.textContent='Acércate para ver todas las farmacias'}else if(!LOC){hint.hidden=false;hint.textContent='Rojo claro: provincias con turno de guardia integrado'}else hint.hidden=true;
  }
  function center(lat,lon,radKm){size();inited=true;cLat=lat;cLon=lon;ppk=Math.min(W,H)/(2.3*Math.max(radKm,1));draw()}
  function focus(lat,lon){cLat=lat;cLon=lon;if(ppk<20)ppk=40;draw()}
  function zoom(k,x,y){x=x??W/2;y=y??H/2;const[la,lo]=unproj(x,y);ppk=Math.max(.25,Math.min(400,ppk*k));const[la2,lo2]=unproj(x,y);cLat+=la-la2;cLon+=lo-lo2;draw()}
  // interacción
  let drag=null,moved=false;
  box.addEventListener('pointerdown',e=>{if(e.target.closest('.mctl'))return;drag={x:e.clientX,y:e.clientY,lat:cLat,lon:cLon};moved=false;box.setPointerCapture(e.pointerId)});
  box.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4){moved=true;box.classList.add('drag')}
    if(moved){cLat=drag.lat+dy/(KM_LAT*ppk);cLon=drag.lon-dx/(KM_LAT*Math.cos(cLat*Math.PI/180)*ppk);draw()}});
  const end=e=>{if(!drag)return;box.classList.remove('drag');const wasMoved=moved;drag=null;
    if(!wasMoved){const g=document.elementFromPoint(e.clientX,e.clientY);const ph=g&&g.closest&&g.closest('.ph');if(ph)select(+ph.dataset.sel,false)}};
  box.addEventListener('pointerup',end);box.addEventListener('pointercancel',()=>{drag=null;box.classList.remove('drag')});
  $('#zin').addEventListener('click',()=>zoom(1.6));$('#zout').addEventListener('click',()=>zoom(1/1.6));
  $('#zme').addEventListener('click',()=>{if(LOC)center(LOC.lat,LOC.lon,RAD);else center(39.9,-3.4,400)});
  new ResizeObserver(()=>{size();if(W&&!inited){inited=true;if(LOC)center(LOC.lat,LOC.lon,RAD);else center(39.9,-3.4,400)}else draw()}).observe(box);
  return {draw,center,focus};
})();
// el mapa no debe tragarse el clic de las farmacias (ya lo gestiona pointerup)
$('#map').addEventListener('click',e=>{if(e.target.closest('.ph'))e.stopPropagation()},true);

// ---------- semana ----------
function renderWeek(){
  const body=$('#wbody');
  if(!LOC){body.innerHTML=`<div class="info"><b>Primero, tu ubicación</b>Elige un lugar arriba para ver las guardias de los próximos días cerca de ti.</div>`;return}
  const p=P[LOC.pv], ci=covInfo(LOC.pv);
  $('#wtitle').textContent='Guardias de esta semana cerca de '+LOC.label.split(',')[0];
  const n=nowFor({pv:LOC.pv});
  const days=[...Array(7)].map((_,k)=>{const d=new Date(n.date+'T12:00:00');d.setDate(d.getDate()+k);return d.toISOString().slice(0,10)});
  const maxKm=Math.max(RAD,25);
  const pool=[];const cosl=Math.cos(LOC.lat*Math.PI/180),dl=maxKm*1000/111320;
  for(const f of F){if(!f.g.length)continue;if(Math.abs(f.lat-LOC.lat)>dl||Math.abs(f.lon-LOC.lon)>dl/cosl)continue;const d=dist(LOC.lat,LOC.lon,f.lat,f.lon);if(d<=maxKm*1000)pool.push({f,d})}
  pool.sort((a,b)=>a.d-b.d);
  let head='';
  if(!ci.has){body.innerHTML=`<div class="info warn"><b>Sin turno integrado en ${esc(p.n)}</b>El colegio de ${esc(p.n)} publica sus guardias en su propia web. Consúltalas aquí: <a href="${esc(p.cof.u)}" target="_blank" rel="noopener">${esc(p.cof.u.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a></div>`;return}
  if(p.cov.dias<7)head=`<div class="info"><b>${esc(p.cov.s)}</b>Esta fuente solo publica el turno del día (${esc(p.cov.q.toLowerCase())}). Los demás días, en el <a href="${esc(p.cof.u)}" target="_blank" rel="noopener">turno oficial</a>.</div>`;
  else head=`<div class="info"><b>${esc(p.cov.s)}</b>Turno oficial de los próximos 7 días, farmacias a menos de ${maxKm} km.</div>`;
  const onDay=(f,day)=>f.g.find(g=>g.a.slice(0,10)===day);
  if(!days.includes(WDAY))WDAY=days[0];
  const chips=days.map((day,k)=>{const c=pool.filter(x=>onDay(x.f,day)).length;const dd=new Date(day+'T12:00:00');
    return `<button type="button" class="dchip" data-day="${day}" aria-pressed="${day===WDAY}"><span>${k===0?'Hoy':k===1?'Mañana':DOWS[(dd.getDay()+6)%7]}</span><b>${dd.getDate()} ${MES[dd.getMonth()]}</b><i>${c?c+' de guardia':'sin dato'}</i></button>`}).join('');
  const pillOf=g=>{const loc=/Localizada/i.test(g.t);const h24=/24/.test(g.t)||(g.a.slice(11)===g.b.slice(11)&&g.a.slice(0,10)!==g.b.slice(0,10));
    return `<span class="pill${loc?' loc':''}">${loc?'Localizada':h24?'24 horas':g.a.slice(11,16)+' – '+g.b.slice(11,16)}<small>${loc?'llamar por teléfono':h24?g.a.slice(11,16)+' a '+g.b.slice(11,16)+' día sig.':'presencial'}</small></span>`};
  const its=pool.map(x=>({...x,g:onDay(x.f,WDAY)})).filter(x=>x.g).sort((a,b)=>(/Localizada/i.test(a.g.t)-/Localizada/i.test(b.g.t))||a.d-b.d);
  const list=its.length?its.map(({f,d,g})=>`<div class="wrow"><div class="t"><b>${esc(f.label)}</b><span>${esc([f.street,f.city].filter(Boolean).join(', '))}${f.tel?' · '+esc(telFmt(f.tel)):''}</span></div>${pillOf(g)}<span class="km num">${fmtKm(d)}</span><span class="acts"><a class="btn guard" href="${route(f)}" target="_blank" rel="noopener">${ICON.go}Ir</a><button class="btn ghost" type="button" data-sel="${f.i}">Mapa</button></span></div>`).join('')
    :`<div class="empty"><b>Sin dato para este día</b>${p.cov.dias<7?'Esta fuente solo da el turno de hoy.':'No hay guardias a menos de '+maxKm+' km.'}</div>`;
  // matriz: farmacias × días
  const rows=pool.filter(x=>days.some(d=>onDay(x.f,d))).slice(0,10);
  const mx=rows.length&&p.cov.dias>1?`<h3 class="sub2">Quién está de guardia cada día</h3><p>Las ${rows.length} farmacias con guardia más cercanas a ti, día a día.</p>
   <div class="mleg2"><span><i style="background:var(--guard)"></i>De guardia (abierta)</span><span><i style="background:var(--loc-t);border:1px solid var(--loc)"></i>Localizada (llamar)</span><span><i style="border:1px solid var(--hair)"></i>No le toca</span></div>
   <div class="mx glass"><table><thead><tr><th style="text-align:left;padding-left:16px">Farmacia</th>${days.map((d,k)=>{const dd=new Date(d+'T12:00:00');return `<th class="${k===0?'today':''}">${k===0?'Hoy':DOWS[(dd.getDay()+6)%7].slice(0,3)} ${dd.getDate()}</th>`}).join('')}</tr></thead><tbody>${rows.map(({f,d})=>`<tr><td class="n"><b data-sel="${f.i}">${esc(f.label)}</b><span>${esc(f.city)} · ${fmtKm(d)}</span></td>${days.map(day=>{const g=onDay(f,day);if(!g)return '<td><span class="c no">—</span></td>';const loc=/Localizada/i.test(g.t);return `<td><span class="c ${loc?'l':'g'}">${loc?'Loc.':(/24/.test(g.t)?'24 h':g.a.slice(11,16))}</span></td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:'';
  body.innerHTML=head+`<div class="days">${chips}</div><div class="wlist glass">${list}</div>`+mx;
}
document.addEventListener('click',e=>{const b=e.target.closest('.dchip');if(!b)return;WDAY=b.dataset.day;renderWeek()});
// ---------- colegios ----------
function renderCofs(){
  $('#mFarm').innerHTML=`${nf.format(F.length)} farmacias. Directorio oficial en la Comunidad de Madrid (${nf.format(F.filter(f=>f.src===1).length)}: COF Madrid, con titulares del registro de la Comunidad de Madrid), Cádiz (${nf.format(F.filter(f=>f.src===2).length)}), Sevilla (${nf.format(F.filter(f=>f.src===4).length)}) y Zaragoza capital (${nf.format(F.filter(f=>f.src===3).length)}). El resto sale de OpenStreetMap (extracto del ${esc(FARM.meta.osmDate.split('-').reverse().join('/'))}): puede tener nombres antiguos o farmacias ya cerradas, y faltan algunas de las unas 22.000 que hay en España.`;
  $('#mGuard').innerHTML=`Integradas: Cádiz (hasta el 31 de diciembre), Sevilla y las cinco provincias de Castilla-La Mancha (7 días), Comunidad de Madrid y Zaragoza capital (hoy), sacadas de sus fuentes oficiales el ${esc(FARM.meta.built.slice(8,10)+'/'+FARM.meta.built.slice(5,7)+' a las '+FARM.meta.built.slice(11))}. Para el resto, enlace al turno oficial.`;
  const ord=P.map((p,i)=>i).sort((a,b)=>(!!P[b].cov-!!P[a].cov)||P[a].n.localeCompare(P[b].n,'es'));
  $('#cofs').innerHTML=ord.map(i=>{const p=P[i];return `<div class="cof glass"><h3>${esc(p.n)}<span class="tag ${p.cov?'on':'off'}">${p.cov?'Integrado':'Solo enlace'}</span></h3><p>${p.cov?esc(p.cov.q)+' · '+esc(p.cov.s):nf.format(p.c)+' farmacias en el directorio'}</p><a href="${esc(p.cof.u)}" target="_blank" rel="noopener">${esc(p.cof.u.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''))}</a></div>`}).join('');
}

// ---------- cabecera ----------
function renderKpis(){
  const gNow=F.filter(f=>status(f).k==='guardia').length;
  $('#kpis').innerHTML=`<div class="kpi glass"><b class="num">${nf.format(F.length)}</b><span>farmacias</span></div><div class="kpi glass g"><b class="num">${nf.format(gNow)}</b><span>de guardia ahora*</span></div><div class="kpi glass"><b class="num">${P.filter(p=>p.cov).length}/52</b><span>turnos integrados</span></div>`;
  $('#foot').innerHTML=`* Solo donde hay turno integrado. Datos: colegios de farmacéuticos de Madrid, Cádiz, Sevilla y Castilla-La Mancha, Comunidad de Madrid, Ayuntamiento de Zaragoza, OpenStreetMap (© colaboradores de OSM, ODbL) y GeoNames. Actualizado el ${esc(FARM.meta.built.slice(8,10)+'/'+FARM.meta.built.slice(5,7)+'/'+FARM.meta.built.slice(0,4)+' '+FARM.meta.built.slice(11))}. Ante una urgencia, llama al 112.${FARM.meta.fallos&&FARM.meta.fallos.length?` <b>Aviso:</b> hoy no se ha podido actualizar alguna fuente (${esc(FARM.meta.fallos.join(', '))}); se muestran los últimos datos válidos.`:''}<nav class="legal"><a href="legal.html#aviso-legal">Aviso legal</a><a href="legal.html#privacidad">Privacidad</a><a href="legal.html#cookies">Cookies</a><a href="legal.html#terminos">Términos de uso</a><a href="legal.html#fuentes">Fuentes y licencias</a></nav><div class="by esc"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="a" d="M3 7c3 0 3 3 6 3s3-3 6-3 3 3 6 3" fill="none" stroke-width="2.4" stroke-linecap="round"/><path class="b" d="M3 14c3 0 3 3 6 3s3-3 6-3 3 3 6 3" fill="none" stroke-width="2.4" stroke-linecap="round"/></svg><span>Un proyecto de <b>esclusa</b></span></div>`;
}

function update(redraw){tick();compute();renderBest();renderList();renderCard();renderQuick();if(VIEW==='semana')renderWeek();if(redraw!==false)MAP.draw()}

// ---------- vistas ----------
function route_(){
  const h=(location.hash||'#cerca').slice(1); VIEW=['cerca','semana','colegios'].includes(h)?h:'cerca';
  ['cerca','semana','colegios'].forEach(v=>$('#v-'+v).hidden=v!==VIEW);
  document.querySelectorAll('.tabs a').forEach(a=>{const on=a.getAttribute('href')==='#'+VIEW;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  const showTool=VIEW!=='colegios'; $('#tool').hidden=!showTool; $('#quick').hidden=!showTool;
  if(VIEW==='semana')renderWeek(); if(VIEW==='colegios')renderCofs(); if(VIEW==='cerca')MAP.draw();
}
addEventListener('hashchange',route_);

// tema
const root=document.documentElement; const th=LS.get('theme'); if(th)root.dataset.theme=th;
$('#theme').addEventListener('click',()=>{const dark=root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;root.dataset.theme=dark?'light':'dark';LS.set('theme',root.dataset.theme)});
// fondo topográfico
(function(){let d='';for(let k=0;k<14;k++){const y=80+k*64;d+=`<path d="M-20 ${y} C 300 ${y-40-k*3} 520 ${y+50} 820 ${y} S 1300 ${y-60} 1620 ${y+10}"/>`}$('#bgTopo').innerHTML=d})();

renderKpis();
if(LOC)q.value=LOC.label;
route_(); update();
setInterval(()=>{update(VIEW==='cerca');renderKpis()},60000);
})();
