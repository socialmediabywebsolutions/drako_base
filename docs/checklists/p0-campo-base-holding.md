# Checklist P0 - Campo Base (Holding)

Fecha: 2026-02-27

## Seguridad tenant/session
- [x] Rutas sensibles sin `x-tenant-id` fail-open (`/api/departments`, `/api/ai/chat`, `/api/campamento-base/contracts`)
- [x] `requireTenantAccess` endurecido sin fallback demo para verificación de mismatch
- [x] Fallback demo removido en flujo partner cuando no hay contexto de tenant

## Data leak
- [x] `reports/[id]/pdf` con filtro `tenant_id`
- [x] `research/jobs` con filtro y ownership de `session_id`
- [x] `company-profile` con email tomado de sesión autenticada
- [x] `saas/export` con guard tenant y logging de actor corregido

## Cron/internal
- [x] Sin secretos por query en `/api/cron/domains`, `/api/cron/growth`, `/api/cron/overseer`
- [x] Auth fuerte por header token con longitud mínima
- [x] Scheduler worker sin fallback `dev-secret-unsafe`

## Estado
- P0 Campo Base: DONE (con validación por tests unitarios y evidencia en reporte P0)

## P0.5 Validación estructural final
- [x] `pnpm lint` ejecutado sin errores (warnings heredados permitidos)
- [x] `pnpm typecheck` en limpio
- [x] `pnpm build` en limpio
- [x] Test crítico `/api/ai/chat` sin sesión => `401`
- [x] Test crítico `/api/reports/:id/pdf` tenant cruzado => `404`
- [x] Test crítico `/api/company-profile?email=otro` ignora query email y usa sesión
