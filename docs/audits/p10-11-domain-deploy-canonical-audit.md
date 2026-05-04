# P10.11 Domain And Deploy Canonical Audit

Date: 2026-05-04  
Scope: documentation audit only  
Change class: read-only architecture evidence; no runtime/config/Cloudflare mutation

## Goal

Audit whether domains, workers, routes, bindings and deploy workflows are aligned with the real product split before selling SocialFlow or Mentoria as independent SaaS products.

## Validation Baseline

| Check | Result | Notes |
|---|---|---|
| `git status --short` | PASS | Clean worktree before audit changes. |
| `pnpm typecheck` | PASS | Completed before documentation edits. |
| `pnpm lint` | PASS | 0 errors; existing warnings remain. |
| `pnpm test` | PASS | Full Vitest suite passed. |
| `pnpm build` | PASS | Next build completed. |

## Initial Config Inventory

| Archivo | Dominio/ruta/worker | Estado | Riesgo | Accion recomendada |
|---|---|---|---|---|
| `workers/drakos/wrangler.workers.toml` | `saas-drakos-prod`; `drako.systems`, `drakos.drako.systems`; `DRACO_DB`, `DRAKOS_AUTHS_DB` -> `drako_db_prod` | ACTIVE_MARKETING | Drako auth still physically shares `DRACO_DB`, expected for current auth architecture but not fully isolated. | Keep as brand/root canonical; do not route back to `drako-base-3`. |
| `workers/bases/wrangler.workers.toml` | `saas-bases-prod`; `base.drako.systems`, `bases.drako.systems`; `BASES_AUTHS_DB` -> `drako_db_prod` | ACTIVE_OPERATOR | Operator/control plane shares canonical DB/auth DB identity by design today. | Keep private/operator posture; harden exposure and auth before wider access. |
| `workers/mentorias/wrangler.workers.toml` | `saas-mentorias-prod`; `mentoria.drako.systems`, `mentorias.drako.systems`; no `MENTORIA_DB`; `MENTORIAS_AUTHS_DB` -> `drako_db_prod` | ACTIVE_PRODUCTIVE | Product DB and auth DB are physically coupled to `DRACO_DB`; workflow also applies Mentoria hotfix to `DRACO_DB`. | Complete P10.9/P10.10 future split before selling as independent DB-bound SaaS. |
| `workers/socialflows/wrangler.workers.toml` | `saas-socialflows-prod`; `socialflows.drako.systems`; `SOCIAL_DB` -> `saas_socialflows_prod_db`; no singular domain found | ACTIVE_PRODUCTIVE | Product DB is dedicated, but SocialFlow auth split is not visible in worker config and singular canonical domain is absent. | Add explicit sales-domain plan and include SocialFlow in canonical deploy/smoke workflow. |
| `wrangler.workers.toml` | root legacy `drako-base-3`; production/preview envs; `NEXTAUTH_URL=https://drako.systems` | LEGACY_ARCHIVED | Legacy root config still contains broad bindings and can confuse deploy ownership. | Keep blocked/archived; continue relying on workers/drakos/bases/mentorias deploy configs. |
| `workers/drako-base-3-shims/wrangler.workers.toml` | `drako-base-3` shim with service bindings, no public domains in local config | LEGACY_ARCHIVED | Should not own critical hostnames. | Keep blocked by hostname/readiness drift gates. |
| `.github/workflows/drako-factory-deploy.yml` | Canonical build/deploy; deploys scheduler -> drakos -> mentorias -> bases; smokes `drako.systems`, `mentorias.drako.systems`, `bases.drako.systems` | ACTIVE_CANONICAL | SocialFlow is not deployed/smoked in this canonical workflow; Mentoria hotfix migrates production `DRACO_DB`. | Split per-product deploy phases and remove DB hotfix pattern before SaaS sale. |
| `.github/workflows/build-worker.yml` | Manual legacy deploy through root `wrangler.workers.toml --env production` | LEGACY_RISK | Deploys archived root path and only smokes `drako.systems`; conflicts with canonical scripts that block root deploy. | Archive or replace with canonical P10 workflow. |
| `.github/workflows/deploy-multi-saas-workers.yml` | Explicitly archived and exits 1 | LEGACY_ARCHIVED | Low; intentionally blocked. | Leave blocked or remove after audit retention window. |
| `.github/workflows/dks-cron-runbook.yaml` | Cron checks plus `https://drako.group/api/status.json` snapshot | UNKNOWN | References `drako.group`, outside current `drako.systems` product map. | Classify as monitoring legacy/external before relying on it. |
| `docs/config/production-audits-expected-state.json` | Expects `drako.systems` -> `saas-drakos-prod`, base/bases -> `saas-bases-prod`, mentoria/mentorias -> `saas-mentorias-prod` | ACTIVE_POLICY | SocialFlow is not a critical hostname in production readiness expected state. | Add SocialFlow critical hostname when sales/deploy ownership becomes required. |
| `docs/audits/hostnames-drift-latest.md` | Confirms critical hostnames pass; warns `drako.systems/*` route missing; blocks `drako-base-3` | ACTIVE_EVIDENCE | Custom domain ownership passes, but route-based evidence is missing for `drako.systems/*`. | Treat as warning until Cloudflare custom-domain policy is normalized. |

