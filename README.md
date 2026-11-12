# Turno · farmacias de guardia en España

Web estática (sin servidor ni base de datos) que muestra las farmacias de guardia más cercanas
con datos oficiales de los colegios de farmacéuticos. Un proyecto de Esclusa.

## Cómo funciona
- Cloudflare Pages está conectado a este repositorio. En cada build ejecuta `pipeline/cf_build.sh`:
  - `pipeline/fetch.py` descarga cada fuente oficial (Madrid, Cádiz, Sevilla, Castilla-La Mancha, Zaragoza).
  - `pipeline/build.py` lo cruza con la base de OpenStreetMap (`pipeline/static/osm_farmacias.json`) y genera `site/farmacias.js`.
  - `pipeline/check.py` frena la publicación si el resultado no es razonable (Cloudflare sigue sirviendo la versión anterior).
- GitHub Actions (`.github/workflows/actualizar.yml`) hace un commit cada sábado a las 9:50 (hora de Madrid); Cloudflare reconstruye la web y descarga los turnos de los 9 días siguientes.
- Limitación: Madrid y Zaragoza solo publican la guardia del día, así que con actualización semanal su turno solo es exacto el sábado. Para tenerlo a diario basta con añadir más líneas `cron` al workflow.

## Configuración en Cloudflare Pages
- Build command: `bash pipeline/cf_build.sh`
- Build output directory: `site`
- Variable de entorno: `PYTHON_VERSION` = `3.12`

## Antes de hacerla pública
- Rellenar los datos del titular en `site/legal.html` (aparecen marcados como PENDIENTE).
- Quitar el `noindex` (en `site/index.html`, `site/legal.html`, `site/_headers` y `site/robots.txt`).
- Pedir a cada colegio permiso para reutilizar sus datos de guardias.

## Seguridad
Sin cookies, sin analítica, sin formularios ni servidor. Cabeceras en `site/_headers`: CSP estricta
(solo recursos propios), HSTS, sin iframes, `Permissions-Policy` con geolocalización solo para la propia web.
