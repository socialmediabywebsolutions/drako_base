# P10.9 Mentoria DB Plan (No Data Migration)

Date: 2026-05-04  
Scope: plan + audit + policy only  
Change class: no-op architecture plan for future physical DB split

## Goal

Design a safe future path to introduce `MENTORIA_DB` as the physical primary database for Mentoria educational/product runtime, without creating remote resources, migrating data, touching production, or changing current runtime behavior.

## Validation Baseline

| Check | Result | Notes |
|---|---|---|
| `git status --short` | PASS | Worktree already had P10.8 changes before P10.9. |
| `pnpm typecheck` | PASS | First UNC/PowerShell attempt was invalid; WSL execution passed. |
| `pnpm lint` | PASS | 0 errors, existing warnings remain. |
| `pnpm test` | PASS | Initial 3 min timeout, rerun with longer timeout passed. |
| `pnpm build` | PASS | Build completed; local DB binding warnings are expected in build context. |

## Current Mentoria DB Audit

| Elemento | Archivo | Estado actual | Riesgo | Accion futura |
|---|---|---|---|---|
| DB selector | `src/lib/mentoria/get-mentoria-db.ts` | Prefers `MENTORIA_DB`, then falls back to `DRACO_DB`, then `__TEST_DB__`. | Fallback can hide missing dedicated binding after cutover. | Treat `DRACO_DB` fallback as transitional only; fail closed in production after cutover. |
| Shared DB helper | `src/lib/db.ts` | `getDb()` resolves only `DRACO_DB`. | Many Mentoria modules still bind implicitly to `DRACO_DB`. | Inventory and convert write/read paths to an injectable Mentoria DB boundary before cutover. |
| Mentoria service | `src/lib/mentoria/service.ts` | Main repository/family repository use `getMentoriaDb(env())`. | Good boundary for core service, but not complete across all submodules. | Keep as primary DB boundary and expand dependency injection to modules still using `getDb()`. |
| Family/auth routes | `src/app/api/mentoria/family/*`, `src/app/api/mentorias/auths/*` | Family access uses `getMentoriaDb`; auth routes require `MENTORIA_DB` or `DRACO_DB`. | Auth registration touches both auth DB and family DB; split must be atomic/recoverable. | Add cutover-time transaction/compensation plan and fail-closed guard. |
| Auth DB selector | `src/lib/auths/repositories.ts` | Mentorias auth resolves `MENTORIAS_AUTHS_DB`; current config maps it to same physical DB as `DRACO_DB`. | Logical auth isolation exists, physical auth isolation does not. | Keep `MENTORIAS_AUTHS_DB` separate from `MENTORIA_DB` unless explicitly approved; never share with `DRACO_DB` after auth split. |
| Worker production config | `workers/mentorias/wrangler.workers.toml` | Declares `DRACO_DB = drako_db_prod`; declares `MENTORIAS_AUTHS_DB = drako_db_prod`; no `MENTORIA_DB`. | Production Mentoria runtime depends physically on canonical Drako D1. | Add `MENTORIA_DB` only after the real DB exists; do not switch reads/writes in the same phase. |
| Root local config | `wrangler.jsonc` | `DRACO_DB`, `MENTORIAS_AUTHS_DB`, auth DBs and `SOCIAL_DB` all map to `drako_db_local`; no `MENTORIA_DB`. | Local dev collapses DB identities and can mask split defects. | Introduce `mentoria_db_local` for future split rehearsals, with explicit guardrails. |
| Global migrations | `migrations/*` | Mentoria schema is applied from the repo-wide migration stream. | A future `MENTORIA_DB` cannot safely apply all global Drako/SocialFlow schema. | Extract/apply domain-filtered Mentoria schema set before any data copy. |
| Local bootstrap | `scripts/local/mentoria-local-bootstrap.mjs` | Hydrates `drako_db_local`, optionally aligns worker local DB. | Reinforces root `DRACO_DB` as the local Mentoria DB. | Add a future no-op mode for `MENTORIA_DB` rehearsal after local DB exists. |
| Local smoke/QA | `scripts/local/mentoria-local-smoke.mjs`, `scripts/local/mentoria-local-qa.mjs` | Validates signup, login, onboarding and workspace on root local runtime. | Useful coverage but not split-aware yet. | Extend smoke to verify current DB identity and fallback metrics in split rehearsals. |
| Deploy workflow | `.github/workflows/drako-factory-deploy.yml` | Applies `0160_mentoria_session_persistence.sql` remotely to `DRACO_DB`; deploys `workers/mentorias`. | Workflow can mutate production `DRACO_DB` and assumes Mentoria tables live there. | Remove hotfix pattern before cutover; migration jobs must target declared domain DB only. |
| Worker package | `workers/mentorias/package.json` | `migrations:local` applies migrations to `DRACO_DB`. | Worker local path is not ready for `MENTORIA_DB`. | Add future split-specific script after DB/config exists. |