## Domain To Worker Map

| Dominio | Worker esperado | Worker configurado/evidencia local | Canonico/compat/legacy | Riesgo |
|---|---|---|---|---|
| `drako.systems` | `saas-drakos-prod` | `workers/drakos/wrangler.workers.toml`; expected-state; hostnames drift PASS | Canonico marca | `drako.systems/*` route missing WARN in hostnames drift latest, likely custom-domain model. |
| `www.drako.systems` | No local canonical worker found | Mentioned only in older deploy docs, not active wrangler expected state | Legacy/unknown | Could create DNS/docs ambiguity if still configured outside repo. |
| `drakos.drako.systems` | `saas-drakos-prod` | `workers/drakos/wrangler.workers.toml`; expected-state; hostnames drift PASS | Compat/context | Useful alias; not public brand primary. |
| `base.drako.systems` | `saas-bases-prod` | `workers/bases/wrangler.workers.toml`; expected-state; hostnames drift PASS | Canonico operator/private | Naming singular vs plural mixed; docs must keep operator boundary clear. |
| `bases.drako.systems` | `saas-bases-prod` | `workers/bases/wrangler.workers.toml`; expected-state; hostnames drift PASS | Compat/operator | Can confuse Campamento Base public/private posture. |
| `mentoria.drako.systems` | `saas-mentorias-prod` | `workers/mentorias/wrangler.workers.toml`; expected-state; hostnames drift PASS | Canonico esperado Mentoria | Product DB still falls back to `DRACO_DB`; not own-domain SaaS ready. |
| `mentorias.drako.systems` | `saas-mentorias-prod` | `workers/mentorias/wrangler.workers.toml`; expected-state; workflow smoke uses plural | Compat/current smoke | Plural/singular split can confuse customers and smokes. |
| `socialflow.drako.systems` | Future `saas-socialflows-prod` if singular is adopted | No local config/evidence found | Missing canonical candidate | P1 naming blocker for sale under product-friendly singular domain. |
| `socialflows.drako.systems` | `saas-socialflows-prod` | `workers/socialflows/wrangler.workers.toml`, `workers/socialflows/src/workers.ts`, worker drift docs | Current plural domain | Not in canonical deploy workflow or critical hostname policy. |
| `analytics.drako.systems` | `saas-analytics-prod` | `workers/analytics/wrangler.workers.toml` | Stub/template-like | Not a declared public SaaS in target architecture. |
| `automations.drako.systems` | `saas-automations-prod` | `workers/automations/wrangler.workers.toml` | Stub/template-like | Not a declared public SaaS in target architecture. |
| `cryptos.drako.systems` | `saas-cryptos-prod` | `workers/cryptos/wrangler.workers.toml` | Stub/template-like | Not a declared public SaaS in target architecture. |
| `invoices.drako.systems` | `saas-invoices-prod` | `workers/invoices/wrangler.workers.toml` | Stub/template-like | Not a declared public SaaS in target architecture. |

## Product To Routes Map

