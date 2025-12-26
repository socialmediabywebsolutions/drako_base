# Domains & Public Front v1

## saas_domains
Tabla multi-tenant para dominios por SaaS:

- id, tenant_id, saas_id
- domain
- is_primary
- status (PENDING_DNS, ACTIVE, ERROR_CHECK)
- last_checked_at
- created_at, updated_at

## Public Profile
`SaasPublicProfile` resume los datos publicos para renderizar la home:

- Nombre, tagline, descripcion corta.
- Branding basico (colores por defecto si no hay configuracion).
- Dominio primario y subdominio Drako.
- Enlaces sociales (si existen cuentas conectadas).

## API Publica
`GET /api/saas/public/[slug]` devuelve el perfil publico y dominios resueltos.

## Home publica
`/site/saas/[slug]` es la home de empresa:

- Hero con CTA principal.
- Servicios y precios.
- Beneficios y testimonios demo.
- BookingWidget integrado.
- Datos practicos (ubicacion, redes sociales, dominio).

## Roadmap
En el futuro un Worker/Pages resolvera Host → slug/tenant (ej. mi-peluqueria.com) y servira esta misma home.
