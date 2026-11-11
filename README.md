# Turno · farmacias de guardia en España

Web estática (sin servidor ni base de datos) que muestra las farmacias de guardia más cercanas
con datos oficiales de los colegios de farmacéuticos. Un proyecto de Esclusa.

## Cómo funciona
- `pipeline/fetch.py` descarga cada fuente oficial (Madrid, Cádiz, Sevilla, Castilla-La Mancha, Zaragoza).
  Si una falla, se usa su última copia buena y la web lo indica.
- `pipeline/build.py` lo cruza con la base de OpenStreetMap (`pipeline/static/osm_farmacias.json`) y genera `site/farmacias.js`.
- `pipeline/check.py` frena la publicación si el resultado no es razonable.
- GitHub Actions (`.github/workflows/actualizar.yml`) lo ejecuta cada día a las 9:50 y a las 18:30 (hora de Madrid)
  y publica `site/` en Cloudflare Pages.

## Puesta en marcha en Cloudflare (una sola vez)
1. Cloudflare → **Workers & Pages → Create → Pages → Upload assets** → nombre del proyecto: `turno`
   (sube cualquier carpeta vacía; las siguientes publicaciones las hace GitHub).
2. Cloudflare → **My Profile → API Tokens → Create Token → plantilla "Edit Cloudflare Workers"**
   (o permiso personalizado *Account · Cloudflare Pages · Edit*). Copia el token.
3. Copia tu **Account ID** (aparece en la portada de Workers & Pages, a la derecha).
4. GitHub → repositorio `turno` → **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = el token
   - `CLOUDFLARE_ACCOUNT_ID` = el Account ID
5. GitHub → **Actions → Actualizar y publicar → Run workflow**. En unos minutos estará en `https://turno.pages.dev`.

## Antes de hacerla pública
- Rellenar los datos del titular en `site/legal.html` (aparecen marcados como PENDIENTE).
- Quitar el `noindex` (en `site/index.html`, `site/legal.html`, `site/_headers` y `site/robots.txt`).
- Pedir a cada colegio permiso para reutilizar sus datos de guardias.

## Seguridad
Sin cookies, sin analítica, sin formularios ni servidor. Cabeceras en `site/_headers`: CSP estricta
(solo recursos propios), HSTS, sin iframes, `Permissions-Policy` con geolocalización solo para la propia web.
