# Public endpoints inventory

Generated: 2025-12-26T07:16:38.652Z

## PUBLIC_OK

| Route | Purpose | Consumer | Risk | Mitigations |
| --- | --- | --- | --- | --- |
| /api/auth/login | Iniciar sesión del owner/staff en el panel | Owner UI | Brute force de credenciales | rate-limit |
| /api/health | Healthcheck básico del runtime | Infra/monitoring | Abuso de ping público | rate-limit |
| /api/core-departments | Catálogo público de departamentos core | UI pública / onboarding | Scraping | rate-limit |
| /api/packs | Lista pública de packs disponibles | UI pública | Scraping | rate-limit |
| /api/catalog/saas | Catálogo público de SaaS | UI pública | Scraping | rate-limit |
| /api/saas/public/[slug] | Perfil público de SaaS | Landing pública | Scraping | rate-limit |
| /api/site/clinic/leads | Lead público de clínica | Formulario público | Spam/abuso | rate-limit, optional-token-or-hmac |
| /api/stripe/webhook | Webhook Stripe | Stripe | Eventos falsos | stripe-signature, rate-limit |

## MUST_AUTH

(none)

## Detected public routes

- /api/auth/login
- /api/catalog/saas
- /api/core-departments
- /api/health
- /api/packs
- /api/saas/public/[slug]
- /api/site/clinic/leads
- /api/stripe/webhook
