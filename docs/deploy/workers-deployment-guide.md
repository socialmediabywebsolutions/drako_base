# Cloudflare Workers Deployment Guide (OpenNext)

## 🎯 Architecture Decision

**Deployment Target:** Cloudflare Workers (NOT Pages)  
**Adapter:** `@opennextjs/cloudflare`  
**Runtime:** Node.js (via `nodejs_compat`)

### Why Workers over Pages?

✅ **Full Node.js runtime** - ISR, server actions, full Next.js features  
✅ **Direct worker control** - Custom routing, middleware, full SSR  
✅ **OpenNext compatibility** - Designed for Workers, not Pages  
✅ **Production-grade** - Better performance, more flexibility  
❌ **Pages limitation** - Edge runtime only, limited features

---

## 📦 Build & Deploy

### Local Development
```bash
npm run dev
# Next.js dev server on http://localhost:3000
```

### Build for Production
```bash
npm run build:worker
# Generates: .open-next/worker.js + .open-next/assets/
```

### Preview Locally (Wrangler)
```bash
npm run preview
# Builds + runs wrangler dev with Workers runtime
```

### Deploy to Production
```bash
npm run deploy
# Build + deploy to Cloudflare Workers
```

### Deploy to Specific Environment
```bash
npm run deploy:production
# Explicitly deploy to production env
```

---

## ⚙️ Configuration Files

### `wrangler.workers.toml`

**Production config for Workers:**

```toml
name = "drako-base-3"
main = ".open-next/worker.js"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

# Static assets
[assets]
directory = ".open-next/assets"

# Workers AI
[ai]
binding = "AI"

# D1 Database (Production)
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"
database_id = "5607a76a-97c7-45a9-a948-e545ba27eae7"

# Preview environment
[env.preview]
main = ".open-next/worker.js"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[[env.preview.d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db"
database_id = "10146888-ca79-41d6-b6c2-bf1025eb651b"

[env.preview.ai]
binding = "AI"

# Cron triggers
[triggers]
crons = ["*/10 * * * *"]
```

### `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build:worker": "npx open-next build --adapter @opennextjs/cloudflare",
    "deploy": "npm run build:worker && npx wrangler deploy --config wrangler.workers.toml",
    "deploy:production": "npm run build:worker && npx wrangler deploy --config wrangler.workers.toml --env production",
    "preview": "npm run build:worker && npx wrangler dev --config wrangler.workers.toml"
  }
}
```

---

## 🌐 Custom Domain Setup

### Add Custom Domain

```bash
npx wrangler domains add drako.systems --config wrangler.workers.toml
```

Or via Cloudflare Dashboard:
1. Go to Workers & Pages → Your Worker
2. Settings → Domains & Routes
3. Add Custom Domain: `drako.systems`
4. Cloudflare auto-configures DNS if domain is on Cloudflare

### Multiple Domains/Routes

Add to `wrangler.workers.toml`:

```toml
routes = [
  { pattern = "drako.systems/*", zone_name = "drako.systems" },
  { pattern = "*.drako.systems/*", zone_name = "drako.systems" }
]
```

---

## 🔗 Bindings Configuration

### D1 Database

Already configured in `wrangler.workers.toml`. Access in code:

```typescript
// In API routes or server components
const db = process.env.DRACO_DB;
const result = await db.prepare("SELECT * FROM users").all();
```

### Workers AI

```typescript
const ai = process.env.AI;
const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
  prompt: "Hello world"
});
```

### KV, R2, DO (if needed)

Add to `wrangler.workers.toml`:

```toml
[[kv_namespaces]]
binding = "MY_KV"
id = "your-kv-id"

[[r2_buckets]]
binding = "MY_BUCKET"
bucket_name = "my-bucket"
```

---

## 🚀 Deployment Process

### Manual Deployment

```bash
# 1. Build OpenNext bundle
npm run build:worker

# 2. Verify output
ls -la .open-next/
# Should see: worker.js, assets/, server-functions/

