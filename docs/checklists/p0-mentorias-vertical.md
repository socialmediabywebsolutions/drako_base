# Checklist P0 - Mentorías (Vertical)

Fecha: 2026-02-27

## Aislamiento
- [x] Guardas base endurecidas en `requireTenantAccess` (impacta verticales que lo consumen)
- [x] Overrides inseguros por `x-tenant-id` bloqueados por defecto

## Billing/Webhooks
- [x] Procesamiento Stripe consolidado con firma y dedupe en endpoint canónico
- [x] Rutas legacy de webhook neutralizadas sin doble procesamiento

## Dominios
- [x] Enforcement de entitlement activo en APIs de dominios compartidas

## Riesgo residual
- [ ] Revisar rutas verticales adicionales fuera del scope P0 para policy pública (`Gate vs Code`)

## Estado
- P0 Mentorías: DONE en controles compartidos, con seguimiento P1 para cobertura total de inventory pública.

## P0.5 Validación estructural final
- [x] Validación estructural global (`lint/typecheck/build`) completada en limpio
- [x] Controles compartidos de webhook Stripe validados con prueba de firma inválida (`400`)
- [x] Aislamiento multi-tenant compartido validado con pruebas de rutas críticas
