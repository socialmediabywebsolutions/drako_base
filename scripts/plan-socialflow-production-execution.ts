import { existsSync } from "node:fs";
import path from "node:path";
import { checkSocialflowProductionGoNoGo } from "./check-socialflow-production-go-no-go";

interface ProductionExecutionPlanOptions {
  json?: boolean;
  markdown?: boolean;
}

type MissingArtifactStatus =
  | "PLANNED_ARTIFACT_REQUIRED"
  | "NOT_AVAILABLE_YET"
  | "MANUAL_REVIEW_REQUIRED";

interface MissingArtifact {
  artifact: string;
  status: MissingArtifactStatus;
  reason: string;
  requiredForExecution: boolean;
  commandReference?: string;
}

interface ProductionExecutionPlan {
  executionAllowed: boolean;
  readyForExecution: boolean;
  commandsArePlannedOnly: boolean;
  requiresApproval: boolean;
  status: string;
  timestamp: string;
  missingArtifacts: MissingArtifact[];
  preExecution: {
    step: string;
    required: boolean;
    description: string;
  }[];
  executionPlannedSteps: {
    phase: string;
    steps: {
      step: string;
      command?: string;
      description: string;
      requiresManualAction: boolean;
      critical: boolean;
    }[];
  }[];
  rollbackPlan: {
    command: string;
    description: string;
    criticalPath: boolean;
  }[];
  monitoringPlan: {
    command: string;
    description: string;
    frequency: string;
  }[];
  communicationSteps: {
    when: string;
    action: string;
    audience: string;
  }[];
  goNoGoGate: {
    goForApproval: boolean;
    goForExecution: boolean;
    blockers: string[];
  };
}

type ArtifactRule = {
  artifact: string;
  statusWhenMissing: MissingArtifactStatus;
  reason: string;
  requiredForExecution: boolean;
  commandReference?: string;
};

function resolveExists(artifact: string): boolean {
  return existsSync(path.resolve(process.cwd(), artifact));
}

function detectMissingArtifacts(rules: ArtifactRule[]): MissingArtifact[] {
  return rules
    .filter((rule) => !resolveExists(rule.artifact))
    .map((rule) => ({
      artifact: rule.artifact,
      status: rule.statusWhenMissing,
      reason: rule.reason,
      requiredForExecution: rule.requiredForExecution,
      commandReference: rule.commandReference,
    }));
}

function hasMissingArtifact(missingArtifacts: MissingArtifact[], artifactPath: string): boolean {
  return missingArtifacts.some((artifact) => artifact.artifact === artifactPath);
}

function plannedOrPlaceholderCommand(
  plannedCommand: string,
  missing: boolean,
  missingStatus: MissingArtifactStatus,
): string {
  if (!missing) {
    return `PLANNED: ${plannedCommand}`;
  }
  return `PLACEHOLDER_ONLY (${missingStatus}): ${plannedCommand}`;
}

