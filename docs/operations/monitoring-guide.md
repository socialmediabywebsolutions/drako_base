# Operations & Monitoring Guide

**Date**: 2026-02-07
**Status**: Production Ready

This guide details the procedures for monitoring the "Production Clean" baseline of the Drako Systems infrastructure.

## 1. Automated Verification (Smoke Tests)

We have upgraded `scripts/smokes-cloudflare.js` to verify:
1.  **Core Endpoints**: Accessibility of `/admin` and `/api/health`.
2.  **Redirects**: Confirmation that `/agentes` permanently redirects to `/agents`.
3.  **Security**: Confirmation that `/api/health/env` is protected (Status 403/404 without keys).

**Usage:**
```bash
# Test against Local
npm run dev
# In another terminal:
node scripts/smokes-cloudflare.js

# Test against Production/Preview (Set BASE_URL)
BASE_URL=https://drako.systems node scripts/smokes-cloudflare.js
```

## 2. Manual "Reality Feedback" Checks

Execute these commands to manually verify the hardening layers.

### A. Redirects (SEO & Consistency)
Verify that traffic is correctly routed to English endpoints with `308 Permanent Redirect`.

```bash
# 1. Agents
curl -I https://drako.systems/agentes
# Expected: HTTP/2 308 ... Location: /agents

# 2. Departments
curl -I https://drako.systems/departamentos
# Expected: HTTP/2 308 ... Location: /departments
```

### B. Env Doctor (Infrastructure Health)
**Endpoint**: `/api/health/env`

This endpoint is **Fail-Closed**. It tests the presence of critical environment variables (Db, Stripe, Auth) without observing their values.

```bash
# 1. Security Scan (Access without Secret)
curl -I https://drako.systems/api/health/env
# Expected: HTTP/2 404 (if Internal Secret missing) OR 403 (if Secret exists but header missing)

# 2. Authorized Diagnose (Requires Secret)
# Retrieve INTERNAL_API_SECRET from your password manager / dashboard
curl -H "X-Drako-Origin-Secret: YOUR_SECRET_HERE" https://drako.systems/api/health/env
# Expected: HTTP/2 200 OK
# Body: JSON with boolean flags (e.g., "STRIPE_SECRET_KEY": true)
# Header: Cache-Control: no-store
```

### C. Stripe Runtime Isolation
To ensure Stripe is NOT running on Edge (which causes crashes):

1.  **Build Log**: Check CI logs for `npm run build:worker`. Success indicates no Edge violations.
2.  **Runtime Check**: Monitoring logs (Datadog/Sentry/Cloudflare Logs). Search for:
    *   `STRIPE_SDK_LOAD_FAILED` (Means strict isolation is working if it happens on client, or configuration error if on server).
    *   Any `Error: Stripe: ...` originating from `middleware` or `edge` runtimes.

## 3. Host Resolution
Monitor the `resolveHostToSaas` logic for custom domains.

*   **Tools**: `dig`, `curl`
*   **Procedure**:
    ```bash
    dig CNAME client.custom-domain.com
    # Should point to -> drako.systems (or your configured CNAME target)

    curl -I http://client.custom-domain.com
    # Should return 200 OK and serve the SaaS application.
    # Check "X-Drako-Tenant" header if enabled for debugging.
    ```

## 4. Maintenance
*   **Logs**: Regular inspection of Cloudflare Worker Logs / Vercel Logs.
*   **Alerts**: Configure alerts for `5xx` errors on `/api/stripe/webhook`.