| Producto | Ruta canonica | Deploy/worker | Estado | Riesgo |
|---|---|---|---|---|
| Drako | `/`, `/site/*`, marketing, `/products/*` | `saas-drakos-prod` via OpenNext worker | ACTIVE_MARKETING | Older docs mention `drako-base-3`/Pages; keep deprecation visible. |
| Campamento Base | `/operator/*`, `/api/operator/*`, compat `/bases/*`, `/api/bases/*`, `/campobase/*`, `/api/campobase/*` | `saas-bases-prod` for operator domains; same OpenNext artifact | ACTIVE_OPERATOR | Operator surface is public-domain reachable and must remain auth/fence protected. |
| Mentoria | `/mentoria/*`, `/api/mentoria/*`, `/mentorias/auths/*`, `/api/mentorias/auths/*` | `saas-mentorias-prod` | ACTIVE_PRODUCTIVE | Product/runtime DB not physically independent; singular/plural smoke mismatch. |
| SocialFlow | `/socialflow/*`, `/api/socialflow/*`, `/socialflow/auth`, `/api/socialflow/auths/*`, `/api/social/*` legacy bridge/410 posture | `saas-socialflows-prod` config exists; not in canonical workflow | ACTIVE_PRODUCTIVE_UNCANONICAL_DEPLOY | Product cannot be sold under own domain until deploy, hostname policy, auth DB and smoke story are canonical. |
| Factory | `/api/factory/*`, `/api/owner/factory/*`, compat `/api/owner/saas-factory/*` | Root/OpenNext plus `saas-factory-worker`/provisioner workers | ACTIVE_CAPABILITY | Factory is internal capability, not final public product. |

## Workflow Audit

| Workflow | Que despliega | Worker/dominio | Riesgo | Accion |
|---|---|---|---|---|
| `.github/workflows/drako-factory-deploy.yml` | Gates, OpenNext build, scheduler, `saas-drakos-prod`, `saas-mentorias-prod`, `saas-bases-prod`; smokes Drako/Mentoria/Base | `drako.systems`, `mentorias.drako.systems`, `bases.drako.systems` | P1: excludes SocialFlow; P1: applies `0160_mentoria_session_persistence.sql` to production `DRACO_DB`. | Split deploy matrix by product and remove one-off DB mutation before independent SaaS sale. |
| `.github/workflows/build-worker.yml` | Manual build plus dependency workers and root `wrangler.workers.toml --env production` | Legacy `drako-base-3` root path; smokes `drako.systems` | P1: conflicts with archived root deploy posture. | Archive or rewrite to call canonical workflow only. |
| `.github/workflows/deploy-multi-saas-workers.yml` | Nothing; intentionally blocked | N/A | Low; explicit archive gate exits 1. | Keep blocked. |
| `.github/workflows/dks-cron-runbook.yaml` | Alerts scripts, draft cleanup, remote snapshot from `drako.group` | Monitoring/runbook only | P2: domain outside current map. | Classify `drako.group` monitoring ownership. |

## Workers Productive Vs Stub