export async function planSocialflowProductionExecution(
  options: ProductionExecutionPlanOptions = {},
): Promise<ProductionExecutionPlan> {
  const timestamp = new Date().toISOString();
  const goNoGo = await checkSocialflowProductionGoNoGo();

  const artifactRules: ArtifactRule[] = [
    {
      artifact: "apps/socialflow-runtime/wrangler.production.toml",
      statusWhenMissing: "PLANNED_ARTIFACT_REQUIRED",
      reason: "Production wrangler config is required before any deploy/rollback command can be reviewed.",
      requiredForExecution: true,
      commandReference: "wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml",
    },
    {
      artifact: "scripts/smoke-socialflow-production-health.ts",
      statusWhenMissing: "NOT_AVAILABLE_YET",
      reason: "Production health smoke is not implemented in repo.",
      requiredForExecution: true,
      commandReference: "pnpm tsx scripts/smoke-socialflow-production-health.ts",
    },
    {
      artifact: "scripts/smoke-socialflow-production-readiness.ts",
      statusWhenMissing: "NOT_AVAILABLE_YET",
      reason: "Production readiness smoke is not implemented in repo.",
      requiredForExecution: true,
      commandReference: "pnpm tsx scripts/smoke-socialflow-production-readiness.ts",
    },
    {
      artifact: "scripts/smoke-socialflow-production-postdeploy.ts",
      statusWhenMissing: "NOT_AVAILABLE_YET",
      reason: "Production postdeploy smoke is not implemented in repo.",
      requiredForExecution: true,
      commandReference: "pnpm tsx scripts/smoke-socialflow-production-postdeploy.ts",
    },
    {
      artifact: "scripts/monitor-socialflow-production-day.ts",
      statusWhenMissing: "MANUAL_REVIEW_REQUIRED",
      reason: "Production day monitoring automation is not implemented in repo.",
      requiredForExecution: false,
      commandReference: "pnpm tsx scripts/monitor-socialflow-production-day.ts --day=1",
    },
  ];

  const missingArtifacts = detectMissingArtifacts(artifactRules);
  const missingForExecution = missingArtifacts.filter((artifact) => artifact.requiredForExecution);
  const readyForExecution = false;
  const executionAllowed = false;
  const commandsArePlannedOnly = true;
  const requiresApproval = true;

  const planStatus =
    missingForExecution.length > 0
      ? "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_MISSING_ARTIFACTS"
      : "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_READY";

  const deployConfigMissing = hasMissingArtifact(
    missingArtifacts,
    "apps/socialflow-runtime/wrangler.production.toml",
  );
  const smokeHealthMissing = hasMissingArtifact(
    missingArtifacts,
    "scripts/smoke-socialflow-production-health.ts",
  );
  const smokeReadinessMissing = hasMissingArtifact(
    missingArtifacts,
    "scripts/smoke-socialflow-production-readiness.ts",
  );
  const smokePostdeployMissing = hasMissingArtifact(
    missingArtifacts,
    "scripts/smoke-socialflow-production-postdeploy.ts",
  );
  const monitorDayMissing = hasMissingArtifact(
    missingArtifacts,
    "scripts/monitor-socialflow-production-day.ts",
  );

  const additionalBlockers = [
    ...missingForExecution.map((artifact) => `MISSING_ARTIFACT:${artifact.artifact}`),
  ];

  const plan: ProductionExecutionPlan = {
    executionAllowed,
    readyForExecution,
    commandsArePlannedOnly,
    requiresApproval,
    status: planStatus,
    timestamp,
    missingArtifacts,
    preExecution: [
      {
        step: "Verify Stakeholder Approval",
        required: true,
        description: "Confirm stakeholder sign-off on production deployment.",
      },
      {
        step: "Verify Production Window",
        required: true,
        description: "Confirm production deployment window is scheduled and communicated.",
      },
      {
        step: "Verify On-Call Engineer",
        required: true,
        description: "Confirm on-call engineer is assigned and available.",
      },
      {
        step: "Verify Rollback Owner",
        required: true,
        description: "Confirm rollback owner is designated and prepared.",
      },
      {
        step: "Verify Cloudflare Access",
        required: true,
        description: "Confirm Cloudflare dashboard and API access is available.",
      },
      {
        step: "Verify Secrets Available",
        required: true,
        description: "Confirm all required secrets are accessible (DO NOT PRINT).",
      },
      {
        step: "Run Preflight Gates",
        required: true,
        description: "Execute all preflight checks: safety gate, go/no-go, parity.",
      },
    ],
    executionPlannedSteps: [
      {
        phase: "Preflight Gates",
        steps: [
          {
            step: "Safety Gate Check",
            command: "pnpm tsx scripts/check-socialflow-production-safety-gate.ts",
            description:
              "Verify safety gate passes (no production touch, zero remote writes, no token leakage).",
            requiresManualAction: false,
            critical: true,
          },
          {
            step: "Go/No-Go Gate",
            command: "pnpm tsx scripts/check-socialflow-production-go-no-go.ts",
            description: "Verify go/no-go returns GO_FOR_APPROVAL.",
            requiresManualAction: false,
            critical: true,
          },
          {
            step: "Parity Check",
            command: "pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts",
            description: "Verify parity is OK with zero mismatches.",
            requiresManualAction: false,
            critical: true,
          },
        ],
      },
      {
        phase: "Production Config Review",
        steps: [
          {
            step: "Review Production Wrangler Config",
            command: plannedOrPlaceholderCommand(
              "wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml",
              deployConfigMissing,
              "PLANNED_ARTIFACT_REQUIRED",
            ),
            description:
              "Review and approve the production wrangler config path before any deploy/rollback action.",
            requiresManualAction: true,
            critical: true,
          },
          {
            step: "Verify Production DB Bindings",
            description: "Confirm production D1 database bindings are correct.",
            requiresManualAction: true,
            critical: true,
          },
          {
            step: "Verify Production Switches",
            description: "Confirm SOCIALFLOW_RUNTIME_TARGET='production'.",
            requiresManualAction: true,
            critical: true,
          },
          {
            step: "Verify Production Secrets",
            description: "Confirm production secrets are configured in Cloudflare (DO NOT PRINT).",
            requiresManualAction: true,
            critical: true,
          },
        ],
      },
      {
        phase: "DNS and Route Planning",
        steps: [
          {
            step: "Review Production Route",
            description: "Confirm production route configuration (for example socialflow.drako.systems).",
            requiresManualAction: true,
            critical: true,
          },
          {
            step: "Plan DNS Cutover",
            description: "Prepare DNS cutover plan (Cloudflare DNS or external).",
            requiresManualAction: true,
            critical: true,
          },
          {
            step: "Verify Route DNS Readiness",
            command: "pnpm tsx scripts/check-socialflow-route-dns-readiness.ts",
            description: "Confirm route/DNS readiness check passes.",
            requiresManualAction: false,
            critical: true,
          },
        ],
      },
      {
        phase: "Deploy Execution (PLACEHOLDER - DO NOT RUN)",
        steps: [
          {
            step: "Deploy to Production",
            command: plannedOrPlaceholderCommand(
              "wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml",
              deployConfigMissing,
              "PLANNED_ARTIFACT_REQUIRED",
            ),
            description:
              "DO NOT EXECUTE. This remains a placeholder command until required production artifacts exist and human approvals are complete.",
            requiresManualAction: true,
            critical: true,
          },
        ],
      },
      {
        phase: "Smoke Testing",
        steps: [
          {
            step: "Production Health Check",
            command: plannedOrPlaceholderCommand(
              "pnpm tsx scripts/smoke-socialflow-production-health.ts",
              smokeHealthMissing,
              "NOT_AVAILABLE_YET",
            ),
            description: "Verify production health endpoint responds correctly.",
            requiresManualAction: smokeHealthMissing,
            critical: true,
          },
          {
            step: "Production Readiness Check",
            command: plannedOrPlaceholderCommand(
              "pnpm tsx scripts/smoke-socialflow-production-readiness.ts",
              smokeReadinessMissing,
              "NOT_AVAILABLE_YET",
            ),
            description: "Verify production readiness endpoint responds correctly.",
            requiresManualAction: smokeReadinessMissing,
            critical: true,
          },
          {
            step: "Production Postdeploy Smoke",
            command: plannedOrPlaceholderCommand(
              "pnpm tsx scripts/smoke-socialflow-production-postdeploy.ts",
              smokePostdeployMissing,
              "NOT_AVAILABLE_YET",
            ),
            description: "Verify no production touch, no token leakage, and zero remote writes.",
            requiresManualAction: smokePostdeployMissing,
            critical: true,
          },
        ],
      },
    ],
    rollbackPlan: [
      {
        command: plannedOrPlaceholderCommand(
          "wrangler rollback --config apps/socialflow-runtime/wrangler.production.toml",
          deployConfigMissing,
          "PLANNED_ARTIFACT_REQUIRED",
        ),
        description: "Rollback production deployment to previous version.",
        criticalPath: true,
      },
      {
        command: "PLANNED: Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE='false' in canary config",
        description: "Disable canary deployability to prevent further deploys.",
        criticalPath: true,
      },
      {
        command: "pnpm tsx scripts/check-socialflow-production-safety-gate.ts",
        description: "Re-verify safety gate after rollback.",
        criticalPath: true,
      },
      {
        command: "PLANNED: Notify stakeholders of rollback",
        description: "Communicate rollback status to all stakeholders.",
        criticalPath: true,
      },
    ],
    monitoringPlan: [
      {
        command: "pnpm tsx scripts/check-socialflow-production-safety-gate.ts",
        description: "Monitor production safety gate.",
        frequency: "Every 5 minutes for first hour",
      },
      {
        command: plannedOrPlaceholderCommand(
          "pnpm tsx scripts/monitor-socialflow-production-day.ts --day=1",
          monitorDayMissing,
          "MANUAL_REVIEW_REQUIRED",
        ),
        description: "Full production monitoring on Day 1.",
        frequency: "Daily for first week",
      },
      {
        command: "pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts",
        description: "Monitor parity between canary and production.",
        frequency: "Every hour for first 24 hours",
      },
    ],
    communicationSteps: [
      {
        when: "Pre-execution",
        action: "Notify stakeholders of planned deployment window.",
        audience: "Stakeholders, Technical Team, On-Call",
      },
      {
        when: "Deploy start",
        action: "Announce deployment start.",
        audience: "Technical Team, On-Call",
      },
      {
        when: "Deploy complete",
        action: "Announce deployment complete and smoke-test status.",
        audience: "Stakeholders, Technical Team, On-Call",
      },
      {
        when: "Post-deploy monitoring",
        action: "Hourly status updates for first 24 hours.",
        audience: "Stakeholders, Technical Team",
      },
      {
        when: "Rollback trigger",
        action: "Immediate notification of rollback initiation.",
        audience: "Stakeholders, Technical Team, On-Call",
      },
    ],
    goNoGoGate: {
      goForApproval: goNoGo.goForApproval,
      goForExecution: false,
      blockers: [...goNoGo.blockers, ...additionalBlockers],
    },
  };

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    console.log(`\n${plan.status}`);
  } else if (options.markdown) {
    printMarkdown(plan);
  } else {
    printNormal(plan);
  }

  return plan;
}

