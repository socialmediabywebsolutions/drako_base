# Infinity Ops: AI Router Governance & Observability (Steel Perfect)

Standard Operating Procedures for verifying and maintaining the AI Router (Cloudflare Worker).

## 🌌 Overview
Infinity Ops provides automated tools to verify the health, security, and auditing of the Drako AI Router.
Updated for **Steel Perfect (v1.2)** compliance.

## 🚀 One-Command Verification (The Gate)
Execute the entire strict verification cycle:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/infinity-run.ps1
```
**Gate Criteria:**
*   Audit Count MUST increment by exactly 1.
*   Correlation ID record MUST exist.
*   Status MUST be 200 (for smoke test).
*   Tokens Used MUST be >= 0.
*   Provider/Model MUST be populated.
*   Error Code MUST be null.

## 🛠️ Included Tools

### 1. Smoke Tester
**Script:** `scripts/infinity-smoke-worker-ai.ps1`
*   **Authentication:** Uses distinct `VERCEL_TO_WORKER_SECRET` and `X_DRAKO_ORIGIN_SECRET`.
*   **Compliance:** Sends Steel-compliant Headers and UUID v4 Correlation ID.
*   **Result:** Outputs `RESULT_CORRELATION_ID` for the orchestrator.

### 2. D1 Auditor Check
**Script:** `scripts/infinity-audit-check.ps1`
*   Queries the production D1 database (`DRACO_DB`).
*   Shows the count of smoke test audits.
*   Displays the latest 5 records with status and latency.

### 3. Worker Tail
**Script:** `scripts/infinity-tail-worker.ps1`
*   Connects to the live log stream of the `autopilot-worker`.
*   Essential for real-time debugging of policies and rate limits.

## 🛡️ Steel Perfect Hardening Features

### 1. Secret Segregation
*   **Rule:** `VERCEL_TO_WORKER_SECRET` and `X_DRAKO_ORIGIN_SECRET` MUST be distinct.
*   **Enforcement:** Worker returns `503 SERVICE_UNAVAILABLE` (Code: `CONFIG_ERROR`) if they match.
*   **Ops Action:** Use strict secret rotation if this error occurs.

### 2. Circuit Breaker FSM
Finite State Machine implementation strictly enforced in D1:
*   **CLOSED:** Normal operation.
*   **OPEN:** Failure Threshold reached. Rejects with 503.
*   **HALF-OPEN:** Cooldown expired (`300s`). Allows **1 concurrent probe**.
    *   **Success:** Transitions to CLOSED.
    *   **Failure:** Transitions to OPEN (Reset cooldown).

### 3. 100% Audit Guarantee
Every request is audited unconditionally in the `finally` block.
*   **Real Tokens:** Captures actual token utilization from Cloudflare AI.
*   **Real Usage:** Audits the *final* provider/model used (even after fallback).

## 🩺 Troubleshooting
If `infinity-run.ps1` fails:
1.  **Cardinality Error:** Check if D1 writes are lagging or if the Worker failed silently (check Tail).
2.  **Config Error (503):** Verify secrets are distinct in `wrangler.toml` or Dashboard.
3.  **Circuit Open:** Check `ai_circuit_breakers` table for `state='OPEN'`.
