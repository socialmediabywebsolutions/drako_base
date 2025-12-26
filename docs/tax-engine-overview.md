# Tax Engine v1 (demo)

## Objetivo
Motor fiscal determinista por SaaS que estima IVA/IRPF a partir de ingresos y gastos ya existentes. Es un sistema de apoyo y **no sustituye** asesoría profesional ni modelos oficiales.

## Tablas nuevas
- `saas_tax_profiles`: configuración fiscal por SaaS (país, régimen, tipos de IVA, retenciones).
- `saas_tax_periods`: periodos fiscales (trimestral/anual) con estimaciones.

## Cómo se calcula
- Ingresos: citas completadas (`saas_appointments`) + precio del servicio.
- Gastos: `saas_expenses` (Email Intake alimenta facturas).
- IVA estimado: aproximación por tipo de IVA configurado.
- IRPF estimado: aplicación de retención si `uses_withholding` está activo.

## APIs
- `GET /api/saas/[id]/tax/profile` → perfil fiscal del SaaS.
- `PATCH /api/saas/[id]/tax/profile` → actualizar configuración.
- `GET /api/saas/[id]/tax/periods` → lista de periodos.
- `POST /api/saas/[id]/tax/periods` → recalcula trimestre actual.
- `GET /api/owner/tax/summary` → resumen fiscal agregado del portfolio.

## UI
- `/saas/[id]` → sección “Contabilidad & Impuestos” con KPIs, histórico y configuración.
- `/owner` → bloque “Tax & Compliance overview” con IVA agregado y SaaS en riesgo.

## Integraciones
- **Autopilot**: acciones fiscales cuando el IVA es alto o el margen está bajo.
- **Tasks**: materializa acciones fiscales como tareas (categoría `TAX`).
- **Knowledge Base**: playbooks etiquetados con `tax/iva/quarterly`.
- **WhatsApp Gateway**: intent “resumen impuestos” para dueños.

## Nota legal
El sistema ofrece **estimaciones demo** y debe validarse con el gestor fiscal antes de declarar.

## Nota de visibilidad
El Tax Engine calcula impuestos para el SaaS operativo. Campamento Base solo consume el resumen agregado necesario y no expone la facturacion completa del negocio final.
