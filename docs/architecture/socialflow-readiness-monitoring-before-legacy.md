# SocialFlow Readiness Monitoring Before Legacy

**Phase:** S3.13B  
**Purpose:** Daily readiness monitoring before legacy activation  
**Minimum recommended:** 3-7 days  
**Status:** IN PROGRESS

---

## Overview

This document tracks daily readiness monitoring for SocialFlow with runtime seed + exports ON, before activating legacy switch.

**Current posture:**
- Runtime seed: **ON**
- Exports: **ON**
- OAuth: **OFF**
- Legacy: **OFF**

**Monitoring criteria:**
- Fallback count must be 0
- Parity must remain strict OK
- No drift detected
- No SOCIAL_DB read failures
- ZIP integrity preserved
- remoteWrites: 0
- deployable: false

---

## Daily Monitoring Log

### Day 1 — 2026-05-27 07:08 UTC+02:00

**Execution:**
```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts
```

**Results:**

| Metric | Value | Status |
|--------|-------|--------|
| `status` | `SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK` | ✅ PASS |
| `runtimeSeedSwitch` | `"1"` | ✅ ON |
| `exportsSwitch` | `"1"` | ✅ ON |
| `oauthSwitch` | `"0"` | ✅ OFF |
| `legacySwitch` | `"0"` | ✅ OFF |
| `deployable` | `false` | ✅ NOT DEPLOYABLE |
| `runtimeSeedSource` | `"SOCIAL_DB"` | ✅ SOCIAL_DB-FIRST |
| `exportsSource` | `"SOCIAL_DB"` | ✅ SOCIAL_DB-FIRST |
| `fallbacksAvailable` | `true` | ✅ AVAILABLE |
| `fallbacksUsedInHealthyPath` | `false` | ✅ NOT USED |
| `parityReport.status` | `"PARITY_OK"` | ✅ PASS |
| `parityReport.runtimeSeedGroupMatched` | `1` | ✅ MATCHED |
| `parityReport.exportsGroupMatched` | `1` | ✅ MATCHED |
| `parityReport.missingInSocial` | `0` | ✅ NO DRIFT |
| `parityReport.missingInCore` | `0` | ✅ NO DRIFT |
| `parityReport.mismatched` | `0` | ✅ NO DRIFT |
| `remoteWrites` | `0` | ✅ NO WRITES |
| `deploy` | `false` | ✅ NO DEPLOY |
| `oauthExcluded` | `true` | ✅ EXCLUDED |

**Contract Evidence:**
- ✅ `runtimeSeedValidatesSocialFirstRead: true`
- ✅ `runtimeSeedValidatesCoreFallback: true`
- ✅ `runtimeSeedValidatesSocialDbFailureFallback: true`
- ✅ `exportsValidatesSocialDbFirstRead: true`
- ✅ `exportsValidatesCoreFallbackOnMissing: true`
- ✅ `exportsValidatesCoreFallbackOnError: true`
- ✅ `exportsValidatesZipPayloadIntact: true`
- ✅ `exportsSocialReadPrepValidatesSocialDbTable: true`
- ✅ `exportsSocialReadPrepValidatesFailClosed: true`

**Baseline Validations:**

```bash
✅ pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
   → Status: NON_DEPLOYABLE_REAL_NONPROD_CONFIG
   → Runtime seed: "1", Exports: "1", OAuth: "0", Legacy: "0"

✅ pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
   → Status: RUNTIME_SEED_SWITCH_SMOKE_OK
   → exportsSwitch: "1", requiredOffSwitches: OAuth "0", Legacy "0"

✅ pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch.ts
   → Status: EXPORTS_SWITCH_SMOKE_OK
   → exportsGroupMatched: 1, missing: 0, mismatched: 0

✅ pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
   → Status: PARITY_OK
   → Matched: 6, Missing in SOCIAL: 0, Mismatched: 0
```

**Recommendation:**
```json
{
  "nextPhaseRecommendation": "PREPARE_LEGACY_SWITCH_NONPROD"
}
```

**Observations:**
- All checks passed
- Fallback count: 0 (expected in healthy state)
- Parity strict OK, no drift
- SOCIAL_DB-first working for runtime seed + exports
- Core fallback available but not exercised
- No warnings or errors detected

