#!/usr/bin/env bash
# Comando de build de Cloudflare Pages: descarga los datos del día y genera site/
set -euo pipefail
python3 -m pip install --quiet shapely==2.0.6
python3 pipeline/fetch.py || echo "Aviso: alguna fuente falló; se publica con las que han funcionado"
python3 pipeline/build.py
python3 pipeline/check.py