function printNormal(plan: ProductionExecutionPlan): void {
  console.log("\nSOCIALFLOW PRODUCTION EXECUTION PLAN");
  console.log(`Status: ${plan.status}`);
  console.log(`Execution Allowed: ${plan.executionAllowed ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${plan.readyForExecution ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${plan.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Approval: ${plan.requiresApproval ? "YES" : "NO"}\n`);

  console.log("MISSING ARTIFACTS");
  if (plan.missingArtifacts.length === 0) {
    console.log("- none\n");
  } else {
    for (const artifact of plan.missingArtifacts) {
      console.log(
        `- ${artifact.artifact} [${artifact.status}] requiredForExecution=${artifact.requiredForExecution}`,
      );
      console.log(`  ${artifact.reason}`);
    }
    console.log();
  }

  console.log("PRE-EXECUTION CHECKLIST");
  for (const [index, item] of plan.preExecution.entries()) {
    console.log(`${index + 1}. ${item.step}${item.required ? " (REQUIRED)" : ""}`);
    console.log(`   ${item.description}`);
  }

  console.log("\nEXECUTION PLANNED STEPS");
  for (const phase of plan.executionPlannedSteps) {
    console.log(`\n${phase.phase.toUpperCase()}`);
    for (const [index, step] of phase.steps.entries()) {
      console.log(`${index + 1}. ${step.step}${step.critical ? " (CRITICAL)" : ""}`);
      if (step.command) {
        console.log(`   Command: ${step.command}`);
      }
      console.log(`   ${step.description}`);
      if (step.requiresManualAction) {
        console.log("   REQUIRES MANUAL ACTION");
      }
    }
  }

  console.log("\nROLLBACK PLAN");
  for (const [index, item] of plan.rollbackPlan.entries()) {
    console.log(`${index + 1}. ${item.description}${item.criticalPath ? " (CRITICAL)" : ""}`);
    console.log(`   Command: ${item.command}`);
  }

  console.log("\nMONITORING PLAN");
  for (const [index, item] of plan.monitoringPlan.entries()) {
    console.log(`${index + 1}. ${item.description}`);
    console.log(`   Command: ${item.command}`);
    console.log(`   Frequency: ${item.frequency}`);
  }

  console.log("\nCOMMUNICATION PLAN");
  for (const [index, item] of plan.communicationSteps.entries()) {
    console.log(`${index + 1}. ${item.when}: ${item.action}`);
    console.log(`   Audience: ${item.audience}`);
  }

  console.log("\nGO/NO-GO GATE STATUS");
  console.log(`- Go for Approval: ${plan.goNoGoGate.goForApproval ? "YES" : "NO"}`);
  console.log(`- Go for Execution: ${plan.goNoGoGate.goForExecution ? "YES" : "NO"}`);
  console.log(`- Blockers: ${plan.goNoGoGate.blockers.join(", ")}\n`);

  console.log("EXECUTION NOT ALLOWED - This is a plan only. Human approval required.\n");
  console.log(plan.status);
}

