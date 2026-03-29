# Workers Runtime Decision - P0 Closure

**Date**: 2026-03-29  
**Status**: FINAL DECISION  
**Impact**: Production Runtime Clarity

---

## Summary

Drako Systems uses **OpenNext** as the canonical runtime for SaaS workers (Mentoria, Drakos).

All custom Worker handlers in `packages/shared/` and `workers/*/src/` are **DEAD CODE** and must be archived.

---

## Evidence

### 1. Canonical Runtime: OpenNext

Both production workers point to OpenNext:

- `workers/mentorias/wrangler.workers.toml`: `main = "../../.open-next/worker.js"`
- `workers/drakos/wrangler.workers.toml`: `main = "../../.open-next/worker.js"`

OpenNext is the **only entry point** executed in production.

### 2. Dead Code Files

The following files are **NOT executed** in production:

- `workers/mentorias/src/workers.ts` (exports `createWorkersHandlers` but not used)
- `workers/drakos/src/workers.ts` (exports `createWorkersHandlers` but not used)
- `packages/shared/workers-handlers.ts` (implements `/api/auths/*` routes, dashboards, but not called)

These files implement:
- Auth routes (`/api/auths/logins`, `/api/auths/logouts`, `/api/auths/sessions`)
- Dashboard HTML responses
- Host fencing and session isolation

**None of this code runs in production.** All routing is handled by Next.js via OpenNext.

### 3. Routing Reality

Production routing:
- **Next.js App Router** handles all `/api/*` routes via `src/app/api/*/route.ts`
- **Middleware** (`src/middleware.ts`) handles host resolution, auth checks, rate limiting
- **OpenNext Worker** bridges Next.js to Cloudflare Workers runtime

No custom Worker handlers are invoked.

---

## Decision

### Action: Archive Dead Code

**Status**: APPROVED  
**Effective**: Immediately

#### Files to Archive

Move to `docs/archived/workers-handlers-legacy/`:

1. `workers/mentorias/src/workers.ts`
2. `workers/drakos/src/workers.ts`
3. `packages/shared/workers-handlers.ts`
4. `packages/shared/auths-isolations.ts` (if only used by dead handlers)
5. `packages/shared/hosts-fencings.ts` (if only used by dead handlers)

#### Files to Keep

- `workers/mentorias/wrangler.workers.toml` (production config)
- `workers/drakos/wrangler.workers.toml` (production config)
- `workers/autopilot-worker/` (active: processes queues, AI routing)
- `workers/drako-ai-orchestrator-worker/` (active: AI orchestration)
- `workers/saas-factory-worker/` (active: SaaS provisioning)
- `workers/alerts-agent.ts` (active: monitoring)
- `src/middleware.ts` (active: request routing)
- `src/app/api/*/route.ts` (active: Next.js routes)

---

## Rationale

### Why Archive?

1. **Clarity**: Single source of truth for routing (Next.js + OpenNext)
2. **Maintenance**: No drift between dead code and actual runtime
3. **Testing**: Tests don't mock non-existent handlers
4. **Onboarding**: New developers don't waste time on dead code

### Why Not Delete?

- Preserve history in git
- Reference implementation if custom Worker handlers needed in future
- Audit trail for architecture decisions

---

## Verification

### Pre-Archive Checklist

- [ ] All auth routes (`/api/auths/*`) work via Next.js (not custom handlers)
- [ ] All dashboard routes work via Next.js (not custom handlers)
- [ ] Host fencing enforced by middleware (not custom handlers)
- [ ] Session isolation enforced by Next.js + auth tokens (not custom handlers)

### Post-Archive Checklist

- [ ] CI/CD does not reference archived files
- [ ] No imports from archived files in active code
- [ ] Tests updated to remove mocks of dead handlers
- [ ] Documentation updated to reflect OpenNext as canonical runtime

---

## Impact on P0 Closure

**This decision does NOT block P0 closure.**

- Family DB unification: ✅ Complete (DRACO_DB)
- AI kill-switch: ✅ Complete (AI_HARD_OFF)
- Worker runtime clarity: ✅ Complete (OpenNext canonical)
- Secrets verification: ⏳ Pending

---

## Next Steps (P1+)

1. Move files to `docs/archived/workers-handlers-legacy/`
2. Update CI/CD to exclude archived directory
3. Add linter rule: fail if imports from archived files
4. Update onboarding docs to reference OpenNext architecture
5. Remove mocks of dead handlers from tests
