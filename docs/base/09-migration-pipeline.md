# D1 Migraciones (Local + Remote)

## Regla
D1 es fuente de verdad. Si prod no tiene migraciones ⇒ prod está “vacío”.

## Local (preview)
1) `npm run cf:build`
2) `wrangler d1 migrations apply drako_db --local --persist-to .wrangler/state`
3) `npm run cf:preview -- --persist-to .wrangler/state`

## Remote (producción)
1) `wrangler login`
2) `wrangler d1 migrations apply drako_db --remote`

## Nota crítica
Si introduces una migración de registry (por ejemplo `0061_drako_domains_registry.sql` para dominios canónicos),
debe aplicarse en remoto antes de esperar routing real.

## Validación mínima
- `curl /api/health`
- `curl /api/saas`
