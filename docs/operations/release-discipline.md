# Release Discipline & Governance

**Objective:** Establish a deterministic, traceable, and reversible deployment process for Drako Systems.

## Environments

### 1. Preview
- **Purpose:** Pull Request validation and experimental feature testing.
- **Trigger:** Manual via `npm run deploy:preview`.
- **Method:** `wrangler pages deploy --branch preview`
- **URL Pattern:** `https://preview.drako-base-3.pages.dev` (or hash-based)
- **Data:** Mock or Sandbox D1.

### 2. Staging
- **Purpose:** Pre-production verification and integration testing.
- **Trigger:** Manual via `npm run deploy:staging`.
- **Method:** `wrangler pages deploy --project-name drako-staging`
- **URL Pattern:** `https://staging.drako-base-3.pages.dev`
- **Data:** Staging D1 (Clone of Prod schema, sanitized data).

### 3. Production (Canonical)
- **Purpose:** Live user traffic.
- **Trigger:** Governance Script via `npm run deploy:production`.
- **Method:** Direct Upload (`wrangler pages deploy`).
- **Pre-requisites:**
  - Health Check OK
  - Smoke Tests PASS
  - Worker Artifact Verified
- **Data:** Production D1 (`drako_db_prod`).

## Governance Logic
Every production release must be recorded with:
- `release_id` (UUID)
- `commit_hash` (Git Short SHA)
- `timestamp` (ISO 8601)
- `actor` (Deployer)

## Rollback Protocol
**Command:** `npm run rollback:production`
**Logic:**
1. Identify last stable deployment ID from Cloudflare history.
2. Revert alias to that deployment.
3. Verify `/api/health` returns previous version.

## Verification
All deployments must pass the standard smoke suite:
`node scripts/smokes-cloudflare.js`
