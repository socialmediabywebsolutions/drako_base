# Interview Engine v1 (Blueprint)

## Goal
Transform interactions from "Chat" to "Guided Construction".
The engine is a State Machine that advances only when specific data gates are met.

## 1. Phases (0-9)

| Phase | Name | Goal | Required Data (Gate) | Orchestration Note |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **Warm-up** | Trust & Context | - | Explain "Partner" role. |
| **1** | **Identity** | Basic Config | `company_name`, `country`, `vertical` | If missing, loop back. |
| **2** | **Digital Audit** | Current State | `website_url` (or "none"), `social_handles` | Trigger `core_analyses`. |
| **3** | **Competitor** | Market Position | `competitors_list`, `radio` (km) | Trigger `partner_market_analyses`. |
| **4** | **Ops & Finance** | Reality Check | `monthly_burn`, `revenue_est`, `employees` | Trigger `core_finances`. |
| **5** | **Vision** | Co-Creation | `pain_points`, `goals` | Brainstorming mode. |
| **6** | **Architecture** | System Design | `agents_setup`, `integrations_needed` | Trigger `core_architectures`. |
| **7** | **Validation** | Human Check | `user_confirmation` | Summarize & Ask. |
| **8** | **Budget** | Pricing | `pricing_quote` (generated) | Present `pricing_quotes`. |
| **9** | **Refinement/Close** | Conversion | `quote_accepted` | Move to Build. |

## 2. Data Collection Logic (Hard Validation)
The Orchestrator (`orchestrator.ts`) checks the `detectedKnowledge` returned by the AI.
- If Phase = 1 AND `identity.company_name` is missing -> `NextPhase = 1` (Loop).
- If Phase = 1 AND `identity.company_name` is present -> `NextPhase = 2`.

## 3. Agents Participation
- **Phases 0-1, 5, 7**: `core_interviews` (Lead).
- **Phases 2-3**: `core_analyses` + `partner_competitor_watchings`.
- **Phase 4, 8**: `core_finances` (Critical).
- **Phase 6**: `core_architectures`.
- **Phase 9**: `core_deliveries`.

## 4. Persisted State (`interviews_sessions`)
- **`current_phase`**: Integer 0-9.
- **`context_json`**: Accumulated facts (The "Truth").
- **`transcript_json`**: Full chat log.
- **`status`**: `in_progress` | `completed`.
