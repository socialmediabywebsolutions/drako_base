# Workers Multi-SaaS Migration (No Downtime)

## Objective
Migrate from one monolith worker to one worker per SaaS with no production downtime.

## Ordered Migration Steps

1. Prepare all target workers and bindings.
2. Deploy each worker to Workers runtime using temporary hostnames if needed.
3. Attach custom domains for each SaaS worker.
4. Validate `/api/health` per SaaS domain before traffic switch.
5. Enable temporary `308` redirects on legacy hostnames.
6. Switch DNS gradually per domain:
   - analytics, socialflows
   - cryptos, automations
   - invoices, mentorias
   - drakos, bases
7. Verify auth isolation after each switch:
   - login on domain A,
   - check no session on domain B.
8. Monitor errors and latency per worker with `wrangler tail`.
9. Keep rollback ready: revert domain route to monolith worker.
10. After stabilization window, disable legacy auth endpoints in monolith.

## Verification Commands

```bash
curl -sS https://drakos.drako.systems/api/health | jq .
curl -sS https://mentorias.drako.systems/api/health | jq .
curl -sS https://bases.drako.systems/api/health | jq .
```

```bash
curl -i https://drakos.drako.systems/api/health -H 'Host: mentorias.drako.systems'
```

Expected:

- health requests return `ok: true` and matching `resolvedContext`.
- foreign host fencing returns `403`.

## Rollback Strategy

1. Repoint affected custom domain route back to monolith worker.
2. Keep new worker deployed for forensic checks.
3. Inspect logs with `wrangler tail` on both workers.
4. Fix issue and re-run migration for the impacted domain only.