## Current Mentoria Tables

All listed tables currently live in `DRACO_DB` in production config and `drako_db_local` in root local config unless otherwise noted. Target DB is future `MENTORIA_DB` unless the row explicitly belongs to auth or global billing/holding.

| Tabla | Usada por | DB actual | DB objetivo | Riesgo de migracion |
|---|---|---|---|---|
| `families`, `guardians`, `students` | Family/tutor/student canonical records | `DRACO_DB` | `MENTORIA_DB` | High: registration and access checks depend on consistency. |
| `student_profiles`, `parent_accounts`, `guardian_student_access`, `conversation_context` | Onboarding, guardian visibility, session context | `DRACO_DB` | `MENTORIA_DB` | High: broken links can lock users out or expose wrong student context. |
| `mentoria_subjects`, `mentoria_student_subjects`, `mentoria_study_plans`, `mentoria_progress`, `student_progress` | Academic plan/progress | `DRACO_DB` | `MENTORIA_DB` | Medium-high: schema has convergence/legacy renames. |
| `mentoria_sessions`, `mentoria_session_state` | Aula/session/chat state | `DRACO_DB` | `MENTORIA_DB` | Critical: active sessions, `board_update_json`, `learning_state_json`. |
| `mentoria_exercises`, `mentoria_focus_sessions` | Classroom exercises/focus | `DRACO_DB` | `MENTORIA_DB` | Medium: can be regenerated partly, but session continuity matters. |
| `mentoria_student_evolution`, `mentoria_student_learning_memory`, `mentoria_student_subject_memory`, `mentoria_motivation_states`, `mentoria_daily_plans` | Learning loop/state | `DRACO_DB` | `MENTORIA_DB` | Critical: personalization state and subject-scoped evolution. |
| `mentoria_interventions`, `events`, `student_activity_logs` | Events/interventions | `DRACO_DB` | `MENTORIA_DB` | High: safety/coach interventions must not be lost. |
| `alerts`, `alert_analyses`, `notifications`, `summaries`, `event_analyses` | Notifications, summaries, alerting | `DRACO_DB` | `MENTORIA_DB` | Medium-high: parent communications and alert history. |
| `whatsapp_contacts` | WhatsApp identity/contact routing | `DRACO_DB` | `MENTORIA_DB` | High: inbound routing can misidentify guardians. |
| `mentoria_material_intakes`, `mentoria_material_context_notes` | Uploaded/WhatsApp study material | `DRACO_DB` | `MENTORIA_DB` | Medium-high: source message and document references must remain stable. |
| `mentoria_academic_records`, `mentoria_academic_documents`, `mentoria_academic_extractions`, `mentoria_academic_analyses`, `mentoria_subject_performance_snapshots` | Academic records/analytics | `DRACO_DB` | `MENTORIA_DB` | High: sensitive academic data and derived analyses. |
| `student_trials` | Trial system | `DRACO_DB` | `MENTORIA_DB` or billing boundary decision | Medium-high: entitlement state may also affect global billing. |
| `acquisition_posts`, `scheduled_posts` | Acquisition/growth publishing | `DRACO_DB` | `MENTORIA_DB` or marketing boundary decision | Medium: external publication state may overlap SocialFlow/global ops. |
| `user_behavior_metrics`, `user_feedback` | User analytics/feedback | `DRACO_DB` | `MENTORIA_DB` | Medium: analytics can tolerate rebuild less than product state. |
| `mentoria_referral_profiles`, `mentoria_referrals`, `mentoria_progress_shares` | Growth/referrals/share progress | `DRACO_DB` | `MENTORIA_DB` | Medium: share codes and invite tokens must be unique. |
| `mentoria_notification_jobs`, `mentoria_feedback_jobs`, `mentoria_publish_jobs`, `mentoria_system_events`, `mentoria_idempotency_keys`, `mentoria_notification_log` | Resilience/outbox/idempotency | `DRACO_DB` | `MENTORIA_DB` | High: duplicate or skipped jobs during cutover. |
| `mentorias_users`, `mentorias_credentials`, `mentorias_sessions` | Auth Mentoria | `MENTORIAS_AUTHS_DB` physically sharing `DRACO_DB` today | `MENTORIAS_AUTHS_DB` dedicated | Critical: auth split is separate from main product DB split. |
| `saas_instances`, `saas_subscriptions`, `economic_events`, `stripe_invoice_runs` | Global SaaS registry/billing | `DRACO_DB` | Stay in global/billing DB unless separately split | High if moved accidentally; keep outside `MENTORIA_DB` for this plan. |

