# Construye los datos de "Turno" (farmacias de guardia) a partir de las fuentes descargadas en /home/claude/raw
import json, glob, zipfile, re, io, os, math, unicodedata, datetime as dt
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
STATIC = os.path.join(HERE, 'static')
OUT = os.path.join(HERE, '..', 'site')
from zoneinfo import ZoneInfo
NOW = dt.datetime.now(ZoneInfo('Europe/Madrid'))
TODAY = NOW.date()
def load(path, default):
    try: return json.load(open(path))
    except Exception as e:
        print('AVISO: no se pudo leer', os.path.basename(path), e); return default
def recent(paths):  # solo ficheros de ayer en adelante
    lim = (TODAY - dt.timedelta(days=1)).isoformat()
    return [p for p in sorted(paths) if os.path.basename(p)[:10] >= lim]
os.makedirs(OUT, exist_ok=True)

def norm(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def hav(a, b, c, d):
    R = 6371000; p1, p2 = math.radians(a), math.radians(c)
    dp, dl = p2 - p1, math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

# ---------- provincias ----------
pg = json.load(open(f'{STATIC}/prov.geojson'))
PROV = []
geoms = []
for f in pg['features']:
    p = f['properties']
    PROV.append({'cod': p['cod_prov'], 'n': p['name']})
    geoms.append(shape(f['geometry']).buffer(0))
order = sorted(range(len(PROV)), key=lambda i: PROV[i]['cod'])
PROV = [PROV[i] for i in order]; geoms = [geoms[i] for i in order]
tree = STRtree(geoms)
NICE = {'01':'Álava','02':'Albacete','03':'Alicante','04':'Almería','05':'Ávila','06':'Badajoz','07':'Illes Balears','08':'Barcelona','09':'Burgos','10':'Cáceres','11':'Cádiz','12':'Castellón','13':'Ciudad Real','14':'Córdoba','15':'A Coruña','16':'Cuenca','17':'Girona','18':'Granada','19':'Guadalajara','20':'Gipuzkoa','21':'Huelva','22':'Huesca','23':'Jaén','24':'León','25':'Lleida','26':'La Rioja','27':'Lugo','28':'Madrid','29':'Málaga','30':'Murcia','31':'Navarra','32':'Ourense','33':'Asturias','34':'Palencia','35':'Las Palmas','36':'Pontevedra','37':'Salamanca','38':'Santa Cruz de Tenerife','39':'Cantabria','40':'Segovia','41':'Sevilla','42':'Soria','43':'Tarragona','44':'Teruel','45':'Toledo','46':'Valencia','47':'Valladolid','48':'Bizkaia','49':'Zamora','50':'Zaragoza','51':'Ceuta','52':'Melilla'}
for p in PROV: p['n'] = NICE.get(p['cod'], p['n'])
cod2i = {p['cod']: i for i, p in enumerate(PROV)}

def prov_of(lat, lon):
    pt = Point(lon, lat)
    for gi in tree.query(pt):
        if geoms[gi].contains(pt): return int(gi)
    # punto en costa: provincia más cercana a <3 km
    best, bd = -1, 1e9
    for gi in tree.query(pt.buffer(0.03)):
        d = geoms[gi].distance(pt)
        if d < bd: best, bd = int(gi), d
    return best

# ---------- horarios OSM ----------
DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
def parse_oh(s):
    """Devuelve (semana, exacto). semana = 7 listas [ini,fin] en minutos (fin puede pasar de 1440)."""
    if not s: return None, False
    s = s.strip()
    if s in ('24/7', 'Mo-Su 00:00-24:00', '00:00-24:00'): return '24', True
    week = [[] for _ in range(7)]; exact = True; any_ok = False
    rules = [r.strip() for r in re.split(r';|\|\|', s) if r.strip()]
    for r in rules:
        if re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|easter|SH)\b', r):
            exact = False; continue
        if r.startswith('PH'): continue
        m = re.match(r'^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?\s*,?\s*)+)?\s*(.*)$', r)
        dspec, tspec = (m.group(1) or '').strip(' ,'), m.group(2).strip()
        tspec = re.sub(r'\bPH\b\s*(off)?', '', tspec).strip(' ,')
        days = set()
        if not dspec: days = set(range(7))
        else:
            for part in re.split(r'\s*,\s*', dspec):
                if not part: continue
                if '-' in part:
                    a, b = part.split('-'); ia, ib = DAYS.index(a), DAYS.index(b)
                    k = ia
                    while True:
                        days.add(k)
                        if k == ib: break
                        k = (k + 1) % 7
                else: days.add(DAYS.index(part))
        if tspec in ('off', 'closed'):
            for d in days: week[d] = []
            any_ok = True; continue
        if tspec in ('24/7', '00:00-24:00'):
            for d in days: week[d] = [[0, 1440]]
            any_ok = True; continue
        spans = re.findall(r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})', tspec)
        if not spans: exact = False; continue
        sl = []
        for a, b, c, d in spans:
            st = int(a) * 60 + int(b); en = int(c) * 60 + int(d)
            if en <= st: en += 1440
            sl.append([st, en])
        for d in days: week[d] = sl
        any_ok = True
    if not any_ok: return None, False
    if all(w == [[0, 1440]] for w in week): return '24', exact
    return week, exact

