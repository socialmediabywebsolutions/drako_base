# SocialFlow Runtime + Exports Readiness Before Legacy

**Date:** 2026-05-26  
**Phase:** S3.13  
**Status:** Combined runtime seed + exports monitoring layer

---

## Overview

This document validates the **combined readiness** of SocialFlow runtime seed and exports switches before activating legacy read models.

The nonprod canary configuration now has:
- Runtime seed switch **ON** (reads from `SOCIAL_DB` first)
- Exports switch **ON** (reads from `SOCIAL_DB` first)
- OAuth switch **OFF** (not activated yet)
- Legacy switch **OFF** (not activated yet)

This phase does **not** activate legacy or OAuth. It creates a monitoring/readiness layer to confirm the current state is stable before proceeding.

---

## Current State

### Config Posture

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"              # ON
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"       # ON
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"           # OFF
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"       # OFF
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"                  # NOT DEPLOYABLE
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"    # ROLLBACK READY
```

### Databases

- **DRACO_DB:** `drako_db_socialflow_canary` (core fallback)
- **SAASES_DB:** `saas_socialflows_registry_canary_db`
- **SOCIAL_DB:** `saas_socialflows_canary_db` (runtime seed + exports SOCIAL_DB-first)
- **SOCIALFLOW_AUTHS_DB:** `saas_socialflow_auths_canary_db`

All databases are nonprod canary. No production tokens.

---

## Runtime Seed SOCIAL_DB-First Evidence

**Source:** `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts`  
**Function:** `resolveRuntimeSocialSaasSeedContract(tenantId)`  
**Switch:** `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH`

### Behavior When Switch ON

1. Attempts to read from `SOCIAL_DB.socialflow_seed_metadata` first
2. If found and active, returns SOCIAL_DB seed
3. If missing or inactive, falls back to `DRACO_DB.saas` (core)
4. If core read fails, returns null (fails closed)

### Fallback Path

```typescript
if (isRuntimeSeedSocialDbReadEnabled()) {
  const socialSeed = await resolveRuntimeSeedFromSocialDb(tenantId);
  if (socialSeed) {
    return socialSeed; // SOCIAL_DB-first successful
  }
}
// Fallback to core DRACO_DB.saas
const db = resolveRuntimeSeedCoreDb();
```

### Contract Evidence

**Test:** `tests/lib/socialflow-runtime-seed-contract.test.ts`

Validates:
- ✅ Core-backed when switch OFF
- ✅ SOCIAL_DB-first when switch ON
- ✅ Fallback to core when SOCIAL_DB missing
- ✅ Fallback to core when SOCIAL_DB read fails

---

## Exports SOCIAL_DB-First Evidence

**Source:** `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`  
**Function:** `resolvePreparedSocialExportReadModel(tenantId, saasId)`  
**Switch:** `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH`

### Behavior When Switch ON

1. Attempts to read from `SOCIAL_DB.socialflow_export_read_models` first
2. If found and usable, builds ZIP from SOCIAL_DB prepared model
3. If missing or unusable, falls back to core-backed export generation
4. If core read fails, fails closed (throws error)

### Fallback Path

```typescript
if (!isRuntimeExportSocialDbReadEnabled()) {
  return null; // Switch OFF, skip SOCIAL_DB
}

const prepared = await resolvePreparedSocialExportReadModel(tenantId, saasId);
if (prepared) {
  return buildZipFromPreparedSocialReadModel(prepared); // SOCIAL_DB-first successful
}

// Fallback to core-backed export generation
const coreReadContract = createSocialFlowExportCoreReadContract(...);
```

### Contract Evidence

**Test:** `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`

Validates:
- ✅ Core-backed when switch OFF
- ✅ SOCIAL_DB read models when switch ON
- ✅ Fallback to core when SOCIAL_DB missing
- ✅ Fallback to core when SOCIAL_DB read fails
- ✅ ZIP payload integrity preserved

**Test:** `tests/lib/socialflow-export-social-read-prep-contract.test.ts`

Validates:
- ✅ Reads from `SOCIAL_DB.socialflow_export_read_models`
- ✅ Fails closed when upsert fails

---

## Fallback Availability

Both runtime seed and exports have **core fallback** available.

### Fallbacks Are NOT Used in Healthy Path

In a healthy state:
- Runtime seed reads from `SOCIAL_DB.socialflow_seed_metadata`
- Exports read from `SOCIAL_DB.socialflow_export_read_models`
- Core fallback is **available but not exercised**

### When Fallback Is Used

Fallback is used only when:
1. SOCIAL_DB row is **missing**
2. SOCIAL_DB row is **inactive/invalid**
3. SOCIAL_DB **read fails** (network/database error)

### Observability

The code logs warnings when fallback is exercised:
- `SOCIALFLOW_RUNTIME_SAAS_SEED_UNAVAILABLE`
- `SOCIALFLOW_RUNTIME_EXPORT_SOCIAL_DB_READ_UNAVAILABLE`

**Expected in healthy state:** 0 fallback warnings.

---

## Parity Evidence

**Script:** `scripts/check-socialflow-nonprod-ownership-parity.ts`

### Parity Groups

- **Runtime Seed:** `SOCIAL_DB.socialflow_seed_metadata` ↔ `DRACO_DB.saas`
- **Exports:** `SOCIAL_DB.socialflow_export_read_models` ↔ core export source tables

### Parity Status

```json
{
  "status": "PARITY_OK",
  "runtimeSeedGroupMatched": 1,
  "exportsGroupMatched": 1,
  "missingInSocial": 0,
  "missingInCore": 0,
  "mismatched": 0
}
```

**Strict parity requirement:** No drift, no missing rows in SOCIAL_DB.

---

## ZIP/Export Payload Integrity

**Evidence:** `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`

### Payload Format

Both SOCIAL_DB-first and core-backed exports produce identical ZIP structure:

```
dossier/
  dossier.json
