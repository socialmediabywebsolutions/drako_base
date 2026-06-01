import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface CheckSocialflowProductionRollbackReadinessOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
}

type RollbackReadinessStatus =
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_NOT_EXECUTABLE";

type PresenceStatus = "PRESENT" | "MISSING";
type RedactionStatus = "REDACTED" | "MISSING";

interface RedactedFieldStatus {
  presence: PresenceStatus;
  value: RedactionStatus;
}

interface CheckSocialflowProductionRollbackReadinessReport {
  ok: boolean;
  status: RollbackReadinessStatus;
  timestamp: string;
  rollbackPlanDocumented: boolean;
  rollbackOwner: RedactedFieldStatus;
  rollbackPlanId: RedactedFieldStatus;
  approvalId: RedactedFieldStatus;
  windowId: RedactedFieldStatus;
  rollbackCommandSetPlannedOnly: boolean;
  restorePathDocumented: boolean;
  postRollbackSmokeListDocumented: boolean;
  abortConditionsDocumented: boolean;
  noRealRollbackExecuted: true;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  remoteWrites: 0;
  productionTouched: false;
  blockers: string[];
  nextAction: string;
}

const ARTIFACT_PATHS = {
  runbook: "docs/runbooks/socialflow-production-controlled-execution.md",
  executionPlanScript: "scripts/plan-socialflow-production-execution.ts",
  decisionPack: "docs/architecture/socialflow-production-approval-pack.md",
  postdeploySmokeScript: "scripts/smoke-socialflow-production-postdeploy.ts",
} as const;

const INVALID_PLACEHOLDER_PATTERNS = [
  /^required_manual_configuration$/i,
  /^todo$/i,
  /^tbd$/i,
  /^pending$/i,
  /^changeme$/i,
] as const;

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }
  return !INVALID_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function toRedactedStatus(value: string | undefined): RedactedFieldStatus {
  const present = isConfiguredValue(value);
  return {
    presence: present ? "PRESENT" : "MISSING",
    value: present ? "REDACTED" : "MISSING",
  };
}

