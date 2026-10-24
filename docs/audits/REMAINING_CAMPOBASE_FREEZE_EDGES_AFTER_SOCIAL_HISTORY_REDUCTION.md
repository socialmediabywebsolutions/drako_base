# Remaining Campobase Freeze Edges After Social History Reduction

Date: 2026-06-07  
Scope: audit remaining legacy imports allowlisted by `tests/architecture/campobase-namespace-freeze.test.ts` after social history reduction.

## 1) Guardrail state

- Guardrail file: `tests/architecture/campobase-namespace-freeze.test.ts`
- Pinned allowlist size: **17**
- Remaining allowlisted edges: **17**

### 1.1 Current allowlisted edges (17)

1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
3. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
4. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
5. `tests/components/campobase-social-page.test.tsx::@/lib/campobase/socialflow-service`
6. `tests/components/operator-socialflow-health-panel.test.tsx::@/lib/campobase/socialflow-service`
7. `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
8. `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
9. `tests/lib/campobase-social-automation-history.test.ts::@/lib/campobase/social-automation-history`
10. `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`
11. `tests/lib/campobase-socialflow-service.test.ts::@/lib/campobase/socialflow-service`
12. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
13. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
14. `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
15. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform`
16. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/socialflow-platform`
17. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform`

## 2) Classification of remaining edges