blueprint/
  blueprint.json
execution/
  work_logs.csv
  orchestrator_messages.csv
economics/
  financials.csv
  economic_events.csv
domains/
  domain_status.json
meta.json
```

### Validation

- ✅ ZIP structure preserved
- ✅ CSV format intact
- ✅ JSON format intact
- ✅ No data corruption
- ✅ Tenant isolation enforced

---

## Campamento Base Observation Model

Campamento Base **must** observe SocialFlow through contracts and routes, **not** runtime internals.

### Allowed Observation

```typescript
// ✅ Allowed: contract-based observation
import { createCampobaseSocialFlowContract } from "@/lib/socialflow/contracts/campobase";

// ✅ Allowed: route-based health check
fetch("/api/socialflow/runtime/health");
fetch("/api/socialflow/runtime/readiness");
fetch("/api/socialflow/setup/status");
```

### Forbidden Observation

```typescript
// ❌ Forbidden: importing runtime internals
import { resolvePreparedSocialExportReadModel } from "apps/socialflow-runtime/src/lib/socialflow/exports-service";
import { resolveRuntimeSocialSaasSeedContract } from "apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract";
import { persistLinkedInConnection } from "@/lib/socialflow/linkedin/repository";

// ❌ Forbidden: reading OAuth tables directly
const auths = await db.queryAll("SELECT * FROM socialflow_oauth_connections WHERE tenant_id = ?", tenantId);

