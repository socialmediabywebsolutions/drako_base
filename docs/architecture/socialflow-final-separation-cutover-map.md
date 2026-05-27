# SocialFlow Final Separation Cutover Map

**Status:** S3.15 OAuth Prep + Final Cutover Audit  
**Date:** 2026-05-27  
**Phase:** Pre-OAuth Activation (Last Switch Pending)

---

## Executive Summary

SocialFlow separation is **3/4 complete** with runtime seed, exports, and legacy read models fully migrated to SOCIAL_DB-first architecture. OAuth remains as the **last critical switch** before independent deployment preparation.

**Current State:**
- ✅ Runtime Seed: SOCIAL_DB-first (ON)
- ✅ Exports: SOCIAL_DB-first (ON)
- ✅ Legacy: SOCIAL_DB-first (ON)
- ⏸️ OAuth: DRACO_DB-backed (OFF - prep complete)
- ✅ Core fallback: Available for all
- ✅ Parity: Strict OK
- ✅ Boundary guards: Active

---

## Module Status Matrix

| Module | Status | Switch | DB Current | Fallback | Files Responsible | Tests Responsible | Risk | Next Cut | Rollback |
|--------|--------|--------|------------|----------|-------------------|-------------------|------|----------|----------|
| **Runtime Seed** | ✅ READY | `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"` | SOCIAL_DB | DRACO_DB | `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts` | `tests/lib/socialflow-runtime-seed-contract.test.ts` | LOW | Monitor stable | Config-only |
| **Exports** | ✅ READY | `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"` | SOCIAL_DB | DRACO_DB (core) | `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts` | `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts` | LOW | Monitor stable | Config-only |
| **Legacy Read Models** | ✅ READY | `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"` | SOCIAL_DB | DRACO_DB (core) | `src/lib/socialflow/contracts/legacy-actions-core.ts` | `tests/lib/socialflow-legacy-read-models-switch.test.ts` | LOW | Monitor stable | Config-only |
| **OAuth** | ⏸️ NEEDS_OAUTH_SWITCH | `SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"` | DRACO_DB | SOCIAL_DB (ready) | `src/lib/socialflow/linkedin/repository.ts` | `tests/lib/linkedin-connection.test.ts` | MEDIUM | **S3.16: Activate OAuth last switch** | Config-only |
| **Publishing** | 🔄 TRANSITIONAL | N/A | MIXED | N/A | `src/lib/socialflow/linkedin/publishing.ts` | `tests/lib/socialflow-linkedin-publishing.test.ts` | LOW | After OAuth stable | N/A |
| **Auth** | ✅ READY | N/A | SOCIAL_DB | N/A | `src/lib/socialflow/auth/tenant-isolation.ts` | `src/lib/socialflow/auth/tenant-isolation.test.ts` | LOW | Stable | N/A |
| **Scheduler** | 🔄 TRANSITIONAL | N/A | MIXED | N/A | `src/lib/socialflow/scheduler.ts` | N/A | LOW | After OAuth stable | N/A |
| **Campamento Base Observation** | 🔄 TRANSITIONAL | N/A | CONTRACT_ONLY | N/A | `src/lib/socialflow/contracts/observability.ts`, `src/lib/socialflow/contracts/campobase.ts` | `tests/architecture/saas-boundary-import-guards.test.ts` | LOW | Maintain contract | N/A |
| **Deploy/Runtime** | ⏸️ PENDING | `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"` | N/A | N/A | `apps/socialflow-runtime/wrangler.toml` | N/A | HIGH | After OAuth + monitor | Deploy cutover |

---

## Switch Progression Timeline

```
S3.11 ✅ ────────► S3.12 ✅ ────────► S3.13 ✅ ────────► S3.14 ✅ ────────► S3.15 ✅ ────────► S3.16 ⏸️
Runtime Seed      Exports          Readiness        Legacy            OAuth Prep         OAuth ON
   ON                ON             Monitor          ON                (prep only)        (LAST)
```

**Current:** S3.15 complete  
**Next:** S3.16 OAuth activation (last switch)  
**After:** Monitor all switches 3-7 days → Deploy preparation

---

## Core-Backed Residues (TRANSITIONAL_ACCEPTED)

1. **OAuth Fallback**
   - Status: DRACO_DB primary, SOCIAL_DB ready
   - Reason: Last switch pending activation
   - Removal: After S3.16 + monitoring stable

2. **DRACO_DB Fallback (All Modules)**
   - Status: Available for runtime seed, exports, legacy, OAuth
   - Reason: Safety mechanism during transition
   - Removal: After independent deploy stable + production validation

3. **Publishing Mixed Sources**
   - Status: Uses both DRACO_DB and SOCIAL_DB
   - Reason: Dependencies on OAuth state
   - Removal: After OAuth stable

---

## Import/Coupling Analysis

### ✅ Allowed Contracts

**Campamento Base → SocialFlow:**
- `src/lib/socialflow/contracts/observability.ts` ✅
- `src/lib/socialflow/contracts/campobase.ts` ✅
- `src/lib/socialflow/contracts/automation.ts` ✅

