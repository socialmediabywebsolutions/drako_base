# Economy Core Overview

## New D1 tables

- saas_services: catalog of services, duration, pricing, and metadata.
- saas_inventory_items: inventory items with cost per unit and stock levels.
- saas_inventory_movements: stock movements (in/out/adjust) with reasons and sources.
- saas_expenses: fixed and variable expenses by type and period.
- saas_pricing_settings: target/min margin, occupancy target, and inclusion flags.
- saas_service_products: item consumption per service.

## Pricing engine

The pricing engine estimates service cost (products + allocated overhead) and suggests a target price:

- suggested_price = cost / (1 - target_margin_percent / 100)
- services below min margin are flagged as LOW_MARGIN
- services priced below cost are flagged as LOSS

## Margin calculation

Service cost includes:

- Product cost: sum of (quantity_per_service * cost_per_unit)
- Overhead: monthly expenses (rent, utilities, payroll) allocated per hour and scaled by service duration

The margin is calculated as:

- margin_percent = (price - cost) / price * 100

## Future integrations

- Appointments: use real service volume and durations to replace the demo volume heuristic.
- Payroll: load actual payroll data from Employees/HR to refine cost allocation.
- Invoice intake: ingest expenses from email imports and supplier invoices.