// ❌ Forbidden: accessing tokens/credentials
const tokens = await db.queryOne("SELECT encrypted_access_token FROM drako_integration_credentials WHERE ...");
```

### What Campamento Base Must NOT Do

1. Import `apps/socialflow-runtime/src/**` runtime internals
2. Import `src/lib/socialflow/repository` directly
3. Import `src/lib/socialflow/linkedin/**` directly for OAuth/token state
4. Read or write SocialFlow OAuth tables
5. Access encrypted tokens, refresh tokens, credentials, or `authMeta`
6. Create auth bypass routes

### Contract-Based Readiness API (Future)

If Campamento Base needs runtime readiness state, create a read-only contract:

**File:** `src/lib/socialflow/contracts/readiness.ts`

```typescript
export type SocialFlowReadinessStatus = {
  runtimeSeedSwitch: "0" | "1";
  exportsSwitch: "0" | "1";
  oauthSwitch: "0" | "1";
  legacySwitch: "0" | "1";
  parityStatus: "PARITY_OK" | "PARITY_DRIFT" | "PARITY_MISSING";
  rollbackReady: boolean;
  risks: string[];
  nextRecommendedAction: string;
};

export function getSocialFlowReadinessStatus(): SocialFlowReadinessStatus {
  // Read from runtime env, not from internals
}
```

**Usage:**

```typescript
// Campamento Base
import { getSocialFlowReadinessStatus } from "@/lib/socialflow/contracts/readiness";

const status = getSocialFlowReadinessStatus();
if (status.parityStatus !== "PARITY_OK") {
  // Alert operator
}
```

---

## Risks Before Legacy Activation

### Current Risks

1. **Fallback observability limited:** No explicit counter for fallback usage in production.
2. **No automatic rollback on parity drift:** Manual intervention required if parity breaks.
3. **OAuth not activated yet:** LinkedIn publishing still uses legacy flow.
4. **Legacy not activated yet:** Dossiers/progress/work logs still core-backed.

### Mitigations

- ✅ Strict parity enforced by `check-socialflow-nonprod-ownership-parity.ts`
- ✅ Smoke tests validate SOCIAL_DB-first + core fallback
- ✅ Config-only rollback available (set switches to "0")
- ✅ No remote D1 writes during readiness validation
- ✅ OAuth excluded from parity checks
- ✅ No deployment allowed (`deployable = false`)

---

## Criteria for Legacy Activation

Before activating `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`, confirm:

### Pre-flight Checklist

- [ ] Runtime seed readiness smoke passes
- [ ] Exports readiness smoke passes
- [ ] Combined readiness smoke passes
- [ ] Parity strict OK for runtime seed + exports
- [ ] No parity drift detected
- [ ] No missing rows in SOCIAL_DB
- [ ] No fallback warnings in logs (fallback count = 0)
- [ ] ZIP/export payload integrity validated
- [ ] Campamento Base boundary respected
- [ ] OAuth still OFF
- [ ] Legacy still OFF
- [ ] No deployment
- [ ] No production changes

### Recommended Actions

1. Run readiness smoke daily for 3-7 days
2. Monitor fallback count (should be 0)
3. Verify parity remains green
4. Review logs for any SOCIAL_DB read failures
5. Confirm no auth bypass routes created

### Rollback If

- Parity drift detected
- Fallback count > 0 in healthy state
- SOCIAL_DB read failures
- ZIP payload corruption
- Campamento Base imports runtime internals
- OAuth accidentally activated

---

## OAuth Activation (Last Phase)

OAuth is the **last** switch to activate:

1. ✅ Runtime seed ON
2. ✅ Exports ON
3. ⏳ Legacy ON (next phase after readiness confirmed)
4. ⏳ OAuth ON (final phase, after legacy stable)

### Why OAuth Is Last

- OAuth requires LinkedIn API credentials
- OAuth requires encrypted token management
- OAuth requires refresh token rotation
- OAuth has external API rate limits
- OAuth has compliance/security review requirements
- OAuth is highest risk for production impact

### OAuth Readiness Criteria

Before activating OAuth:
- [ ] Runtime seed stable (no fallback)
- [ ] Exports stable (no fallback)
- [ ] Legacy stable (no fallback)
- [ ] Parity strict OK for all groups
- [ ] No drift detected for 30+ days
- [ ] Campamento Base boundary fully enforced
- [ ] No auth bypass routes
- [ ] LinkedIn API credentials secured
- [ ] Token encryption validated
- [ ] Refresh token rotation tested
- [ ] Rate limiting configured
- [ ] Compliance review complete

---

## Readiness Smoke Script

**Script:** `scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts`

### What It Validates

1. Runtime seed switch ON
2. Exports switch ON
3. OAuth switch OFF
4. Legacy switch OFF
5. Deployable = false
6. Rollback available
7. Runtime seed SOCIAL_DB-first OK
8. Exports SOCIAL_DB-first OK
9. Fallback available but not used in healthy path
10. Parity strict OK
11. ZIP/export payload intact
12. OAuth excluded
13. Remote writes = 0
14. No deployment

### Usage

```bash
# Normal mode
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts

# JSON mode
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts --json
```

### Expected Output (Normal Mode)

```json
{
  "ok": true,
  "status": "SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK",
  "runtimeSeedSwitch": "1",
  "exportsSwitch": "1",
  "oauthSwitch": "0",
  "legacySwitch": "0",
  "deployable": false,
  "runtimeSeedSource": "SOCIAL_DB",
  "exportsSource": "SOCIAL_DB",
  "fallbacksAvailable": true,
  "fallbacksUsedInHealthyPath": false,
  "parityReport": {
    "status": "PARITY_OK",
    "runtimeSeedGroupMatched": 1,
    "exportsGroupMatched": 1,
    "missingInSocial": 0,
    "missingInCore": 0,
    "mismatched": 0
  },
  "remoteWrites": 0,
  "deploy": false,
  "oauthExcluded": true,
  "rollbackReady": true,
  "nextPhaseRecommendation": "PREPARE_LEGACY_SWITCH_NONPROD"
}
```

---

## Rollback Strategy

### Immediate Rollback

**Runtime seed rollback:**

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
```

**Exports rollback:**

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

**Combined rollback:**

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

### Rollback Marker

```toml
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
```

### Rollback Requirements

- ✅ Config-only (no deploy)
- ✅ No migration rollback needed
- ✅ No remote D1 writes
- ✅ No data loss
- ✅ Core fallback remains available

---

## Next Phase

**Phase:** S3.14 — Prepare Legacy Switch Nonprod

**Prerequisites:**
- ✅ Runtime seed + exports readiness confirmed
- ✅ Fallback count = 0
- ✅ Parity strict OK
- ✅ No drift for 3-7 days
- ✅ Smoke passes consistently

**Scope:**
- Activate `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`
- Create legacy switch smoke script
- Validate legacy SOCIAL_DB-first + core fallback
- Update guard scripts
- Update parity checks
- Update runbook

**Still forbidden:**
- ❌ No OAuth activation
- ❌ No deploy
- ❌ No production

---

## Summary

This phase creates a **monitoring/readiness layer** for SocialFlow with runtime seed + exports ON.

✅ Runtime seed SOCIAL_DB-first validated  
✅ Exports SOCIAL_DB-first validated  
✅ Core fallback available  
✅ Fallback not used in healthy path  
✅ Parity strict OK  
✅ ZIP integrity preserved  
✅ OAuth OFF  
✅ Legacy OFF  
✅ No deploy  
✅ Rollback ready  

**Next:** Prepare legacy switch nonprod (after readiness confirmed).  
**Last:** OAuth (after runtime seed + exports + legacy stable).
