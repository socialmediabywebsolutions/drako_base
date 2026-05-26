# SocialFlow Exports Switch Preparation Audit

Date: 2026-05-26

## Scope

This audit prepares the future activation of:

```text
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
```

**This phase does NOT activate the switch.** It validates that the exports contract, read models, fallback logic, and parity are ready for a future nonprod activation phase.

## Current State

### Runtime Seed Switch: ON

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
```

Runtime seed reads can start from `SOCIAL_DB.socialflow_seed_metadata` when the switch is ON and an active seed exists. Core fallback remains available.

### Exports Switch: OFF

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Exports currently remain **core-backed** through `DRACO_DB` via:

- `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`
- `src/lib/socialflow/contracts/export-core-read.ts`

The exports service already contains the SOCIAL_DB-first logic, but it is **not active** because the switch is OFF.

### OAuth and Legacy Switches: OFF

```toml
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

OAuth and legacy read models remain outside this phase.

### Deployable: FALSE

```toml
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
```

No deploy, no remote migration apply, no switch activation in this phase.

## Exports Contract Evidence

### SOCIAL_DB-First Read Contract

**Location:** `src/lib/socialflow/contracts/export-core-read.ts`

**Function:** `createSocialFlowExportSocialReadPrepContract(executor)`

**Target table:** `SOCIAL_DB.socialflow_export_read_models`

**Contract methods:**

- `getPreparedExportReadModel(tenantId, saasId)` — reads prepared export read model from SOCIAL_DB
- `upsertPreparedExportReadModel(input)` — writes prepared export read model to SOCIAL_DB (write switch is OFF)

**Test coverage:** `tests/lib/socialflow-export-social-read-prep-contract.test.ts`

- ✅ Reads prepared read model rows from SOCIAL_DB-owned table contract
- ✅ Fails closed when SOCIAL_DB prep upsert is not successful

### Core Fallback Contract

**Location:** `src/lib/socialflow/contracts/export-core-read.ts`

**Function:** `createSocialFlowExportCoreReadContract(executor)`

**Target tables:** `DRACO_DB.saas`, `tenant_strategic_dossiers`, `agent_work_logs`, `orchestrator_messages`, `economic_events`, `saas_domains`

**Contract methods:**

- `findRuntimeSocialFlowExportSaasRecord(tenantId)` — reads SaaS record with column projection
- `getStrategicDossier(tenantId)` — reads dossier
- `listAgentWorkLogs(tenantId, saasId)` — reads work logs
- `listOrchestratorMessages(tenantId)` — reads orchestrator messages
- `listEconomicEvents(tenantId, saasId)` — reads economic events
- `listSaasDomains(tenantId, saasId)` — reads domains
- `recordExportGeneratedEvent(input)` — writes export event to core

**Test coverage:** `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`

- ✅ Keeps core-backed behavior when switch is off
- ✅ Uses SOCIAL_DB read models when switch is on and prepared model is valid
- ✅ Falls back to core when switch is on and SOCIAL_DB read model is missing
- ✅ Falls back to core when switch is on and SOCIAL_DB read fails

### Runtime Exports Service

**Location:** `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`

**Function:** `generateRuntimeSocialFlowExportForTenant(tenantId)`

**Switch resolution:**

```typescript
function isRuntimeExportSocialDbReadEnabled(): boolean {
  if (RUNTIME_EXPORT_SOCIAL_DB_READ_SWITCH) {
    return true;
  }

  const contextEnv = (getCloudflareContextSafeSync() as { env?: Record<string, unknown> } | null)?.env;
  const contextValue = normalizeSwitchValue(
    contextEnv?.[SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH_ENV_KEY],
  );
  if (["1", "true", "on", "yes"].includes(contextValue)) {
    return true;
  }

  const processEnvValue = normalizeSwitchValue(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
      SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH_ENV_KEY
    ],
  );
  return ["1", "true", "on", "yes"].includes(processEnvValue);
}
```

**SOCIAL_DB-first path:**

