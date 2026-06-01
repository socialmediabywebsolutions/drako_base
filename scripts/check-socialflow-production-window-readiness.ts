import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface CheckSocialflowProductionWindowReadinessOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
}

type ProductionWindowReadinessStatus =
  | "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_WINDOW_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED";

type PresenceStatus = "PRESENT" | "MISSING";
type RedactionStatus = "REDACTED" | "MISSING";

interface RedactedFieldStatus {
  presence: PresenceStatus;
  value: RedactionStatus;
}

interface CheckSocialflowProductionWindowReadinessReport {
  ok: boolean;
  status: ProductionWindowReadinessStatus;
  timestamp: string;
  productionWindowId: RedactedFieldStatus;
  onCallOwner: RedactedFieldStatus;
  approvalId: RedactedFieldStatus;
  rollbackPlanId: RedactedFieldStatus;
  monitoringPlanId: RedactedFieldStatus;
  smokeSequenceId: RedactedFieldStatus;
  abortCriteriaId: RedactedFieldStatus;
  monitoringPlanPresent: boolean;
  smokeSequencePresent: boolean;
  abortCriteriaPresent: boolean;
  runbookPresent: boolean;
  decisionPackPresent: boolean;
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
  decisionPack: "docs/architecture/socialflow-production-approval-pack.md",
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

function printNormal(report: CheckSocialflowProductionWindowReadinessReport): void {
  console.log("\nSOCIALFLOW PRODUCTION WINDOW READINESS");
  console.log(`Status: ${report.status}`);
  console.log(`Runbook Present: ${report.runbookPresent ? "YES" : "NO"}`);
  console.log(`Decision Pack Present: ${report.decisionPackPresent ? "YES" : "NO"}`);
  console.log(`Monitoring Plan Present: ${report.monitoringPlanPresent ? "YES" : "NO"}`);
  console.log(`Smoke Sequence Present: ${report.smokeSequencePresent ? "YES" : "NO"}`);
  console.log(`Abort Criteria Present: ${report.abortCriteriaPresent ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("WINDOW GOVERNANCE FIELDS (VALUES REDACTED)");
  console.log(
    `- SOCIALFLOW_PRODUCTION_WINDOW_ID: ${report.productionWindowId.presence} (${report.productionWindowId.value})`,
  );
  console.log(`- SOCIALFLOW_PRODUCTION_ON_CALL_OWNER: ${report.onCallOwner.presence} (${report.onCallOwner.value})`);
  console.log(`- SOCIALFLOW_PRODUCTION_APPROVAL_ID: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(
    `- SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`,
  );
  console.log(
    `- SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID: ${report.monitoringPlanId.presence} (${report.monitoringPlanId.value})`,
  );
  console.log(
    `- SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID: ${report.smokeSequenceId.presence} (${report.smokeSequenceId.value})`,
  );
  console.log(
    `- SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID: ${report.abortCriteriaId.presence} (${report.abortCriteriaId.value})`,
  );
  console.log();

  console.log(`Blockers: ${report.blockers.length === 0 ? "none" : report.blockers.join(", ")}`);
  console.log(`Next Action: ${report.nextAction}\n`);
  console.log(report.status);
}

function printMarkdown(report: CheckSocialflowProductionWindowReadinessReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION WINDOW READINESS\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Runbook Present:** ${report.runbookPresent ? "YES" : "NO"}`);
  console.log(`**Decision Pack Present:** ${report.decisionPackPresent ? "YES" : "NO"}`);
  console.log(`**Monitoring Plan Present:** ${report.monitoringPlanPresent ? "YES" : "NO"}`);
  console.log(`**Smoke Sequence Present:** ${report.smokeSequencePresent ? "YES" : "NO"}`);
  console.log(`**Abort Criteria Present:** ${report.abortCriteriaPresent ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("## Window Governance Fields (Values Redacted)\n");
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_WINDOW_ID\`: ${report.productionWindowId.presence} (${report.productionWindowId.value})`,
  );
  console.log(`- \`SOCIALFLOW_PRODUCTION_ON_CALL_OWNER\`: ${report.onCallOwner.presence} (${report.onCallOwner.value})`);
  console.log(`- \`SOCIALFLOW_PRODUCTION_APPROVAL_ID\`: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID\`: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID\`: ${report.monitoringPlanId.presence} (${report.monitoringPlanId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID\`: ${report.smokeSequenceId.presence} (${report.smokeSequenceId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID\`: ${report.abortCriteriaId.presence} (${report.abortCriteriaId.value})`,
  );
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

export async function checkSocialflowProductionWindowReadiness(
  options: CheckSocialflowProductionWindowReadinessOptions = {},
): Promise<CheckSocialflowProductionWindowReadinessReport> {
  const timestamp = new Date().toISOString();
  const blockers = new Set<string>();

  const runbookPresent = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.runbook));
  const decisionPackPresent = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.decisionPack));
  if (!runbookPresent) blockers.add("RUNBOOK_MISSING");
  if (!decisionPackPresent) blockers.add("DECISION_PACK_MISSING");

  const runbookContent = readTextIfExists(ARTIFACT_PATHS.runbook);
  const monitoringPlanPresent =
    runbookContent.includes("## 10. Checklist de monitoring")
    && runbookContent.includes("monitor-socialflow-production-day.ts");
  const smokeSequencePresent =
    runbookContent.includes("## 9. Checklist de smokes")
    && runbookContent.includes("smoke-socialflow-production-health.ts")
    && runbookContent.includes("smoke-socialflow-production-readiness.ts")
    && runbookContent.includes("smoke-socialflow-production-postdeploy.ts");
  const abortCriteriaPresent = runbookContent.includes("## 16. Condiciones de abort");

  if (!monitoringPlanPresent) blockers.add("MONITORING_PLAN_NOT_DOCUMENTED");
  if (!smokeSequencePresent) blockers.add("SMOKE_SEQUENCE_NOT_DOCUMENTED");
  if (!abortCriteriaPresent) blockers.add("ABORT_CRITERIA_NOT_DOCUMENTED");

  const productionWindowId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID);
  const onCallOwner = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER);
  const approvalId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID);
  const rollbackPlanId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID);
  const monitoringPlanId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID);
  const smokeSequenceId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID);
  const abortCriteriaId = toRedactedStatus(process.env.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID);

  const structuralChecksComplete = blockers.size === 0;
  const governanceMetadataComplete =
    productionWindowId.presence === "PRESENT"
    && onCallOwner.presence === "PRESENT"
    && approvalId.presence === "PRESENT"
    && rollbackPlanId.presence === "PRESENT"
    && monitoringPlanId.presence === "PRESENT"
    && smokeSequenceId.presence === "PRESENT"
    && abortCriteriaId.presence === "PRESENT";

  if (!governanceMetadataComplete) {
    blockers.add("WINDOW_GOVERNANCE_METADATA_INCOMPLETE");
  }
  if (approvalId.presence !== "PRESENT") {
    blockers.add("APPROVAL_ID_REQUIRED");
  }
  if (onCallOwner.presence !== "PRESENT") {
    blockers.add("ON_CALL_OWNER_REQUIRED");
  }
  if (productionWindowId.presence !== "PRESENT") {
    blockers.add("WINDOW_ID_REQUIRED");
  }

  const status: ProductionWindowReadinessStatus = !structuralChecksComplete
    ? "SOCIALFLOW_PRODUCTION_WINDOW_BLOCKED"
    : !governanceMetadataComplete
    ? "SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED"
    : "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW";

  const report: CheckSocialflowProductionWindowReadinessReport = {
    ok: status === "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW",
    status,
    timestamp,
    productionWindowId,
    onCallOwner,
    approvalId,
    rollbackPlanId,
    monitoringPlanId,
    smokeSequenceId,
    abortCriteriaId,
    monitoringPlanPresent,
    smokeSequencePresent,
    abortCriteriaPresent,
    runbookPresent,
    decisionPackPresent,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    remoteWrites: 0,
    productionTouched: false,
    blockers: Array.from(blockers),
    nextAction: status === "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW"
      ? "SUBMIT_WINDOW_AND_ON_CALL_PLAN_FOR_HUMAN_APPROVAL"
      : status === "SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED"
      ? "SET_APPROVAL_WINDOW_ON_CALL_AND_GOVERNANCE_IDS"
      : "COMPLETE_WINDOW_MONITORING_AND_ABORT_DOCUMENTATION",
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

  checkSocialflowProductionWindowReadiness({ json, markdown })
    .then((report) => {
      const shouldFail = report.status !== "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_WINDOW_READINESS_ERROR", error);
      process.exit(1);
    });
}
