# SocialFlow Nonprod Canary Predeploy Gate

**Status:** Active  
**Phase:** S3.18 - Predeploy Gate Preparation  
**Environment:** Nonprod Canary Only  
**Deployment Status:** NOT DEPLOYED (preparation only)

## Overview

This document describes the predeploy gate system for SocialFlow nonprod canary deployment. The gate validates all safety conditions before allowing deployment while ensuring no actual deployment occurs during the preparation phase.

## Current Configuration

### Deployment Flags

- **SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE:** `"true"` (activated in S3.18)
- **SOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1:** `"true"` (explicit safety flag)

### Switch Status (All ON)

1. **SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH:** `"1"` (ON)
2. **SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH:** `"1"` (ON)
3. **SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH:** `"1"` (ON)
4. **SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH:** `"1"` (ON)

### Rollback Configuration

- **SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE:** `"all-switches-off"` (ready for instant rollback)

## Predeploy Gate Validation

### Gate Script

```bash
pnpm tsx scripts/check-socialflow-predeploy-gate.ts
```

### Validation Criteria

The predeploy gate enforces the following conditions:

1. **Deployable Flag:** Must be `true`
2. **Allow Deploy Flag:** Must be explicitly set to `true`
3. **All Switches ON:** All 4 read switches must be `"1"`
4. **Parity Check:** Ownership parity must be `PARITY_OK`
5. **Token Safety:** No production tokens in configuration
6. **AuthMeta Safety:** No production auth metadata
7. **Database Posture:** All DBs must be nonprod (no `prod` token in names)
8. **Canary Config:** Must pass all canary config validations
9. **Rollback Ready:** Rollback configuration must be present
10. **Deploy Not Executed:** Confirms no deployment has occurred
11. **Production Not Touched:** Confirms no production changes
12. **Remote Writes:** Must be 0 (no remote D1 writes)

### Expected Output

**Normal Mode:**
```json
{
  "ok": true,
  "status": "SOCIALFLOW_PREDEPLOY_GATE_READY",
  "timestamp": "2026-05-27T09:31:10.401Z",
  "deployable": true,
  "allowDeployFlag": true,
  "allSwitchesOn": true,
  "parityOk": true,
  "tokenSafe": true,
  "authMetaSafe": true,
  "dbsNonprod": true,
  "canaryConfigReady": true,
  "rollbackReady": true,
  "deployNotExecuted": true,
  "productionTouched": false,
  "remoteWrites": 0,
  "nextAction": "EXECUTE_DEPLOY_COMMAND_OR_ROLLBACK"
}
```

**JSON Mode:**
```bash
pnpm tsx scripts/check-socialflow-predeploy-gate.ts --json
```

**Markdown Mode:**
```bash
pnpm tsx scripts/check-socialflow-predeploy-gate.ts --markdown
```

## Dry Run Simulation

### Dry Run Script

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-predeploy-dry-run.ts
```

### Purpose

The dry run script:
- Validates the predeploy gate passes
- Simulates deployment commands WITHOUT executing them
- Displays planned commands for future deployment
- Provides rollback commands
- Lists smoke test URLs
- Confirms no deployment execution

### Expected Output

```json
{
  "ok": true,
  "status": "SOCIALFLOW_PREDEPLOY_DRY_RUN_OK",
  "timestamp": "2026-05-27T09:31:11.809Z",
  "predeployGateOk": true,
  "deployNotExecuted": true,
  "plannedCommands": [
    "cd apps/socialflow-runtime && pnpm build",
    "cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml",
    "cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml"
  ],
  "rollbackCommands": [
    "Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = \"false\" in wrangler.toml files",
    "Or set all switches to \"0\" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE",
    "Re-deploy with rollback config"
  ],
  "smokeUrls": [
    "https://socialflow-canary.drako.systems/health",
    "https://socialflow-canary.drako.systems/api/socialflow/status"
  ]
}
```

## Planned Deployment Commands (NOT EXECUTED)

When deployment is approved in a future phase, these commands will be executed:

```bash
# 1. Build the application
cd apps/socialflow-runtime && pnpm build

# 2. Deploy socialflow-runtime with canary config
cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml

# 3. Deploy socialflows-runtime-canary worker
cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml
```

**IMPORTANT:** These commands are planned but NOT executed in S3.18 phase.

## Rollback Procedures

### Instant Rollback (Switch-Based)

If issues occur after deployment, instant rollback via switch flip:

1. **Via Rollback State:**
   - The `SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"` configuration is already present
   - This allows switching all read switches to `"0"` instantly
   - No code changes required

