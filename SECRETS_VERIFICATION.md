# Secrets Verification - P0 Closure

**Date**: 2026-03-29  
**Status**: VERIFICATION REQUIRED  
**Impact**: Auth Token Signing/Verification

---

## Required Secrets

### Mentoria SaaS

**Secret Name**: `MENTORIAS_AUTHS_SECRET`  
**Location**: Cloudflare Secrets (worker: `saas-mentorias-prod`)  
**Used By**: `src/lib/auths/tokens.ts` → `readSecret("mentorias")`  
**Purpose**: HMAC-SHA256 signing and verification of session tokens  
**Status**: ⏳ **NOT VERIFIED** (must be checked in Cloudflare dashboard)

**Evidence**:
- `workers/mentorias/wrangler.workers.toml` line 50: `AUTHS_SECRETS_NAME = "MENTORIAS_AUTHS_SECRET"` (variable reference only)
- `src/lib/auths/tokens.ts` lines 104-107:
  ```typescript
  if (context === "mentorias") {
    const secret = direct("MENTORIAS_AUTHS_SECRET") ?? direct("SESSION_SECRET");
    if (!secret) throw new Error("MENTORIAS_AUTHS_SECRET is not configured");
    return secret;
  }
  ```

### Drakos SaaS

**Secret Name**: `DRAKOS_AUTHS_SECRET`  
**Location**: Cloudflare Secrets (worker: `saas-drakos-prod`)  
**Used By**: `src/lib/auths/tokens.ts` → `readSecret("drakos")`  
**Purpose**: HMAC-SHA256 signing and verification of session tokens  
**Status**: ⏳ **NOT VERIFIED** (must be checked in Cloudflare dashboard)

**Evidence**:
- `workers/drakos/wrangler.workers.toml` line 47: `NEXTAUTH_URL = "https://drako.systems"` (no explicit secret var, but code reads it)
- `src/lib/auths/tokens.ts` lines 99-102:
  ```typescript
  if (context === "drakos") {
    const secret = direct("DRAKOS_AUTHS_SECRET") ?? direct("NEXTAUTH_SECRET");
    if (!secret) throw new Error("DRAKOS_AUTHS_SECRET is not configured");
    return secret;
  }
  ```

---

## Verification Checklist

### Manual Verification (Cloudflare Dashboard)

1. **Mentoria Worker**
   - [ ] Go to Cloudflare → Workers & Pages → `saas-mentorias-prod`
   - [ ] Click "Settings" → "Secrets"
   - [ ] Confirm `MENTORIAS_AUTHS_SECRET` exists and is not empty
   - [ ] Confirm value is a strong random string (≥32 chars)

2. **Drakos Worker**
   - [ ] Go to Cloudflare → Workers & Pages → `saas-drakos-prod`
   - [ ] Click "Settings" → "Secrets"
   - [ ] Confirm `DRAKOS_AUTHS_SECRET` exists and is not empty
   - [ ] Confirm value is a strong random string (≥32 chars)

### Runtime Verification

**Test**: Session token creation and verification

```bash
# In local dev with D1 + env vars set:
npm run test -- tests/lib/auth-session-cookie-e2e.test.ts

# Expected: All token creation/verification tests pass
```

**Test**: Health check with missing secret

```bash
# Unset MENTORIAS_AUTHS_SECRET in env
unset MENTORIAS_AUTHS_SECRET

# Call any Mentoria auth route (e.g., GET /api/mentorias/auths/sessions)
# Expected: 500 with "MENTORIAS_AUTHS_SECRET is not configured"
```

---

## Failure Modes

### If Secret is Missing

**Symptom**: Auth routes return 500 with error message:
```
MENTORIAS_AUTHS_SECRET is not configured
```

**Impact**: 
- Session creation fails (login broken)
- Session verification fails (all protected routes return 401)
- Family routes unreachable (no valid session)

**Fix**: 
1. Generate strong random secret (e.g., `openssl rand -base64 32`)
2. Add to Cloudflare Secrets for the worker
3. Redeploy worker (or secrets auto-sync, depending on CF setup)

### If Secret is Weak

**Symptom**: No immediate error, but tokens are cryptographically weak

**Impact**: 
- Tokens could be forged by attackers
- Session hijacking possible

**Fix**: 
1. Rotate secret to strong random value
2. Invalidate all existing sessions (optional, depends on TTL)
3. Redeploy

### If Secret Differs Between Environments

**Symptom**: 
- Dev tokens don't work in prod
- Prod tokens don't work in dev
- Cross-tenant token forgery possible

**Impact**: 
- Auth isolation broken
- Multi-tenant security compromised

**Fix**: 
1. Ensure each environment (dev, staging, prod) has its own secret
2. Ensure each SaaS (Mentoria, Drakos) has its own secret
3. Never share secrets across boundaries

---

## Current Status

| Secret | Worker | Status | Evidence |
|--------|--------|--------|----------|
| `MENTORIAS_AUTHS_SECRET` | `saas-mentorias-prod` | ⏳ Unverified | Var defined, secret not checked |
| `DRAKOS_AUTHS_SECRET` | `saas-drakos-prod` | ⏳ Unverified | Code expects it, secret not checked |

---

## P0 Closure Dependency

**Blocking**: YES

Cannot close P0 without confirming:
1. Both secrets exist in Cloudflare
2. Both secrets are non-empty and strong
3. Runtime verification passes (token creation/verification)

---

## Next Steps

1. **Manual Check**: Verify secrets in Cloudflare dashboard
2. **Runtime Test**: Run auth token tests
3. **Document Result**: Update this file with verification timestamp
4. **Proceed to P0_FIXED**: Only if all checks pass