def oh_compact(w):
    if w is None: return ''
    if w == '24': return '24'
    return '|'.join(','.join(f'{a}-{b}' for a, b in d) for d in w)

# ---------- farmacias base: OpenStreetMap congelado (se refresca aparte) ----------
ph = json.load(open(f'{STATIC}/osm_farmacias.json'))
print('farmacias OSM:', len(ph))

# índice espacial simple por rejilla para emparejar
def grid_index(items):
    g = {}
    for i, f in enumerate(items):
        g.setdefault((round(f['lat'] * 200), round(f['lon'] * 200)), []).append(i)
    return g
def nearest(items, g, lat, lon, maxd):
    k0, k1 = round(lat * 200), round(lon * 200); best, bd = -1, maxd
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            for i in g.get((k0 + a, k1 + b), []):
                d = hav(lat, lon, items[i]['lat'], items[i]['lon'])
                if d < bd: best, bd = i, d
    return best

def tcase(s):
    s = re.sub(r'\s+', ' ', s or '').strip()
    if s.isupper() or s.islower():
        s = ' '.join(w if w in ('de', 'del', 'la', 'las', 'los', 'y') else w.capitalize() for w in s.lower().split(' '))
    return s

# ---------- Madrid (COFM): directorio oficial completo + guardia de hoy ----------
cofm = load(f'{RAW}/cofm_f.json', [])
mad = cod2i['28']
osm_mad = [f for f in ph if f['pv'] == mad]
gm = grid_index(osm_mad)
newmad = []; used = set()
CAMN = {}
try:
    for r in load(f'{RAW}/cam_of.json', {'data': []})['data']:
        CAMN[str(r['FARMACIA_NRO_SOE']).strip()] = r
except Exception as e: print('sin registro CAM', e)
def nice_titular(s):
    s = re.sub(r'\s+', ' ', s or '').strip(' ,')
    return ' '.join(w if w.lower() in ('de', 'del', 'la', 'las', 'los', 'y', 'e', 'cb', 'c.b.', 'sl', 's.l.') and i else w.capitalize() for i, w in enumerate(s.lower().split(' '))).replace(' ,', ',').replace('Cb', 'CB').replace('C.b.', 'C.B.')
