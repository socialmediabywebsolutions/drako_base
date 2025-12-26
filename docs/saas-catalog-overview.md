# SaaS Catalog & Campamento Base Overview

## Modelo de negocio
- Cada vertical (salón, clínica, grooming, lavandería) se alquila como un SaaS independiente.
- Cada SaaS tiene su propio plan, features y métricas.
- Campamento Base (/owner) agrega toda la operación (Economy, HR, Social, Tasks, etc.).
- Drako cobra la licencia y modulos; el presupuesto de Ads se paga directamente por el cliente a Google/Meta.

## Pricing recomendado (referencia)
- Core: 199-249 EUR/mes (SaaS + IA + WhatsApp basico + Tasks + Knowledge basica)
- Growth: 299-349 EUR/mes (Core + Social Engine 8 posts/mes + Tax basico)
- Pro: 399-549 EUR/mes (Growth + 12-16 posts/mes + reporting avanzado + soporte prioritario)

Packs extra:
- Social Pack +8 posts/mes: +80-120 EUR/mes
- Social Pack +16 posts/mes: +140-200 EUR/mes
- Gestion de Ads: fee 100-250 EUR/mes (el presupuesto Ads lo paga el cliente)

## Catálogo de SaaS
- Fuente de verdad: packs definidos en `src/lib/packs/definitions.ts`.
- El catálogo no usa D1; es configuración en memoria.
- Endpoint: `GET /api/catalog/saas`.

## Flujo de alta
1) Owner entra a `/owner/catalog`.
2) Selecciona un pack → `/saas/create?packId=...`.
3) Crea SaaS.
4) Se aplica pack + blueprint + features base.
5) Billing/Stripe gestiona la suscripción existente.

## Integración con módulos
- Packs → Blueprint + Features.
- Owner Portfolio y Owner Control muestran el SaaS nuevo automáticamente.
- El catálogo prepara la base para un flujo multi-SaaS por suscripción.