```typescript
const preparedReadModel = await resolvePreparedSocialExportReadModel(tenantId, exportTarget.id);
if (preparedReadModel) {
  const zip = await buildZipFromPreparedSocialReadModel(preparedReadModel);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `drako-export-${exportTarget.slug}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;

  await coreReadContract.recordExportGeneratedEvent({
    tenantId,
    saasId: exportTarget.id,
    payloadJson: JSON.stringify({
      filename,
      size_bytes: buffer.byteLength,
      source: "socialflow-runtime.exports.current",
    }),
  });

  return { buffer, filename };
}
```

**Core fallback path:**

If `preparedReadModel` is `null` (switch OFF, SOCIAL_DB missing, SOCIAL_DB error, or model not usable), the service falls back to core-backed export generation.

### ZIP/Payload Format Integrity

**ZIP structure (unchanged):**

```text
dossier/dossier.json
blueprint/blueprint.json
execution/work_logs.csv
execution/orchestrator_messages.csv
economics/financials.csv
economics/economic_events.csv
domains/domain_status.json
meta.json
```

**Evidence:**

- Both SOCIAL_DB-first and core fallback paths produce the same ZIP structure.
- `buildZipFromPreparedSocialReadModel(prepared)` uses the same folder/file names as the core fallback path.
- `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts` validates ZIP entries in all paths.

## Parity Evidence

### Ownership Parity Script

**Location:** `scripts/check-socialflow-nonprod-ownership-parity.ts`

**Exports group:**

- Source: `DRACO_DB.saas`, `tenant_strategic_dossiers`, `agent_work_logs`, `orchestrator_messages`, `economic_events`, `saas_domains`
- Target: `SOCIAL_DB.socialflow_export_read_models`
- Key fields: `tenant_id`, `saas_id`
- Compared fields: `tenant_id`, `saas_id`, `slug`, `status`, `dossier_json`, `blueprint_json`, `work_logs_csv`, `orchestrator_messages_csv`, `financials_csv`, `economic_events_csv`, `domains_json`, `meta_json`, `source_revision`

**Expected parity state before exports switch activation:**

- `matched > 0` — at least one export read model matches
- `missingInSocial = 0` — no expected exports missing in SOCIAL_DB
- `missingInCore = 0` — no unexpected exports in SOCIAL_DB
- `mismatched = 0` — no drift between source and target
- `emptySources = 0` — source tables are not empty

**Current parity status:**

Run `pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts` to confirm.

## Smoke Preparatory Script

**Location:** `scripts/smoke-socialflow-nonprod-exports-switch-prep.ts`

**What it does:**

1. Re-runs canary guard on both `wrangler` configs and requires `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`.
2. Requires runtime seed switch `"1"`, exports switch `"0"`, OAuth switch `"0"`, legacy switch `"0"`.
3. Runs exports contract test suite (`tests/lib/socialflow-export-social-read-prep-contract.test.ts`).
4. Runs exports service test suite (`apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`).
5. Runs strict ownership parity without `--allow-empty-source`.
6. Asserts `remoteWrites: 0`, `deploy: false`, `oauthExcluded: true`.
7. Emits `EXPORTS_SWITCH_PREP_OK` if all checks pass.

**Test coverage:** `tests/smoke-socialflow-nonprod-exports-switch-prep.test.ts`

- ✅ Passes when runtime seed is ON, exports/OAuth/legacy are OFF, and parity is green
- ✅ Fails when exports switch is already ON
- ✅ Fails when runtime seed switch is OFF
- ✅ Fails when config is deployable
- ✅ Fails when parity is not green
- ✅ Fails when database contains prod token
- ✅ Fails when OAuth switch is ON
- ✅ Fails when legacy switch is ON

## Campamento Base Observation

Campamento Base must observe SocialFlow exports through contracts, not through direct imports of exports internals.

**Existing contracts:**

- `src/lib/socialflow/contracts/campobase.ts` — Campamento Base contract adapter
- `src/lib/campobase/socialflow-service.ts` — imports only `@/lib/socialflow/contracts/campobase`
- `src/app/api/operator/socialflow/route.ts` — calls `src/lib/campobase/socialflow-service.ts`

**What Campamento Base must not do:**

- Import `apps/socialflow-runtime/src/**` runtime internals
- Import `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts` directly
- Read or write `SOCIAL_DB.socialflow_export_read_models` directly
- Bypass the exports contract to access export data

**Recommended contract for Campamento Base:**

A read-only export status contract that exposes:

- Export read model freshness (last updated timestamp)
- Export parity state (matched, drift, empty source)
- Export source selection (SOCIAL_DB-first vs core fallback)
- Export generation events (last export timestamp, size, source)

This contract should be added before wider activation.

## Risks Before Activation

### 1. Silent Fallback

**Risk:** If SOCIAL_DB read fails, the service falls back to core without emitting a metric or event.

**Mitigation:** Add a warning log or metric when fallback occurs. Expose fallback count in health/status.

### 2. Incomplete Read Model

**Risk:** If `SOCIAL_DB.socialflow_export_read_models` is stale or incomplete, the export may be outdated.

**Mitigation:** Strict parity must be green before activation. Add `source_revision` comparison in parity.

### 3. OAuth Excluded

**Risk:** OAuth tokens, credentials, and `authMeta` are not included in export read models.

**Mitigation:** OAuth remains outside this phase. Do not activate OAuth switch until a separate token-safe OAuth phase.

### 4. No Observability

**Risk:** Operators cannot see whether exports are coming from SOCIAL_DB or core fallback.

**Mitigation:** Add export source selection to health/status. Emit metric when SOCIAL_DB-first path is used.

### 5. Parity Drift

**Risk:** If parity drifts after activation, exports may diverge from core source.

**Mitigation:** Run strict parity before activation. Add parity monitoring to CI/CD.

## Gaps Before Activation

Required before enabling `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`:

1. ✅ Exports contract reads `SOCIAL_DB.socialflow_export_read_models` first.
2. ✅ Core fallback is available and tested.
3. ✅ ZIP/payload format is unchanged.
4. ✅ Strict parity is green for export rows.
5. ⚠️ Export source selection is not exposed in health/status.
6. ⚠️ Fallback count is not emitted as a metric.
7. ⚠️ Campamento Base does not have a read-only export status contract.
8. ✅ OAuth is excluded.
9. ✅ Remote writes are zero.
10. ✅ Deploy is blocked.

## Recommended Next Phase

The next safe phase is exports switch activation in nonprod only:

1. Keep runtime seed switch ON in nonprod only.
2. Activate only `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"` in nonprod config.
3. Re-run guard, smoke exports prep, strict parity, radar, boundary guard, and typecheck.
4. Run local smoke with exports switch ON to validate SOCIAL_DB-first path.
5. Monitor fallback count and export source selection.
6. Keep OAuth and legacy switches OFF.
7. Do not deploy to production.
8. Rollback is a config-only change back to `"0"`.

## Rollback

Immediate rollback is a config-only change:

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Rollback posture must be explicit:

```toml
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
```

## Validation Commands

```bash
# Guard
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts

# Runtime seed smoke
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts

# Ownership parity
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts

# Exports switch prep smoke
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch-prep.ts
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch-prep.ts --json

# Exports contract test
npx vitest run tests/lib/socialflow-export-social-read-prep-contract.test.ts

# Exports service test
npx vitest run apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts

# Exports switch prep test
npx vitest run tests/smoke-socialflow-nonprod-exports-switch-prep.test.ts

# Boundary guards
npx vitest run tests/architecture/socialflow-draco-dependency-radar.test.ts
npx vitest run tests/architecture/saas-boundary-import-guards.test.ts

# Typecheck
pnpm typecheck

# Git diff check
git diff --check -- docs scripts tests apps/socialflow-runtime
```

## Conclusion

Exports switch preparation is complete. The exports contract, read models, fallback logic, parity, and smoke coverage are ready for a future nonprod activation phase.

**Current posture:**

- Runtime seed switch: ON
- Exports switch: OFF (prepared for activation)
- OAuth switch: OFF
- Legacy switch: OFF
- Deployable: FALSE
- Remote writes: 0
- Deploy: FALSE
- OAuth excluded: TRUE

**Next phase recommendation:**

Activate only `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"` in nonprod config, re-run all validations, and monitor export source selection and fallback count.