| # | Path | Legacy import | Category | Domain | Risk | Canonical equivalent exists now? | Recommended action |
|---|---|---|---|---|---|---|---|
| 1 | `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | legacy interno congelado | Clinic | high | No (`src/lib/campamento-base/*` clinic modules not present) | no tocar todavía |
| 2 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/clinic-platform` | legacy interno congelado | platform-bootstrap + Clinic | high | No | no tocar todavía |
| 3 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/taskops-platform` | legacy interno congelado | platform-bootstrap + TaskOps | high | No | no tocar todavía |
| 4 | `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | legacy interno congelado | TaskOps | high | No (`campamento-base` taskops modules not present) | no tocar todavía |
| 5 | `tests/components/campobase-social-page.test.tsx` | `@/lib/campobase/socialflow-service` | test de compatibilidad | SocialFlow | low | Yes (`@/lib/operator/socialflow-service`, `@/lib/campamento-base/socialflow-control-plane-service`) | migrar ahora |
| 6 | `tests/components/operator-socialflow-health-panel.test.tsx` | `@/lib/campobase/socialflow-service` | test de compatibilidad | SocialFlow | low | Yes (`@/lib/operator/socialflow-service`, `@/lib/campamento-base/socialflow-control-plane-service`) | migrar ahora |
| 7 | `tests/lib/campobase-clinic-platform-service.test.ts` | `@/lib/campobase/clinic-platform-service` | test de compatibilidad | Clinic | medium/high | No | requiere contrato / auditoría previa |
| 8 | `tests/lib/campobase-platform-bootstrap.test.ts` | `@/lib/campobase/platform-bootstrap` | test de compatibilidad | platform-bootstrap | high | Partial only (SocialFlow canonicalized; Clinic/TaskOps still legacy) | no tocar todavía |
| 9 | `tests/lib/campobase-social-automation-history.test.ts` | `@/lib/campobase/social-automation-history` | test legacy adapter | social history | low | Yes (canonical + operator facade), but this test is adapter coverage | mantener como adapter test |
| 10 | `tests/lib/campobase-social-automation-registry.test.ts` | `@/lib/campobase/social-automation-registry` | test de compatibilidad | SocialFlow | medium/high | No canonical registry module found | requiere contrato |
| 11 | `tests/lib/campobase-socialflow-service.test.ts` | `@/lib/campobase/socialflow-service` | test legacy adapter | SocialFlow | low | Yes (`campobase` module is adapter to canonical control-plane service) | mantener como adapter test |
| 12 | `tests/lib/campobase-taskops-platform-service.test.ts` | `@/lib/campobase/taskops-platform-service` | test de compatibilidad | TaskOps | high | No | requiere contrato / auditoría previa |
| 13 | `tests/lib/cross-saas-taskops-flow.test.ts` | `@/lib/campobase/taskops-platform` | factory/orchestrator | TaskOps + cross-saas | high | No | requiere auditoría previa |
| 14 | `tests/lib/factory-orchestrator.test.ts` | `@/lib/campobase/platform-bootstrap` | factory/orchestrator | factory-orchestrator + bootstrap | high | No (depends on Clinic/TaskOps legacy edges) | requiere auditoría previa |
| 15 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/clinic-platform` | test de compatibilidad | Clinic | medium/high | No | no tocar todavía |
| 16 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/socialflow-platform` | test de compatibilidad | SocialFlow | low | Yes (`@/lib/campamento-base/socialflow-platform`) | migrar ahora |
| 17 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/taskops-platform` | test de compatibilidad | TaskOps | medium/high | No | no tocar todavía |

## 3) Top 3 safest candidates for next allowlist reduction

### Candidate 1

- File to touch: `tests/components/campobase-social-page.test.tsx`
- Import change: `@/lib/campobase/socialflow-service` → `@/lib/operator/socialflow-service`
- Recommended equivalent: operator facade (1:1 canonical bridge)
- Why safe: type-only usage with legacy-compatible exported types; no runtime behavior change
- Tests needed:
  - `tests/components/campobase-social-page.test.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- Rollback: single import line revert + restore one allowlist edge

### Candidate 2

- File to touch: `tests/components/operator-socialflow-health-panel.test.tsx`
- Import change: `@/lib/campobase/socialflow-service` → `@/lib/operator/socialflow-service`
- Recommended equivalent: operator facade
- Why safe: component test type payloads align with current canonical/operator API
- Tests needed:
  - `tests/components/operator-socialflow-health-panel.test.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- Rollback: single import line revert + restore one allowlist edge

### Candidate 3

- File to touch: `tests/lib/saas-contract-definitions.test.ts`
- Import change: only SocialFlow edge: `@/lib/campobase/socialflow-platform` → `@/lib/campamento-base/socialflow-platform`
- Recommended equivalent: direct canonical module
- Why safe: `campobase/socialflow-platform` is already a pure adapter re-export to canonical
- Why partial: keep Clinic/TaskOps imports untouched in same file until their canonical contracts exist
- Tests needed:
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- Rollback: single import line revert + restore one allowlist edge

## 4) What should NOT be touched yet

Keep frozen for now:

1. **Clinic vertical edges** (`clinic-platform`, `clinic-platform-service`)  
   - Reason: no canonical `campamento-base` clinic platform/service modules detected.
2. **TaskOps vertical edges** (`taskops-platform`, `taskops-platform-service`)  
   - Reason: no canonical `campamento-base` taskops platform/service modules detected.
3. **`platform-bootstrap` legacy internals**  
   - Reason: still depends on Clinic/TaskOps legacy modules; migration should follow vertical contracts.
4. **Legacy adapter coverage tests**  
   - Keep `tests/lib/campobase-social-automation-history.test.ts` and `tests/lib/campobase-socialflow-service.test.ts` on legacy path while adapters remain intentional.
5. **Factory/orchestrator related edges** (`cross-saas-taskops-flow`, `factory-orchestrator`)  
   - Reason: cross-domain behavior and bootstrap coupling; needs dedicated audit block before migration.

## 5) Recommended next block (safest incremental)

Recommended next technical block: **"migrate socialflow test-only imports to operator/canonical and shrink guardrail"**

Proposed scope:

- Migrate Candidate 1 and Candidate 2 to `@/lib/operator/socialflow-service`.
- Migrate Candidate 3 SocialFlow edge in `tests/lib/saas-contract-definitions.test.ts` to canonical `@/lib/campamento-base/socialflow-platform`.
- Shrink corresponding allowlist edges only; keep adapter and Clinic/TaskOps/factory edges unchanged.

This gives a low-risk shrink without touching product runtime or unresolved vertical contracts.