| Worker folder | Tiene runtime real | Tiene wrangler | Dominios | DB/bindings | Estado |
|---|---|---|---|---|---|
| `workers/drakos` | OpenNext artifact | Yes | `drako.systems`, `drakos.drako.systems` | `DRACO_DB`, `DRAKOS_AUTHS_DB`, queues, scheduler | ACTIVE_MARKETING |
| `workers/bases` | OpenNext artifact | Yes | `base.drako.systems`, `bases.drako.systems` | `DRACO_DB`, `BASES_AUTHS_DB`, queues, scheduler | ACTIVE_OPERATOR |
| `workers/mentorias` | OpenNext artifact | Yes | `mentoria.drako.systems`, `mentorias.drako.systems` | `DRACO_DB`, `MENTORIAS_AUTHS_DB`, queues, scheduler | ACTIVE_PRODUCTIVE |
| `workers/socialflows` | `createWorkersHandlers` product worker | Yes | `socialflows.drako.systems` | `SAASES_DB`, `SOCIAL_DB`, KV/R2/queue | ACTIVE_PRODUCTIVE_UNCANONICAL_DEPLOY |
| `workers/drako-scheduler` | TypeScript worker | Yes | None | `DRACO_DB`, Durable Object | ACTIVE_INTERNAL |
| `workers/saas-factory-worker` | TypeScript API/queue worker | Yes | None | `DRACO_DB` | ACTIVE_INTERNAL |
| `workers/autopilot-worker` | TypeScript worker | Yes | None | `DRACO_DB`, AI | ACTIVE_INTERNAL |
| `workers/drako-core-worker` | TypeScript holding worker | Yes | workers.dev | `DRKO_HOLDING_DB`, KV, queue | ACTIVE_INTERNAL |
| `workers/drako-billing-worker` | TypeScript worker | Yes | workers.dev | `DRKO_BILLING_DB`, KV, queue | ACTIVE_INTERNAL |
| `workers/drako-observability-worker` | TypeScript worker | Yes | workers.dev | `DRKO_OBSERVABILITY_DB`, KV, queue | ACTIVE_INTERNAL |
| `workers/drako-ai-orchestrator-worker` | TypeScript worker | Yes | workers.dev | `DRKO_AI_DB`, KV, queue | ACTIVE_INTERNAL |
| `workers/drako-provisioner-worker` | TypeScript provisioning worker | Yes | workers.dev; derives `<slug>.drako.systems` | `DRKO_HOLDING_DB`, KV, queue | ACTIVE_INTERNAL |
| `workers/drako-base-3-shims` | Shim only | Yes | None in local config | service bindings to internal workers | LEGACY_ARCHIVED |
| `workers/analytics` | Generic workers-handler | Yes | `analytics.drako.systems` | `SAASES_DB`, KV/R2/queue | STUB |
| `workers/automations` | Generic workers-handler | Yes | `automations.drako.systems` | `SAASES_DB`, KV/R2/queue | STUB |
| `workers/cryptos` | Generic workers-handler | Yes | `cryptos.drako.systems` | `SAASES_DB`, KV/R2/queue | STUB |
| `workers/invoices` | Generic workers-handler | Yes | `invoices.drako.systems` | `SAASES_DB`, KV/R2/queue | STUB |
| `workers/stripe-webhook` | Forwarder worker | Yes | None; forwards default to `https://drako.systems/api/stripe/webhook` | `DRACO_DB` | ACTIVE_INTERNAL |
| `workers/whatsapp-channel` | Channel worker | Yes | None visible | Queue/config bindings | ACTIVE_INTERNAL |

## Product Verdicts

### Drako marca

- Dominio canonico: `drako.systems`.
- Worker: `saas-drakos-prod`.
- Estado: ACTIVE_MARKETING.
- Listo para operar como marca publica: yes, with route-warning caveat.
- Bloqueos: legacy docs/configs still mention `drako-base-3`/Pages; hostnames drift latest has WARN for missing `drako.systems/*` zone route even while custom domain ownership passes.

### Campamento Base

- Dominio canonico: `base.drako.systems`.
- Worker: `saas-bases-prod`.
- Estado: ACTIVE_OPERATOR.
- Listo como operator privado: yes if auth/fencing remains enforced.
- Bloqueos: singular/plural/admin aliases (`base`, `bases`, `admin`) need explicit private-operator messaging; auth DB is not physically isolated from `DRACO_DB`.

### Mentoria

- Dominio canonico esperado: `mentoria.drako.systems`.
- Dominio actual confirmado: `mentoria.drako.systems` and `mentorias.drako.systems`.
- Worker: `saas-mentorias-prod`.
- Estado: ACTIVE_PRODUCTIVE, not physically independent.
- Listo para vender como SaaS independiente bajo dominio propio: no.
- Bloqueos: no `MENTORIA_DB`; product runtime falls back to `DRACO_DB`; `MENTORIAS_AUTHS_DB` shares `drako_db_prod`; canonical workflow applies a Mentoria migration hotfix to production `DRACO_DB`; smoke uses plural domain.

### SocialFlow

- Dominio canonico esperado: `socialflow.drako.systems` if singular naming is adopted; otherwise formally declare `socialflows.drako.systems`.
- Dominio actual confirmado: only `socialflows.drako.systems` in local config/evidence; no `socialflow.drako.systems`.
- Worker: `saas-socialflows-prod`.
- Estado: ACTIVE_PRODUCTIVE_UNCANONICAL_DEPLOY.
- Listo para vender como SaaS independiente bajo dominio propio: no.
- Bloqueos: not included in canonical deploy workflow/smokes/critical hostname expected state; singular domain absent; auth DB split is not visible in worker config; sales-domain/tenant-domain smoke plan missing.

