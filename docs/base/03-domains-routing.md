# Dominios y Routing (Cloudflare Pages + Host Resolver)

Este documento describe el **contrato de routing** entre Cloudflare Pages (Edge) y el runtime Drako:
cómo se decide si una request va a **Campamento Base** (holding/admin) o a un **SaaS público** (incluyendo Drako.Systems).

## Dominios oficiales (v1)
- **Campamento Base (admin/holding):** `base.drako.systems`
- **Drako.Systems (primer SaaS + fábrica):** `drako.systems`

Opcionales (cuando toque):
- SaaS canónicos: `<saasSlug>.apps.drako.systems`
- Dominios propios cliente: `cliente.com`, `app.cliente.com`, etc.

## Resolver: cómo se decide qué SaaS sirve una request
1) Normalizar `Host` (lowercase, sin puerto, quitar `www.`)
2) Query en D1: `saas_domains.domain = host`
3) Si existe y está **ACTIVE + verified**:
   - `status = "active"`
   - `verification_status = "verified"`
   → resolver devuelve: `tenant_id`, `saas_id`, `saas_slug`
4) El middleware inyecta headers internos y sigue el routing.

Si NO existe o no está activo/verificado:
- el runtime responde con modo “no registrado” (sin contexto), y algunas pantallas/health pueden mostrar `host_resolution_not_found`.

## Headers que inyecta el middleware (contrato interno)
Cuando un dominio resuelve a un SaaS activo, el middleware añade (o normaliza):

- `x-tenant-id` → tenant (ej: `demo-tenant`)
- `x-drako-tenant-id` → alias/compat para el tenant
- `x-drako-saas-id` → id del SaaS resuelto
- `x-drako-saas-slug` → slug del SaaS (ej: `drako-systems`)
- `x-drako-correlation-id` → id único por request (para logs/tracing)

> No necesitas enviar estos headers a mano en producción. Solo sirven para debug o pruebas.

## Campos clave en `saas_domains`
- `status`: `active | disabled`
- `verification_status`: `pending | verified | failed`
- `is_primary`: dominio canónico/primario del SaaS

## Debug rápido

### 1) Pages responde pero el custom domain aún no
Probar Host override:
```bash
curl -H "Host: drako.systems" https://<tu-proyecto>.pages.dev/api/health
curl -H "Host: base.drako.systems" https://<tu-proyecto>.pages.dev/api/health
```

### 2) /api/health devuelve host_resolution_not_found
Falta registrar el dominio en `saas_domains` como `ACTIVE/verified` o falta aplicar la migración/seed de registry.

### 3) 503 binding-missing / migrations-missing / table-missing
No es un “misterio”: falta binding `DRACO_DB` o faltan migraciones/tablas en D1 remoto.
