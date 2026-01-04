# Runbooks — GO / NO-GO (Cloudflare Pages + D1)

## Señales GO
- Dominios responden por HTTPS (SSL ACTIVE)
- D1 binding `DRACO_DB` en Pages
- Migraciones remotas aplicadas
- `/api/health` en prod reporta db + campamento + publicSaas + domains
- `/api/saas` en prod lista mínimo: campamento-base y drako-systems
- No hay 500 silenciosos (503 con reason/hint cuando falte algo)

---

## A) Preview local (Cloudflare)
1) `npm run cf:build`
2) `wrangler d1 migrations apply drako_db --local --persist-to .wrangler/state`
3) `npm run cf:preview -- --port 8788 --persist-to .wrangler/state`

Smoke:
- `curl http://localhost:8788/api/health`
- `curl http://localhost:8788/api/saas`

---

## B) Producción (Cloudflare Pages)
1) Binding D1:
   - Settings → Functions → D1 bindings
   - `DRACO_DB` → `drako_db`

2) Migraciones remotas:
- `wrangler login`
- `wrangler d1 migrations apply drako_db --remote`

3) Deploy:
- `npm run cf:build`
- `npm run cf:deploy`

4) Dominios:
- `drako.systems`
- `base.drako.systems`

5) DNS (proxied):
- CNAME `drako.systems` → `<project>.pages.dev`
- CNAME `base.drako.systems` → `<project>.pages.dev`

Smoke prod:
- `curl https://drako.systems/api/health`
- `curl https://drako.systems/api/saas`

Host override (si DNS aún no está):
- `curl -H "Host: drako.systems" https://<project>.pages.dev/api/health`

---

## C) Diagnósticos (503)
- `binding-missing`: falta enlazar D1 en Pages
- `migrations-missing` / `table-missing`: faltan migraciones remotas
- `host_resolution_not_found`: falta dominio ACTIVE/verified en `saas_domains`
- `stripe_not_configured`: faltan secrets Stripe

## Runbook: levantar producción (Pages + D1 + dominios)
Objetivo: que **drako.systems** y **base.drako.systems** respondan y que `/api/health` muestre `campamento` + `publicSaas` + `domains` (sin 500).

1) **Binding D1 (Cloudflare Pages)**
- Settings → Functions → D1 bindings
- Añade: `DRACO_DB` → `drako_db`

2) **Migraciones remotas (incluye registry 0061)**
```bash
wrangler login
wrangler d1 migrations apply drako_db --remote
```

3) **Deploy**
- Build:
```bash
npm run cf:build
```
- Deploy (elige UNA):
  - si tienes script:
```bash
npm run cf:deploy
```
  - o directo:
```bash
wrangler pages deploy .vercel/output/static
```

4) **Custom Domains + DNS**
- Pages → Custom domains: añade:
  - `drako.systems`
  - `base.drako.systems`
- DNS (Cloudflare):
  - `drako.systems` CNAME → `<tu-proyecto>.pages.dev` (proxied)
  - `base.drako.systems` CNAME → `<tu-proyecto>.pages.dev` (proxied)
- Espera a que SSL esté **ACTIVE** (sin esto, curl puede fallar).

5) **Smoke tests**
```bash
curl https://drako.systems/api/health
curl https://drako.systems/api/saas
curl https://drako.systems/api/agents
```

Si DNS todavía no está listo:
```bash
curl -H "Host: drako.systems" https://<tu-proyecto>.pages.dev/api/health
```

Resultado esperado:
- `/api/health` reporta `db.status=ok`, `campamento`, `publicSaas`, y `domains` con `ACTIVE/verified`.
- `/api/saas` lista mínimo: `campamento-base`, `drako-systems`, `drako-clinic-pack`, `demo-saas`.
- Si falta binding o tablas: devuelve **503 con reason/hint**, nunca 500 silencioso.

