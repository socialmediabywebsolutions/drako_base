# holding changelog - 2026-02-25

## drako-core-worker
- Promoted to production with real bindings (`DRKO_HOLDING_DB`, `DRKO_GLOBAL_CONFIG`, `DRKO_GLOBAL_EVENTS`).
- Added canonical `GovernanceEventSpec v1` and strict validation in `/governance/events`.
- Aligned governance persistence and queue publication to the same event payload (`event_json` parity).
- Added migration `0002_governance_event_contract_v1.sql` for governance contract columns.
- Maintained audit coverage for critical routes.

## drako-provisioner-worker
- Initialized holding skeleton with `workers.drako-provisioner-worker` runtime.
- Added `POST /provision/saases/plan` for dry-run planning.
- Added `POST /provision/saases/apply` for intent-only registration + governance event emission.
- Enforced core-first orchestration by calling `drako-core-worker` (`/registry/saases`, `/governance/events`).
