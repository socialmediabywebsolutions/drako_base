import { describe, expect, it } from "vitest";
import { assertSmokeEvidenceFromVitestReport } from "../scripts/smoke-socialflow-export-read-models-switch-local";

describe("socialflow export read models switch local smoke helpers", () => {
  it("accepts a passing report with required assertions", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "exports-service.test.ts",
          assertionResults: [
            {
              title: "keeps core-backed behavior when switch is off",
              fullName: "suite keeps core-backed behavior when switch is off",
              status: "passed",
            },
            {
              title: "uses SOCIAL_DB read models when switch is on and prepared model is valid",
              fullName: "suite uses SOCIAL_DB read models when switch is on and prepared model is valid",
              status: "passed",
            },
            {
              title: "falls back to core when switch is on and SOCIAL_DB read model is missing",
              fullName: "suite falls back to core when switch is on and SOCIAL_DB read model is missing",
              status: "passed",
            },
            {
              title: "falls back to core when switch is on and SOCIAL_DB read fails",
              fullName: "suite falls back to core when switch is on and SOCIAL_DB read fails",
              status: "passed",
            },
          ],
        },
      ],
    } as const;

    const evidence = assertSmokeEvidenceFromVitestReport(report);
    expect(evidence.socialReadAssertion).toContain("uses SOCIAL_DB read models");
    expect(evidence.coreFallbackFailureAssertion).toContain("read fails");
  });

  it("fails closed when required assertions are missing", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "exports-service.test.ts",
          assertionResults: [],
        },
      ],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_ASSERTION_MISSING",
    );
  });

  it("fails closed when report is not successful", () => {
    const report = {
      success: false,
      numFailedTests: 1,
      testResults: [],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_TESTS_FAILED",
    );
  });
});
