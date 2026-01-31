# Runbook: Stripe Mapping

Este documento explica cómo mapear los Tier de Drako a Productos de Stripe reales.

## Configuración de Entorno

Las siguientes variables deben estar definidas en `.dev.vars` (local) y Cloudflare Dashboard (prod).

```bash
STRIPE_PRODUCT_STARTER_ID=prod_...
STRIPE_PRODUCT_PRO_ID=prod_...
STRIPE_PRODUCT_FULL_ID=prod_...

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_FULL_MONTHLY=price_...
```

## Creación en Stripe
1. Ir al Dashboard de Stripe -> Catálogo de Productos.
2. Crear producto "Drako Starter".
    - Añadir precio recurrente: 49 EUR / mes.
    - Copiar Product ID (`prod_...`) y Price ID (`price_...`).
3. Repetir para Pro y Full.

## Addons
Los addons deben crearse como productos independientes en Stripe, o como Prices opcionales dentro de la suscripción.
Recomendamos "Suscripción con múltiples items".

## Webhooks
El sistema escucha `customer.subscription.updated` y `invoice.payment_succeeded` para provisionar el acceso.
