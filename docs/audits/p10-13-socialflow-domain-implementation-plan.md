# P10.13 SocialFlow Domain Implementation Plan

Date: 2026-05-04  
Scope: technical plan only  
Change class: no-op implementation plan; no Cloudflare, worker, workflow, middleware, OAuth runtime, route or data mutation

## Goal

Prepare a safe future implementation plan for `socialflow.drako.systems` as the canonical SocialFlow product domain, while keeping `socialflows.drako.systems` as compatibility/legacy until validated.

## Validation Baseline

| Check | Result | Notes |
|---|---|---|
| `git status --short` | PASS_WITH_EXISTING_DOCS | Worktree already contains documentation changes from P10.11/P10.12. |
| `pnpm typecheck` | PASS | Completed before P10.13 documentation edits. |
| `pnpm lint` | PASS | 0 errors; existing warnings remain. |
| `pnpm test` | PASS | Full Vitest suite passed; expected fail-closed stderr remains. |
| `pnpm build` | PASS | Next build completed. |

## Current State Audit

| Elemento | Estado actual | Riesgo | Accion futura |
|---|---|---|---|
| ADR P10.12 | `docs/decisions/adr-socialflow-canonical-domain.md` accepts `socialflow.drako.systems` as future canonical and `socialflows.drako.systems` as compat/legacy. | Decision exists, but no implementation yet. | Use ADR as source of truth for future Cloudflare/workflow/readiness changes. |
| Current worker domain | `workers/socialflows/wrangler.workers.toml` has `pattern = "socialflows.drako.systems"` and `custom_domain = true`. | Plural remains operational primary in local config. | Add singular custom domain only in a future Cloudflare/config phase. |
| Worker identity | `workers/socialflows/wrangler.workers.toml` and `workers/socialflows/src/workers.ts` identify `saas-socialflows-prod`. | Worker exists, but is not included in canonical deploy workflow. | Confirm worker before domain attach; add deploy/smoke path later. |
| Singular domain | No local worker/domain config confirms `socialflow.drako.systems`. | Canonical domain absent. | Create/attach in Cloudflare only after phase approval. |
| Product routes | P10.11 and matrix identify `/socialflow/*`, `/api/socialflow/*`, `/socialflow/auth`, `/api/socialflow/auths/*`. | Domain switch must preserve singular route assumptions. | Smoke these paths on canonical host before marking sellable. |
| Legacy Social API | `/api/social/*` root is permanently disabled; `/api/social/posts` and `/api/social/linkedin/publish` must stay `410`. | Domain work could accidentally revive legacy routes. | Include legacy 410 checks in smoke/readiness. |
| LinkedIn canonical routes | `/api/socialflow/linkedin/connect` and `/api/socialflow/linkedin/callback` execute canonical OAuth flow. | OAuth redirect URI depends on request origin and authorized callback registration. | Register canonical callback in LinkedIn developer console before live switch. |
| LinkedIn bridges | `/api/social/linkedin/connect`, `/api/social/linkedin/callback`, `/auth/linkedin/callback` redirect `308` to canonical SocialFlow routes. | Removing bridges too early breaks existing OAuth apps/callbacks. | Keep bridges through a compatibility window. |
| Auth host helpers | `src/lib/auths/contexts.ts` and `src/lib/auths/origin.ts` already recognize `socialflow.drako.systems`. | Helper support does not equal deployed domain ownership. | Verify behavior through real host smoke after domain attach. |
| Production readiness expected state | `docs/config/production-audits-expected-state.json` has no SocialFlow critical hostname. | Readiness does not fail if singular domain is absent. | Add phase-gated expected-state after domain exists or a cutover flag is active. |
| Hostnames drift evidence | `docs/audits/hostnames-drift-latest.md` includes `socialflows.drako.systems -> saas-socialflows-prod` as blocked-service PASS. | Plural is visible, singular is not protected. | Add singular ownership checks in future readiness/hostnames drift. |
| Canonical workflow | `.github/workflows/drako-factory-deploy.yml` deploys scheduler, Drako, Mentoria and Base, not SocialFlow. | SocialFlow deploy not reproducible through canonical product workflow. | Add SocialFlow deploy/smoke job or product workflow after planning. |
| Root configs | `wrangler.jsonc` and root `wrangler.workers.toml` are not canonical SocialFlow domain owners. | Updating root configs could revive legacy deployment confusion. | Keep SocialFlow domain implementation in `workers/socialflows` and Cloudflare expected-state. |

