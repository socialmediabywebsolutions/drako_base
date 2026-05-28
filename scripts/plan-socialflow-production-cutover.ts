import { checkProductionCutoverReadiness } from "./check-socialflow-production-cutover-readiness";

interface ProductionCutoverPlanOptions {
  json?: boolean;
  markdown?: boolean;
}

interface ProductionCutoverPlan {
  executionAllowed: boolean;
  requiresHumanApproval: boolean;
  commandsArePlannedOnly: boolean;
  status: string;
  timestamp: string;
  readiness: {
    readyForPlanning: boolean;
    readyForExecution: boolean;
    blockers: string[];
  };
  prechecks: {
    command: string;
    description: string;
    mustPass: boolean;
  }[];
  productionConfigReview: {
    items: string[];
    approvalRequired: boolean;
  };
  cloudflareSteps: {
    step: string;
    description: string;
    requiresManualAction: boolean;
  }[];
  deployCommand: {
    command: string;
    warning: string;
    doNotExecute: boolean;
  };
  smokeCommands: {
    command: string;
    description: string;
    mustPass: boolean;
  }[];
  rollbackCommands: {
    command: string;
    description: string;
    criticalPath: boolean;
  }[];
  monitoringCommands: {
    command: string;
    description: string;
    frequency: string;
  }[];
  approvalsRequired: string[];
  recommendation: string;
}

