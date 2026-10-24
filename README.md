This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployment: Factory Mode

- Manual local deploy with `wrangler` is not allowed for production.
- Official production deploy path is GitHub Actions CI/CD only.
- To deploy, merge or push to `main`.
- Required GitHub Actions secret: `CLOUDFLARE_API_TOKEN`.
- Required GitHub Actions secret: `CLOUDFLARE_ACCOUNT_ID`.

## Mentoría Local (Abr 2026)

Estado final del hito local de Mentoría:

- Onboarding y Workspace: PASS (flujo validado en local).
- UX onboarding: tarjetas de materias completas clicables, a11y y feedback visual/táctil consistente.
- Bootstrap local: columnas y tablas requeridas aseguradas en D1 local (idempotente).
- Runtime local: sin errores relevantes; QA smoke operativa.

Comandos canónicos:

- Bootstrap DB local (idempotente):
  - `pnpm mentoria:local:bootstrap`
  - `pnpm mentoria:local:bootstrap:align-worker` (opcional, alinea migrations del worker)
- Ciclo QA (levanta runtime, espera readiness y ejecuta smoke):
  - `pnpm mentoria:local:qa`
  - `pnpm mentoria:local:qa:align-worker` (opcional)

Notas operativas:

- Readiness: `mentoria:local:qa` espera `http://localhost:8787/site/mentoria` hasta READY (configurable con `MENTORIA_READY_TIMEOUT_MS`).
- Variables útiles: `BASE_URL` para override local si aplica.
- Wrangler dev: requiere flag `experimental` activado en `wrangler.jsonc` (incluido).

Ruido no bloqueante conocido:

- `MENTORIA_AI_NOT_AVAILABLE`: degradación esperada en local cuando AI no está configurado; no bloquea onboarding/workspace.
- `/en/mentoria/app 404`: rutas localizadas fuera del scope actual (flujo usa `/mentoria/app`).
- Warning editor de schema `wrangler.jsonc`: de tooling, no afecta ejecución.

Siguiente frente recomendado (no implementado aquí):

- Salud AI Mentoría (healthcheck + gating/UI copy) para reducir aún más ruido local y mejorar diagnóstico, sin tocar flujos funcionales.
