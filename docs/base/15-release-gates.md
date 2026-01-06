# Release Gates (checklist de salida a producción)

## Gate 1 — Repo sano
- `npm run qa` debe estar ✅
- ESLint no debe escanear artefactos temporales:
  - ignorar `.wrangler/**` y `.vercel/**` en lint (o limpiar antes de lint)

## Gate 2 — Build Cloudflare
- `npm run pages:build` ✅ (OpenNext sin errores)

## Gate 3 — Preview local con D1
- `wrangler d1 migrations apply drako_db --local --persist-to .wrangler/state`
- `npm run cf:preview -- --persist-to .wrangler/state`
- `curl /api/health` y `curl /api/saas` devuelven JSON coherente

## Gate 4 — Producción (Pages)
- Custom domains en Pages: `drako.systems` y `base.drako.systems` (SSL ACTIVE)
- Binding D1:
  - `DRACO_DB` → `drako_db`
- Migraciones remotas:
  - `wrangler d1 migrations apply drako_db --remote`
- Deploy:
  - `npm run cf:deploy`

## Gate 5 — Dominios + DNS + SSL
- Pages custom domains: `drako.systems`, `base.drako.systems`
- DNS CNAME proxied a `<project>.pages.dev`
- SSL status: ACTIVE

## Gate 6 — Smoke tests prod
- `curl https://drako.systems/api/health` (db OK + campamento + publicSaas + domains)
- `curl https://drako.systems/api/saas` (lista completa; no “faltan” registros)
- `curl https://drako.systems/api/agents` (200, no 500)
- Si falla DNS: Host override a `<project>.pages.dev` con header Host

## Definición de GO final
Si estos 6 gates pasan, el sistema está listo para producción real.


## Gate: Registry & dominios (0061)
- `/api/health` en prod reporta `db.status=ok`.
- `/api/health` reporta `campamento` y `publicSaas` (no null).
- `/api/health` lista `domains` y contiene `drako.systems` y `base.drako.systems` en `active/verified`.
- `/api/saas` devuelve mínimo: `campamento-base`, `drako-systems`, `drako-clinic-pack`, `demo-saas`.
