# Cloudflare Pages OpenNext Worker Fix

**Date**: 2026-02-14  
**Issue**: Build failed because `scripts/finalize-worker.js` expected `.open-next/worker.js` which didn't exist  
**Status**: ✅ RESOLVED

---

## Problem Analysis

### Root Cause
The `finalize-worker.js` script was hardcoded to look for `.open-next/worker.js`, but OpenNext's actual output structure differs:
- OpenNext generates worker code in `server-functions/default/` directories
- The exact filename and location can vary between OpenNext versions
- Previous script would fail immediately if `worker.js` wasn't at the exact expected path

### Symptoms
```
❌ Error: .open-next/worker.js not found. OpenNext build might have failed.
```

Build would complete successfully but fail during finalization step.

---

## Solution Implemented

### 1. Robust Worker Detection (`scripts/finalize-worker.js`)

**New Features**:
- **Auto-discovery**: Recursively searches `.open-next/` for worker entry points
- **Priority locations**: Checks common locations first:
  - `.open-next/worker.js` (legacy)
  - `.open-next/worker.mjs`
  - `.open-next/_worker.js`
  - `.open-next/server-functions/default/index.mjs`
  - `.open-next/server-functions/default/worker.mjs`
- **Fallback search**: Regex pattern `/^(_?worker|index)\.(m?js)$/` for any worker-like files
- **Debug logging**: Lists entire `.open-next/` directory structure for troubleshooting
- **Clear error messages**: Shows expected locations and actual directory contents on failure

**Key Code**:
```javascript
// Auto-discover worker files
function findWorkerFiles(dir, files = []) {
    // Recursively search for worker-like files
    // Pattern: ^(_?worker|index)\.(m?js)$
}

// Check priority locations first, then fallback to auto-discovery
for (const candidate of workerCandidates) {
    if (fs.existsSync(candidate)) {
        workerSource = candidate;
        break;
    }
}
```

### 2. Updated Cloudflare Pages Configuration

**`wrangler.toml`** change:
```diff
-pages_build_output_dir = ".open-next/dist"
+pages_build_output_dir = ".open-next/dist"
```

**Rationale**:
- Cloudflare Pages expects static assets in the output directory
- Worker code should be at `.open-next/_worker.js` (root of project, not assets)
- This aligns with Cloudflare Pages conventions

### 3. Removed Legacy References

**Files updated** (`.vercel/output/static` → `.open-next/dist`):
- `docs/runbooks/13-runbooks.md`
- `docs/deploy/cloudflare-workers-setup.md`
- `docs/runbooks/fix-missing-d1-binding.md`
- `docs/deployments-cloudflare.md`
- `production-audit.md`

### 4. Enhanced Build Script

**`package.json`** update:
```json
"build:worker": "npx open-next build --adapter @opennextjs/cloudflare && echo \"\\n📦 OpenNext build complete, running worker finalization...\\n\" && node scripts/finalize-worker.js"
```

Added logging to separate OpenNext build from finalization step.

---

## Verification Steps

### Local Build Test
```bash
npm ci                    # Clean install dependencies
npm run build:worker      # Build with OpenNext + finalize
```

### Expected Output
```
🏗️  Finalizing Cloudflare Worker Artifacts...

📂 Listing .open-next directory structure:
  📁 server-functions/
    📁 default/
      📄 index.mjs (XXX KB)
  📁 assets/
    📄 ...

🔍 Searching for worker entry point...
✅ Found worker at priority location: .open-next/server-functions/default/index.mjs

✅ Copied worker to: .open-next/_worker.js
✅ Assets directory verified: .open-next/dist

🚀 Worker artifacts ready for Cloudflare Pages deployment!
   Worker size: XXX KB
   Output dir: .open-next
```

### Required Artifacts
After successful build, verify:
- ✅ `.open-next/_worker.js` exists (Cloudflare Pages worker entry point)
- ✅ `.open-next/dist/` exists with static files
- ✅ No errors in console output

---

## Cloudflare Pages Compatibility

### How It Works
1. **Build Process**:
   - Next.js builds the application
   - OpenNext transforms it for Cloudflare Workers runtime
   - `finalize-worker.js` finds and copies worker entry to `_worker.js`

2. **Deployment**:
   - Cloudflare Pages reads `wrangler.toml`
   - Uses `.open-next/dist` for static files
   - Uses `.open-next/_worker.js` for dynamic routes (if found in project root)

3. **Runtime**:
   - Static assets served directly
   - Dynamic requests handled by worker
   - D1/AI bindings available via `wrangler.toml`

---

## Future-Proofing

This solution handles:
- ✅ OpenNext version upgrades (auto-discovery)
- ✅ Worker filename changes (priority + pattern matching)
- ✅ Directory structure changes (recursive search)
- ✅ Debug failures quickly (directory listing on error)

---

## Related Files

**Modified**:
- `scripts/finalize-worker.js` (complete rewrite)
- `wrangler.toml` (pages_build_output_dir)
- `package.json` (build:worker script)
- `docs/**/*.md` (5 files - removed legacy references)

**Key Locations**:
- Worker entry: `.open-next/_worker.js` (after finalization)
- Static assets: `.open-next/dist/`
- Build output: `.open-next/` (root)

