# Runbook: Workers-only (No Cloudflare Pages)

This repository must be deployed **ONLY** as a Cloudflare **Worker** using `wrangler`.

## Goals

- Deploy the app as a **Worker** (OpenNext output + `wrangler deploy`).
- Ensure **Cloudflare Pages cannot be used** (hard guardrails).
- Ensure host routing works in the Worker runtime:
  - `drako.systems`
  - `mentoria.drako.systems`
  - `base.drako.systems`

## Source of truth

- Deployment config: `wrangler.workers.toml` (authoritative)
- Build command: `npm run cf:build`
- Deploy command: `npm run cf:deploy`

## Guardrails (must fail on Pages)

### Build-time guardrail

The script `scripts/check-no-pages.ts` fails if:

- Any Cloudflare Pages env var is present:
  - `CF_PAGES`, `CF_PAGES_ENVIRONMENT`, `CF_PAGES_BRANCH`, `CF_PAGES_COMMIT_SHA`, `CF_PAGES_URL`, `CF_PAGES_BUILD_ID`
- Any active legacy config is detected:
  - `wrangler.toml`
  - `wrangler.pages.toml`

It is wired into the pipeline via:

- `precf:build` → `npm run check:no-pages`
- `precf:deploy` → `npm run check:no-pages`

You can run it manually:

- `npm run check:no-pages`

### Runtime guardrail

The app middleware returns an explicit error if it detects a Pages runtime (`CF_PAGES*`).

## Deploy (Worker only)

### 1) Build Worker artifact

- `npm run cf:build`

Expected output:

- `.open-next/worker.js` exists

### 2) Deploy Worker

- `npm run cf:deploy`

This runs:

- `npx wrangler deploy --config wrangler.workers.toml --env production`

### 3) Local Worker preview

- `npm run cf:preview`

## Verify Pages is disabled

- In CI/build logs, ensure `npm run check:no-pages` runs and does NOT report `CF_PAGES*`.
- If anyone tries to run the build on Pages, the build must fail with:
  - `ERROR: Cloudflare Pages environment detected ...`

## Host routing verification checklist

- Verify the middleware adds `x-drako-effective-host` and routes correctly.
- Verify redirects:
  - `/site/mentoria/*` → `https://mentoria.drako.systems/*` (308)

## Auth / Cookies verification checklist

- Confirm cookie names are host-only and context-specific:
  - `__Host-drakos_session`
  - `__Host-mentorias_session`
  - `__Host-bases_session`

- Confirm the app rejects cross-context cookies:
  - A `__Host-drakos_session` must not authenticate on `mentoria.drako.systems`.

## DNS / Routes checklist

### DNS

- `drako.systems` → Worker (via Cloudflare routing / custom domain)
- `mentoria.drako.systems` → Worker (custom domain)
- `base.drako.systems` → Worker (custom domain)

### Cloudflare routes

- Ensure all custom domains point to the Worker service (not Pages).

## Cloudflare Dashboard: remove / disconnect Pages

1. Cloudflare Dashboard → **Workers & Pages**.
2. Go to **Pages**.
3. Open the Pages project (example: `drako-base-3`).
4. Disable automatic deployments:
   - Settings → Builds & deployments → disable Git integration / automatic builds.
5. Remove custom domains from Pages:
   - Settings → Custom domains → remove `drako.systems` and any subdomains.
6. (Recommended) Delete the Pages project if not needed:
   - Settings → Danger zone → Delete project.

Then ensure the Worker has the custom domains attached:

- Workers & Pages → Workers → select the Worker (`drako-base-3`) → Triggers → Custom Domains

## Troubleshooting

- If you see a `pages.dev` URL in production:
  - You are hitting Pages. Stop and remove the Pages custom domain + disable/delete Pages project.

- If build fails with `Cloudflare Pages environment detected`:
  - You are running in Pages CI. Switch to Worker deployment pipeline.
