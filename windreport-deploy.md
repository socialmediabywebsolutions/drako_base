# Deploy Report — npm peer deps fix (Cloudflare Pages)

## Opción aplicada
- ✅ Añadido `.npmrc` con `legacy-peer-deps=true` y `strict-peer-deps=false` para permitir la instalación con `next@15.5.9`.
- Next se mantiene en `15.5.9` (parche de seguridad); no se aplicó downgrade.

## Resultados locales
- `npm ci` (equivalente clean-install con `.npmrc`): ✅
- `npm run build`: ✅ (Next 15.5.9). Único warning informativo de Edge deshabilitando SSG para páginas con runtime edge (no bloqueante).
- `npm run qa`: **no ejecutado en este ciclo** (si se requiere, lanzar para lint+build).

## Veredicto
- GO para despliegue en Cloudflare Pages: la fase de `npm clean-install` ya no debería fallar por peer deps.

## Notas
- OpenNext es el adaptador oficial para Cloudflare Pages/Workers; el pipeline actual ya usa OpenNext.
- Plan B (no aplicado): bajar Next a 15.5.2 si surgiera un problema en runtime; no necesario tras este fix.
