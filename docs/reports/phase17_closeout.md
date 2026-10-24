# Phase 17: Multi-Env Release Discipline & Control Plane

**Status:** ✅ CLOSED
**Date:** 2026-02-09
**Outcome:** Stable Release Pipeline with Governance.

## Achievements
1.  **Governance Script (`scripts/deploy.js`)**:
    - Enforces environment validation (preview, staging, production).
    - Swaps `wrangler.toml` (Worker config) with `wrangler.pages.toml` (Pages config) automatically.
    - Generates traceable `release_id`.
    - Logs releases to `release_log.jsonl`.
    - Supports `SKIP_BUILD=true` for rapid iteration.

2.  **Environments Defined**:
    - **Preview:** `npm run deploy:preview` -> `https://preview.drako-base-3.pages.dev`
    - **Staging:** `npm run deploy:staging` -> `https://staging.drako-base-3.pages.dev` (Project alias)
    - **Production:** `npm run deploy:production` -> Canonical URL

3.  **Rollback Capability**:
    - Native Cloudflare Pages Rollback via Deployment ID.
    - Command: `npx wrangler pages deployment rollback --project-name drako-base-3`

4.  **Control Plane**:
    - Migration `0060_release_governance.sql` created for future Db logging.
    - `/api/health/release` endpoint implemented (reads build-time env vars).

## Evidence
- **Preview Deployment:** [SUCCESS](https://preview.drako-base-3.pages.dev)
- **Deployment List:** Verified via CLI.

## Next Steps (Phase 18)
- Expand Control Plane to use D1 for release tracking.
- Automate "Staging -> Production" promotion gate.
