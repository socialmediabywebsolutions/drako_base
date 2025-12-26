# Social Engine v1

## Tablas nuevas

- `saas_social_accounts`: cuentas sociales conectadas por SaaS.
- `saas_social_campaigns`: campañas con objetivo, segmento y fechas.
- `saas_social_posts`: posts (borrador, programado, publicado).
- `saas_social_metrics`: métricas básicas de engagement por post.

Todas las tablas son multi-tenant (`tenant_id`, `saas_id`) y siguen naming plural.

## Content Engine (determinista)

Archivo: `src/lib/social/content-engine.ts`

Usa:

- Economy: servicios activos, márgenes y alertas de stock.
- Appointments: frecuencia de servicios en últimos 30 días.
- Customers: preferencias y servicios favoritos (sin acoplar a UI).

Genera:

- Ideas de campaña (3–5) con objetivo, segmento y servicios sugeridos.
- Sugerencias de posts con copy corto e image hints.

No llama a APIs externas; deja TODOs para DrakoSocialAgent (IA) en v2.

## Flujo v1

Dueño → `/saas/[id]` → Social Engine → “Generar ideas” → “Crear campaña” → “Generar posts” → programar/editar.

## v1.1

- Publish manual: el botón “Marcar como publicado” solo cambia estado a `POSTED` y fija `posted_at` (sin llamadas a APIs externas).
- Filtros de posts: estado, campaña y provider en la tabla.
- Social Health: resumen en Owner Control Tower con cuentas conectadas, campañas activas, posts programados y engagement básico.

## Social Conversion v1

- Nuevos campos en citas: `social_campaign_id`, `social_post_id`, `source_channel`.
- El portal `/site/saas/[slug]` acepta `?campaignId=...&postId=...&source=social` y propaga la atribución al booking.
- APIs nuevas:
  - `/api/social/analytics/summary`
  - `/api/social/analytics/campaigns`
  - `/api/social/analytics/posts`
- La sección Social muestra rendimiento (citas e ingresos) y Owner Control incluye un bloque Social ROI básico.

## Futuro

- OAuth real para Instagram/Meta/TikTok.
- Segmentación profunda usando CustomerPartner + Customer Experience v2.
