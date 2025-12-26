# Drako Vendor / Campamento Base Overview

## Que es Drako Vendor / Campamento Base
Drako Vendor agrupa los costes que Drako asume como vendor para operar todos los SaaS: infraestructura, IA, marketing, soporte y equipo. Estos gastos viven en la tabla `drako_vendor_expenses` y se imputan al portfolio completo para estimar margen por vertical.

## Modelo de negocio de Drako como vendor
Drako cobra la licencia SaaS y los modulos (IA, WhatsApp, Social, Tax, Knowledge, Tasks). El presupuesto de Ads (Google/Meta) lo paga el cliente directamente a la plataforma; Drako solo cobra un fee de gestion si el cliente contrata ese modulo.

### Coste objetivo por SaaS (por mes)
Rangos recomendados por SaaS activo:
- INFRA: 15-25 EUR
- AI: 25-40 EUR
- TEAM/SUPPORT: 30-50 EUR
- OTHER: 10-20 EUR

Target global: 80-120 EUR por SaaS y mes.

### Margen objetivo de Drako
Margen despues de gastos vendor imputados a la vertical:
- Objetivo recomendado: >= 65%
- < 30%: CRITICAL
- 30-50%: WARNING
- 50-70%: OK
- > 70%: VERY_HEALTHY

### Separacion de visibilidad
El owner de Campamento Base solo ve lo que paga cada SaaS a Drako y los costes vendor imputados por vertical. No ve la facturacion completa ni el margen interno del negocio final (peluqueria, clinica, etc.).

## Esquema de datos
Tabla: `drako_vendor_expenses`

- `id`: identificador del gasto
- `label`: descripcion corta del gasto
- `type`: INFRA | AI | MARKETING | SUPPORT | TEAM | OTHER
- `amount`: importe numerico
- `currency`: moneda (por defecto EUR)
- `period`: MONTHLY | YEARLY | ONE_OFF
- `from_date`: fecha de inicio (ISO)
- `to_date`: fecha de fin (ISO, opcional)
- `vertical_id`: vertical al que se imputa (opcional)
- `metadata`: JSON opcional
- `created_at`, `updated_at`: timestamps

## Snapshot Owner
`DrakoVendorAccountingSnapshot` expone:

- `totalVendorExpensesThisMonth`: gasto total de vendor del mes actual
- `totalVendorExpensesLastMonth`: gasto total del mes anterior
- `vendorExpensesByType`: desglose por tipo con share sobre el total
- `vendorExpensesByVertical`: desglose por vertical con share sobre el total
- `estimatedMarginByVertical`: ingresos vs gastos por vertical + margen estimado
- `notes`: alertas de margen o gasto elevado

Se usa en `/owner` (OwnerVendorSection) para visualizar margen estimado por vertical y el mix de gastos del vendor.

## Demo
El entorno demo incluye gastos como Cloudflare, pipelines de IA, ads por vertical, herramientas de soporte y costes de equipo core. Parte de los gastos se asignan a verticales (SALON, CLINIC, LAUNDRY) para simular imputacion parcial.