## Future Cloudflare Custom Domain Plan

| Paso | Accion | Riesgo | Validacion |
|---|---|---|---|
| 1 | Confirm `saas-socialflows-prod` exists and current `socialflows.drako.systems` ownership is healthy. | Attaching canonical domain to wrong worker. | Cloudflare worker/domain read-only audit shows `socialflows.drako.systems -> saas-socialflows-prod`. |
| 2 | Add custom domain `socialflow.drako.systems` to `saas-socialflows-prod`. | DNS/certificate pending or wrong service binding. | Cloudflare Custom Domains shows active certificate and service `saas-socialflows-prod`. |
| 3 | Confirm SSL/certificate status is active before traffic/smoke claims. | Browser/OAuth failures from TLS not ready. | HTTPS GET and certificate inspection pass. |
| 4 | Add hostname/readiness expected-state for `socialflow.drako.systems -> saas-socialflows-prod`. | Readiness can block too early if added before domain exists. | Phase-gate check or add only after domain attach completes. |
| 5 | Keep `socialflows.drako.systems` attached during compatibility window. | Breaking existing bookmarks, callbacks or worker smoke scripts. | Both hosts respond; plural is marked compat, not primary. |
| 6 | Decide compatibility mode: `308` redirect to singular or temporary bridge. | Permanent redirect can break OAuth/state if LinkedIn still posts back to plural/legacy callback. | Choose bridge first if OAuth callbacks are not fully migrated. |
| 7 | Do not remove plural domain until canonical host passes sustained smokes. | Irreversible traffic/customer breakage. | Smoke history green for agreed retention window. |

## Future Routing And App Plan

### `socialflow.drako.systems`

- `/` should either serve the SocialFlow landing/workspace or redirect to `/socialflow`.
- `/socialflow/*` must work as the canonical product surface.
- `/socialflow/auth` must work as the canonical auth UI.
- `/api/socialflow/*` must work as the canonical runtime/API surface.
- `/api/socialflow/auths/*` must preserve current auth context behavior.
- `/api/social/*` legacy surfaces must remain disabled or redirect-only where already defined.
- `/api/social/posts` must continue returning `410`.
- `/api/social/linkedin/publish` must continue returning `410`.
- `/api/social/linkedin/connect`, `/api/social/linkedin/callback` and `/auth/linkedin/callback` must remain `308` bridges until OAuth compatibility is closed.

### `socialflows.drako.systems`

- Keep as compatibility/legacy host after singular domain exists.
- Do not present it as the primary product domain in docs, sales, onboarding or smoke names.
- Prefer a temporary bridge while OAuth and customer traffic are observed.
- Move to `308` redirect only after canonical smoke/OAuth evidence is stable.
- Do not remove from Cloudflare until retention, analytics and rollback windows are complete.

## Future OAuth LinkedIn Plan

| Area | Current evidence | Future requirement |
|---|---|---|
| Canonical connect | `/api/socialflow/linkedin/connect` builds LinkedIn authorization URL. | Smoke that `redirect_uri` points to `https://socialflow.drako.systems/api/socialflow/linkedin/callback` on canonical host. |
| Canonical callback | `/api/socialflow/linkedin/callback` handles token exchange and redirects to SocialFlow settings. | Add `https://socialflow.drako.systems/api/socialflow/linkedin/callback` in LinkedIn developer console before live traffic. |
| Legacy API callback | `/api/social/linkedin/callback` redirects `308` to `/api/socialflow/linkedin/callback`. | Keep until LinkedIn and customer callbacks no longer use legacy path. |
| Legacy auth callback | `/auth/linkedin/callback` redirects `308` to `/api/socialflow/linkedin/callback`. | Keep as a safety bridge through migration window. |
| Callback origin resolution | OAuth diagnostics derive callback origin from forwarded host/origin/request URL, with env fallback. | Verify Cloudflare forwards host/proto such that canonical callback URL is generated under singular host. |
| LinkedIn app config | Unknown from local repo. | Add canonical callback while retaining plural/legacy callbacks until smokes prove safe. |
| Failure mode | Redirect URI mismatch invalidates OAuth code exchange. | Treat LinkedIn callback registration as a pre-cutover blocker. |

