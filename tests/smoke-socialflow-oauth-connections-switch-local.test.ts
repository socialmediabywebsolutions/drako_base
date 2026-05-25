import { describe, expect, it } from "vitest";
import { assertSmokeEvidenceFromVitestReport } from "../scripts/smoke-socialflow-oauth-connections-switch-local";

describe("socialflow oauth connections switch local smoke helpers", () => {
  it("accepts a passing report with required assertions", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "linkedin-connection.test.ts",
          assertionResults: [
            {
              title: "keeps core-backed behavior when switch is off",
              fullName: "suite keeps core-backed behavior when switch is off",
              status: "passed",
            },
            {
              title: "uses SOCIAL_DB prepared connection when read switch is ON and row is valid",
              fullName: "suite uses SOCIAL_DB prepared connection when read switch is ON and row is valid",
              status: "passed",
            },
            {
              title: "falls back to core-backed projection when switch is ON and SOCIAL_DB row is missing",
              fullName: "suite falls back to core-backed projection when switch is ON and SOCIAL_DB row is missing",
              status: "passed",
            },
            {
              title: "falls back to core-backed projection when switch is ON and SOCIAL_DB read fails",
              fullName: "suite falls back to core-backed projection when switch is ON and SOCIAL_DB read fails",
              status: "passed",
            },
          ],
        },
      ],
    } as const;

    const evidence = assertSmokeEvidenceFromVitestReport(report);
    expect(evidence.socialReadAssertion).toContain("uses SOCIAL_DB prepared connection");
    expect(evidence.coreFallbackFailureAssertion).toContain("SOCIAL_DB read fails");
  });

  it("fails closed when required assertions are missing", () => {
    const report = {
      success: true,
      numFailedTests: 0,
      testResults: [
        {
          name: "linkedin-connection.test.ts",
          assertionResults: [],
        },
      ],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_OAUTH_CONNECTIONS_SMOKE_ASSERTION_MISSING",
    );
  });

  it("fails closed when report is not successful", () => {
    const report = {
      success: false,
      numFailedTests: 1,
      testResults: [],
    } as const;

    expect(() => assertSmokeEvidenceFromVitestReport(report)).toThrow(
      "SOCIALFLOW_OAUTH_CONNECTIONS_SMOKE_TESTS_FAILED",
    );
  });
});
