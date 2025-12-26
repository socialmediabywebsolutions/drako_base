# Stripe – Modo desarrollo y producción

## Variables habituales
Configura en `.env.local` (dev) o en tu plataforma (prod):

```
APP_URL=https://app.drako.systems   # o http://localhost:3000 en local
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DRAKO_BASE_PRODUCT_ID=prod_TcV7OQkv5g0Fpk
DRAKO_BASE_STARTER_PRICE_ID=price_1SfG7HGW3NNEeb7odEVaTDYy
DRAKO_CLINIC_STARTER_PRICE_ID=price_XXXXXXX
```

## Flujo local con Stripe CLI
1. Instala Stripe CLI.
2. En la raíz del repo ejecuta:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```
   Stripe mostrará un nuevo `whsec_xxx`; cópialo a `STRIPE_WEBHOOK_SECRET` en `.env.local`.
3. Arranca la app (`npm run dev`) con `APP_URL=http://localhost:3000`.
4. Ve a `/billing`, pulsa **Activate Campamento Base (29 €/month)**, completa el pago de prueba (4242...).
5. El CLI reenviará el webhook y `/billing` mostrará el estado `active` tras recargar.

## Flujo en producción
- Despliega la app con `APP_URL=https://app.drako.systems`.
- Configura el webhook en Stripe apuntando a `https://app.drako.systems/api/stripe/webhook` y usa ese `whsec_xxx` en las variables del entorno de producción.
- El checkout usará automáticamente esa URL para `success` y `cancel`.
