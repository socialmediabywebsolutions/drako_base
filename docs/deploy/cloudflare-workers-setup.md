# Final Deployment Setup - Cloudflare Workers Only

## 🎯 Decision: Workers ONLY (No Pages)

**Cloudflare Pages is incompatible with `@opennextjs/cloudflare` output.**

Pages expects `.open-next/assets`, but OpenNext generates `.open-next/` for Workers.

---

## 1️⃣ Disable Cloudflare Pages Auto-Deploy

### Option A: Pause Builds (Recommended)

1. Go to **Cloudflare Dashboard**
2. **Pages** → **drako-base-3**
3. **Settings** → **Builds & deployments**
4. Click **"Pause builds"**

This keeps the project but stops auto-deployments.

### Option B: Delete Pages Project

1. Go to **Cloudflare Dashboard**
2. **Pages** → **drako-base-3**
3. **Settings** → Delete project
4. Confirm deletion

**Note:** After deletion, the `drako-base-3.pages.dev` domain will be gone.

---

## 2️⃣ Manual Deployment (Immediate)

### Prerequisites

```bash
# Login to Cloudflare (one time)
wrangler login
```

### Deploy Now

```bash
cd c:\CAMPAMENTO BASE DRAKO\drako_base

# Build + Deploy
npm run deploy

# Or step by step:
npm run build:worker
npx wrangler deploy --config wrangler.workers.toml
```

### Expected Output

```
✨ Built OpenNext bundle
⬆️  Uploading...
✨ Success! Deployed to:
   https://drako-base-3.your-subdomain.workers.dev
```

---

## 3️⃣ Automated Deployment (GitHub Actions)

### A. Configure GitHub Secrets

1. **Get Cloudflare API Token:**
   - Cloudflare Dashboard → My Profile → API Tokens
   - Create Token → Use "Edit Cloudflare Workers" template
   - Copy token

2. **Get Account ID:**
   - Cloudflare Dashboard → Workers & Pages → Overview
   - Copy Account ID (on right sidebar)

3. **Add Secrets to GitHub:**
   - GitHub repo → Settings → Secrets and variables → Actions
   - New repository secret:
     - Name: `CLOUDFLARE_API_TOKEN`
     - Value: [your token]
   - New repository secret:
     - Name: `CLOUDFLARE_ACCOUNT_ID`
     - Value: [your account ID]

### B. GitHub Actions Workflow Created

**File:** `.github/workflows/deploy-workers.yml`

**Triggers:**
- Every push to `main` branch
- Manual trigger via "Actions" tab

**What it does:**
1. Checkout code
2. Install dependencies
3. Build OpenNext (`.open-next/`)
4. Verify output exists
5. Deploy to Workers with `wrangler deploy`

### C. Test Deployment

**Option 1: Push to main**
```bash
git push origin main
```

**Option 2: Manual trigger**
1. GitHub → Actions tab
2. Deploy to Cloudflare Workers
3. "Run workflow" → Run

### D. Monitor Deployment

- GitHub → Actions tab → Latest workflow run
- Check logs for errors
- Verify deployment URL at end of logs

---

## 4️⃣ Verify Deployment

### After Deploy

```bash
# View live logs
npx wrangler tail --config wrangler.workers.toml

# List deployments
npx wrangler deployments list --config wrangler.workers.toml

# Test endpoint
curl https://drako-base-3.your-subdomain.workers.dev
```

### Check in Dashboard

1. Cloudflare Dashboard → Workers & Pages
2. Click **drako-base-3** worker
3. View:
   - Deployment status
   - Analytics
   - Logs
   - Bindings (D1, AI)

---

## 5️⃣ Add Custom Domain (Optional)

```bash
npx wrangler domains add drako.systems --config wrangler.workers.toml
```

Or via Dashboard:
1. Workers → drako-base-3 → Settings → Domains & Routes
2. Add Custom Domain
3. Enter domain (e.g., `drako.systems`)
4. Cloudflare auto-configures DNS

---

## 📊 Deployment Comparison

| Method | Trigger | Speed | Best For |
|--------|---------|-------|----------|
| Manual (`npm run deploy`) | Manual command | Immediate | Testing, hotfixes |
| GitHub Actions | Git push to main | 2-3 min | Production, automation |
| Wrangler CLI | Manual command | Immediate | Development, debugging |

---

## 🔧 Commands Reference

```bash
# Development
npm run dev                    # Next.js dev server
npm run preview               # Wrangler dev preview

# Build
npm run build:worker          # Build OpenNext

# Deploy
npm run deploy                # Build + deploy
npx wrangler deploy --config wrangler.workers.toml

# Monitor
npx wrangler tail             # Live logs
npx wrangler deployments list # Deployment history

# Rollback
npx wrangler rollback [id]    # Rollback to previous
```

---

## ✅ Production Checklist

### Before First Deploy

- [x] Pages auto-deploy disabled
- [x] `wrangler.workers.toml` configured
- [x] GitHub Actions workflow created
- [ ] GitHub secrets configured (API token + Account ID)
- [ ] `wrangler login` completed locally
- [ ] Build tested: `npm run build:worker`

### After First Deploy

- [ ] Worker URL accessible
- [ ] D1 database working (test `/api/debug/bindings`)
- [ ] Workers AI binding working
- [ ] Static assets loading
- [ ] Custom domain configured (optional)
- [ ] Monitoring/alerts set up

---

## 🚨 Troubleshooting

### "Authentication error"

**Cause:** Not logged in or invalid token.

**Fix:**
```bash
wrangler login  # For manual deploy
# OR add/update GitHub secrets for Actions
```

### "Build failed: .open-next not found"

**Cause:** Build script didn't complete.

**Fix:**
```bash
rm -rf .open-next
npm run build:worker
```

### "Worker not accessible"

**Cause:** Deployment succeeded but not live yet.

**Fix:** Wait 30-60 seconds, then check again.

### "D1 binding not found"

**Cause:** Database not bound or incorrect ID.

**Fix:** Verify `database_id` in `wrangler.workers.toml` matches Dashboard.

---

## 🎯 Next Steps

1. **Disable Pages:**
   - Go to Dashboard → Pages → drako-base-3
   - Pause builds

2. **Configure GitHub Secrets:**
   - Add `CLOUDFLARE_API_TOKEN`
   - Add `CLOUDFLARE_ACCOUNT_ID`

3. **Test Manual Deploy:**
   ```bash
   npm run deploy
   ```

4. **Test Auto-Deploy:**
   ```bash
   git push origin main
   # Watch GitHub Actions
   ```

5. **Add Custom Domain** (optional):
   ```bash
   npx wrangler domains add drako.systems
   ```

---

## 📝 Summary

✅ **Workers deployment configured**  
✅ **GitHub Actions workflow created**  
✅ **Manual deploy ready:** `npm run deploy`  
✅ **Pages disabled:** Prevents conflicts  
✅ **Production-ready:** Full Node.js runtime

**Deploy now:**
```bash
npm run deploy
```