## Future Workflow And Smoke Plan

### Minimum Smoke Coverage

| Smoke | Expected result | Notes |
|---|---|---|
| `GET https://socialflow.drako.systems/` | `200` or controlled redirect to `/socialflow` | Decide expected root behavior before implementation. |
| `GET https://socialflow.drako.systems/socialflow` | `200` or auth-aware product response | Must not redirect to Drako/Base/Mentoria hosts. |
| `GET https://socialflow.drako.systems/api/socialflow/profile` or safe equivalent | `200`, `401` or controlled auth response | Use a stable endpoint; avoid mutating APIs. |
| `GET https://socialflow.drako.systems/socialflow/auth` | `200` | Confirms auth UI under canonical host. |
| `GET https://socialflow.drako.systems/api/social/posts` | `410` | Legacy route remains blocked. |
| `GET https://socialflow.drako.systems/api/social/linkedin/publish` | `410` | Legacy publish remains blocked. |
| `GET https://socialflow.drako.systems/api/socialflow/linkedin/connect?saasId=...` | `307` to LinkedIn with canonical `redirect_uri` | Requires safe test credentials or non-secret URL inspection. |
| `GET https://socialflow.drako.systems/api/social/linkedin/connect?saasId=...` | `308` to canonical route | Confirms bridge only. |
| `GET https://socialflows.drako.systems/socialflow` | Compat behavior | Bridge or redirect must be intentional. |
| `GET https://socialflow.drako.systems/operator/socialflow` | Not publicly exposed without auth | Operator surface must not become public product surface. |

### Future Readiness Checks

- Add hostname ownership: `socialflow.drako.systems -> saas-socialflows-prod`.
- Keep compatibility hostname visibility: `socialflows.drako.systems -> saas-socialflows-prod` or explicit compat state.
- Block if singular hostname is missing once the domain phase is active.
- Warn if plural remains primary in config/docs after canonical switch.
- Warn/block if SocialFlow critical host points to `drako-base-3` or any non-SocialFlow worker.
- Add smoke workflow for canonical host before declaring independent SaaS readiness.
- Keep P10.8 `SOCIALFLOW_AUTHS_DB` guardrails separate from domain activation; domain readiness does not prove auth DB physical split.

### P10.14 Follow-up (Implemented Guardrails)

- Production readiness now includes phase-gated checks for canonical SocialFlow domain expected-state.
- Phase gate source of truth is `docs/config/production-audits-expected-state.json` under `phaseGates.socialflowCanonicalDomain`.
- Current default remains `active: false`, so missing `socialflow.drako.systems` is warning debt and does not block readiness.
- When switched to `active: true`, missing canonical hostname, wrong worker ownership, and missing canonical smoke evidence become blockers.
- Compatibility hostname `socialflows.drako.systems` is tracked as a warning if it appears to remain primary before canonical health is established.

### P10.15 Follow-up (Prepared Canonical Smoke, Not Activated)

- Added safe manual smoke script: `scripts/smoke/socialflow-canonical-domain-smoke.mjs`.
- Added runbook: `docs/runbooks/socialflow-canonical-domain-smoke.md`.
- Script is no-op by default and only runs HTTP checks when:
  - `SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1`
  - `SOCIALFLOW_CANONICAL_HOST` is explicitly provided.
- Expected-state smoke evidence now points to the script/runbook, without activating phase gate.
- No Cloudflare, worker, middleware, runtime, OAuth code, or production mutation is performed in this preparation.

### P10.16 Follow-up (Cloudflare Operation Runbook, Not Executed)

- Added manual Cloudflare checklist: `docs/runbooks/socialflow-canonical-domain-cloudflare-checklist.md`.
- The checklist defines preconditions, custom domain steps, HTTP validation, smoke execution, OAuth warnings, rollback, success criteria and stop criteria.
- It explicitly keeps `phaseGates.socialflowCanonicalDomain.active: false` until a later readiness activation phase.
- No Cloudflare, DNS, worker, middleware, runtime, OAuth code, LinkedIn callback, data or deploy action is performed by this documentation step.

### P10.17 Follow-up (Host Fencing Canonical Fix)

- Host fencing now reads `SAASES_DOMAIN` as an explicit allowed-host list (comma/space/newline separators).
- Canonical `socialflow.drako.systems` is accepted together with compatibility `socialflows.drako.systems` when both are configured.
- Host normalization now handles protocol, trailing slash and spacing noise safely.
- Wildcards are explicitly ignored (fail-closed).

