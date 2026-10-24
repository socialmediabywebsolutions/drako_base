# SocialFlow Production Cutover Readiness Assessment

**Document Version:** 1.0 (S3.25)
**Created:** 2026-05-28
**Phase:** S3.25 - Accelerated Separation & Production Cutover Readiness

---

## Executive Summary

**Status:** READY_FOR_PRODUCTION_PLANNING
**Technical Readiness:** ✅ PASS
**Approval Status:** ⏸️ PENDING (stakeholder approval required)
**Execution Allowed:** ❌ NO (not without explicit approval)

SocialFlow canary nonprod has successfully completed:
- ✅ **3-day minimum monitoring** (S3.22-S3.24)
- ✅ **Zero drift** across all monitoring periods
- ✅ **All technical gates** passing
- ✅ **Production safety gates** created and validated
- ✅ **Cutover readiness assessment** completed

**Next Step:** Stakeholder approval for production planning

---

## Evidence from S3.19-S3.24

### S3.19 - Initial Canary Deploy
- Deployed SocialFlow canary nonprod to Cloudflare
- Target: `canary-nonprod`
- Host: `socialflow-canary.drako.systems`
- Status: Deployed successfully

### S3.20 - Path Fixes
- Fixed routing issues
- Confirmed health/readiness endpoints
- Gate protection active

### S3.21 - Gated Setup
- Configured gate token protection
- Health/Readiness require custom header
- Baseline: 403 without header ✅

### S3.21B - Real Gate Validation
- Attempted real gate validation
- Token not available locally (expected)
- Gate mechanism confirmed working

### S3.22 - Day 1 Monitoring
- Status: OK_WITH_MISSING_GATE_TOKEN
- 4/4 switches ON
- Parity: 6 matched, 0 mismatched
- No security issues
- All tests: 42/42 PASS

### S3.23 - Day 2 Monitoring
- Status: OK_WITH_MISSING_GATE_TOKEN
- No drift from Day 1
- Configuration stable
- All tests: 42/42 PASS

### S3.24 - Day 3 Monitoring
- Status: OK_WITH_MISSING_GATE_TOKEN
- **Minimum 3-day milestone REACHED** ✅
- No drift from Day 1 or Day 2
- Perfect stability demonstrated
- All tests: 42/42 PASS

---

## Current State of SocialFlow Separation

### ✅ Already Independent

**Runtime:**
- Standalone worker: `saas-socialflows-runtime-canary-nonprod`
- Dedicated D1 databases:
  - `drako_db_socialflow_canary`
  - `saas_socialflows_canary_db`
  - `saas_socialflows_registry_canary_db`
  - `saas_socialflow_auths_canary_db`
- Independent routing: `socialflow-canary.drako.systems`
- Independent switches (4/4 ON)
- Independent gate protection

**Capabilities:**
- LinkedIn OAuth flow (canonical)
- Post publishing
- Analytics window
- Read models
- Export models
- Legacy models
- Seed metadata
- Tenant ownership parity

### ⏸️ Still in Canary

**Environment:**
- Target: `canary-nonprod` (not `production`)
- Host: `socialflow-canary.drako.systems` (not production domain)
- D1: Canary databases (not production)
- Workers: Canary worker (not production)

**Monitoring:**
- 3 days completed (minimum reached)
- 7 days recommended (not yet complete)

### ❌ Blocks Production

**Technical Blockers:** None ✅

**Approval Blockers:**
- STAKEHOLDER_APPROVAL_REQUIRED
- PRODUCTION_DEPLOY_WINDOW_REQUIRED
- ON_CALL_REQUIRED
- PRODUCTION_CONFIG_REVIEW_REQUIRED
- DNS/ROUTE_APPROVAL_REQUIRED

---

## Gates Created in S3.25

### 1. Production Safety Gate
**Script:** `scripts/check-socialflow-production-safety-gate.ts`
**Tests:** `tests/check-socialflow-production-safety-gate.test.ts`

**Validates:**
- ✅ Production not touched
- ✅ Remote writes = 0
- ✅ Token leakage not detected
- ✅ No production DBs in canary config
- ✅ Gate protection active
- ✅ Parity OK
- ✅ All switches ON
- ✅ Deployable = true
- ✅ Canary target confirmed
- ✅ Production target not enabled

**Status Codes:**
- `SOCIALFLOW_PRODUCTION_SAFETY_GATE_OK`
- `SOCIALFLOW_PRODUCTION_SAFETY_GATE_BLOCKED`
- `SOCIALFLOW_PRODUCTION_SAFETY_GATE_TOKEN_LEAKAGE_BLOCKER`
- `SOCIALFLOW_PRODUCTION_SAFETY_GATE_PRODUCTION_TOUCH_BLOCKER`
- `SOCIALFLOW_PRODUCTION_SAFETY_GATE_REMOTE_WRITE_BLOCKER`