**Action Required:**
- ✅ Continue daily monitoring
- ⏳ Wait minimum 3-7 days before legacy activation
- ⏳ Monitor for parity drift
- ⏳ Monitor for SOCIAL_DB read failures
- ⏳ Monitor fallback count (must remain 0)

---

## Monitoring Schedule

| Day | Date | Time | Status | Notes |
|-----|------|------|--------|-------|
| Day 1 | 2026-05-27 | 07:08 UTC+02:00 | ✅ PASS | Initial baseline established |
| Day 2 | TBD | TBD | ⏳ PENDING | - |
| Day 3 | TBD | TBD | ⏳ PENDING | - |
| Day 4 | TBD | TBD | ⏳ PENDING | - |
| Day 5 | TBD | TBD | ⏳ PENDING | - |
| Day 6 | TBD | TBD | ⏳ PENDING | - |
| Day 7 | TBD | TBD | ⏳ PENDING | - |

**Minimum days required:** 3-7 days  
**Days completed:** 1 / 3 (minimum)

---

## Criteria for Legacy Activation

Before activating `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`:

- [x] Day 1 readiness smoke passes
- [ ] Day 2 readiness smoke passes
- [ ] Day 3 readiness smoke passes
- [ ] Minimum 3 days of stable monitoring completed
- [ ] Fallback count = 0 for all monitored days
- [ ] Parity strict OK for all monitored days
- [ ] No drift detected for all monitored days
- [ ] No SOCIAL_DB read failures
- [ ] ZIP integrity validated consistently
- [ ] Campamento Base boundary respected
- [ ] OAuth still OFF
- [ ] Legacy still OFF
- [ ] No deployment
- [ ] No production changes

---

## Rollback Criteria

Rollback runtime seed + exports if:

- ❌ Parity drift detected (missing in SOCIAL_DB > 0)
- ❌ Parity mismatch detected (mismatched > 0)
- ❌ Fallback count > 0 in healthy state
- ❌ SOCIAL_DB read failures
- ❌ ZIP payload corruption
- ❌ Campamento Base imports runtime internals
- ❌ OAuth accidentally activated
- ❌ Legacy accidentally activated

**Rollback command:**

```toml
# Runtime seed rollback
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"

# Exports rollback
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"

# Combined rollback
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Rollback is config-only. No deploy required.

---

## Next Steps

**After 3-7 days of stable monitoring:**

1. Review monitoring log
2. Confirm all criteria met
3. Proceed to S3.14 — Prepare Legacy Switch Nonprod
4. Activate `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`
5. Create legacy switch smoke script
6. Validate legacy SOCIAL_DB-first + core fallback
7. Continue monitoring with legacy ON

**OAuth activation (final phase):**

OAuth is the **last** switch to activate, after legacy stable for 3-7 days.

---

## Monitoring Commands

**Daily smoke:**
```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts
```

**Daily smoke JSON:**
```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts --json
```

**Baseline validation:**
```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch.ts
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

**Expected exit codes:**
- ✅ All commands: exit 0
- ❌ Any command: exit 1 → investigate immediately

---

## Monitoring Alerts

**Green (continue monitoring):**
- All smoke scripts pass
- Parity strict OK
- Fallback count = 0
- remoteWrites = 0
- deployable = false

**Yellow (investigate):**
- Warning logs detected
- Parity near-miss (but still OK)
- Fallback count > 0 but test passes

**Red (rollback immediately):**
- Parity drift detected
- Parity mismatch detected
- Fallback count > 0 in production-like state
- SOCIAL_DB read failures
- ZIP corruption
- OAuth or legacy accidentally activated

---

## Summary Day 1

✅ **All validations passed**  
✅ **Runtime seed + exports SOCIAL_DB-first working**  
✅ **Core fallback available but not used**  
✅ **Parity strict OK, no drift**  
✅ **Fallback count: 0**  
✅ **remoteWrites: 0, deploy: false**  
✅ **OAuth OFF, Legacy OFF**  

**Status:** Day 1 baseline established successfully.  
**Next:** Continue daily monitoring for minimum 2-6 more days.
