# Mentoría Acquisition Feature Status

**Status:** 🟡 **NOT DEPLOYED** (P2 Technical Debt)  
**Last Updated:** 2026-05-22  
**Classification:** Future feature with completed code, pending schema deployment

---

## Current State

### ✅ Implemented
- **Code:** Complete implementation in `src/lib/mentoria/acquisition-*`
- **API:** Full REST endpoint at `/api/mentoria/acquisition`
- **Types:** TypeScript types with tenant isolation
- **Tests:** Unit tests for tenant isolation
- **Migration:** 0186_mentoria_acquisition_tenant_isolation.sql prepared

### ❌ Not Deployed
- **Schema:** Table `acquisition_posts` does NOT exist in `saas_mentorias_prod_db`
- **UI:** NO frontend components consume the API
- **Jobs:** NO cron/workers execute acquisition logic
- **Activation:** Feature flag `ACQUISITION_ENABLED` is `false` (fail-closed)

---

## Architecture

### Database
- **Target D1:** `saas_mentorias_prod_db` (67b013a3-dcd8-424b-adf9-558895817841)
- **Binding:** `MENTORIA_DB` (via `getMentoriaDb()`)
- **Migration Required:** `0186_mentoria_acquisition_tenant_isolation.sql`

### Access Control
- **Role Required:** `admin` only
- **Feature Flag:** `ACQUISITION_ENABLED` env var (default: `false`)
- **Fail-Closed:** Returns 501 Not Implemented when disabled
- **Activation Allowed Now:** `no` (pending explicit approval)
- **Remote Migration Allowed Now:** `no` (pending explicit approval)

### Tenant Isolation
- **Column:** `tenant_id TEXT NOT NULL`
- **FK:** `FOREIGN KEY (tenant_id) REFERENCES tenants(id)`
- **Indexes:** Tenant-scoped for channel and metrics queries
- **All GET methods:** Filter by `tenant_id`
- **All UPDATE methods:** Include `tenant_id` in WHERE clause

---

## Risk Assessment

### Production Risk: ✅ NONE
- Feature NOT exposed in UI
- API requires admin role
- Feature flag disabled by default
- NO automated jobs executing
- Users CANNOT trigger crash

### Development Risk: ⚠️ LOW
- Admins can manually access `/api/mentoria/acquisition` → would crash with 501
- Feature flag prevents access until migration applied

### FK Constraint Risk: ✅ RESOLVED
- `mentoria_publish_jobs` table EXISTS (verified 2026-05-22)
- FK to `acquisition_posts(id)` was ignored (SQLite PRAGMA foreign_keys = OFF)
- No blocking issues in resilience layer

---

## Deployment Checklist

### Pre-Deployment
- [x] Migration 0186 created
- [x] Code hardened with tenant filters
- [x] Feature flag added (fail-closed)
- [x] Unit tests for tenant isolation
- [x] API feature flag tests passing
- [x] Type safety enforced
- [ ] Integration tests with real D1
- [ ] PM approval for feature activation
- [ ] UI components ready

### Deployment Steps
1. **Apply Migration** (15 min)
   ```bash
   wrangler d1 execute saas_mentorias_prod_db \
     --file=migrations/0186_mentoria_acquisition_tenant_isolation.sql \
     --remote
   ```

2. **Verify Schema** (5 min)
   ```sql
   PRAGMA table_info(acquisition_posts);
   -- Must include: tenant_id TEXT NOT NULL
   
   SELECT COUNT(*) FROM acquisition_posts;
   -- Must return: 0 (empty table)
   ```

3. **Enable Feature Flag** (2 min)
   ```bash
   # In wrangler.workers.toml [env.production.vars]
   ACQUISITION_ENABLED = "true"
   ```

4. **Deploy Worker** (5 min)
   ```bash
   pnpm deploy:workers
   ```

5. **Smoke Test** (5 min)
   ```bash
   curl -X GET https://mentorias.drako.systems/api/mentoria/acquisition \
     -H "Cookie: session=..." \
     -H "Content-Type: application/json"
   # Expected: 200 OK with metrics
   ```

### Rollback Plan
If issues arise after deployment:

```sql
-- Rollback schema
BEGIN TRANSACTION;
DROP TABLE IF EXISTS acquisition_posts;
ALTER TABLE acquisition_posts_backup RENAME TO acquisition_posts;
COMMIT;
```

```bash
# Disable feature flag
ACQUISITION_ENABLED=false
pnpm deploy:workers
```

---

## Files Modified (P0-1B Hardening)

### Migrations
- `migrations/0186_mentoria_acquisition_tenant_isolation.sql` — NEW

### Code
- `src/lib/mentoria/acquisition-publishing.ts` — Added `tenantId` to all GET methods
- `src/lib/mentoria/optimization-engine.ts` — Pass `tenantId` to acquisition methods
- `src/app/api/mentoria/acquisition/route.ts` — Feature flag fail-closed
- `src/app/api/mentoria/analytics/route.ts` — Pass `tenantId` to optimization engine

### Tests
- `tests/lib/mentoria-acquisition-tenant-isolation.test.ts` — NEW
- `tests/api/mentoria-acquisition-feature-flag.test.ts` — NEW

### Documentation
- `docs/mentoria/ACQUISITION_FEATURE_STATUS.md` — NEW (this file)

---

## Validation Commands

```bash
# Type check
pnpm typecheck

# Run full test suite
pnpm test

# Build
pnpm build

# Git check
git diff --check
```

## Validation Results (P0-1C)

- `typecheck_pass`: **yes**
- `full_test_suite_pass`: **yes** (232 files / 1094 tests)
- `acquisition_feature_flag_tests_pass`: **yes** (5/5)
- `build_pass`: **yes**
- `git_diff_check_pass`: **yes**
- `remote_migration_allowed_now`: **no**
- `acquisition_activation_allowed_now`: **no**
- `p0_blocker`: **no**
- `p2_debt_controlled`: **yes**

---

## Future Work

### Phase 1: Schema Deployment
- Apply migration 0186
- Verify tenant isolation
- Enable feature flag

### Phase 2: UI Integration
- Admin dashboard for acquisition metrics
- Analytics page for content performance
- Scheduled posts calendar

### Phase 3: Automation
- Cron job for daily post generation
- Automatic publishing via SocialFlow integration
- Performance alerts for underperforming content

---

## References

- **P0 Audit:** `MENTORIA_AUDIT_2026-05-22.md`
- **Drift Analysis:** `MENTORIA_P0-1_ACQUISITION_RUNTIME_DRIFT_REPORT.md`
- **Migration Pattern:** `migrations/0165_mentoria_scheduled_posts_tenant.sql` (reference)
- **Resilience FK:** `migrations/0173_mentoria_resilience_runtime.sql:58` (references acquisition_posts)

---

**Maintained by:** Engineering Team  
**Contact:** #mentoria-dev  
**Status Dashboard:** Pending (create when feature activated)