## Future MENTORIA_DB Design

| Item | Proposal |
|---|---|
| Logical binding | `MENTORIA_DB` |
| Local DB name | `mentoria_db_local` |
| Preview DB name | `mentoria_db_preview` |
| Production DB name | `mentoria_db_prod` |
| Main scope | Educational/product state: family, students, onboarding, classroom/session, board, learning state, academic records, trials if product-owned, WhatsApp contact/routing state, Mentoria resilience jobs. |
| Auth relationship | `MENTORIAS_AUTHS_DB` remains the auth boundary. It should become physically dedicated and must not share identity with `DRACO_DB`. Sharing with `MENTORIA_DB` should be avoided unless an explicit security review approves it. |
| DRACO relationship | `DRACO_DB` remains global/holding/factory/billing registry. It should not be a runtime dependency for product reads/writes after final cutover. |
| Migration source | Domain-filtered Mentoria schema set, not the full global `migrations/*` stream. |
| Local seed | Minimal deterministic seed for tutor, family, student, subject, onboarding-complete workspace, and one safe classroom session. |
| Fallback policy | `DRACO_DB` fallback is allowed only before cutover and during a controlled temporary rollback window. Final production state is fail-closed if `MENTORIA_DB` is missing. |

Minimum schema set should be assembled from Mentoria domain migrations: `0119`, `0143` through `0150`, `0152` through `0183`, plus the local resilience/schema equivalents only where they represent missing canonical schema. Auth migrations such as `0136_auths_isolations.sql` belong to `MENTORIAS_AUTHS_DB`, not the main `MENTORIA_DB` target.

## Future Migration Plan

### Phase A - Inventory Freeze

- Freeze the table inventory above into an executable manifest.
- List every Mentoria route, repository, worker, queue and script that can write Mentoria state.
- Classify each write path as product DB, auth DB, global billing/holding DB, or external integration.
- Stop accepting new Mentoria tables in the global stream without domain classification.

### Phase B - Config Safe/No-Op

- Add `MENTORIA_DB` only after the physical DB exists.
- Do not change reads or writes in the same phase.
- Add readiness checks that prove preview/prod isolation and no identity reuse.
- Keep production runtime behavior unchanged.

### Phase C - Schema

- Apply only Mentoria schema to `MENTORIA_DB`.
- Verify table existence, required columns, indexes and migrations ledger.
- Do not backfill rows yet.

### Phase D - Dual-Read / Shadow-Read

- Read from `MENTORIA_DB` only when explicitly enabled for shadow mode.
- Fallback to `DRACO_DB` during transition and record fallback metrics.
- Compare representative rows/queries without changing writes.

### Phase E - Backfill