## Phased Implementation Plan

### Phase A - Readiness Expected-State

- Add phase-gated expected-state entry for `socialflow.drako.systems`.
- Decide whether to gate by explicit phase flag or only merge after Cloudflare domain exists.
- Add fixtures/tests for singular missing, wrong worker and plural-primary warning.

### Phase B - Cloudflare Custom Domain

- Add `socialflow.drako.systems` to `saas-socialflows-prod`.
- Confirm SSL/certificate and worker ownership.
- Do not remove `socialflows.drako.systems`.

### Phase C - App/Routing Compatibility

- Decide root behavior for canonical host: `/` -> `/socialflow` redirect or direct SocialFlow landing.
- Preserve `/socialflow/*`, `/api/socialflow/*` and auth surfaces.
- Keep `/api/social/*` disabled/bridge-only as currently defined.

### Phase D - OAuth LinkedIn Callback Registration

- Add `https://socialflow.drako.systems/api/socialflow/linkedin/callback` to LinkedIn allowed redirect URLs.
- Keep old callback URLs during the compatibility window.
- Confirm generated `redirect_uri` from canonical host.

### Phase E - Smoke Tests

- Add smoke job for canonical host and compatibility host.
- Include OAuth connect URL inspection and legacy 410 checks.
- Include anti-cross-domain redirects.

### Phase F - Switch Canonical Docs/Links

- Update public docs, sales, onboarding links and operator references to singular domain only after smokes pass.
- Keep internal docs noting plural compat until cleanup.

### Phase G - Plural Compat Redirect

- Move `socialflows.drako.systems` from bridge/primary behavior to controlled redirect only after retention criteria are met.
- Avoid redirecting OAuth callbacks until LinkedIn config and telemetry prove no old callbacks remain.

### Phase H - Cleanup Legacy

- Remove plural primary references from configs/docs/workflows when safe.
- Keep or remove plural domain based on retention, analytics and support policy.
- Record final evidence in a closure audit.

## Non-Goals Confirmed

- No Cloudflare changes.
- No domain creation.
- No worker changes.
- No workflow changes.
- No middleware changes.
- No runtime route changes.
- No OAuth code changes.
- No SocialFlow internals changes.
- No Mentoria changes.
- No apps changes.
- No DB creation or data migration.

## Result

The future implementation path for `socialflow.drako.systems` is defined with Cloudflare, routing, OAuth, smoke, readiness and compatibility controls. Execution remains deferred.

---

## P10.20 Update (2026-05-07)

**Status:** Config fix applied in repo. Deploy pending.

The `wrangler.workers.toml` for `workers/socialflows` now declares both custom domains:

```toml
[[routes]]
pattern = "socialflows.drako.systems"
custom_domain = true

[[routes]]
pattern = "socialflow.drako.systems"
custom_domain = true
```

This prevents Wrangler from stripping the canonical custom domain on deploy (issue discovered in P10.19 where the deploy caused NXDOMAIN for `socialflow.drako.systems`).

Host fencing logic (`parseAllowedHostNames`) was already correct and requires no code changes. The `SAASES_DOMAIN` var already contains both hosts comma-separated.

Next: deploy with corrected config (P10.21).

---

## P10.24 Update (2026-05-07)

**Status:** Phase gate activated. Production readiness now enforces canonical domain.

After completing P10.20 (config fix), P10.21 (controlled deploy), P10.22 (smoke with Origin header), and P10.23 (workflow integration), the `socialflowCanonicalDomain` phase gate has been activated:

- `docs/config/production-audits-expected-state.json`: `phaseGates.socialflowCanonicalDomain.active` changed from `false` to `true`.
- Production readiness checks now treat missing `socialflow.drako.systems` as **BLOCKER** (previously WARN).
- Worker ownership validation enforces `saas-socialflows-prod` as **BLOCKER**.
- Smoke evidence validation enforces presence of canonical smoke script/runbook as **BLOCKER**.
- Fixture updated to include both `socialflow.drako.systems` and `socialflows.drako.systems` pointing to `saas-socialflows-prod`.

The canonical domain is now a production readiness requirement. The compatibility domain `socialflows.drako.systems` remains operational with controlled warning for plural-as-primary state.
