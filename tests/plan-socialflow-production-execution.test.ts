import { beforeEach, describe, expect, it, vi } from "vitest";
import { planSocialflowProductionExecution } from "../scripts/plan-socialflow-production-execution";
import * as goNoGoModule from "../scripts/check-socialflow-production-go-no-go";

const baseGoNoGo = () =>
  ({
    goForApproval: true,
    goForExecution: false,
    status: "GO_FOR_APPROVAL",
    timestamp: new Date().toISOString(),
    blockers: ["STAKEHOLDER_APPROVAL_REQUIRED"],
    approvalsRequired: {} as any,
    technicalReadiness: {} as any,
    operationalReadiness: {} as any,
    rollbackReady: true,
    onCallRequired: true,
    productionWindowRequired: true,
    recommendation: "GO",
  }) as any;

describe("plan-socialflow-production-execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(goNoGoModule, "checkSocialflowProductionGoNoGo").mockResolvedValue(baseGoNoGo());
  });

  it("never executes deploy", async () => {
    const plan = await planSocialflowProductionExecution();
    expect(plan.executionAllowed).toBe(false);
    expect(plan.readyForExecution).toBe(false);
    expect(plan.commandsArePlannedOnly).toBe(true);

    const deployStep = plan.executionPlannedSteps
      .find((phase) => phase.phase === "Deploy Execution (PLACEHOLDER - DO NOT RUN)")
      ?.steps.find((step) => step.step === "Deploy to Production");
    expect(deployStep).toBeDefined();
    expect(deployStep?.command).toContain("PLACEHOLDER_ONLY");
  });

  it("detects missing wrangler.production.toml", async () => {
    const plan = await planSocialflowProductionExecution();
    const artifact = plan.missingArtifacts.find(
      (item) => item.artifact === "apps/socialflow-runtime/wrangler.production.toml",
    );
    expect(artifact).toBeDefined();
    expect(artifact?.status).toBe("PLANNED_ARTIFACT_REQUIRED");
    expect(artifact?.requiredForExecution).toBe(true);
  });

  it("detects missing production smoke scripts", async () => {
    const plan = await planSocialflowProductionExecution();
    const missingSmoke = plan.missingArtifacts.filter((item) =>
      item.artifact.startsWith("scripts/smoke-socialflow-production-"),
    );
    expect(missingSmoke.length).toBeGreaterThanOrEqual(3);
    missingSmoke.forEach((item) => {
      expect(item.status).toBe("NOT_AVAILABLE_YET");
      expect(item.requiredForExecution).toBe(true);
    });
  });

  it("does not mark missing artifacts as available", async () => {
    const plan = await planSocialflowProductionExecution();
    const statuses = plan.missingArtifacts.map((item) => item.status);
    expect(statuses).not.toContain("AVAILABLE");
  });

  it("keeps missing smoke commands as placeholders", async () => {
    const plan = await planSocialflowProductionExecution();
    const smokeCommands = plan.executionPlannedSteps
      .find((phase) => phase.phase === "Smoke Testing")
      ?.steps.map((step) => step.command ?? "") ?? [];

    expect(smokeCommands.some((command) => command.includes("PLACEHOLDER_ONLY (NOT_AVAILABLE_YET)"))).toBe(true);
  });

  it("does not touch production", async () => {
    const plan = await planSocialflowProductionExecution();
    expect(plan.executionAllowed).toBe(false);
    expect(plan.readyForExecution).toBe(false);
    expect(plan.requiresApproval).toBe(true);

    plan.executionPlannedSteps.forEach((phase) => {
      phase.steps.forEach((step) => {
        if (step.command && !step.command.includes("PLACEHOLDER") && !step.command.includes("PLANNED:")) {
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
    expect(plan).toHaveProperty("missingArtifacts");
    expect(plan).toHaveProperty("executionPlannedSteps");
    expect(() => JSON.stringify(plan)).not.toThrow();
  });

  it("generates markdown output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log");
    await planSocialflowProductionExecution({ markdown: true });
    const allLogs = consoleLogSpy.mock.calls.flat().join("\n");

    expect(allLogs).toContain("# SOCIALFLOW PRODUCTION EXECUTION PLAN");
    expect(allLogs).toContain("## Missing Artifacts");
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