async function planProductionCutover(
  options: ProductionCutoverPlanOptions = {}
): Promise<ProductionCutoverPlan> {
  const timestamp = new Date().toISOString();

  const readinessReport = await checkProductionCutoverReadiness();

  const executionAllowed = false;
  const requiresHumanApproval = true;
  const commandsArePlannedOnly = true;

  const status = "SOCIALFLOW_PRODUCTION_CUTOVER_PLAN_READY";

  const prechecks = [
    {
      command: "pnpm tsx scripts/check-socialflow-production-cutover-readiness.ts",
      description: "Verify all gates pass",
      mustPass: true,
    },
    {
      command: "pnpm tsx scripts/check-socialflow-production-safety-gate.ts",
      description: "Confirm production safety",
      mustPass: true,
    },
    {
      command: "pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts",
      description: "Confirm parity before cutover",
      mustPass: true,
    },
    {
      command: "pnpm typecheck",
      description: "Confirm no type errors",
      mustPass: true,
    },
    {
      command: "npx vitest run",
      description: "Confirm all tests pass",
      mustPass: true,
    },
  ];

  const productionConfigReview = {
    items: [
      "Review production wrangler.toml configuration",
      "Verify production database bindings",
      "Verify production secrets are set in Cloudflare",
      "Verify SOCIALFLOW_RUNTIME_TARGET = 'production'",
      "Verify production custom domain configuration",
      "Verify production switch states",
      "Verify production rollback switch state",
    ],
    approvalRequired: true,
  };

  const cloudflareSteps = [
    {
      step: "DNS/Route configuration",
      description:
        "Configure production custom domain in Cloudflare dashboard (DO NOT EXECUTE until approved)",
      requiresManualAction: true,
    },
    {
      step: "Secret verification",
      description:
        "Verify all production secrets exist in Cloudflare (SOCIALFLOW_CANARY_GATE_TOKEN, etc.)",
      requiresManualAction: true,
    },
    {
      step: "D1 database verification",
      description:
        "Verify production D1 databases exist and have correct schema",
      requiresManualAction: true,
    },
  ];

  const deployCommand = {
    command:
      "PLACEHOLDER: wrangler deploy --config apps/socialflow-runtime/wrangler.production.toml",
    warning:
      "DO NOT EXECUTE - This is a planned command only. Requires stakeholder approval and production deploy window.",
    doNotExecute: true,
  };

  const smokeCommands = [
    {
      command: "PLACEHOLDER: pnpm tsx scripts/smoke-socialflow-production-postdeploy.ts",
      description: "Verify production health and readiness endpoints",
      mustPass: true,
    },
    {
      command: "PLACEHOLDER: pnpm tsx scripts/check-socialflow-production-ownership-parity.ts",
      description: "Verify production parity after deploy",
      mustPass: true,
    },
    {
      command: "PLACEHOLDER: pnpm tsx scripts/smoke-socialflow-production-gated-health.ts",
      description: "Verify production gate protection active",
      mustPass: true,
    },
  ];

  const rollbackCommands = [
    {
      command:
        "PLACEHOLDER: wrangler rollback --name saas-socialflows-runtime-production",
      description: "Rollback to previous production deployment",
      criticalPath: true,
    },
    {
      command: "PLACEHOLDER: Set SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = 'all-switches-off'",
      description: "Emergency rollback via switch state",
      criticalPath: true,
    },
    {
      command: "PLACEHOLDER: Verify rollback via smoke tests",
      description: "Confirm rollback successful",
      criticalPath: true,
    },
  ];

  const monitoringCommands = [
    {
      command: "PLACEHOLDER: Check Cloudflare Dashboard logs",
      description: "Monitor worker logs for errors",
      frequency: "Every 5 minutes for first hour",
    },
    {
      command: "PLACEHOLDER: pnpm tsx scripts/monitor-socialflow-production-day.ts --day=1",
      description: "Run production monitoring",
      frequency: "Daily for 7 days",
    },
    {
      command: "PLACEHOLDER: curl https://socialflow.drako.systems/api/socialflow/runtime/health",
      description: "Manual health check",
      frequency: "As needed",
    },
  ];

  const approvalsRequired = [
    "Technical Lead approval",
    "Stakeholder approval",
    "Production deploy window confirmed",
    "On-call engineer availability confirmed",
    "Rollback plan reviewed and approved",
    "Monitoring dashboard configured",
    "All prechecks passed",
  ];

  const recommendation = readinessReport.readyForPlanning
    ? "Plan ready for stakeholder review. DO NOT EXECUTE without explicit approval."
    : `Cannot plan cutover yet. Blockers: ${readinessReport.blockedBy.filter(b => !["STAKEHOLDER_APPROVAL_REQUIRED", "PRODUCTION_DEPLOY_WINDOW_REQUIRED", "ON_CALL_REQUIRED"].includes(b)).join(", ")}`;

  const plan: ProductionCutoverPlan = {
    executionAllowed,
    requiresHumanApproval,
    commandsArePlannedOnly,
    status,
    timestamp,
    readiness: {
      readyForPlanning: readinessReport.readyForPlanning,
      readyForExecution: readinessReport.readyForExecution,
      blockers: readinessReport.blockedBy,
    },
    prechecks,
    productionConfigReview,
    cloudflareSteps,
    deployCommand,
    smokeCommands,
    rollbackCommands,
    monitoringCommands,
    approvalsRequired,
    recommendation,
  };

  return plan;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  const plan = await planProductionCutover({ json, markdown });

  if (json) {
    console.log(JSON.stringify(plan, null, 2));
  } else if (markdown) {
    console.log(`# SOCIALFLOW PRODUCTION CUTOVER PLAN\n`);
    console.log(`**Status:** ${plan.status}`);
    console.log(`**Timestamp:** ${plan.timestamp}`);
    console.log(`**Execution Allowed:** ❌ ${plan.executionAllowed}`);
    console.log(`**Requires Human Approval:** ✅ ${plan.requiresHumanApproval}`);
    console.log(
      `**Commands Are Planned Only:** ✅ ${plan.commandsArePlannedOnly}\n`
    );
    console.log(`## Readiness\n`);
    console.log(
      `- Ready for Planning: ${plan.readiness.readyForPlanning ? "✅" : "❌"}`
    );
    console.log(
      `- Ready for Execution: ${plan.readiness.readyForExecution ? "✅" : "❌"}`
    );
    console.log(`- Blockers: ${plan.readiness.blockers.join(", ")}\n`);
    console.log(`## Prechecks\n`);
    plan.prechecks.forEach((p) =>
      console.log(`- \`${p.command}\` - ${p.description}`)
    );
    console.log(`\n## Production Config Review\n`);
    plan.productionConfigReview.items.forEach((i) => console.log(`- ${i}`));
    console.log(
      `\n**Approval Required:** ${plan.productionConfigReview.approvalRequired ? "✅" : "❌"}\n`
    );
    console.log(`## Cloudflare Steps\n`);
    plan.cloudflareSteps.forEach((s) =>
      console.log(`- **${s.step}:** ${s.description}`)
    );
    console.log(`\n## Deploy Command (PLANNED ONLY - DO NOT EXECUTE)\n`);
    console.log(`\`\`\`bash\n${plan.deployCommand.command}\n\`\`\``);
    console.log(`\n⚠️ **WARNING:** ${plan.deployCommand.warning}\n`);
    console.log(`## Smoke Commands (Post-Deploy)\n`);
    plan.smokeCommands.forEach((s) =>
      console.log(`- \`${s.command}\` - ${s.description}`)
    );
    console.log(`\n## Rollback Commands\n`);
    plan.rollbackCommands.forEach((r) =>
      console.log(`- \`${r.command}\` - ${r.description}`)
    );
    console.log(`\n## Monitoring Commands\n`);
    plan.monitoringCommands.forEach((m) =>
      console.log(`- \`${m.command}\` (${m.frequency}) - ${m.description}`)
    );
    console.log(`\n## Approvals Required\n`);
    plan.approvalsRequired.forEach((a) => console.log(`- ${a}`));
    console.log(`\n**Recommendation:** ${plan.recommendation}\n`);
  } else {
    console.log(`SOCIALFLOW PRODUCTION CUTOVER PLAN`);
    console.log(`Status: ${plan.status}`);
    console.log(`Execution Allowed: ${plan.executionAllowed}`);
    console.log(`Requires Human Approval: ${plan.requiresHumanApproval}`);
    console.log(`Commands Are Planned Only: ${plan.commandsArePlannedOnly}`);
    console.log(`Ready for Planning: ${plan.readiness.readyForPlanning}`);
    console.log(`Ready for Execution: ${plan.readiness.readyForExecution}`);
    console.log(`Blockers: ${plan.readiness.blockers.join(", ")}`);
    console.log(`Approvals Required: ${plan.approvalsRequired.length}`);
    console.log(`Recommendation: ${plan.recommendation}`);
  }

  console.log(`\n${plan.status}`);
  console.log(`\n⚠️  EXECUTION NOT ALLOWED - PLAN ONLY`);
  process.exit(0);
}

if (require.main === module) {
  main();
}

export { planProductionCutover };
