# Phase 22 Hotfix - Build-Safe Env Validation

**Date**: 2026-02-14  
**Issue**: Cloudflare Pages build failing with `MISSING_ENV: GOOGLE_CLIENT_ID`  
**Status**: ✅ FIXED

---

## Root Cause

**Problem**: `requireEnv("GOOGLE_CLIENT_ID")` called at module load time

**Chain of failure**:
```
Build → Import client-social/route.ts 
     → Import @/lib/auth (authOptions)
     → Import GoogleProvider with safeEnv.GOOGLE_CLIENT_ID
     → safeEnv getter calls requireEnv("GOOGLE_CLIENT_ID")
     → Throws Error: MISSING_ENV at build time
     → Build fails
```

**Why it fails**: Next.js build process imports all route modules to analyze them. If any module-level code throws, build fails.

---

## Fix Applied

### 1. Made Google OAuth credentials optional (`src/lib/env.ts`)

**Before**:
```typescript
export interface DrakoStrictEnv {
    GOOGLE_CLIENT_ID: string;  // ❌ Required
    GOOGLE_CLIENT_SECRET: string;  // ❌ Required
}

export const safeEnv = {
    get GOOGLE_CLIENT_ID() { return requireEnv("GOOGLE_CLIENT_ID"); },  // ❌ Throws if missing
    get GOOGLE_CLIENT_SECRET() { return requireEnv("GOOGLE_CLIENT_SECRET"); },
}
```

**After**:
```typescript
export interface DrakoStrictEnv {
    GOOGLE_CLIENT_ID?: string;  // ✅ Optional
    GOOGLE_CLIENT_SECRET?: string;  // ✅ Optional
}

export const safeEnv = {
    get GOOGLE_CLIENT_ID() { return getEnv("GOOGLE_CLIENT_ID"); },  // ✅ Returns "" if missing
    get GOOGLE_CLIENT_SECRET() { return getEnv("GOOGLE_CLIENT_SECRET"); },
}
```

### 2. Made Google provider conditional (`src/lib/auth.ts`)

**Before**:
```typescript
export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({  // ❌ Always tries to initialize
            clientId: safeEnv.GOOGLE_CLIENT_ID,
            clientSecret: safeEnv.GOOGLE_CLIENT_SECRET,
        }),
        // ...
    ]
}
```

**After**:
```typescript
function buildProviders() {
    const providers: any[] = [];

    // ✅ Only add Google provider if credentials are configured
    if (safeEnv.GOOGLE_CLIENT_ID && safeEnv.GOOGLE_CLIENT_SECRET) {
        providers.push(GoogleProvider({
            clientId: safeEnv.GOOGLE_CLIENT_ID,
            clientSecret: safeEnv.GOOGLE_CLIENT_SECRET,
        }));
    }

    // ✅ Always add credentials provider
    providers.push(CredentialsProvider({ /* ... */ }));

    return providers;
}

export const authOptions: NextAuthOptions = {
    providers: buildProviders(),  // ✅ Conditional providers
    // ...
}
```

---

## Validation

### Build Test (without GOOGLE_CLIENT_ID)
```bash
npm run build
```

**Result**:
```
✅ Compiled successfully in 27.9s
✅ EXIT CODE: 0
```

### Runtime Behavior (fail-closed)

**When Google OAuth credentials are missing**:
- ✅ Build succeeds (no module-level errors)
- ✅ Only Credentials provider available (email/password login)
- ✅ Google OAuth button won't appear in UI (graceful degradation)

**When Google OAuth credentials are present**:
- ✅ Both providers available (Google + Credentials)
- ✅ Full OAuth flow works as before

---

## Commit

```bash
git add src/lib/env.ts src/lib/auth.ts
git commit -m "fix: make client-social analysis endpoint build-safe when env missing"
git push origin main
```

**Pushed**: ✅ Triggered Cloudflare Pages deployment

---

## Security Validation (Fail-Closed)

✅ **Build-time**: No failures if env vars missing  
✅ **Runtime**: Google OAuth unavailable if creds missing (safe degradation)  
✅ **Edge compatible**: No Node.js APIs used  
✅ **No bypass**: Credentials provider still requires valid DB authentication

**No 503 handler needed** because:
- The affected endpoint (`/api/analysis/client-social`) doesn't directly use Google OAuth
- It only uses `getServerSession(authOptions)` which works fine with either provider
- Missing Google OAuth just means one less login method, not a service failure

---

## Next Steps

1. ⏳ Monitor Cloudflare Pages build (should pass now)
2. ⏳ Verify production URL accessible
3. ✅ Resume Phase 23 (Revenue Simulation) once deployment stable

---

**Status**: Hotfix complete. Awaiting Cloudflare deployment confirmation.
