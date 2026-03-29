# P0 Validation with Wrangler - Real D1 Runtime

**Status**: Production-aligned local validation using real Cloudflare D1

---

## Prerequisites

1. **Create D1 Local Database** (one-time)
```bash
wrangler d1 create drako_db_local --local
```

2. **Apply Migrations** (one-time)
```bash
wrangler d1 execute drako_db_local --local < migrations/0153_mentoria_family_foundation.sql
```

---

## Validation Commands

### Start Wrangler Dev Server
```bash
wrangler dev --local
```

This starts the local runtime with real D1 binding at `http://localhost:8787`

### Validate Family Flow (Real D1)
```bash
curl http://localhost:8787/api/internal/validate-p0-family
```

**Expected Response** (200 OK):
```json
{
  "status": "SUCCESS",
  "steps": [
    {
      "step": "Creating family...",
      "status": "COMPLETED",
      "result": { "id": "p0-test-family-...", "createdAt": "..." }
    },
    {
      "step": "Creating student...",
      "status": "COMPLETED",
      "result": { "id": "...", "name": "P0-Student-..." }
    },
    {
      "step": "Inviting guardian...",
      "status": "COMPLETED",
      "result": { "id": "...", "email": "p0-guardian-...@test.local" }
    },
    {
      "step": "Retrieving family bundle...",
      "status": "COMPLETED",
      "result": { "familyId": "...", "guardians": 1, "students": 1 }
    },
    {
      "step": "Verifying tenant isolation...",
      "status": "COMPLETED",
      "result": { "tenantIsolationOK": true }
    }
  ],
  "errors": []
}
```

### Validate AI_HARD_OFF Kill-Switch
```bash
curl http://localhost:8787/api/internal/validate-p0-ai-hardoff
```

**Expected Response** (200 OK):
```json
{
  "status": "SUCCESS",
  "tests": [
    {
      "name": "AI_HARD_OFF not set",
      "status": "PASSED",
      "result": { "hardOffValue": null, "shouldAllow": true }
    },
    {
      "name": "AI_HARD_OFF detection logic",
      "status": "PASSED",
      "result": { "configReaderAvailable": true }
    },
    {
      "name": "Kill-switch in content pipeline",
      "status": "PASSED",
      "result": { "killSwitchImplemented": true, "location": "src/lib/drako/content/index.ts" }
    },
    {
      "name": "Kill-switch in Mentoria LLM",
      "status": "PASSED",
      "result": { "killSwitchImplemented": true, "location": "src/lib/agents/mentoria/llm-client.ts" }
    }
  ],
  "errors": []
}
```

---

## Architecture

### Local Runtime (Wrangler Dev)
- **Runtime**: Cloudflare Workers (same as production)
- **Database**: D1 Local (real SQLite, same API as production D1)
- **Bindings**: DRACO_DB (same as production)
- **Model**: Identical to production

### Production Runtime (Cloudflare)
- **Runtime**: Cloudflare Workers
- **Database**: D1 Remote (Cloudflare D1)
- **Bindings**: DRACO_DB (injected by Cloudflare)
- **Model**: Identical to local

---

## Key Differences from Previous Approach

### ❌ REMOVED
- `src/lib/db-local.ts` (JSON mock)
- Fallback to local D1 implementation
- Custom SQL parser
- Node.js-only execution

### ✅ ADDED
- Real D1 via Wrangler
- Endpoints for validation (not scripts)
- Same runtime model as production
- Fail-closed without alternatives

---

## Troubleshooting

### Error: "DRACO_DB binding is missing"
**Cause**: Not running inside Wrangler runtime

**Fix**: Use `wrangler dev` or `wrangler d1 execute` instead of `npx tsx`

### Error: "no such table"
**Cause**: Migrations not applied

**Fix**: Run migration command above

### Error: "database not found"
**Cause**: D1 database not created

**Fix**: Run `wrangler d1 create drako_db_local --local`

---

## Validation Checklist

- ✅ Wrangler dev running with real D1
- ✅ Family endpoint returns 200 with data
- ✅ AI_HARD_OFF endpoint returns 200 with tests
- ✅ Data persists in D1 local
- ✅ Tenant isolation enforced
- ✅ Same model as production
