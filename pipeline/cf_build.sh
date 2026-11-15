#!/usr/bin/env bash
# Comando de build de Cloudflare Pages: descarga los datos del día y genera site/
set -euo pipefail
python3 -m pip install --quiet shapely==2.0.6
python3 pipeline/fetch.py || echo "Aviso: alguna fuente falló; se publica con las que han funcionado"
python3 pipeline/build.py
python3 pipeline/check.py
# guarda en la web los datos usados, para recuperarlos si una fuente falla en la próxima actualización
rm -rf site/_datos && mkdir -p site/_datos && cp -r pipeline/raw/. site/_datos/ && rm -f site/_datos/estado.json