function printMarkdown(plan: ProductionExecutionPlan): void {
  console.log("\n# SOCIALFLOW PRODUCTION EXECUTION PLAN\n");
  console.log(`**Status:** ${plan.status}`);
  console.log(`**Execution Allowed:** ${plan.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${plan.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${plan.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Approval:** ${plan.requiresApproval ? "YES" : "NO"}\n`);

  console.log("## Missing Artifacts\n");
  if (plan.missingArtifacts.length === 0) {
    console.log("- none\n");
  } else {
    for (const artifact of plan.missingArtifacts) {
      console.log(
        `- **${artifact.artifact}** [${artifact.status}] requiredForExecution=${artifact.requiredForExecution}`,
      );
      console.log(`  - ${artifact.reason}`);
      if (artifact.commandReference) {
        console.log(`  - Command reference: \`${artifact.commandReference}\``);
      }
    }
    console.log();
  }

  console.log("## Pre-Execution Checklist\n");
  for (const [index, item] of plan.preExecution.entries()) {
    console.log(`${index + 1}. **${item.step}**${item.required ? " *(REQUIRED)*" : ""}`);
    console.log(`   - ${item.description}\n`);
  }

  console.log("## Execution Planned Steps\n");
  for (const phase of plan.executionPlannedSteps) {
    console.log(`### ${phase.phase}\n`);
    for (const [index, step] of phase.steps.entries()) {
      console.log(`${index + 1}. **${step.step}**${step.critical ? " *(CRITICAL)*" : ""}`);
      if (step.command) {
        console.log(`   - Command: \`${step.command}\``);
      }
      console.log(`   - ${step.description}`);
      if (step.requiresManualAction) {
        console.log("   - *REQUIRES MANUAL ACTION*");
      }
      console.log();
    }
  }

  console.log("## Rollback Plan\n");
  for (const [index, item] of plan.rollbackPlan.entries()) {
    console.log(`${index + 1}. **${item.description}**${item.criticalPath ? " *(CRITICAL)*" : ""}`);
    console.log(`   - Command: \`${item.command}\`\n`);
  }

  console.log("## Monitoring Plan\n");
  for (const [index, item] of plan.monitoringPlan.entries()) {
    console.log(`${index + 1}. **${item.description}**`);
    console.log(`   - Command: \`${item.command}\``);
    console.log(`   - Frequency: ${item.frequency}\n`);
  }

  console.log("## Communication Plan\n");
  for (const [index, item] of plan.communicationSteps.entries()) {
    console.log(`${index + 1}. **${item.when}:** ${item.action}`);
    console.log(`   - Audience: ${item.audience}\n`);
  }

  console.log("## Go/No-Go Gate Status\n");
  console.log(`- Go for Approval: ${plan.goNoGoGate.goForApproval ? "YES" : "NO"}`);
  console.log(`- Go for Execution: ${plan.goNoGoGate.goForExecution ? "YES" : "NO"}`);
  console.log(`- Blockers: ${plan.goNoGoGate.blockers.join(", ")}\n`);

  console.log("EXECUTION NOT ALLOWED - This is a plan only. Human approval required.\n");
  console.log(plan.status);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  planSocialflowProductionExecution({ json, markdown })
    .then((plan) => {
      process.exit(!plan.executionAllowed && plan.commandsArePlannedOnly ? 0 : 1);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_ERROR", error);
      process.exit(1);
    });
}
