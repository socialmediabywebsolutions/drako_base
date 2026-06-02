import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { planSocialflowProductionExecution } from "../scripts/plan-socialflow-production-execution";

const FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "socialflow-production-planned-approval.json",
);

describe("plan-socialflow-production-execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE;
  });

  it("never executes deploy and remains blocked", async () => {
    const plan = await planSocialflowProductionExecution();
    expect(plan.executionAllowed).toBe(false);
    expect(plan.readyForExecution).toBe(false);
    expect(plan.commandsArePlannedOnly).toBe(true);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.requiresHumanApproval).toBe(true);
    expect(plan.manualConfigurationRequired).toBe(true);
    expect(plan.status).toBe("SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_PENDING_MANUAL_APPROVAL");
  });

  it("keeps planned-only execution when fixture mode is enabled", async () => {
    const plan = await planSocialflowProductionExecution({ fixture: FIXTURE_PATH });

    expect(plan.fixtureMode).toBe(true);
    expect(plan.productionTouchAllowed).toBe(false);
    expect(plan.executionAllowed).toBe(false);
    expect(plan.readyForExecution).toBe(false);
    expect(plan.commandsArePlannedOnly).toBe(true);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.requiresHumanApproval).toBe(true);
    expect(plan.manualConfigurationRequired).toBe(true);
    expect(plan.status).toBe("SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_PENDING_MANUAL_APPROVAL");
  });

  it("tracks production template as present but manual-review required", async () => {
    const plan = await planSocialflowProductionExecution();
    const artifact = plan.artifactInventory.find(
      (item) => item.artifact === "apps/socialflow-runtime/wrangler.production.toml",
    );
    expect(artifact).toBeDefined();
    expect(artifact?.present).toBe(true);
    expect(artifact?.status).toBe("PRODUCTION_TEMPLATE_PRESENT_MANUAL_CONFIGURATION_REQUIRED");
  });

  it("marks production smoke and monitor artifacts as present", async () => {
    const plan = await planSocialflowProductionExecution();
    const artifactStatuses = plan.artifactInventory
      .filter(
        (item) =>
          item.artifact.startsWith("scripts/smoke-socialflow-production-")
          || item.artifact === "scripts/monitor-socialflow-production-day.ts",
      )
      .map((item) => item.status);

    expect(artifactStatuses).toHaveLength(4);
    artifactStatuses.forEach((status) => {
      expect(status).toBe("PRESENT");
    });
    expect(plan.missingArtifacts).toHaveLength(0);
  });

  it("tracks approval pack and runbook artifacts as present", async () => {
    const plan = await planSocialflowProductionExecution();
    const runbook = plan.artifactInventory.find(
      (item) => item.artifact === "docs/runbooks/socialflow-production-controlled-execution.md",
    );
    const decisionPack = plan.artifactInventory.find(
      (item) => item.artifact === "docs/architecture/socialflow-production-approval-pack.md",
    );
    const routingReviewScript = plan.artifactInventory.find(
      (item) => item.artifact === "scripts/review-socialflow-production-routing.ts",
    );
    const routingReviewPack = plan.artifactInventory.find(
      (item) => item.artifact === "docs/architecture/socialflow-production-routing-review-pack.md",
    );
    const rollbackDrillScript = plan.artifactInventory.find(
      (item) => item.artifact === "scripts/simulate-socialflow-production-rollback.ts",
    );
    const rollbackDrillPack = plan.artifactInventory.find(
      (item) => item.artifact === "docs/architecture/socialflow-production-rollback-drill.md",
    );

    expect(runbook).toBeDefined();
    expect(runbook?.present).toBe(true);
    expect(runbook?.status).toBe("PRESENT");
    expect(decisionPack).toBeDefined();
    expect(decisionPack?.present).toBe(true);
    expect(decisionPack?.status).toBe("PRESENT");
    expect(routingReviewScript).toBeDefined();
    expect(routingReviewScript?.present).toBe(true);
    expect(routingReviewScript?.status).toBe("PRESENT");
    expect(routingReviewPack).toBeDefined();
    expect(routingReviewPack?.present).toBe(true);
    expect(routingReviewPack?.status).toBe("PRESENT");
    expect(rollbackDrillScript).toBeDefined();
    expect(rollbackDrillScript?.present).toBe(true);
    expect(rollbackDrillScript?.status).toBe("PRESENT");
    expect(rollbackDrillScript?.requiredForExecution).toBe(true);
    expect(rollbackDrillPack).toBeDefined();
    expect(rollbackDrillPack?.present).toBe(true);
    expect(rollbackDrillPack?.status).toBe("PRESENT");
    expect(rollbackDrillPack?.requiredForExecution).toBe(true);
  });

  it("tracks manual/rollback/window validators as present artifacts", async () => {
    const plan = await planSocialflowProductionExecution();
    const validatorArtifacts = [
      "scripts/check-socialflow-production-manual-config.ts",
      "scripts/check-socialflow-production-rollback-readiness.ts",
      "scripts/check-socialflow-production-window-readiness.ts",
    ];

    validatorArtifacts.forEach((artifactPath) => {
      const artifact = plan.artifactInventory.find((item) => item.artifact === artifactPath);
      expect(artifact).toBeDefined();
      expect(artifact?.present).toBe(true);
      expect(artifact?.status).toBe("PRESENT");
      expect(artifact?.requiredForExecution).toBe(true);
    });
  });

  it("tracks routing review script and pack as present artifacts", async () => {
    const plan = await planSocialflowProductionExecution();
    const routingReviewScript = plan.artifactInventory.find(
      (item) => item.artifact === "scripts/review-socialflow-production-routing.ts",
    );
    const routingReviewPack = plan.artifactInventory.find(
      (item) => item.artifact === "docs/architecture/socialflow-production-routing-review-pack.md",
    );

    expect(routingReviewScript).toBeDefined();
    expect(routingReviewScript?.present).toBe(true);
    expect(routingReviewScript?.status).toBe("PRESENT");
    expect(routingReviewScript?.requiredForExecution).toBe(true);
    expect(routingReviewPack).toBeDefined();
    expect(routingReviewPack?.present).toBe(true);
    expect(routingReviewPack?.status).toBe("PRESENT");
    expect(routingReviewPack?.requiredForExecution).toBe(true);
  });

  it("includes rollback drill planning in the pre-execution checklist", async () => {
    const plan = await planSocialflowProductionExecution();
    const rollbackDrillStep = plan.preExecution.find((step) => step.step === "Verify Rollback Drill Simulation");

    expect(rollbackDrillStep).toBeDefined();
    expect(rollbackDrillStep?.required).toBe(true);
    expect(rollbackDrillStep?.description).toContain("planned-only rollback drill script");
    expect(rollbackDrillStep?.description).toContain("drill doc");
  });

  it("keeps deploy command as planned template review required", async () => {
    const plan = await planSocialflowProductionExecution();
    const deployStep = plan.executionPlannedSteps
      .find((phase) => phase.phase === "Deploy Execution (PLACEHOLDER - DO NOT RUN)")
      ?.steps.find((step) => step.step === "Deploy to Production");

    expect(deployStep).toBeDefined();
    expect(deployStep?.command).toContain("PLANNED_TEMPLATE_REVIEW_REQUIRED");
    expect(deployStep?.command).toContain("wrangler deploy");
  });

  it("keeps smoke commands in planned mode when artifacts exist", async () => {
    const plan = await planSocialflowProductionExecution();
    const smokeCommands =
      plan.executionPlannedSteps
        .find((phase) => phase.phase === "Smoke Testing")
        ?.steps.map((step) => step.command ?? "") ?? [];

    expect(smokeCommands).toHaveLength(3);
    smokeCommands.forEach((command) => {
      expect(command).toContain("PLANNED:");
      expect(command).not.toContain("PLACEHOLDER_ONLY");
    });
  });

  it("keeps the routing review command planned-only", async () => {
    const plan = await planSocialflowProductionExecution();
    const routingReviewStep = plan.executionPlannedSteps
      .find((phase) => phase.phase === "DNS and Route Planning")
      ?.steps.find((step) => step.step === "Review Production Routing Pack");

    expect(routingReviewStep).toBeDefined();
    expect(routingReviewStep?.command).toContain("PLANNED:");
    expect(routingReviewStep?.command).toContain("scripts/review-socialflow-production-routing.ts");
  });

  it("keeps go/no-go blocked for execution even with artifacts present", async () => {
    const plan = await planSocialflowProductionExecution();
    expect(plan.goNoGoGate.goForApproval).toBe(true);
    expect(plan.goNoGoGate.goForExecution).toBe(false);
    expect(plan.goNoGoGate.blockers).toContain("STAKEHOLDER_APPROVAL_REQUIRED");
    expect(plan.goNoGoGate.blockers).toContain("ON_CALL_ENGINEER_REQUIRED");
    expect(plan.goNoGoGate.blockers).toContain("PRODUCTION_WINDOW_REQUIRED");
    expect(plan.goNoGoGate.blockers).toContain("MANUAL_CONFIGURATION_REQUIRED");
  });

  it("does not touch production commands directly", async () => {
    const plan = await planSocialflowProductionExecution();

    plan.executionPlannedSteps.forEach((phase) => {
      phase.steps.forEach((step) => {
        if (step.command && !step.command.includes("PLACEHOLDER") && !step.command.includes("PLANNED")) {
          expect(step.command).not.toContain("wrangler deploy");
          expect(step.command).not.toContain("wrangler rollback");
        }
      });
    });
  });

  it("generates valid JSON output", async () => {
    const plan = await planSocialflowProductionExecution({ json: true, fixture: FIXTURE_PATH });
    expect(plan).toHaveProperty("executionAllowed");
    expect(plan).toHaveProperty("readyForExecution");
    expect(plan).toHaveProperty("artifactInventory");
    expect(plan).toHaveProperty("missingArtifacts");
    expect(plan).toHaveProperty("fixtureMode");
    expect(plan).toHaveProperty("productionTouchAllowed");
    expect(() => JSON.stringify(plan)).not.toThrow();
  });

  it("generates markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await planSocialflowProductionExecution({ markdown: true });
    const allLogs = consoleLogSpy.mock.calls.flat().join("\n");

    expect(allLogs).toContain("# SOCIALFLOW PRODUCTION EXECUTION PLAN");
    expect(allLogs).toContain("## Artifact Inventory");
    expect(allLogs).toContain("## Execution Planned Steps");
    consoleLogSpy.mockRestore();
  });

  it("does not print secrets", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await planSocialflowProductionExecution();
    const allLogs = consoleLogSpy.mock.calls.flat().join(" ");

    const secretPatterns = [
      /SOCIALFLOW_CANARY_GATE_TOKEN\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
      /access_token\s*[:=]\s*[a-zA-Z0-9_-]{20,}/i,
      /password\s*[:=]\s*[a-zA-Z0-9_-]{10,}/i,
      /secret\s*[:=]\s*['"][a-zA-Z0-9_-]{10,}['"]/i,
    ];

    secretPatterns.forEach((pattern) => {
      expect(allLogs).not.toMatch(pattern);
    });

    consoleLogSpy.mockRestore();
  });
});
