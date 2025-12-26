# Public surface hardening

## Scope

This runbook documents how to harden public endpoints without breaking existing flows.

## Flags

- `DRACO_PUBLIC_LOCKDOWN_ENABLED` (default: false)
  - When true, routes marked as MUST_AUTH are blocked unless authenticated.
- `DRACO_RATE_LIMIT_ENABLED` (default: true)
  - Enables rate limiting on PUBLIC_OK routes.
- `DRACO_PUBLIC_RPM` (default: 60)
  - Requests per minute for public rate limits.
- `DRACO_PUBLIC_BURST` (default: 20)
  - Extra burst capacity per minute.
- `DRACO_PUBLIC_SIGNATURE_REQUIRED` (default: false)
  - When true, public ingest endpoints require token/HMAC.
- `DRACO_PUBLIC_SIGNATURE_MODE` (default: token)
  - `token` or `hmac` for public ingest verification.

## Enable lockdown safely

1) Set `DRACO_PUBLIC_LOCKDOWN_ENABLED=true`.
2) Confirm MUST_AUTH routes in `docs/security/public-endpoints.md`.
3) Validate that authenticated routes still return 200/401 as expected.

## Enable signature enforcement for public ingest

1) Set `DRACO_PUBLIC_SIGNATURE_REQUIRED=true`.
2) Choose mode:
   - `token` (default): set `x-drako-ingest-token` in requests.
   - `hmac`: set `x-drako-signature` as HMAC of raw body.
3) Populate `public_ingest_tokens` with token/secret per tenant/saas.

## Rotate public ingest tokens

1) Update `public_ingest_tokens` for the relevant `tenant_id`/`saas_id`.
2) Update client(s) sending the leads.
3) Verify `security.ingest.invalid_signature` events are not triggered.

## Rate limit tuning

- Increase `DRACO_PUBLIC_RPM` or `DRACO_PUBLIC_BURST` if legitimate traffic is blocked.
- Monitor `security.ratelimit.blocked` events in `campamento_events`.

## Interpreting security events

- `security.ratelimit.blocked`: public rate limit exceeded.
- `security.ingest.invalid_signature`: public ingest token/signature invalid.
- `security.ingest.abuse_detected`: repeated failures triggered Action Queue.
- `security.public_endpoint.lockdown_blocked`: route blocked by lockdown.

## Action Queue for abuse

If repeated public ingest failures occur (10+ within 10 minutes per IP/route), a HIGH priority Action Queue item is created.

## Troubleshooting

- Check `docs/security/public-endpoints.md` for the current public endpoints inventory.
- Use the audit script:
  - `npx tsc --project tsconfig.scripts.json`
  - `node scripts/.dist/audit-public-endpoints.js`
