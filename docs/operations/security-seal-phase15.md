# Security Seal: Phase 15 (Tenant Isolation)

**Status:** 🔒 SEALED
**Date:** 2026-02-08

## Protocol: "The Great Filter"

This document seals the implementation of **Strict Tenant Isolation**.
**NO CHANGES** are permitted to the following core components without following the strict protocol below:

### protected_components
- `src/lib/authz/saas-access.ts` (The Core)
- `src/middleware.ts` (Host Resolution & Routing)
- `src/lib/hosts.ts` (Hostname Normalization)
- `src/lib/auth.ts` (Session Callbacks)

### Checklist for Modifications
Any proposed change to the above files requires:
1.  [ ] **Analysis**: Verify impact on `authorizeSaasAccess`.
2.  [ ] **Test**: Run `scripts/verify-tenant-isolation.js` LOCALLY and against STAGING.
3.  [ ] **Evidence**: Capture curl output showing 401/403 for cross-tenant requests.
4.  [ ] **Audit**: Verify no global queries are introduced (must have `WHERE tenant_id = ?`).

### Known State (Post-Seal)
- **Middleware**: Enforces unauthorized redirects (`/site/panel` -> `/client`).
- **API**: Critical endpoints return 401/403 if `tenant_id` mismatches session.
- **DB**: All SaaS-scoped queries must include `tenant_id`.

**DO NOT REMOVE THIS SEAL WITHOUT AUTHORIZATION.**