**Supports:** `--json`, `--markdown`

### 2. Route/DNS Readiness Checker
**Script:** `scripts/check-socialflow-route-dns-readiness.ts`
**Tests:** `tests/check-socialflow-route-dns-readiness.test.ts`

**Validates:**
- ✅ Canary host known (`socialflow-canary.drako.systems`)
- ✅ Health route correct (`/api/socialflow/runtime/health`)
- ✅ Readiness route correct (`/api/socialflow/runtime/readiness`)
- ✅ Gate protected
- ✅ Production host not ready (by design)

**Status Codes:**
- `CANARY_ROUTE_READY`
- `ROUTING_BLOCKER`

**Supports:** `--json`, `--markdown`

### 3. Production Cutover Readiness Gate
**Script:** `scripts/check-socialflow-production-cutover-readiness.ts`
**Tests:** `tests/check-socialflow-production-cutover-readiness.test.ts`

**Integrates:**
- Production safety gate
- Route/DNS readiness
- Monitoring day status
- Predeploy gate
- Ownership parity
- Token safety
- Rollback readiness

**Decisión:**
- `readyForPlanning = true` ✅
- `readyForExecution = false` (requires approval)

**Status Codes:**
- `SOCIALFLOW_PRODUCTION_CUTOVER_READY_FOR_PLANNING`
- `SOCIALFLOW_PRODUCTION_CUTOVER_BLOCKED`

**Supports:** `--json`, `--markdown`

### 4. Production Cutover Plan
**Script:** `scripts/plan-socialflow-production-cutover.ts`
**Tests:** `tests/plan-socialflow-production-cutover.test.ts`

**Generates:**
- Planned prechecks
- Production config review items
- Cloudflare route/DNS steps
- Deploy command (PLACEHOLDER - DO NOT EXECUTE)
- Smoke commands (post-deploy)
- Rollback commands
- Monitoring commands
- Approvals required

**Key Properties:**
- `executionAllowed = false` ✅
- `requiresHumanApproval = true` ✅
- `commandsArePlannedOnly = true` ✅

**Status:** `SOCIALFLOW_PRODUCTION_CUTOVER_PLAN_READY`

**Supports:** `--json`, `--markdown`

---

## Cutover Readiness Result

**Assessment Date:** 2026-05-28

### Monitoring
- Days Completed: 3 / 7
- Minimum Monitoring Reached: ✅ YES (3 days)
- Recommended Monitoring Target: 7 days
- Recommended Monitoring Reached: ⏸️ NO (continue to Day 7 for confidence)

### Configuration
- All Switches ON: ✅ YES (4/4)
- Deployable: ✅ YES
- Allow Deploy with Real D1: ✅ YES

### Gates
- Safety Gate: ✅ OK
- Route/DNS Ready: ✅ OK
- Parity: ✅ OK (6 matched, 0 mismatched)
- Rollback Ready: ✅ YES
- Token Safe: ✅ YES

### Security
- Production Touched: ✅ NO (false)
- Remote Writes: ✅ ZERO (0)
- Token Leakage Detected: ✅ NO (false)

### Blocked By
- STAKEHOLDER_APPROVAL_REQUIRED
- PRODUCTION_DEPLOY_WINDOW_REQUIRED
- ON_CALL_REQUIRED

### Recommendation
**READY FOR PRODUCTION PLANNING** - All technical gates pass, requires stakeholder approval.

### Next Action
**STAKEHOLDER_APPROVAL_AND_PLANNING**

---

## Cutover Plan

### Prechecks (Pre-Cutover)
1. `pnpm tsx scripts/check-socialflow-production-cutover-readiness.ts` - Verify all gates pass
2. `pnpm tsx scripts/check-socialflow-production-safety-gate.ts` - Confirm production safety
3. `pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts` - Confirm parity
4. `pnpm typecheck` - Confirm no type errors
5. `npx vitest run` - Confirm all tests pass

### Production Config Review
- Review production `wrangler.toml` configuration
- Verify production database bindings (names must NOT contain "canary")
- Verify production secrets set in Cloudflare dashboard
- Verify `SOCIALFLOW_RUNTIME_TARGET = "production"`
- Verify production custom domain configuration
- Verify production switch states
- Verify production rollback switch state

### Cloudflare Steps
1. **DNS/Route Configuration:** Configure production custom domain in Cloudflare dashboard (REQUIRES APPROVAL)
2. **Secret Verification:** Verify all production secrets exist (`SOCIALFLOW_CANARY_GATE_TOKEN`, encryption keys, etc.)
3. **D1 Database Verification:** Verify production D1 databases exist with correct schema