2. **Manual Switch Flip:**
   ```toml
   SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
   SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
   SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
   SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
   ```

3. **Re-deploy with rollback config**

### Full Rollback (Deployable Flag)

If complete rollback is required:

1. Set `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"` in both wrangler configs
2. Re-deploy with the updated configuration

## Deployment Criteria (Future Phase)

Deployment will only proceed when ALL of the following are met:

1. ✅ Predeploy gate passes (`SOCIALFLOW_PREDEPLOY_GATE_READY`)
2. ✅ Dry run simulation completes successfully
3. ✅ All tests pass (canary config + predeploy + dry-run)
4. ✅ Ownership parity confirmed (`PARITY_OK`)
5. ✅ All 4 switches are ON and stable
6. ✅ No production databases in configuration
7. ✅ No placeholders remaining
8. ✅ Rollback configuration verified
9. ✅ Explicit approval from authorized personnel
10. ✅ Monitoring and alerting ready
11. ✅ Smoke test plan prepared
12. ✅ Rollback plan confirmed

## Blocking Criteria

Deployment is BLOCKED if ANY of the following:

1. ❌ Predeploy gate fails
2. ❌ Any switch is OFF
3. ❌ Production database token found
4. ❌ Placeholder database IDs present
5. ❌ Ownership parity fails
6. ❌ Remote writes detected (remoteWrites > 0)
7. ❌ Production touched flag is true
8. ❌ Rollback configuration missing
9. ❌ Allow deploy flag not explicitly set
10. ❌ Tests failing
11. ❌ Typecheck errors

## Safety Guarantees

### S3.18 Phase Guarantees

- ✅ **NO deployment executed** (deployNotExecuted: true)
- ✅ **NO production touched** (productionTouched: false)
- ✅ **NO remote writes** (remoteWrites: 0)
- ✅ **NO secrets printed** (all outputs validated)
- ✅ **NO production databases** (all DBs validated as nonprod)
- ✅ **Rollback ready** (configuration present and tested)

### Configuration Files

**Modified:**
- `apps/socialflow-runtime/wrangler.toml`
- `workers/socialflows-runtime-canary/wrangler.workers.toml`

**Created:**
- `scripts/check-socialflow-predeploy-gate.ts`
- `scripts/smoke-socialflow-nonprod-predeploy-dry-run.ts`
- `tests/check-socialflow-predeploy-gate.test.ts`
- `tests/smoke-socialflow-nonprod-predeploy-dry-run.test.ts`

**Updated:**
- `scripts/check-socialflow-nonprod-canary-config.ts` (deployable=true validations)
- `scripts/check-socialflow-nonprod-ownership-parity.ts` (accept DEPLOYABLE status)
- `scripts/smoke-socialflow-nonprod-all-switches-readiness.ts` (allow deployable=true)
- `tests/check-socialflow-nonprod-canary-config.test.ts` (new test cases)

## Smoke Test URLs (Post-Deployment)

After actual deployment (not in S3.18), validate with:

- **Health Check:** `https://socialflow-canary.drako.systems/health`
- **Status Endpoint:** `https://socialflow-canary.drako.systems/api/socialflow/status`

## Next Steps

S3.18 establishes the predeploy gate infrastructure. The actual deployment will occur in a future phase after:

1. Extended monitoring of switch stability
2. Final approval from stakeholders
3. Confirmation of deployment window
4. Smoke test readiness
5. On-call engineer availability
6. Explicit deployment authorization

## Related Documentation

- [SocialFlow Nonprod Canary Config Runbook](../runbooks/socialflow-nonprod-canary-config.md)
- [SocialFlow Separation Architecture](./socialflow-separation-architecture.md)
- [Draco Dependency Radar](../../tests/architecture/socialflow-draco-dependency-radar.test.ts)
- [SaaS Boundary Import Guards](../../tests/architecture/saas-boundary-import-guards.test.ts)

## Version History

- **S3.18 (2026-05-27):** Initial predeploy gate activation with deployable=true flag
- **S3.16:** OAuth switch activation (4th and final switch)
- **S3.15:** Legacy switch activation (3rd switch)
- **S3.14:** Exports switch activation (2nd switch)
- **S3.13:** Runtime seed switch activation (1st switch)
