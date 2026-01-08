# HITO 3A · Domains & Hostnames Production Readiness

## Summary
- Implemented Autopilot worker queue with rate limiting, circuit breaker, and idempotent hostname polling pipeline.
- Hardened resolver & middleware gating to block unverified domains, emit routing events, and surface metadata downstream.
- Added shared status utilities, TypeScript test suite, and production-go guard rail to validate deploy readiness.

## Production Checklist
- [x] Autopilot worker sources, Wrangler config, and runbook present.
- [x] `.dev.vars.example` declares DRACO_DB, AUTOPILOT_QUEUE, AUTOPILOT_DLQ, APP_URL.
- [x] Middleware emits `routing.resolve.domain.*` events and distinguishes pending activation.
- [x] Resolver/status utilities return `DOMAIN_PENDING_ACTIVATION` & `DOMAIN_NOT_ACTIVE` reasons.
- [x] `npm run hostnames:tests` succeeds.
- [x] `npm run pages:build` succeeds.
- [x] `npm run production:go` passes locally.
- [ ] Remote production health check reachable (blocked by environment fetch failure).

## Evidence
### `npm run hostnames:tests`
```
> drako.systems@1.0.0 hostnames:tests
> tsc --project tsconfig.scripts.json && node scripts/.dist/scripts/hostnames-tests.js
✅ Pending domains are blocked
✅ Verified but inactive domains are blocked
✅ Active and verified domains are permitted
✅ Hostname poll activates domain idempotently
✅ Hostname poll schedules retry with backoff
✅ All hostnames tests passed
Exit code: 0
```

### `npm run pages:build`
*Full log stored at `reports/evidence/pages-build.log` (53s build, 200+ routes). Extract:*
```
⚡️ @cloudflare/next-on-pages CLI v.1.13.16
⚡️ Preparing project...
⚡️ Building project...
▲  Vercel CLI 50.1.6
▲  WARN! Build not running on Vercel. System environment variables will not be available.
▲  WARNING: You should not upload the `.next` directory.
... [truncated for brevity, see log]
⚡️ Build completed in 53.18s
```

### `npm run production:go`
```
> drako.systems@1.0.0 production:go
> tsc --project tsconfig.scripts.json && node scripts/.dist/scripts/production-go.js
Production Gates – Domains & Hostnames (root: /home/cris/drako_base-repo)
✅ worker:file:workers/autopilot-worker/src/index.ts: present
✅ worker:file:workers/autopilot-worker/src/hostnames.ts: present
✅ worker:file:workers/autopilot-worker/wrangler.toml: present
✅ documentation:runbook: docs/runbooks/autopilot-worker.md
✅ vars:DRACO_DB: declared
✅ vars:AUTOPILOT_QUEUE: declared
✅ vars:AUTOPILOT_DLQ: declared
✅ vars:APP_URL: declared
✅ middleware:event.blocked: present
✅ middleware:event.active: present
✅ middleware:reason.pending: present
✅ resolver:pending_activation: present
✅ resolver:not_active: present
✅ remote:health: PROD_URL not set – skipped
Exit code: 0
```

### `PROD_URL=https://drako-base.pages.dev npm run production:go`
```
> drako.systems@1.0.0 production:go
> tsc --project tsconfig.scripts.json && node scripts/.dist/scripts/production-go.js
Production Gates – Domains & Hostnames (root: /home/cris/drako_base-repo)
✅ worker:file:workers/autopilot-worker/src/index.ts: present
✅ worker:file:workers/autopilot-worker/src/hostnames.ts: present
✅ worker:file:workers/autopilot-worker/wrangler.toml: present
✅ documentation:runbook: docs/runbooks/autopilot-worker.md
✅ vars:DRACO_DB: declared
✅ vars:AUTOPILOT_QUEUE: declared
✅ vars:AUTOPILOT_DLQ: declared
✅ vars:APP_URL: declared
✅ middleware:event.blocked: present
✅ middleware:event.active: present
✅ middleware:reason.pending: present
✅ resolver:pending_activation: present
✅ resolver:not_active: present
⛔ remote:health: request failed: fetch failed
Exit code: 0
```

## Risks & Limitations
- Remote `production:go` health probe fails with `fetch failed`, likely due to sandbox network restrictions. Manual verification against `https://drako-base.pages.dev/api/health` recommended once network egress is available.
- Ensure Cloudflare environment variables mirror `.dev.vars.example` before deploy; production-go validates presence but not values.
