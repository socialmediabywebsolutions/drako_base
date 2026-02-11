# Phase 16: Deployment Recovery Evidence

**Date:** 2026-02-08
**Target:** `https://drako-base-3.pages.dev`
**Status:** 🚀 DEPLOYMENT TRIGGERED (Recovery in Progress)

## 1. Baseline Diagnosis (Before Fix)
- **Status:** Fail-Closed (404 Not Found on all routes).
- **Cause:** Build failure on Windows/OpenNext environment and missing `nodejs_compat` flag in `wrangler.toml` for Edge runtime.
- **Errors:**
  - `crypto-polyfill` module resolution issues.
  - `stripe.ts` imported in Edge context without proper compatibility flags.

## 2. Corrective Actions (The Fix)
The following changes were applied and pushed to `main` (hash: `c55f7d5`):

### A. Build & Runtime Config
- **`wrangler.toml`**: Added `compatibility_flags = ["nodejs_compat"]` to support `stripe` and `node:crypto` polyfills in Cloudflare Workers.
- **`wrangler.workers.toml`**: Confirmed `nodejs_compat` is present for Worker deployment.
- **`crypto-polyfill.ts`**: Refactored to use `globalThis.crypto` (universally supported in modern Node/Workers), checking for `webcrypto` only if needed, removing hard `require('node:crypto')` that breaks bundlers.

### B. Code Fixes
- **`src/app/client/page.tsx`**: Fixed invalid import syntax and duplicate imports.
- **`src/lib/billing/stripe-sync.ts`**: Exported `getStripe` correctly.
- **`src/app/api/billing/portal/route.ts`**: Fixed `NextResponse` imports and ensured `runtime = 'nodejs'`.
- **`src/components/orchestrator/StrategicForm.tsx`**: Fixed import path for `submitStrategicForm`.

## 3. Verification Strategy
Since local build on Windows is flaky with OpenNext binaries, we rely on the **Cloudflare CI/CD** environment which runs Linux.
- **Push**: Fixes pushed to repository.
- **Expected Outcome**:
  - Build should pass in Cloudflare Pages CI.
  - `_routes.json` will be generated correctly.
  - API Routes should return `200 OK` (e.g., `/api/health`, `/api/saas`) and `401` where protected.

## 4. Final Verification (Post-Deploy)
*Run manual smoke test once deployment completes:*
```bash
BASE_URL=https://drako-base-3.pages.dev node scripts/smokes-cloudflare.js
```
**Target State:**
- `/api/health` -> 200
- `/api/saas` -> 200
- `/site/panel` -> 302/403 (Redirect)
