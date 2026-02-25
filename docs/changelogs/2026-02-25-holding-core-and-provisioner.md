# holding changelog - 2026-02-25

## drako-core-worker
- Promoted to production with real bindings (`DRKO_HOLDING_DB`, `DRKO_GLOBAL_CONFIG`, `DRKO_GLOBAL_EVENTS`).
- Added canonical `GovernanceEventSpec v1` and strict validation in `/governance/events`.
- Aligned governance persistence and queue publication to the same event payload (`event_json` parity).
- Added migration `0002_governance_event_contract_v1.sql` for governance contract columns.
- Maintained audit coverage for critical routes.
