---
id: packs-blueprint
version: v1
scope: holding
status: active
owners: [drako-team]
tags: [packs, pricing, blueprint]
applies_to: [all]
not_applies_to: []
---

# Packs & Pricing Model v1

## 1. Packs Globales

Drako estandariza la oferta en tres niveles. El cliente no "compra agentes", compra un **Pack** que activa un "Enjambre por Defecto".

### PACK: STARTER (Tactical)
**Para**: Solopreneurs, MVPs, arranques.
**Focus**: Ejecución táctica básica.

- **Agentes incluidos**:
    - Todos los CORE (limitados en frecuencia).
    - 2 Partners clave del vertical (ej. `media_strategies` + `copywritings`).
    - 3 Operators básicos (`stripe_billings`, `email_intakes`, `calendar_syncings`).
- **Límites**:
    - 1 Entrevista mensual.
    - 500k Tokens de contexto.
    - Sin acceso a D1 directo.

### PACK: PRO (Growth)
**Para**: Pequeñas empresas, agencias.
**Focus**: Crecimiento y automatización seria.

- **Agentes incluidos**:
    - Todos los CORE (frecuencia media).
    - **5 Partners** del vertical.
    - **8 Operators** (incluye `queues`, `cron`).
- **Features**:
    - D1 dedicado (aislamiento lógico).
    - Orquestación asíncrona (Queues).
    - Base de Conocimiento hasta 50MB.

### PACK: FULL (Empire)
**Para**: Empresas consolidadas, escalado agresivo.
**Focus**: Dominio total del nicho.

- **Agentes incluidos**:
    - **TODOS** los del catálogo.
    - Swimlanes dedicados en Workers.
- **Features**:
    - D1 dedicado + Backup.
    - R2 ilimitado (dentro de fair use).
    - Base de Conocimiento ilimitada.
    - Soporte prioritario.

---

## 2. Modelo de Precios (Pricing Engine)

El precio FINAL se calcula dinámicamente, pero se basa en:

`Precio = (Base Pack) + (Addons) + (Uso Estimado)`

### Base Mensual (Referencia)
- **Starter**: 49€ - 99€ / mes
- **Pro**: 199€ - 299€ / mes
- **Full**: 499€+ / mes

### Variables de Complejidad
El motor `pricing.ts` ajusta el precio base según:
- **Volumen de transacciones** (Stripe).
- **Número de empleados** (Seats).
- **Complejidad de integración** (Custom APIs).

### Addons Comunes
- **Extra Agent**: +29€/mes
- **Dedicated IP**: +19€/mes
- **Legal Compliance Pack**: +49€/mes