**SocialFlow → Campamento Base:**
- `src/lib/socialflow/contracts/observability.ts` ✅
- `src/lib/socialflow/contracts/campobase.ts` ✅

**SocialFlow → Core:**
- None (all via contracts) ✅

### ❌ Violations Detected

**None** - All boundaries respected.

### 🔍 Monitored Boundaries

- `tests/architecture/socialflow-draco-dependency-radar.test.ts` ✅
- `tests/architecture/saas-boundary-import-guards.test.ts` ✅

---

## Database Usage

### DRACO_DB

**Current Usage:**
- OAuth connections (fallback - primary until S3.16)
- Runtime seed fallback
- Exports fallback
- Legacy fallback

**Post-S3.16:**
- OAuth fallback
- Runtime seed fallback
- Exports fallback
- Legacy fallback

**Post-Deploy:**
- Fallback only (emergency)

### SOCIAL_DB

**Current Usage:**
- `socialflow_seed_metadata` (PRIMARY)
- `socialflow_export_read_models` (PRIMARY)
- `socialflow_legacy_strategic_dossiers` (PRIMARY)
- `socialflow_legacy_tenant_progress` (PRIMARY)
- `socialflow_legacy_agent_work_logs` (PRIMARY)
- `socialflow_legacy_repository_context` (PRIMARY)
- `socialflow_oauth_connections` (READY - not active)

**Post-S3.16:**
- All above + `socialflow_oauth_connections` (PRIMARY)

---

## Risk Analysis

| Risk Category | Status | Evidence | Mitigation |
|---------------|--------|----------|------------|
| **Token Safety** | ✅ SAFE | No tokens in logs, encryption intact | Token encryption validated in tests |
| **AuthMeta Safety** | ✅ SAFE | Shape preserved, no exposure | Contract tests pass |
| **Production Risk** | ✅ LOW | No prod DB, deployable=false | Config guards active |
| **Deploy Risk** | ⚠️ MEDIUM | OAuth pending, monitoring needed | S3.16 + 3-7 days monitoring |
| **Fallback Risk** | ✅ LOW | All fallbacks available | Config-only rollback |

---

## Blockers

### Before OAuth ON (S3.16)

**None** - All prerequisites met:
- ✅ Runtime seed stable
- ✅ Exports stable
- ✅ Legacy stable
- ✅ Parity OK
- ✅ Contract tests pass
- ✅ Token safety validated
- ✅ Rollback ready

### Before Deploy Independent

1. ⏸️ **OAuth activation** (S3.16)
2. ⏸️ **Monitor all switches 3-7 days**
3. ⏸️ **DNS cutover preparation**
4. ⏸️ **Deploy canary configuration**
5. ⏸️ **Production validation plan**

### Before Remove Fallback

1. ⏸️ **Deploy independent stable**
2. ⏸️ **Monitor production stable**
3. ⏸️ **Confirm no core dependency**
4. ⏸️ **Performance validation**

---

## Rollback Strategy

### Config-Only Rollback (Current State)

**Runtime Seed / Exports / Legacy:**
```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

**OAuth (Post-S3.16):**
```toml
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
```

**Full Rollback:**
```toml
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
```

**Execution Time:** < 1 minute (config change only)  
**Deploy Required:** No  
**Data Loss:** None (fallback to DRACO_DB)

---

## Next Steps

### Immediate (S3.16)

1. **Activate OAuth switch** in nonprod
   ```toml
   SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1"
   ```

2. **Run OAuth smoke tests**
   ```bash
   pnpm tsx scripts/smoke-socialflow-nonprod-oauth-switch.ts
   npx vitest run tests/lib/linkedin-connection.test.ts
   ```

3. **Validate token safety**
   - No tokens in logs
   - Encryption intact
   - AuthMeta shape preserved

### Short-term (Post-S3.16)

1. **Monitor all switches 3-7 days**
   - Runtime seed stable
   - Exports stable
   - Legacy stable
   - OAuth stable

2. **Prepare deploy configuration**
   - Update DNS
   - Configure routing
   - Prepare production cutover

### Long-term (Production)

1. **Deploy independent SocialFlow**
2. **Monitor production stability**
3. **Remove core fallback** (after validation)
4. **Complete separation**

---

## Appendix: Files Modified in S3.15

**Scripts:**
- `scripts/smoke-socialflow-nonprod-oauth-switch-prep.ts`
- `scripts/audit-socialflow-final-separation-cutover.ts`

**Tests:**
- `tests/smoke-socialflow-nonprod-oauth-switch-prep.test.ts`
- `tests/audit-socialflow-final-separation-cutover.test.ts`

**Docs:**
- `docs/architecture/socialflow-final-separation-cutover-map.md`
- `docs/architecture/socialflow-oauth-switch-prep-audit.md`
- `docs/runbooks/socialflow-nonprod-canary-config.md` (updated)

---

## References

- S3.11: Runtime Seed Activation
- S3.12: Exports Switch Activation
- S3.13: Runtime + Exports Readiness Monitoring
- S3.14: Legacy Switch Activation
- S3.15: OAuth Prep + Final Cutover Audit (current)
- S3.16: OAuth Switch Activation (next)