for x in cofm:
    lat, lon = float(x['latitud']), float(x['longitud'])
    j = nearest(osm_mad, gm, lat, lon, 45)
    name = ''  # el COFM no publica el nombre; no usamos el de OSM porque puede estar desfasado
    if j >= 0 and j not in used: used.add(j)
    o = osm_mad[j] if j >= 0 else {}
    cr = CAMN.get(str(x['identificador']))
    if cr:  # solo si la calle del registro coincide con la del colegio (evita titulares de una dirección antigua)
        ws = [w for w in norm(cr.get('DIRECCION_VIAL_NOMBRE')).split() if len(w) > 3 and w not in ('calle', 'avenida', 'plaza')]
        if ws and not any(w in norm(x['direccion']) for w in ws): cr = None
    if cr and cr.get('TITULARES_NOMBRE'):
        name = 'Farmacia ' + nice_titular(cr['TITULARES_NOMBRE'])
    newmad.append({'osm': o.get('osm', ''), 'lat': lat, 'lon': lon, 'name': name,
                   'street': tcase(re.sub(r'\s*,\s*', ', ', x['direccion'])), 'city': tcase(x['poblacion']), 'cp': x.get('codigoPostal', ''),
                   'tel': x.get('telefono', ''), 'oh': o.get('oh', ''), 'src': 'cofm', 'pv': mad,
                   'hoy': x.get('horarioHoy', ''), 'h24': bool(x.get('servicio24h')), 'g': x.get('horarioGuardia', ''), 'gd': x.get('horarioGuardiaDesc', '')})
ph = ([f for f in ph if f['pv'] != mad] + newmad) if newmad else ph
print('Madrid COFM:', len(newmad), 'con nombre OSM:', len(used))

# ---------- Cádiz: directorio oficial completo del COF (con horarios) ----------
def cad_week(horarios):
    h = [x for x in horarios if x['inicio'] <= TODAY.isoformat() <= x['fin']] or horarios[:1]
    if not h: return '', 0
    wk = [[] for _ in range(7)]
    m = lambda s: int(s[:2]) * 60 + int(s[3:5])
    for tr in h[0]['tramos']:
        days = {'LV': range(0, 5), 'S': [5], 'D': [6], 'LS': range(0, 6), 'LD': range(0, 7)}.get(tr['codigo'])
        if days is None: continue
        spans = []
        parts = [tr['mannana'], tr['tarde']] if tr['tipo'] == 'MT' else [tr.get('continuo')]
        for pp in parts:
            if not pp or not pp.get('inicio') or not pp.get('fin'): continue
            a, b = m(pp['inicio']), m(pp['fin'])
            if b <= a: b += 1440
            if pp['fin'].startswith('23:59'): b = 1440
            spans.append([a, b])
        for d in days: wk[d] = spans
    if all(w == [[0, 1440]] for w in wk): return '24', 1
    return '|'.join(','.join(f'{a}-{b}' for a, b in d) for d in wk), 1
cad = load(f'{RAW}/cad_dir.json', {'informacion': []})['informacion']
cpv = cod2i['11']
ph = [f for f in ph if f['pv'] != cpv] if cad else ph
SOE = {}
for x in cad:
    c = x['contactos_profesionales'][0]
    try: lat, lon = json.loads(c['coordenadas'].replace(' ', ''))
    except Exception: continue
    oh, ex = cad_week(x.get('horarios') or [])
    ph.append({'osm': '', 'lat': lat, 'lon': lon, 'name': 'Farmacia ' + x['nombre'], 'street': c['direccion'],
               'city': c.get('localidad') or c['municipio'], 'cp': c.get('codigo_postal') or '', 'tel': c.get('telefono') or '',
               'oh': '', 'ohc': oh, 'ohx': ex, 'src': 'cofcadiz', 'pv': cpv, 'soe': x['soe']})
    SOE[x['soe']] = len(ph) - 1
print('Cádiz oficial:', len(SOE))

