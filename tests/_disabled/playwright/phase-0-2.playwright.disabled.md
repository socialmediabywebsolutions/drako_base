# Phase 0.2 Playwright Suite (Disabled)

Status: `DISABLED_BY_AUDIT_S3.26B`

Reason:
- The original file was `tests/api/phase-0-2.spec.ts`.
- It imported `@playwright/test`, but Playwright is not declared in `package.json` and is not installed in this repository.
- `vitest.config.ts` excludes `tests/**/*.spec.ts`, so the suite was not part of active CI/runtime validation.

Decision:
- Keep this suite explicitly classified as disabled until there is a deliberate decision to introduce a real Playwright pipeline.
- Do not treat this suite as active coverage for production readiness gates.

Reactivation checklist:
1. Add explicit Playwright dependency and version policy.
2. Add dedicated script (for example `test:e2e:playwright`) and execution docs.
3. Validate runtime preconditions (`localhost`, seeded data, auth fixtures).
4. Re-enable only after ownership and CI scope are approved.
