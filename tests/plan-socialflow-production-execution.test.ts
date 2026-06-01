import { beforeEach, describe, expect, it, vi } from "vitest";
import { planSocialflowProductionExecution } from "../scripts/plan-socialflow-production-execution";

describe("plan-socialflow-production-execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(runbook).toBeDefined();
    expect(runbook?.present).toBe(true);
    expect(runbook?.status).toBe("PRESENT");
    expect(decisionPack).toBeDefined();
    expect(decisionPack?.present).toBe(true);
    expect(decisionPack?.status).toBe("PRESENT");
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
    const plan = await planSocialflowProductionExecution({ json: true });
    expect(plan).toHaveProperty("executionAllowed");
    expect(plan).toHaveProperty("readyForExecution");
    expect(plan).toHaveProperty("artifactInventory");
    expect(plan).toHaveProperty("missingArtifacts");
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
