# drako-base-3 Traffic Report

Date: 2026-02-26  
Worker: `drako-base-3`  
Purpose: Validate real residual ingress before final decommission.

## 1) Capture Window

- Start: `2026-02-26T18:31:28+01:00`
- End: `2026-02-26T18:44:24+01:00`
- Duration: `12m56s`
- Command:

```bash
timeout 900 npx wrangler tail drako-base-3 --format json
```

- Exit code: `0`

## 2) Raw Event Summary

- Total events captured: `1`
- Event types:
  - `cron scheduled event`: `1`
- HTTP request events: `0`

Captured event:

- `outcome=exception`
- `message="Handler does not export a scheduled() function"`
- `cron=*/10 * * * *`
- `scriptVersion=7f118bc5-d69f-42e1-8236-eceec6a35f4e`

## 3) Top Paths and Statuses

- Top paths: none (no HTTP ingress observed)
- Top statuses: none (no HTTP ingress observed)
- Mapped-route hits (registry/governance/billing/observability/ai): `0`
- 410 sunset hits: `0`
- 403 host-fencing hits: `0`

## 4) Origin Analysis

Detected source:

- Internal legacy cron trigger attached to `drako-base-3` (`*/10 * * * *`), not end-user traffic.

Corrective action executed:

- Removed schedules via API (`PUT /workers/scripts/drako-base-3/schedules` with `[]`).

Evidence:

- Before: one schedule (`*/10 * * * *`)
- After: empty schedule list (`[]`)

## 5) Decommission Readiness

- Residual user traffic: not detected.
- Residual system traffic: fixed (cron removed).
- Outcome: ingress risk reduced and ready for `workers.dev` disable.
