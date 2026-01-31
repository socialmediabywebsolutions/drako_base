# Runbook: Modelo de Precios (Pricing Logic)

Este sistema calcula el precio de suscripción mensual para un SaaS de Drako.

## Fórmula Maestra

```typescript
Total = (Base_Tier + Extra_Seats) + Sum(Addons) + (Estimated_Usage)
```

## 1. Base Tier (Fijo)
Definido en `src/lib/billing/pricing.ts`. Es el coste de acceso a la plataforma y orquestación.
- **STARTER**: 49€ (Incluye 1 usuario)
- **PRO**: 199€ (Incluye 3 usuarios)
- **FULL**: 499€ (Incluye 10 usuarios)

## 2. Seats (Licencias)
Usuarios adicionales con acceso al panel de control.
- Coste: **15€ / usuario extra**.

## 3. Addons (Módulos opcionales)
Agentes o capacidades extra activadas manualmente.
- `extra_agent`: 29€
- `dedicated_ip`: 19€
- `compliance_pack`: 49€

## 4. Usage (Variable)
Estimación de costes de infraestructura (Cloudflare/Stripe/AI).
- Actualmente modelado como: **0.10€ por transacción estimada**.
- *Nota: Esto es una estimación de preventa. En producción, el billing es real (metered).*

## Ajustes Manuales
El agente `core_finances` puede aplicar descuentos discrecionales (hasta 20%) si el compromiso es anual. Esto se gestiona en la capa de negociación (Entrevista), no en el motor base.