# 3. Deploy
npx wrangler deploy --config wrangler.workers.toml
```

### CI/CD (GitHub Actions)

Create `.github/workflows/deploy-workers.yml`:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm ci
      
      - name: Build OpenNext
        run: npm run build:worker
        
      - name: Deploy to Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy --config wrangler.workers.toml
```

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN` - API token with Workers deploy permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

---

## 📊 Build Output Structure

```
.open-next/
├── worker.js              # Main Worker entry point
├── assets/                # Static files (served automatically)
│   ├── _next/            # Next.js build artifacts
│   ├── favicon.ico
│   └── [other static files]
├── server-functions/      # SSR/API handlers
│   └── default/
│       ├── index.mjs     # Server runtime
│       └── [dependencies]
├── cache/                 # ISR cache
├── revalidation-function/ # ISR revalidation
└── open-next.output.json  # Build metadata
```

---

## ✅ Pre-Deployment Checklist

### Before First Deploy

- [ ] `wrangler login` completed
- [ ] D1 database created and ID in wrangler.workers.toml
- [ ] Workers AI enabled on account
- [ ] Build succeeds: `npm run build:worker`
- [ ] Preview works: `npm run preview`
- [ ] Environment variables set (if any)

### Production Deployment

- [ ] All tests pass
- [ ] Build completed successfully
- [ ] No console errors in preview
- [ ] Database migrations applied
- [ ] Custom domain configured (optional)
- [ ] Cron triggers verified (if used)

---

## 🔍 Verification

### After Deployment

1. **Check deployment:**
   ```bash
   npx wrangler deployments list --config wrangler.workers.toml
   ```

2. **View logs:**
   ```bash
   npx wrangler tail --config wrangler.workers.toml
   ```

3. **Test worker:**
   ```bash
   curl https://drako-base-3.your-subdomain.workers.dev
   ```

4. **Verify bindings:**
   - Test an API route that uses D1
   - Test Workers AI endpoint
   - Check static assets load

---

## 🐛 Troubleshooting

### "worker.js not found"

**Cause:** Build failed or incomplete.

**Fix:**
```bash
rm -rf .open-next
npm run build:worker
```

### "nodejs_compat not enabled"

**Cause:** Missing compatibility flag.

**Fix:** Ensure `wrangler.workers.toml` has:
```toml
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2024-11-01"  # or later
```

### "Assets not loading"

**Cause:** Assets binding not configured.

**Fix:** Ensure `wrangler.workers.toml` has:
```toml
[assets]
directory = ".open-next/assets"
```

### "D1 binding not found"

**Cause:** Database not bound or wrong binding name.

**Fix:**
1. Check binding name matches code
2. Verify database ID is correct
3. Ensure database exists: `npx wrangler d1 list`

---

## 📈 Performance & Monitoring

### Logs

**Real-time:**
```bash
npx wrangler tail --config wrangler.workers.toml
```

**Filter by status:**
```bash
npx wrangler tail --status error
```

### Analytics

View in Dashboard:
- Workers & Pages → drako-base-3 → Analytics
- Metrics: Requests, CPU time, errors
- Logging: Console logs, exceptions

### Optimization

- **Static assets:** Automatically cached via `[assets]`
- **ISR:** Configured via `.open-next/cache/`
- **Edge caching:** Headers set by OpenNext
- **Compression:** Auto-enabled by Cloudflare

---

## 🔄 Rollback

### Rollback to Previous Version

```bash
# List deployments
npx wrangler deployments list

# Rollback to specific deployment
npx wrangler rollback [deployment-id]
```

---

## 📝 Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js dev server |
| `npm run build:worker` | Build OpenNext for Workers |
| `npm run preview` | Preview with wrangler dev |
| `npm run deploy` | Build + deploy to Workers |
| `npm run deploy:production` | Deploy to production env |
| `npx wrangler tail` | View live logs |
| `npx wrangler deployments list` | List deployments |
| `npx wrangler rollback` | Rollback deployment |

---

## 🎯 Next Steps

1. **First Deploy:**
   ```bash
   npm run deploy
   ```

2. **Test Deployment:**
   - Visit worker URL
   - Test API routes
   - Verify D1 queries work
   - Check AI endpoints

3. **Add Custom Domain:**
   ```bash
   npx wrangler domains add drako.systems
   ```

4. **Setup CI/CD:**
   - Add GitHub Actions workflow
   - Configure secrets
   - Test automated deployment

5. **Monitor:**
   - Enable error notifications
   - Set up alerts in Dashboard
   - Monitor analytics

---

## ✅ Production Ready

Your Workers deployment is now configured for:

- ✅ Full Node.js runtime
- ✅ ISR, SSR, API routes
- ✅ D1 database integration
- ✅ Workers AI binding
- ✅ Static asset serving
- ✅ Custom domains
- ✅ Cron triggers
- ✅ Environment-based config

**Deploy now:**
```bash
npm run deploy
```