# ---------- Sevilla: directorio oficial del COF (con horario de hoy) ----------
spv = cod2i['41']
_sev = sorted(p for p in glob.glob(f'{RAW}/sev/*.json') if os.path.basename(p)[:10] <= TODAY.isoformat())
sev0 = json.load(open(_sev[-1]))['data']['data']['informacion'] if _sev else []
ph = [f for f in ph if f['pv'] != spv] if sev0 else ph
for g in sev0:
    for c in g['contenido']:
        if not c.get('coordenadas'): continue
        lat, lon = c['coordenadas']
        hs = [f"{c[a]}-{c[b]}" for a, b in (('hora_inicio_m', 'hora_fin_m'), ('hora_inicio_t', 'hora_fin_t')) if c.get(a) and c.get(b)]
        ph.append({'osm': '', 'lat': lat, 'lon': lon, 'name': 'Farmacia ' + c['nombre'], 'street': c.get('direccion') or '', 'city': c.get('municipio') or '',
                   'cp': c.get('codigo_postal') or '', 'tel': c.get('telefono') or '', 'oh': '', 'src': 'cofsevilla', 'pv': spv, 'hoy': ','.join(hs), 'uuid': c['uuid']})
print('Sevilla oficial:', sum(1 for f in ph if f.get('src') == 'cofsevilla'))

# ---------- Zaragoza capital: directorio oficial (Ayuntamiento, fuente COF) ----------
def zgz_hours(s):
    s = re.sub(r'<[^>]+>', ' ', s or '').lower()
    if '24 horas' in s: return '24'
    m = re.search(r'lunes a (s[aá]bado|domingo)[^0-9]*?(\d{1,2})[:.](\d\d)\s*a\s*(\d{1,2})[:.](\d\d)(?:\s*h)?(?:\s*y\s*(\d{1,2})[:.](\d\d)\s*a\s*(\d{1,2})[:.](\d\d))?', s)
    if not m: return ''
    nd = 7 if m.group(1).startswith('d') else 6
    sp = [[int(m.group(2)) * 60 + int(m.group(3)), int(m.group(4)) * 60 + int(m.group(5))]]
    if m.group(6): sp.append([int(m.group(6)) * 60 + int(m.group(7)), int(m.group(8)) * 60 + int(m.group(9))])
    return '|'.join(','.join(f'{a}-{b}' for a, b in sp) if d < nd else '' for d in range(7))
zall = load(f'{RAW}/zgz_all.json', {'result': []})['result']
zpv = cod2i['50']; ZC = (41.6488, -0.8891)
zoff = []
for x in zall:
    if 'geometry' not in x: continue
    lon, lat = x['geometry']['coordinates']
    zoff.append({'osm': '', 'lat': lat, 'lon': lon, 'name': x['title'], 'street': x.get('calle', ''), 'city': 'Zaragoza', 'cp': '',
                 'tel': (x.get('telefonos') or '').split(' ')[0], 'oh': '', 'ohc': zgz_hours(x.get('horario')), 'ohx': 1, 'src': 'zaragoza', 'pv': zpv, 'zid': x['id']})
ph = ([f for f in ph if not (f['pv'] == zpv and hav(f['lat'], f['lon'], *ZC) < 9000)] + zoff) if zoff else ph
ZID = {f['zid']: i for i, f in enumerate(ph) if f.get('zid')}
SOE = {f['soe']: i for i, f in enumerate(ph) if f.get('soe')}
SUU = {f['uuid']: i for i, f in enumerate(ph) if f.get('uuid')}
print('Zaragoza oficial:', len(zoff))