- Copy Mentoria-owned tables from `DRACO_DB` to `MENTORIA_DB`.
- Validate row counts, required FKs, unique constraints, JSON parseability, timestamps and checksums.
- Keep old tables untouched.

### Phase F - Controlled Dual-Write

- Write to both DBs during a short controlled window only if needed.
- Treat `MENTORIA_DB` write failure as blocker once phase is active.
- Alert on divergence and queue reconciliation jobs.

### Phase G - Cutover

- Promote `MENTORIA_DB` to primary read/write for Mentoria product runtime.
- Keep `DRACO_DB` fallback temporary, explicit and observable.
- Freeze critical writes if divergence exceeds the rollback threshold.

### Phase H - Remove Fallback

- Remove runtime dependency on `DRACO_DB` from Mentoria product paths.
- Convert missing `MENTORIA_DB` in production to fail-closed.
- Ensure modules still using `getDb()` are outside Mentoria or explicitly global.

### Phase I - Cleanup

- Mark old `DRACO_DB` Mentoria tables as historical.
- Do not delete until retention, rollback and legal review are closed.
- Keep reconciliation reports and cutover evidence in audits.

## Risks And Rollback

| Risk | Impact | Rollback posture |
|---|---|---|
| Loss of educational sessions | Students lose classroom continuity. | Keep `DRACO_DB` as historical source; freeze session writes if needed. |
| Corrupted `learning_state_json` or `board_update_json` | Personalization and board state become unreliable. | Validate JSON checksums before cutover; retry from `DRACO_DB`. |
| Chat/session state drift | User sees stale or wrong session context. | Prefer `DRACO_DB` fallback until divergence reconciles. |
| Incomplete family/student records | Login succeeds but access fails. | Roll back product reads to `DRACO_DB`; reconcile family graph. |
| Trial/plan mismatch | Incorrect entitlement or billing access. | Keep billing/global tables in `DRACO_DB`; reconcile trial ownership before retry. |
| WhatsApp inbound mismatch | Wrong actor/student routing. | Pause WhatsApp writes or force manual review until contact graph matches. |
| Sensitive academic data exposure | Privacy incident risk. | Checksums plus tenant-scoped validation before enabling reads. |
| Auth physically shared | Auth isolation is logical only. | Treat `MENTORIAS_AUTHS_DB` split as separate prerequisite/parallel hardening. |
| Local DBs collapsed | Tests pass while real split would fail. | Add local `mentoria_db_local` rehearsal and identity guardrails. |

Safe rollback requires keeping `DRACO_DB` as the historical source during the migration window, never deleting old tables during cutover, freezing critical writes if divergence is detected, reconciling all differences before retry, and recording the exact phase/flag state used for rollback.

## Future Guardrails

- Implemented in P10.10 (readiness/tests/doc only): `MENTORIA_DB` now has non-blocking missing-binding debt warnings plus fail-closed checks for shared identity reuse and preview/prod collisions when configured.
- `MENTORIA_DB` must not share physical identity with `DRACO_DB`.
- Preview `MENTORIA_DB` must not point to production physical identity.
- `workers/mentorias` must declare `MENTORIA_DB` when the active phase requires it.
- Production Mentoria runtime must fail closed if `MENTORIA_DB` is missing after cutover.
- Mentoria migrations must be applyable by domain, not only from global `migrations/*`.
- Readiness must flag `MENTORIAS_AUTHS_DB` sharing identity with `DRACO_DB`.
- Smoke tests must cover tutor registration, onboarding, aula, `/api/mentoria/chat`, pizarra, learning state, and trial/billing if applicable.
- Local smoke must report which physical binding handled product DB reads.

## Non-Goals Confirmed

- No remote DB creation.
- No data migration.
- No production mutation.
- No runtime behavior change.
- No SocialFlow, app, middleware, public route, aula/chat/pizarra/learning-loop, or worker production edits.

## Result

P10.9 produces a future-safe plan only. Mentoria remains physically dependent on `DRACO_DB` until a later phase creates and validates a real `MENTORIA_DB`, applies domain schema, backfills safely, runs controlled shadow/dual-write windows, cuts over, and finally removes fallback.
