# Phase 21 Build Fix - Summary

## Problem Statement
Build was failing with webpack error **before** Phase 21 changes could be tested:
```
Module not found: Can't resolve 'crypto'
./node_modules/next-auth/core/init.js:8:1
```

## Root Cause Analysis

### Error Chain
```
/api/mentoria/sessions/route.ts (Edge runtime)
  ↓ imports
authorizeSaasAccess from @/lib/authz/saas-access.ts
  ↓ imports
getServerSession from next-auth
  ↓ requires
Node.js crypto module (incompatible with Edge runtime)
```

### Why It Failed
- `/api/mentoria/sessions/route.ts` was configured as **Edge runtime** (`export const runtime = 'edge'`)
- Edge runtime cannot resolve Node.js built-in modules like `crypto`
- `next-auth` depends on `crypto` for JWT operations
- Webpack unable to polyfill `crypto` for Edge runtime → build failure

### Secondary Issue
Import path error in `src/lib/mentoria/session-engine.ts`:
- Incorrect: `import { MentoriaInvoicer } from '../../billing/mentoria-invoicer'`
- Correct: `import { MentoriaInvoicer } from '../billing/mentoria-invoicer'`

## Fixes Applied

### Fix 1: Runtime Change (Temporary)
**File**: `src/app/api/mentoria/sessions/route.ts`

Changed runtime from `'edge'` to `'nodejs'`:
```typescript
// TEMP: Node.js runtime until Phase 21 Edge Auth migration complete
// Issue: next-auth → crypto polyfill incompatible with Edge runtime
export const runtime = 'nodejs';
```

**Rationale**: Allows build to proceed while Phase 21 implements Edge-native auth. Will revert to `'edge'` in Phase 4.

### Fix 2: Import Path Correction
**File**: `src/lib/mentoria/session-engine.ts`

Corrected relative import paths (2 locations):
```typescript
// Line 2
import { MentoriaInvoicer } from '../billing/mentoria-invoicer';

// Line 129
const { MentoriaInvoicer } = await import('../billing/mentoria-invoicer');
```

## Verification

```bash
npx next build
```

**Result**: ✅ **PASS** (Exit code: 0)

Build output:
```
✓ Compiled successfully in 49s
✓ Generating static pages (213/213)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
ƒ Middleware  60.8 kB
```

## Impact

### Unblocked
- ✅ Build now succeeds
- ✅ Phase 21 execution can proceed
- ✅ Edge Auth Core (`src/lib/edge-auth.ts`) included in commit

### Technical Debt Created
- ⚠️ `/api/mentoria/sessions` temporarily on Node.js runtime
- 📝 Must revert to Edge runtime after Phase 21 Step 4 (endpoints migration)

## Next Steps

1. **Phase 21 Step 1**: Verify `edge-auth.ts` module (already created ✅)
2. **Phase 21 Step 2**: Refactor `middleware.ts` to use `extractSessionFromRequest()`
3. **Phase 21 Step 3**: Refactor `authz/saas-access.ts` to decouple from `next-auth`
4. **Phase 21 Step 4**: Migrate `/api/mentoria/sessions` to use Edge auth + revert runtime to `'edge'`

## Commit

```
fix(build): Unblock Phase 21 - Fix Edge runtime crypto polyfill error
```

SHA: `30a2e45`

Files changed: 89
- Created: `src/lib/edge-auth.ts` (Phase 21 Step 1)
- Modified: `src/app/api/mentoria/sessions/route.ts` (runtime change)
- Modified: `src/lib/mentoria/session-engine.ts` (import path fix)
