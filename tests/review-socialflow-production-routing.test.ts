import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { reviewSocialflowProductionRouting } from "../scripts/review-socialflow-production-routing";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

function createRealDomainFixture(): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "socialflow-routing-review-"));
  const fixturePath = path.join(tmpDir, "routing-review-real-domain.json");
  writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        approvalId: "fixture-approval-socialflow-planned-only",
        rollbackPlanId: "fixture-rollback-socialflow-planned-only",
        onCallOwner: "fixture-on-call-owner",
        productionWindowId: "fixture-window-socialflow-planned-only",
        productionBaseUrl: "https://socialflow.example.com",
        expectedHost: "socialflow.example.com",
        healthPath: "/api/socialflow/runtime/health",
        readinessPath: "/api/socialflow/runtime/readiness",
        monitoringPlanId: "fixture-monitoring-socialflow-planned-only",
        smokeSequenceId: "fixture-smoke-sequence-socialflow-planned-only",
        abortCriteriaId: "fixture-abort-criteria-socialflow-planned-only",
        humanApprovalRecorded: false,
        plannedOnly: true,
        productionTouchAllowed: false,
      },
      null,
      2,
    ),
    "utf8",
  );
  return fixturePath;
}

describe("review-socialflow-production-routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE;
    delete process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
    delete process.env.SOCIALFLOW_PRODUCTION_EXPECTED_HOST;
    delete process.env.SOCIALFLOW_PRODUCTION_HEALTH_PATH;
    delete process.env.SOCIALFLOW_PRODUCTION_READINESS_PATH;
  });

  it("returns blocked when no fixture or env metadata is available", async () => {
    const report = await reviewSocialflowProductionRouting({ silent: true });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED");
    expect(report.fixtureMode).toBe(false);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.manualConfigurationRequired).toBe(true);
    expect(report.dnsRoutingRequired).toBe(true);
    expect(report.blockers).toContain("PLANNED_ONLY_FIXTURE_REQUIRED");
    expect(report.routingReviewPackPresent).toBe(true);
    expect(report.routingReviewScriptPresent).toBe(true);
  });

  it("returns ready-for-planning with the planned-only invalid-host fixture", async () => {
    const report = await reviewSocialflowProductionRouting({ silent: true, fixture: FIXTURE_PATH });

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING");
    expect(report.fixtureMode).toBe(true);
    expect(report.productionTouchAllowed).toBe(false);
    expect(report.readyForExecution).toBe(false);
    expect(report.executionAllowed).toBe(false);
    expect(report.commandsArePlannedOnly).toBe(true);
    expect(report.requiresHumanApproval).toBe(true);
    expect(report.manualConfigurationRequired).toBe(true);
    expect(report.dnsRoutingRequired).toBe(true);
    expect(report.targets.productionBaseUrl.presence).toBe("FIXTURE");
    expect(report.targets.expectedHost.presence).toBe("FIXTURE");
    expect(report.targets.healthPath.presence).toBe("FIXTURE");
    expect(report.targets.readinessPath.presence).toBe("FIXTURE");
    expect(report.targets.workerTarget).toBe("saas-socialflows-runtime-production");
    expect(report.wranglerProductionTemplate.present).toBe(true);
    expect(report.wranglerProductionTemplate.workersDevFalse).toBe(true);
    expect(report.wranglerProductionTemplate.routesCommentedOnly).toBe(true);
    expect(report.routingReviewPackPresent).toBe(true);
    expect(report.routingReviewScriptPresent).toBe(true);
    expect(report.checklist.dnsRecordsExpected.join(" ")).toContain(".invalid");
    expect(report.checklist.cloudflareRoutesExpected.join(" ")).toContain(".invalid");
    expect(report.checklist.rollbackRoutingChecklist.length).toBeGreaterThan(0);
  });

  it("blocks a fixture that uses a real domain", async () => {
    const fixturePath = createRealDomainFixture();

    try {
      const report = await reviewSocialflowProductionRouting({ silent: true, fixture: fixturePath });

      expect(report.ok).toBe(false);
      expect(report.status).toBe("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED");
      expect(report.productionTouchAllowed).toBe(false);
      expect(report.readyForExecution).toBe(false);
      expect(report.executionAllowed).toBe(false);
      expect(report.commandsArePlannedOnly).toBe(true);
      expect(report.requiresHumanApproval).toBe(true);
      expect(report.blockers.length).toBeGreaterThan(0);
    } finally {
      rmSync(path.dirname(fixturePath), { recursive: true, force: true });
    }
  });

  it("supports json and markdown output without network calls", async () => {
    const fetchSpy = vi.fn();
    const consoleLogSpy = vi.spyOn(console, "log");
    const globalWithFetch = globalThis as typeof globalThis & { fetch: typeof fetch };
    const originalFetch = globalWithFetch.fetch;

    try {
      globalWithFetch.fetch = fetchSpy as unknown as typeof fetch;

      await reviewSocialflowProductionRouting({ json: true, fixture: FIXTURE_PATH });
      await reviewSocialflowProductionRouting({ markdown: true, fixture: FIXTURE_PATH });
      const output = consoleLogSpy.mock.calls.flat().join("\n");

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(output).toContain("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING");
      expect(output).toContain("# SOCIALFLOW PRODUCTION ROUTING REVIEW");
      expect(output).toContain(".invalid");
      expect(output).not.toContain("socialflow.example.com");
    } finally {
      consoleLogSpy.mockRestore();
      globalWithFetch.fetch = originalFetch;
    }
  });
});