# ---------- guardias ----------
G = []  # (idx farmacia, inicio 'YYYY-MM-DDTHH:MM', fin, tipo, zona, fuente)
def add_or_match(lat, lon, rec, maxd=70):
    global gidx
    j = nearest(ph, gidx, lat, lon, maxd)
    if j >= 0:
        f = ph[j]
        for k in ('street', 'city', 'cp', 'tel'):
            if rec.get(k): f[k] = rec[k]   # el dato del colegio manda
        if rec.get('pv') is not None: f['pv'] = rec['pv']
        if rec.get('name') and not f['name']: f['name'] = rec['name']
        if rec.get('titular'): f['titular'] = rec['titular']
        return j
    rec.update({'lat': lat, 'lon': lon, 'pv': rec.get('pv') if rec.get('pv') is not None else prov_of(lat, lon), 'osm': '', 'oh': rec.get('oh', '')})
    ph.append(rec); gidx.setdefault((round(lat * 200), round(lon * 200)), []).append(len(ph) - 1)
    return len(ph) - 1
gidx = grid_index(ph)

# Madrid
for i, f in enumerate(ph):
    if f.get('src') == 'cofm' and f.get('g'):
        m = re.match(r'(\d{4}-\d\d-\d\d) (\d\d:\d\d)-(\d{4}-\d\d-\d\d) (\d\d:\d\d)', f['g'])
        if m:
            tipo = '24 h' if f.get('h24') or (m.group(2) == m.group(4) and m.group(1) != m.group(3)) else 'Guardia'
            G.append([i, f'{m.group(1)}T{m.group(2)}', f'{m.group(3)}T{m.group(4)}', f.get('gd') or tipo, tcase(f['city']), 'cofm'])

# Cádiz (semana completa)
for fn in recent(glob.glob(f'{RAW}/cad/*.json')):
    d = json.load(open(fn))
    for x in d['informacion']:
        cp = x['contactos_profesionales'][0]
        try: lat, lon = json.loads(cp['coordenadas'].replace(' ', ''))
        except Exception: continue
        i = SOE.get(x['soe'])
        if i is None:
            rec = {'name': 'Farmacia ' + x['nombre'], 'street': cp['direccion'], 'city': cp.get('localidad') or cp['municipio'], 'cp': cp.get('codigo_postal', ''), 'tel': cp.get('telefono', ''), 'src': 'cofcadiz', 'pv': cod2i['11']}
            ph.append(dict(rec, lat=lat, lon=lon, osm='', oh='')); i = len(ph) - 1; SOE[x['soe']] = i
        day = dt.date.fromisoformat(x['fecha'])
        for h in x['horarios']:
            a, b = h['hora_apertura'][:5], h['hora_cierre'][:5]
            d2 = day + dt.timedelta(days=1) if (h.get('cierre_dia_siguiente') or b <= a) else day
            G.append([i, f'{day}T{a}', f'{d2}T{b}', h['tipo'], tcase(x['zona_guardia']), 'cofcadiz'])

# Zaragoza ciudad (hoy)
z = load(f'{RAW}/zgz.json', {})
for x in z.get('result', []):
    lon, lat = x['geometry']['coordinates']
    i = ZID.get(x['id'])
    if i is None:
        rec = {'name': x['title'], 'street': x.get('calle', ''), 'city': 'Zaragoza', 'tel': x.get('telefonos', ''), 'src': 'zaragoza', 'pv': cod2i['50']}
        i = add_or_match(lat, lon, rec)
    g = x['guardia']; day = dt.date.fromisoformat(g['fecha'][:10])
    hs = re.findall(r'(\d{1,2})[:.](\d{2})', g['horario'])
    if len(hs) >= 2:
        a = f'{int(hs[0][0]):02d}:{hs[0][1]}'; b = f'{int(hs[1][0]):02d}:{hs[1][1]}'
        d2 = day + dt.timedelta(days=1) if ('siguiente' in g['horario'] or b <= a) else day
        G.append([i, f'{day}T{a}', f'{d2}T{b}', g['horario'], g.get('sector', 'Zaragoza'), 'zaragoza'])
