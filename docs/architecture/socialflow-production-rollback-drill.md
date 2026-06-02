# SocialFlow Production Rollback Drill

## Executive Summary
This document defines a planned-only rollback drill for SocialFlow. It exists to prove we can abort, restore, and re-check the product path without touching production, DNS, deploy state, or live rollback commands.

## Current State
- `readyForExecution=false`.
- `executionAllowed=false`.
- `commandsArePlannedOnly=true`.
- `requiresHumanApproval=true`.
- `rollbackExecutable=false`.
- `rollbackCommandsPlannedOnly=true`.
- `productionTouchAllowed=false`.
- `productionTouched=false`.
- `remoteWrites=0`.

## Drill Scope
- Validate abort conditions.
- Validate rollback metadata.
- Validate route restoration.
- Validate worker target restoration.
- Validate config restoration.
- Validate post-rollback smokes.
- Validate post-rollback monitoring.
- Validate evidence capture.
- Keep all actions planned-only.

## What Is Not Executed
- No real rollback.
- No deploy.
- No DNS changes.
- No route changes.
- No Cloudflare API calls.
- No wrangler execution.
- No production writes.

## Preconditions
- Planned-only fixture is loaded.
- Fixture host remains `.invalid`.
- Controlled execution runbook exists.
- Production approval pack exists.
- Routing review pack exists.
- Rollback drill script exists.

## Abort Conditions
- Token-like or secret-like values appear in the drill input.
- Any required governance ID is missing.
- The fixture uses a real production domain.
- Any document required by the drill is missing.
- Any step implies a real deploy, route change, or rollback.

## Planned-Only Sequence
1. Freeze production execution.
2. Abort the current cutover window.
3. Restore the previous worker route target.
4. Restore the previous DNS and routing state.
5. Re-run the health smoke.
6. Re-run the readiness smoke.
7. Re-run the postdeploy smoke.
8. Monitor the day window.
9. Record rollback evidence.
10. Require human sign-off.

## Rollback Routing Checklist
- Restore the last approved route manifest.
- Keep the route review pack as the source of truth.
- Confirm the route remains planned-only until approval.
- Confirm no active route line is introduced by the drill.

## Rollback Worker Target Checklist
- Restore the previous worker target.
- Confirm the worker target matches the approved rollout state.
- Confirm the target is recorded in the drill evidence.

## Rollback Config Checklist
- Restore the previous config snapshot.
- Confirm the manual configuration stays planned-only.
- Confirm no live secret or cookie value is printed.

## Post-Rollback Smoke Checklist
- Run the health smoke.
- Run the readiness smoke.
- Run the postdeploy smoke.
- Confirm the smokes stay read-only.

## Post-Rollback Monitoring Checklist
- Run the day-1 monitor review.
- Confirm the monitoring window is still human-approved.
- Confirm the monitor stays read-only.

## Evidence Required
- JSON output from the rollback drill script.
- JSON output from the approval pack.
- JSON output from the execution plan.
- Signed human approval record.

## Human Approval Required
- Stakeholder approval is required.
- Technical lead approval is required.
- On-call ownership is required.
- Production window approval is required.

## Criteria For P1.7
- The drill passes in planned-only fixture mode.
- The drill stays blocked without a fixture.
- The drill blocks real-domain fixtures.
- The approval pack references the drill.
- The execution plan references the drill.
- No real rollback or production touch is allowed.

## Decision
No real rollback. No deploy. No production touch.