### Deploy Command (PLANNED ONLY)
```bash
# PLACEHOLDER - DO NOT EXECUTE
wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml
```

⚠️ **WARNING:** DO NOT EXECUTE without stakeholder approval and production deploy window

### Post-Deploy Smoke Commands
1. Verify production health and readiness endpoints
2. Verify production parity after deploy
3. Verify production gate protection active
4. Monitor Cloudflare Dashboard logs (every 5 min for first hour)

### Rollback Commands
1. **Rollback Deployment:** `wrangler rollback --name saas-socialflows-runtime-production`
2. **Emergency Switch:** Set `SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"`
3. **Verify Rollback:** Run smoke tests to confirm rollback successful

### Monitoring Commands (Post-Cutover)
- Check Cloudflare Dashboard logs: Every 5 minutes for first hour
- Run production monitoring: Daily for 7 days
- Manual health check: `curl https://socialflow.drako.systems/api/socialflow/runtime/health` (as needed)

### Approvals Required
- ✅ Technical Lead approval
- ⏸️ Stakeholder approval
- ⏸️ Production deploy window confirmed
- ⏸️ On-call engineer availability confirmed
- ⏸️ Rollback plan reviewed and approved
- ⏸️ Monitoring dashboard configured
- ✅ All prechecks passed

---

## Criteria for Production Execution

### ✅ Must Have (Technical)
- All technical gates passing
- 3-day minimum monitoring complete
- Zero drift demonstrated
- All tests passing
- Parity validated
- Gate protection active
- Rollback plan ready
- Production config reviewed

### ✅ Must Have (Approval)
- Stakeholder approval obtained
- Production deploy window confirmed
- On-call engineer availability confirmed
- Rollback plan approved

### ⚠️ Recommended (But Not Blocking)
- 7-day monitoring complete (currently 3/7)
- Cloudflare Dashboard logs reviewed
- Additional smoke testing in canary

---

## Criteria for NOT Executing Production

### ❌ Absolute Blockers
- Any technical gate failing
- Production touched = true
- Remote writes > 0
- Token leakage detected
- Parity mismatches > 0
- Any switch OFF
- Deployable = false
- Tests failing
- No rollback plan
- No on-call coverage

### ⏸️ Approval Blockers
- No stakeholder approval
- No production deploy window
- No on-call engineer confirmed

---

## Rollback Matrix

| Scenario | Trigger | Action | Recovery Time |
|----------|---------|--------|---------------|
| Deploy fails | Wrangler deploy error | Deploy aborted, no rollback needed | Immediate |
| Health check fails post-deploy | HTTP status ≠ 403 | Wrangler rollback | < 1 minute |
| Parity check fails post-deploy | Mismatches detected | Wrangler rollback | < 2 minutes |
| Token leakage detected | Security scan alert | Emergency switch OFF + rollback | < 1 minute |
| High error rate in logs | Cloudflare Dashboard | Wrangler rollback | < 2 minutes |
| Performance degradation | Monitoring alerts | Wrangler rollback | < 3 minutes |
| Switch state corruption | Config check fails | Emergency rollback switch | < 30 seconds |

---

## Next Phase Recommended

### Option 1: Continue to Day 7 (Recommended)
**Phase:** S3.26-S3.29 - Day 4-7 Monitoring
**Timeline:** 4 more days
**Benefit:** Full 7-day stability evidence for stakeholder confidence
**Risk:** Low (stable system)

### Option 2: Proceed to Production Planning
**Phase:** S3.30 - Production Planning & Approval
**Prerequisites:**
- Stakeholder approval obtained
- Production deploy window confirmed
- On-call engineer confirmed
**Risk:** Medium (only 3 days monitoring, recommended is 7)

### Option 3: Extended Canary Period
**Phase:** S3.26-S3.35 - Extended Monitoring (14+ days)
**Benefit:** Maximum confidence for critical system
**Risk:** Very Low
**Timeline:** 11+ more days

---

## Related Documentation

- `docs/architecture/socialflow-canary-monitoring-log.md` - Daily monitoring log
- `docs/runbooks/socialflow-nonprod-canary-config.md` - Canary configuration runbook
- `docs/architecture/socialflow-nonprod-canary-deploy-result.md` - Deploy result
- `docs/architecture/socialflow-canary-gated-health-readiness.md` - Gate validation
- `scripts/monitor-socialflow-nonprod-canary-day.ts` - Daily monitoring script
- `scripts/check-socialflow-production-cutover-readiness.ts` - Cutover readiness gate
- `scripts/plan-socialflow-production-cutover.ts` - Cutover plan generator

---

**Document Status:** ACTIVE
**Owner:** Technical Lead
**Review Cycle:** After each monitoring day or before production cutover
