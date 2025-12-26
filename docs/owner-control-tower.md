# Owner Control Tower

## Overview
Owner Control Tower es un snapshot agregado para el dueño que combina Economy, HR/Fairness, Email Intake y Social Health en una vista unica.

## OwnerControlSnapshot
- Identifica tenantId y saasId.
- Economy: margen estimado, objetivo, ingresos/costes y servicios con presion de precios.
- HR/Fairness: total de empleados, señales de sobrecarga, salarios bajos, baja actividad y issues criticas.
- Email Intake: volumen de emails, facturas, ofertas de proveedor, leads y ahorro potencial mensual.
- Social Health: cuentas conectadas, campañas activas, posts programados y engagement agregado.
- Social ROI: citas e ingresos estimados atribuidos a campañas sociales.
- Decision: canHireAdvice con estado y razon principal.
- Recommendations: lista corta de acciones sugeridas.

## Fuentes de datos
- Economy: `getSaasProfitabilitySnapshot`, `getPricingSuggestions`, inventario para comparar ofertas.
- HR/Fairness: `getSaasComplianceSummary` y compliance por empleado.
- Email Intake: `listEmailMessages`, `getEmailIntakeSnapshot`.
- Social Health: `getSocialOwnerSummary` desde Social Engine.
- Social ROI: `getSocialConversionSnapshot` desde Social Engine.

## CanHireAdvisor
Heuristica simple:
- Margen < 20% -> CANNOT_HIRE.
- Margen > 30% y sobrecarga -> CAN_HIRE.
- Margen 25-30% con baja actividad -> BORDERLINE.
Incluye detalles si hay ahorro potencial por proveedores.

## UI Owner Control Tower
La seccion muestra:
- KPIs de margen, fairness y ahorro.
- Badge con recomendacion de contratacion.
- Tabla de servicios en presion.
- Resumen fairness y lista de issues.
- Tabla de oportunidades de ahorro.
- Recomendaciones de siguiente paso.