# Sevilla (8 días)
seen = set()
for fn in recent(glob.glob(f'{RAW}/sev/*.json')):
    for g in json.load(open(fn))['data']['data']['informacion']:
        for c in g['contenido']:
            i = SUU.get(c['uuid'])
            if i is None: continue
            for gu in c.get('guardias') or []:
                a = gu['guardia_horario_fecha_inicio'][:16].replace(' ', 'T'); b = gu['guardia_horario_fecha_fin'][:16].replace(' ', 'T')
                if (i, a) in seen: continue
                seen.add((i, a))
                tipo = 'Atención Permanente (Localizada)' if gu.get('tipo_guardia') == 'localizada' else ('24 h' if b[11:] == a[11:] and b[:10] != a[:10] else 'Guardia presencial')
                G.append([i, a, b, tipo, c.get('municipio') or '', 'cofsevilla'])
# Castilla-La Mancha (8 días; sin directorio: se cruza con OSM y manda el nombre oficial)
CLMP = {'Albacete': '02', 'Ciudad Real': '13', 'Cuenca': '16', 'Guadalajara': '19', 'Toledo': '45'}
gidx = grid_index(ph); seen = set(); CLMI = {}
for fn in recent(glob.glob(f'{RAW}/clm/*.json')):
    day = dt.date.fromisoformat(os.path.basename(fn)[:10])
    for x in json.load(open(fn))['data']:
        try: lat, lon = float(x['lat']), float(x['lng'])
        except Exception: continue
        key = x['numero_farmacia']
        if key not in CLMI:
            rec = {'name': 'Farmacia ' + nice_titular(x['nombre']), 'street': tcase(x.get('domicilio') or ''), 'city': tcase(x.get('localidad') or ''),
                   'tel': x.get('telefono') or '', 'src': 'cofclm', 'pv': cod2i[CLMP.get(x.get('provincia'), '45')]}
            j = nearest(ph, gidx, lat, lon, 70)
            if j >= 0:
                ph[j].update({k: v for k, v in rec.items() if v}); ph[j]['src'] = 'cofclm'; CLMI[key] = j
            else:
                ph.append(dict(rec, lat=lat, lon=lon, osm='', oh='')); CLMI[key] = len(ph) - 1
        i = CLMI[key]
        a, b = x['hora_inicio'][:5], x['hora_fin'][:5]
        d2 = day + dt.timedelta(days=1) if b <= a else day
        A, B = f'{day}T{a}', f'{d2}T{b}'
        if (i, A) in seen: continue
        seen.add((i, A))
        G.append([i, A, B, 'Atención Permanente (Localizada)' if x.get('guardia_localizada') else ('24 h' if a == b else 'Guardia presencial'), tcase(x.get('zona') or ''), 'cofclm'])
print('tramos de guardia:', len(G))

# ---------- salida farmacias ----------
SRC = {'osm': 0, 'cofm': 1, 'cofcadiz': 2, 'zaragoza': 3, 'cofsevilla': 4, 'cofclm': 5}
rows = []; ohstats = [0, 0, 0]
for f in ph:
    w, exact = parse_oh(f.get('oh'))
    if f.get('ohc') is not None and f.get('src') in ('cofcadiz', 'zaragoza'):
        w = None; exact = bool(f.get('ohx'))
    if f.get('src') == 'cofm' and f.get('hoy'):
        # horario oficial de hoy del COFM (más fiable que OSM para hoy)
        pass
    oc = f['ohc'] if (f.get('ohc') is not None and f.get('src') in ('cofcadiz', 'zaragoza')) else oh_compact(w)
    if not oc: exact = False
    ohstats[0 if not oc else (1 if exact else 2)] += 1
    name = f['name'] or ''
    if f.get('titular') and not name: name = 'Farmacia ' + f['titular']
    rows.append([round(f['lat'], 5), round(f['lon'], 5), name, f.get('street', ''), tcase(f.get('city', '')), f['pv'], f.get('cp', ''),
                 re.sub(r'[^\d+]', '', f.get('tel', ''))[:14], oc, 1 if exact else 0, SRC.get(f.get('src'), 0),
                 f.get('hoy', '') if f.get('src') in ('cofm', 'cofsevilla') else '', 1 if f.get('h24') else 0, f.get('osm', '')])
