import { describe, expect, it } from "vitest";
import { assertSmokeEvidenceFromVitestReport } from "../scripts/smoke-socialflow-legacy-read-models-switch-local";

describe("socialflow legacy read models switch local smoke helpers", () => {
  it("accepts a passing report with required assertions", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "socialflow-legacy-read-models-switch.test.ts",
          assertionResults: [
            {
              title: "keeps core-backed reads when switch is OFF",
              fullName: "suite keeps core-backed reads when switch is OFF",
              status: "passed",
            },
            {
              title: "uses SOCIAL_DB read models when switch is ON",
              fullName: "suite uses SOCIAL_DB read models when switch is ON",
              status: "passed",
            },
            {
              title: "falls back to core when switch is ON and SOCIAL_DB read model is missing",
              fullName: "suite falls back to core when switch is ON and SOCIAL_DB read model is missing",
              status: "passed",
            },
            {
              title: "falls back to core when switch is ON and SOCIAL_DB read fails",
              fullName: "suite falls back to core when switch is ON and SOCIAL_DB read fails",
              status: "passed",
            },
            {
              title: "keeps payload and return shape compatible between social-first and core fallback",
              fullName: "suite keeps payload and return shape compatible between social-first and core fallback",
              status: "passed",
            },
          ],
        },
      ],
    } as const;

    const evidence = assertSmokeEvidenceFromVitestReport(report);
    expect(evidence.socialReadAssertion).toContain("uses SOCIAL_DB read models");
    expect(evidence.coreFallbackFailureAssertion).toContain("SOCIAL_DB read fails");
    expect(evidence.payloadCompatibilityAssertion).toContain("payload and return shape compatible");
  });

  it("fails closed when required assertions are missing", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "socialflow-legacy-read-models-switch.test.ts",
          assertionResults: [],
        },
      ],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_ASSERTION_MISSING",
    );
  });

  it("fails closed when report is not successful", () => {
    const report = {
      success: false,
      numFailedTests: 1,
      testResults: [],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_TESTS_FAILED",
    );
  });
});
