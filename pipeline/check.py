"""Comprobaciones antes de publicar: si algo no cuadra, el job falla y Cloudflare sigue sirviendo la versión anterior."""
import json, os, sys
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'farmacias.js')
t = open(p, encoding='utf8').read()
d = json.loads(t[t.index('=') + 1:].rstrip(';\n'))
n, g = len(d['f']), len(d['g'])
errores = []
if n < 15000: errores.append(f'solo {n} farmacias')
if g < 500: errores.append(f'solo {g} tramos de guardia')
if any(not (26 < r[0] < 44.5 and -19 < r[1] < 5) for r in d['f']): errores.append('coordenadas fuera de España')
if any(gi[0] >= n for gi in d['g']): errores.append('guardias con índice inválido')
print(f'{n} farmacias, {g} tramos de guardia, fallos de fuente: {d["meta"].get("fallos")}')
if errores:
    print('ERROR:', '; '.join(errores)); sys.exit(1)