function readTextIfExists(relativePath: string): string {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function printNormal(report: CheckSocialflowProductionRollbackReadinessReport): void {
  console.log("\nSOCIALFLOW PRODUCTION ROLLBACK READINESS");
  console.log(`Status: ${report.status}`);
  console.log(`Rollback Plan Documented: ${report.rollbackPlanDocumented ? "YES" : "NO"}`);
  console.log(`Rollback Commands Planned-Only: ${report.rollbackCommandSetPlannedOnly ? "YES" : "NO"}`);
  console.log(`Restore Path Documented: ${report.restorePathDocumented ? "YES" : "NO"}`);
  console.log(`Post-Rollback Smokes Documented: ${report.postRollbackSmokeListDocumented ? "YES" : "NO"}`);
  console.log(`Abort Conditions Documented: ${report.abortConditionsDocumented ? "YES" : "NO"}`);
  console.log(`No Real Rollback Executed: ${report.noRealRollbackExecuted ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("ROLLBACK GOVERNANCE FIELDS (VALUES REDACTED)");
  console.log(`- SOCIALFLOW_PRODUCTION_ON_CALL_OWNER: ${report.rollbackOwner.presence} (${report.rollbackOwner.value})`);
  console.log(
    `- SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`,
  );
  console.log(`- SOCIALFLOW_PRODUCTION_APPROVAL_ID: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(`- SOCIALFLOW_PRODUCTION_WINDOW_ID: ${report.windowId.presence} (${report.windowId.value})`);
  console.log();

  console.log(`Blockers: ${report.blockers.length === 0 ? "none" : report.blockers.join(", ")}`);
  console.log(`Next Action: ${report.nextAction}\n`);
  console.log(report.status);
}

function printMarkdown(report: CheckSocialflowProductionRollbackReadinessReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION ROLLBACK READINESS\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Rollback Plan Documented:** ${report.rollbackPlanDocumented ? "YES" : "NO"}`);
  console.log(`**Rollback Commands Planned-Only:** ${report.rollbackCommandSetPlannedOnly ? "YES" : "NO"}`);
  console.log(`**Restore Path Documented:** ${report.restorePathDocumented ? "YES" : "NO"}`);
  console.log(`**Post-Rollback Smokes Documented:** ${report.postRollbackSmokeListDocumented ? "YES" : "NO"}`);
  console.log(`**Abort Conditions Documented:** ${report.abortConditionsDocumented ? "YES" : "NO"}`);
  console.log(`**No Real Rollback Executed:** ${report.noRealRollbackExecuted ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("## Rollback Governance Fields (Values Redacted)\n");
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ON_CALL_OWNER\`: ${report.rollbackOwner.presence} (${report.rollbackOwner.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID\`: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`,
  );
  console.log(`- \`SOCIALFLOW_PRODUCTION_APPROVAL_ID\`: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(`- \`SOCIALFLOW_PRODUCTION_WINDOW_ID\`: ${report.windowId.presence} (${report.windowId.value})`);
  console.log();

  console.log("## Blockers\n");
  if (report.blockers.length === 0) {
    console.log("- none");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(report.status);
}

export async function checkSocialflowProductionRollbackReadiness(
  options: CheckSocialflowProductionRollbackReadinessOptions = {},
): Promise<CheckSocialflowProductionRollbackReadinessReport> {
  const timestamp = new Date().toISOString();
  const blockers = new Set<string>();

  const runbookExists = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.runbook));
  const executionPlanScriptExists = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.executionPlanScript));
  const decisionPackExists = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.decisionPack));
  const postdeploySmokeScriptExists = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.postdeploySmokeScript));

  if (!runbookExists) blockers.add("RUNBOOK_MISSING");
  if (!executionPlanScriptExists) blockers.add("EXECUTION_PLAN_SCRIPT_MISSING");
  if (!decisionPackExists) blockers.add("DECISION_PACK_MISSING");
  if (!postdeploySmokeScriptExists) blockers.add("POSTDEPLOY_SMOKE_SCRIPT_MISSING");

  const runbookContent = readTextIfExists(ARTIFACT_PATHS.runbook);
  const executionPlanContent = readTextIfExists(ARTIFACT_PATHS.executionPlanScript);

  const rollbackPlanDocumented =
    runbookContent.includes("## 11. Checklist de rollback")
    && runbookContent.includes("## 17. Plan de rollback");
  const rollbackCommandSetPlannedOnly =
    executionPlanContent.includes("PLANNED_TEMPLATE_REVIEW_REQUIRED: wrangler rollback")
    || executionPlanContent.includes("PLACEHOLDER_ONLY (PLANNED_ARTIFACT_REQUIRED): wrangler rollback");
  const unsafeRollbackLiteralDetected = /command:\s*"wrangler rollback --config/.test(executionPlanContent);
  const restorePathDocumented =
    /restore path|ruta de restore|restauraci[oó]n/i.test(runbookContent);
  const postRollbackSmokeListDocumented =
    runbookContent.includes("smoke-socialflow-production-health.ts")
    && runbookContent.includes("smoke-socialflow-production-readiness.ts")
    && runbookContent.includes("smoke-socialflow-production-postdeploy.ts");
  const abortConditionsDocumented = runbookContent.includes("## 16. Condiciones de abort");

  if (!rollbackPlanDocumented) blockers.add("ROLLBACK_PLAN_NOT_DOCUMENTED");
  if (!rollbackCommandSetPlannedOnly || unsafeRollbackLiteralDetected) {
    blockers.add("ROLLBACK_COMMAND_SET_NOT_PLANNED_ONLY");
  }
  if (!restorePathDocumented) blockers.add("RESTORE_PATH_NOT_DOCUMENTED");
  if (!postRollbackSmokeListDocumented) blockers.add("POST_ROLLBACK_SMOKE_LIST_NOT_DOCUMENTED");
  if (!abortConditionsDocumented) blockers.add("ABORT_CONDITIONS_NOT_DOCUMENTED");

  const rollbackOwner = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER);
  const rollbackPlanId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID);
  const approvalId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID);
  const windowId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID);

  const reviewChecksComplete = blockers.size === 0;
  const executableMetadataComplete =
    rollbackOwner.presence === "PRESENT"
    && rollbackPlanId.presence === "PRESENT"
    && approvalId.presence === "PRESENT"
    && windowId.presence === "PRESENT";

  if (!executableMetadataComplete) {
    blockers.add("ROLLBACK_EXECUTION_METADATA_INCOMPLETE");
  }

  const status: RollbackReadinessStatus = !reviewChecksComplete
    ? "SOCIALFLOW_PRODUCTION_ROLLBACK_BLOCKED"
    : !executableMetadataComplete
    ? "SOCIALFLOW_PRODUCTION_ROLLBACK_NOT_EXECUTABLE"
    : "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW";

  const report: CheckSocialflowProductionRollbackReadinessReport = {
    ok: status === "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW",
    status,
    timestamp,
    rollbackPlanDocumented,
    rollbackOwner,
    rollbackPlanId,
    approvalId,
    windowId,
    rollbackCommandSetPlannedOnly: rollbackCommandSetPlannedOnly && !unsafeRollbackLiteralDetected,
    restorePathDocumented,
    postRollbackSmokeListDocumented,
    abortConditionsDocumented,
    noRealRollbackExecuted: true,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    remoteWrites: 0,
    productionTouched: false,
    blockers: Array.from(blockers),
    nextAction: status === "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW"
      ? "SUBMIT_ROLLBACK_READINESS_FOR_HUMAN_APPROVAL"
      : status === "SOCIALFLOW_PRODUCTION_ROLLBACK_NOT_EXECUTABLE"
      ? "SET_ROLLBACK_METADATA_AND_KEEP_PLANNED_ONLY"
      : "COMPLETE_ROLLBACK_DOCUMENTATION_AND_PLANNED_COMMAND_SET",
  };

  if (!options.silent) {
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      console.log(`\n${report.status}`);
    } else if (options.markdown) {
      printMarkdown(report);
    } else {
      printNormal(report);
    }
  }

  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  checkSocialflowProductionRollbackReadiness({ json, markdown })
    .then((report) => {
      const shouldFail = report.status !== "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_ROLLBACK_READINESS_ERROR", error);
      process.exit(1);
    });
}
