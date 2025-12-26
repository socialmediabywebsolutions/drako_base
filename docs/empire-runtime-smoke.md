# Empire Runtime smoke tests

Objetivo: validar el flujo minimo de dominios (registro + verificacion) sin tocar DNS real.

## Requisitos previos
- App corriendo local: `npm run dev`
- Tenant/owner creado y accesible en `/owner`
- SaaS demo creado desde `/saas/create` (modo dry_run ok)

## Smoke 1: canonical domain (ACTIVE si el resolver lo mapea)
1) Crea un SaaS desde `/saas/create` con slug valido (ej. `atlas-growth`).
2) Confirma en `/owner` -> "Dominios del imperio" que existe `atlas-growth.apps.drako.systems`.
3) Ejecuta verificacion:
   - UI: boton "Verify" en la fila del dominio.
   - API: `POST /api/owner/domains/verify` con body `{"scope":"domain","domain":"atlas-growth.apps.drako.systems"}`.
4) Esperado:
   - Status pasa a `ACTIVE` si el resolver devuelve el saas/tenant correcto.
   - `verification_status` = `VERIFIED`, reason `CANONICAL_RESOLVED`.

## Smoke 2: custom domain (PENDING)
1) Inserta o registra un dominio custom (ej. `mi-saas.com`) con status `PENDING_DNS`.
2) Verifica con UI o API.
3) Esperado:
   - Status sigue `PENDING_DNS`.
   - `verification_status` = `PENDING`, reason `CUSTOM_DOMAIN_DEFERRED`.

## Smoke 3: Host routing (middleware)
1) Simula el Host en local:
   - `curl -H "Host: atlas-growth.apps.drako.systems" http://localhost:3000/`
2) Esperado:
   - La respuesta llega con headers `x-drako-saas-id`, `x-drako-tenant-id`, `x-drako-saas-slug`.
   - Se inserta un evento en `campamento_events` tipo `routing.resolve.success`.

## Eventos a revisar
En `campamento_events` deben aparecer eventos:
- `provision.domain.verify.started`
- `provision.domain.verify.done` o `provision.domain.verify.failed`
- `routing.resolve.success` / `routing.resolve.miss`

Si no hay DNS/SSL real, los custom domains permanecen en `PENDING_DNS` hasta verificacion en runtime.

## Canonical Smoke (staging)
Objetivo: validar en staging/preview con routing real que el canonical pasa a `active` y `verified`.

### Requisitos
- URL base de staging (ej. `https://staging.drako.systems`)
- Sesion valida de owner/tenant_admin en el browser
- Un SaaS con canonical `<slug>.apps.drako.systems` registrado en `saas_domains`

### Verificacion via API (scope=domain)
1) Abre la consola del navegador logueado en `/owner`.
2) Ejecuta:
```js
await fetch("/api/owner/domains/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scope: "domain", domain: "<slug>.apps.drako.systems" }),
}).then((res) => res.json());
```
3) Esperado (snippet):
```json
{ "ok": true, "count": 1 }
```

### Verificacion via API (scope=saas)
```js
await fetch("/api/owner/domains/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scope: "saas", saasId: "<saas_id>" }),
}).then((res) => res.json());
```

### Validacion en UI
1) Ve a `/owner` -> "Dominios del imperio".
2) Confirma:
   - `status` = `active`
   - `verification_status` = `verified`
   - `verification_reason` vacio o `CANONICAL_RESOLVED`
   - `retry_count` no sube al verificar canonical ya activo

### Validacion en D1 (opcional)
Consultar `saas_domains` y confirmar:
- `status = 'active'`
- `verification_status = 'verified'`
- `updated_at` actualizado
- `retry_count` no se incrementa en dominios ya activos

### Evidencias (adjuntar)
- Respuesta JSON del verify (solo `ok` y `count`).
- Captura de la card "Dominios del imperio" con status `active` y stage `verified`.
