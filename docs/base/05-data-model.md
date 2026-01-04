# Data Model (D1 Registry)

## Fuente de verdad
Registry = D1.

Tablas núcleo:
- `saas`
- `saas_projects`
- `saas_domains`

## `saas`
Identidad del SaaS:
- id, slug, name, status, created_at

## `saas_projects`
Extensión del SaaS (metadata/flags/owner):
- saas_id, tenant_id, fields extra

## `saas_domains`
Routing por host:
- domain, tenant_id, saas_id, saas_slug
- is_primary
- status (active/disabled)
- verification_status (pending/verified/failed)

## Endpoint obligatorio: /api/saas
Debe **fusionar** `saas + saas_projects + dominios` por tenant.
NO debe descartar registros por lógica parcial.

Salida mínima por item:
- id, slug, name, status
- primaryDomain { domain, status, verification_status }
- domainsCount

## Endpoint obligatorio: /api/health
Debe reportar:
- db.status (binding/table) con hints
- campamento/publicSaas (si existen) + estados
- dominios canónicos y estados
- host resolution status (ok/not found)
Nunca 500 silencioso.

## Seed idempotente mínimo (obligatorio)
- `campamento-base` + `base.drako.systems` ACTIVE/verified primary
- `drako-systems` + `drako.systems` ACTIVE/verified primary