print('farmacias totales:', len(rows), 'horario: sin/exacto/aprox', ohstats)

# ---------- colegios ----------
links = json.load(open(f'{STATIC}/cof_links.json'))
SLUG = {'araba-alava':'01','albacete':'02','alicante':'03','almeria':'04','avila':'05','badajoz':'06','baleares':'07','barcelona':'08','burgos':'09','caceres':'10','cadiz':'11','castellon':'12','ciudad-real':'13','cordoba':'14','a-coruna':'15','cuenca':'16','girona':'17','granada':'18','guadalajara':'19','gipuzkoa':'20','huelva':'21','huesca':'22','jaen':'23','leon':'24','lleida':'25','la-rioja':'26','lugo':'27','madrid':'28','malaga':'29','murcia':'30','navarra':'31','ourense':'32','asturias':'33','palencia':'34','las-palmas':'35','pontevedra':'36','salamanca':'37','tenerife':'38','cantabria':'39','segovia':'40','sevilla':'41','soria':'42','tarragona':'43','teruel':'44','toledo':'45','valencia':'46','valladolid':'47','bizkaia':'48','zamora':'49','zaragoza':'50','ceuta':'51','melilla':'52'}
SOC = ('gmpg', 'unpkg', 'cismed', 'twitter', 'instagram', 'facebook', 'youtube', 'linkedin', 't.me', 'tiktok')
cof = [None] * len(PROV)
for slug, ls in links.items():
    cod = SLUG[slug]
    ext = [l for l in ls if not any(s in l for s in SOC)] if isinstance(ls, list) else []
    url = ext[0].replace('%20', '') if ext else f'https://www.farmaceuticos.com/farmacias-de-guardia/{slug}/'
    cof[cod2i[cod]] = {'u': url, 'direct': bool(ext)}
COVER = {cod2i['28']: {'s': 'Colegio Oficial de Farmacéuticos de Madrid', 'q': 'Toda la Comunidad · solo hoy', 'dias': 1},
         cod2i['11']: {'s': 'Colegio Oficial de Farmacéuticos de Cádiz', 'q': 'Toda la provincia · 7 días', 'dias': 7},
         cod2i['50']: {'s': 'Ayuntamiento de Zaragoza (datos abiertos, fuente COF Zaragoza)', 'q': 'Solo Zaragoza capital · solo hoy', 'dias': 1},
         cod2i['41']: {'s': 'Colegio Oficial de Farmacéuticos de Sevilla', 'q': 'Toda la provincia · 7 días', 'dias': 7}}
for c in ('02', '13', '16', '19', '45'):
    COVER[cod2i[c]] = {'s': 'Colegios de Farmacéuticos de Castilla-La Mancha (farmaciasdeguardia.cofcam.es)', 'q': 'Guardias de toda la provincia · 7 días', 'dias': 7}

try: estado = json.load(open(f'{RAW}/estado.json'))
except Exception: estado = {}
meta = {'built': NOW.strftime('%Y-%m-%dT%H:%M'), 'osmDate': '2026-10-11', 'fallos': sorted((estado.get('error') or {}).keys())}
counts = [0] * len(PROV)
for r in rows: counts[r[5]] += 1
provs = [{'cod': p['cod'], 'n': p['n'], 'c': counts[i], 'cof': cof[i], 'cov': COVER.get(i)} for i, p in enumerate(PROV)]

def w(name, var, obj):
    with open(f'{OUT}/{name}', 'w', encoding='utf8') as fh:
        fh.write(f'window.{var}=' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(name, os.path.getsize(f'{OUT}/{name}') // 1024, 'KB')
w('farmacias.js', 'FARM', {'meta': meta, 'prov': provs, 'f': rows, 'g': G})
