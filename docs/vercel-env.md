# Vercel Environment Variables

This document lists all environment variables required or recommended for deploying Drako Base on Vercel.

## Platform Detection (Auto-Set)

These variables are automatically set by the deployment platform:

- **`VERCEL`**: Set to `"1"` when running on Vercel
- **`VERCEL_URL`**: Auto-set deployment URL on Vercel
- **`CF_PAGES_ENVIRONMENT`**: Set by Cloudflare Pages (production/preview)
- **`CF_PAGES_BRANCH`**: Git branch on Cloudflare Pages
- **`NEXT_RUNTIME`**: Set to `"edge"` or `"nodejs"` by Next.js

## Required for Basic Operation

### Session Security
- **`SESSION_SECRET`**: Secret key for session encryption
  - **Example**: `your-secret-key-min-32-chars`
  - **Vercel**: Set in Project Settings → Environment Variables

## Database (Cloudflare D1 - Not Available on Vercel)

The application uses Cloudflare D1 database which is **only available on Cloudflare Pages**. On Vercel:

- **`DRACO_DB`**: D1 Database binding (Cloudflare-only)
  - **Vercel Behavior**: NOT available, app degrades gracefully
  - **Impact**: Database-dependent features return 503 or empty results
  - **Workaround**: Future implementation of HTTP-based database client

> **Note**: The app is designed to work without the database on Vercel. Core UI and static pages will load, but features requiring tenant/domain lookup will be disabled.

## Stripe Integration (Optional)

Required only if using Stripe payments:

- **`STRIPE_PUBLISHABLE_KEY`**: Stripe public API key  
  - **Example**: `pk_test_...`
  
- **`STRIPE_SECRET_KEY`**: Stripe secret API key  
  - **Example**: `sk_test_...`
  
- **`STRIPE_WEBHOOK_SECRET`**: Stripe webhook endpoint secret  
  - **Example**: `whsec_...`

- **`DRAKO_BASE_PRODUCT_ID`**: Stripe product ID
- **`DRAKO_BASE_STARTER_PRICE_ID`**: Stripe price ID for starter plan
- **`DRAKO_CLINIC_STARTER_PRICE_ID`**: Stripe price ID for clinic plan
- **`MENTOR_IA_PRICE_ID`**: Stripe price ID for MentorIA plan

## AI Integration (Cloudflare-Only)

These variables enable AI features via Cloudflare Workers AI:

- **`AI`**: Cloudflare Workers AI binding (Cloudflare-only)
- **`AI_GATEWAY_ID`**: Cloudflare AI Gateway ID
- **`AI_GATEWAY_COMPAT_TOKEN`**: AI Gateway authentication token
- **`CF_ACCOUNT_ID`**: Cloudflare account ID
- **`FIREWORKS_API_KEY`**: Fireworks AI API key (alternative provider)
- **`ORCHESTRATOR_MODEL`**: AI model identifier

> **Vercel Behavior**: AI features will use mock responses when these are unavailable.

## Rate Limiting (Optional)

- **`DRACO_RATE_LIMIT_ENABLED`**: Enable rate limiting (`"true"` or `"false"`)
- **`DRACO_PUBLIC_RPM`**: Requests per minute for public endpoints
- **`DRACO_PUBLIC_BURST`**: Burst allowance for rate limiting

## Application Configuration

- **`APP_URL`**: Base URL of the application
  - **Example**: `https://your-app.vercel.app`
  - **Vercel**: Auto-detected from `VERCEL_URL` if not set

- **`DEMO_MODE`**: Enable demo mode
  - **Values**: `"true"` or omit for production

- **`DEFAULT_TENANT_ID`**: Fallback tenant ID when DB unavailable

## Cloudflare Provisioning (Cloudflare-Only)

Used for automated Cloudflare resource provisioning:

- **`CF_API_TOKEN`** or **`CLOUDFLARE_API_TOKEN`**: Cloudflare API token
- **`CLOUDFLARE_ACCOUNT_ID`**: Cloudflare account ID
- **`CF_ZONE_ID`** or **`CLOUDFLARE_ZONE_ID`**: Cloudflare Zone ID

> **Vercel Behavior**: Not used, provisioning features disabled.

---

## Minimum Configuration for Vercel

To get the app running on Vercel with **bare minimum** configuration:

```bash
SESSION_SECRET=your-super-secret-key-at-least-32-characters-long
APP_URL=https://your-app.vercel.app
```

## Expected Behavior on Vercel

### ✅ Works Without Database

- Homepage / landing pages
- Static content
- `/api/health-simple` endpoint
- Public routes

### ⚠️ Degrades Gracefully (Returns 503 or Empty Data)

- Tenant-specific features
- Domain routing/resolution
- Database-dependent API endpoints
- Multi-tenant SaaS features

### ❌ Not Available (Cloudflare-Only)

- D1 Database queries
- Workers AI binding
- Cloudflare resource provisioning
- Cloudflare-specific bindings (KV, R2, etc.)

---

## Setting Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with appropriate scope:
   - **Production**: Production deployments only
   - **Preview**: Preview deployments only
   - **Development**: Local development (optional)

4. Redeploy the application after adding variables

---

## Troubleshooting

### Issue: 500 Error on Middleware

**Cause**: Middleware throwing exception when Cloudflare context unavailable  
**Fix**: ✅ OLIMPO updates make this impossible - middleware NEVER throws

### Issue: Database Unavailable Errors

**Cause**: Vercel doesn't have D1 database binding  
**Fix**: ✅ Expected behavior - app degrades gracefully, returns empty data

### Issue: AI Features Not Working

**Cause**: Cloudflare Workers AI not available on Vercel  
**Fix**: ✅ App uses mock responses - features degrade gracefully

---

## Future Enhancements

To make database features work on Vercel, consider:

1. **HTTP-based D1 Client**: Access D1 via Cloudflare's D1 HTTP API
2. **Alternative Database**: Migrate to Vercel Postgres, PlanetScale, or Supabase
3. **Hybrid Deployment**: Keep database on Cloudflare, deploy frontend to Vercel