### Factory

- Dominio/ruta: `/api/factory/*`, `/api/owner/factory/*`, `/api/owner/saas-factory/*`; provisioning workers derive `<slug>.drako.systems`.
- Worker: OpenNext root plus `saas-factory-worker`, `drako-provisioner-worker`, internal holding workers.
- Estado: ACTIVE_CAPABILITY.
- Listo para presentarse como fabrica final: no.
- Bloqueos: it is a provisioning/control capability, not a public finished product; no standalone public domain or product smoke contract.

## Risks

### P0

- No confirmed local evidence of a P0 active domain pointing to the wrong worker; hostnames drift latest passes blockers for critical domains.
- No confirmed local evidence of preview/legacy pointing to production for public domains in this audit.
- Operator public exposure must remain guarded, but this audit did not find a domain-to-wrong-worker P0.

### P1

- SocialFlow is not in the canonical deploy workflow, smoke tests or critical hostname expected state.
- `socialflow.drako.systems` is absent while `socialflows.drako.systems` exists.
- Mentoria is not sellable as independent SaaS because `MENTORIA_DB` is absent and auth/product DBs physically share `DRACO_DB`.
- Canonical workflow applies a Mentoria table hotfix to production `DRACO_DB`.
- `build-worker.yml` remains a manual legacy deploy path for root `wrangler.workers.toml`.
- Singular/plural naming is mixed for Base and Mentoria; SocialFlow is plural-only locally.

### P2

- Older docs still reference Pages/`drako-base-3`/`www.drako.systems`.
- Stub workers exist for analytics/automations/cryptos/invoices and can be mistaken for sellable SaaS.
- Monitoring workflow references `drako.group`, which is outside the current product-domain map.
- `drako.systems/*` zone route is WARN missing while custom-domain ownership passes, which needs policy wording.

## Recommended Plan

### Phase A - Correct Documentation And State

- Mark `saas-drakos-prod`, `saas-bases-prod`, `saas-mentorias-prod` and `saas-socialflows-prod` as the current real product workers.
- Mark `drako-base-3`, Pages-era docs and `apps/*` as legacy/archive/template context.

### Phase B - Prepare Canonical SocialFlow Domain

- Decide singular vs plural for product-facing SocialFlow.
- Add the chosen domain to expected-state, deploy workflow, smoke tests and readiness only when Cloudflare/domain work is planned.

### Phase C - Prepare Canonical Mentoria Domain

- Keep `mentoria.drako.systems` as expected canonical and `mentorias.drako.systems` as compat unless product decides otherwise.
- Align workflow smokes to the canonical domain before own-domain sale.

### Phase D - Stabilize Workflows By Product

- Replace root/manual legacy deploy workflow with canonical deploy only.
- Add SocialFlow deploy/smoke path or separate product workflow.
- Remove one-off production DB hotfixes from deploy before physical DB split.

### Phase E - Smoke Tests By Domain

- Add per-domain smoke coverage for public landing, auth, app redirect and health.
- Include anti-cross-domain redirect checks for SocialFlow once canonical domain is declared.

### Phase F - Declare Product Sellable

- SocialFlow: domain, deploy, smoke, auth DB guardrails and customer-domain policy all green.
- Mentoria: domain, deploy, smoke, `MENTORIA_DB`, auth DB split posture and no `DRACO_DB` fallback as final state.

## Non-Goals Confirmed

- No production mutation.
- No Cloudflare changes.
- No domain or worker creation.
- No runtime code edits.
- No config edits.
- No SocialFlow/Mentoria feature changes.
- No aula/chat/pizarra/learning-loop changes.

## Result

P10.11 documents the real local/config evidence for domain and deploy ownership. Drako and Campamento Base have canonical workers today; Mentoria has canonical domains but is not physically independent; SocialFlow has a product worker and plural domain but is not yet wired into canonical deploy/readiness/smoke policy for sale under its own domain.

## Final Validation

| Check | Result | Notes |
|---|---|---|
| `pnpm typecheck` | PASS | Completed after documentation edits. |
| `pnpm lint` | PASS | 0 errors; existing warnings remain. |
| `pnpm test` | PASS | Full Vitest suite passed; expected stderr from fail-closed tests remains. |
| `pnpm build` | PASS | Next build completed. |
