import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  loadSocialflowPlannedApprovalFixture,
  resolvePlannedApprovalField,
} from "./lib/socialflow-production-planned-approval-fixture";

interface CheckSocialflowProductionWindowReadinessOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
  fixture?: string;
}

type ProductionWindowReadinessStatus =
  | "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_WINDOW_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED";

type PresenceStatus = "PRESENT" | "MISSING" | "FIXTURE";
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
  fixtureMode: boolean;
  productionTouchAllowed: false;
  remoteWrites: 0;
  productionTouched: false;
  blockers: string[];
  nextAction: string;
}

const ARTIFACT_PATHS = {
  runbook: "docs/runbooks/socialflow-production-controlled-execution.md",
  decisionPack: "docs/architecture/socialflow-production-approval-pack.md",
} as const;

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
  console.log(`Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
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
  console.log(`**Fixture Mode:** ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`**Production Touch Allowed:** ${report.productionTouchAllowed ? "YES" : "NO"}`);
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
  const fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
  const fixture = fixtureResolution.fixture;
  const fixtureValues = fixture
    ? {
        SOCIALFLOW_PRODUCTION_WINDOW_ID: fixture.productionWindowId,
        SOCIALFLOW_PRODUCTION_ON_CALL_OWNER: fixture.onCallOwner,
        SOCIALFLOW_PRODUCTION_APPROVAL_ID: fixture.approvalId,
        SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID: fixture.rollbackPlanId,
        SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID: fixture.monitoringPlanId,
        SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID: fixture.smokeSequenceId,
        SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID: fixture.abortCriteriaId,
      }
    : null;

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

  const productionWindowId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_WINDOW_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_WINDOW_ID,
    fixtureResolution.fixtureMode,
  );
  const onCallOwner = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER,
    fixtureValues?.SOCIALFLOW_PRODUCTION_ON_CALL_OWNER,
    fixtureResolution.fixtureMode,
  );
  const approvalId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_APPROVAL_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_APPROVAL_ID,
    fixtureResolution.fixtureMode,
  );
  const rollbackPlanId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID,
    fixtureResolution.fixtureMode,
  );
  const monitoringPlanId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID,
    fixtureResolution.fixtureMode,
  );
  const smokeSequenceId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID,
    fixtureResolution.fixtureMode,
  );
  const abortCriteriaId = resolvePlannedApprovalField(
    process.env.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID,
    fixtureValues?.SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID,
    fixtureResolution.fixtureMode,
  );

  const structuralChecksComplete = blockers.size === 0;
  const governanceMetadataComplete =
    productionWindowId.presence !== "MISSING"
    && onCallOwner.presence !== "MISSING"
    && approvalId.presence !== "MISSING"
    && rollbackPlanId.presence !== "MISSING"
    && monitoringPlanId.presence !== "MISSING"
    && smokeSequenceId.presence !== "MISSING"
    && abortCriteriaId.presence !== "MISSING";

  if (!governanceMetadataComplete) {
    blockers.add("WINDOW_GOVERNANCE_METADATA_INCOMPLETE");
  }
  if (approvalId.presence === "MISSING") {
    blockers.add("APPROVAL_ID_REQUIRED");
  }
  if (onCallOwner.presence === "MISSING") {
    blockers.add("ON_CALL_OWNER_REQUIRED");
  }
  if (productionWindowId.presence === "MISSING") {
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
    fixtureMode: fixtureResolution.fixtureMode,
    productionTouchAllowed: false,
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
  const fixtureIndex = args.findIndex((arg) => arg === "--fixture" || arg.startsWith("--fixture="));
  const fixture =
    fixtureIndex >= 0
      ? args[fixtureIndex] === "--fixture"
        ? args[fixtureIndex + 1]
        : args[fixtureIndex].slice("--fixture=".length)
      : undefined;

  checkSocialflowProductionWindowReadiness({ json, markdown, fixture })
    .then((report) => {
      const shouldFail = report.status !== "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_WINDOW_READINESS_ERROR", error);
      process.exit(1);
    });
}
