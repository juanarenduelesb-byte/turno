"""Descarga diaria de las fuentes oficiales de Turno.

Cada fuente se descarga por separado: si una falla, las demás siguen y el
build usa la última copia buena de la que ha fallado (queda en raw/).
Uso: python pipeline/fetch.py
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
UA = {'User-Agent': 'Mozilla/5.0 (compatible; TurnoBot/1.0; +https://github.com/)'}
TODAY = dt.datetime.now(ZoneInfo('Europe/Madrid')).date()
DAYS = 8
sys.path.insert(0, HERE)


def get(url, data=None, timeout=90):
    req = urllib.request.Request(url, data=data, headers=UA)
    for intento in range(3):
        try:
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as e:
            if intento == 2:
                raise
            time.sleep(5 * (intento + 1))


def save(rel, content):
    path = os.path.join(RAW, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as fh:
        fh.write(content if isinstance(content, bytes) else json.dumps(content, ensure_ascii=False).encode())
    os.replace(tmp, path)


def check_json(b, key=None, minimo=1):
    d = json.loads(b)
    n = len(d[key] if key else d)
    if n < minimo:
        raise ValueError(f'respuesta con {n} elementos (mínimo {minimo})')
    return d


def madrid():
    b = get('https://www.cofm.es/rest/farmacias/es?direccion=')
    check_json(b, minimo=2000)
    save('cofm_f.json', b)


def madrid_registro():
    b = get('https://datos.comunidad.madrid/dataset/2d682b1d-e2e8-4c6f-b902-7a3f108e2fb9/resource/6f1a2274-740c-47b5-a06d-2ab6ffb30685/download/oficinas_farmacia.json')
    check_json(b, 'data', 2000)
    save('cam_of.json', b)


CADIZ_G = ('https://www.cofcadiz.es/wp-json/vcomm/v1/farmacias/guardia?estilo=completo&servicios=&tipo=&orden=soe+DESC,hora_entrada+ASC'
           '&uuid=62482d53-19e0-47fb-b783-239184d4d72a&limit=999')
CADIZ_D = ('https://www.cofcadiz.es/wp-json/vcomm/v1/farmacias?estilo=completo&servicios=&tipo=&orden=primary_name+ASC'
           '&uuid=62a8021b-0749-4434-af0a-ee14effe25b7&limit=2000')


def cadiz():
    b = get(CADIZ_D)
    check_json(b, 'informacion', 400)
    save('cad_dir.json', b)
    for k in range(DAYS):
        d = TODAY + dt.timedelta(days=k)
        b = get(CADIZ_G + '&fecha=' + d.isoformat())
        check_json(b, 'informacion', 10)
        save(f'cad/{d}.json', b)
        time.sleep(1)


def zaragoza():
    b = get('https://www.zaragoza.es/sede/servicio/farmacia.json?tipo=todas&rows=500')
    check_json(b, 'result', 200)
    save('zgz_all.json', b)
    b = get('https://www.zaragoza.es/sede/servicio/farmacia.json?tipo=guardia&rows=100')
    check_json(b, 'result', 1)
    save('zgz.json', b)


def sevilla():
    from vbf import VBF
    v = VBF('https://www.farmaceuticosdesevilla.es/buscador-de-farmacias/')
    base = dict(vbf_req_endpoint='/farmacias-abiertas', vbf_req_solo_guardias='false', vbf_req_lang='es_ES')
    for k in range(DAYS):
        d = TODAY + dt.timedelta(days=k)
        kw = dict(base, vbf_req_aplica_filtro_fecha='false') if k == 0 else dict(base, vbf_req_fecha=d.isoformat(), vbf_req_aplica_filtro_fecha='true')
        r = v.call(**kw)
        inf = r['data']['data']['informacion']
        n = sum(len(g['contenido']) for g in inf)
        ng = sum(1 for g in inf for c in g['contenido'] if c.get('guardias'))
        if (k == 0 and n < 500) or ng < 20:
            raise ValueError(f'Sevilla {d}: {n} farmacias, {ng} con guardia')
        save(f'sev/{d}.json', r)
        time.sleep(1)


def castilla_la_mancha():
    for k in range(DAYS):
        d = TODAY + dt.timedelta(days=k)
        b = get(f'https://farmaciasdeguardia.cofcam.es/api.php?action=list&fecha={d}')
        check_json(b, 'data', 50)
        save(f'clm/{d}.json', b)
        time.sleep(1)


FUENTES = [madrid, madrid_registro, cadiz, zaragoza, sevilla, castilla_la_mancha]

def podar():
    """Borra descargas diarias de hace más de 2 días."""
    lim = (TODAY - dt.timedelta(days=2)).isoformat()
    for sub in ('cad', 'sev', 'clm'):
        d = os.path.join(RAW, sub)
        for fn in (os.listdir(d) if os.path.isdir(d) else []):
            if fn[:10] < lim:
                os.remove(os.path.join(d, fn))


if __name__ == '__main__':
    podar()
    estado = {'fecha': TODAY.isoformat(), 'ok': [], 'error': {}}
    for f in FUENTES:
        try:
            f()
            estado['ok'].append(f.__name__)
            print('OK   ', f.__name__)
        except Exception as e:
            estado['error'][f.__name__] = str(e)[:300]
            print('ERROR', f.__name__, e)
    save('estado.json', estado)
    # falla el job solo si caen todas: así una fuente rota no bloquea al resto
    sys.exit(0 if estado['ok'] else 1)
