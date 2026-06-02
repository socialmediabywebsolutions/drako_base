import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  loadSocialflowPlannedApprovalFixture,
  resolvePlannedApprovalField,
} from "./lib/socialflow-production-planned-approval-fixture";

interface SimulateSocialflowProductionRollbackOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
  fixture?: string;
}

type RollbackDrillStatus =
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER";

type PresenceStatus = "PRESENT" | "MISSING" | "FIXTURE";
type RedactionStatus = "REDACTED" | "MISSING";

interface RedactedFieldStatus {
  presence: PresenceStatus;
  value: RedactionStatus;
}

interface RollbackDrillReport {
  ok: boolean;
  status: RollbackDrillStatus;
  timestamp: string;
  fixtureMode: boolean;
  productionTouchAllowed: false;
  rollbackExecutable: false;
  rollbackCommandsPlannedOnly: true;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  noRealRollbackExecuted: true;
  productionTouched: false;
  remoteWrites: 0;
  approvalId: RedactedFieldStatus;
  rollbackPlanId: RedactedFieldStatus;
  onCallOwner: RedactedFieldStatus;
  productionWindowId: RedactedFieldStatus;
  abortCriteriaId: RedactedFieldStatus;
  smokeSequenceId: RedactedFieldStatus;
  monitoringPlanId: RedactedFieldStatus;
  routingReviewPackPresent: boolean;
  controlledExecutionRunbookPresent: boolean;
  productionApprovalPackPresent: boolean;
  rollbackDrillPackPresent: boolean;
  rollbackDrillScriptPresent: boolean;
  drillChecklist: {
    abortConditionsDocumented: boolean;
    plannedRollbackSequenceDocumented: boolean;
    routingRestoreDocumented: boolean;
    workerTargetRestoreDocumented: boolean;
    configRestoreDocumented: boolean;
    postRollbackSmokeDocumented: boolean;
    postRollbackMonitoringDocumented: boolean;
    evidenceRequiredDocumented: boolean;
    humanApprovalRequiredDocumented: boolean;
    futureExecutionGateDocumented: boolean;
    noRealRollbackDecisionDocumented: boolean;
  };
  plannedRollbackSequence: string[];
  postRollbackSmokes: string[];
  postRollbackMonitoring: string[];
  evidenceRequired: string[];
  blockers: string[];
  nextAction: string;
}

const ARTIFACT_PATHS = {
  routingReviewPack: "docs/architecture/socialflow-production-routing-review-pack.md",
  controlledExecutionRunbook: "docs/runbooks/socialflow-production-controlled-execution.md",
  productionApprovalPack: "docs/architecture/socialflow-production-approval-pack.md",
  rollbackDrillPack: "docs/architecture/socialflow-production-rollback-drill.md",
  rollbackDrillScript: "scripts/simulate-socialflow-production-rollback.ts",
} as const;

const TOKEN_LEAKAGE_PATTERNS = [
  /\b(access|refresh)_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

function readTextIfExists(relativePath: string): string {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) {
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function detectTokenLeakage(values: Array<string | undefined>): boolean {
  return values
    .filter((value): value is string => typeof value === "string")
    .some((value) => TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value)));
}

function printNormal(report: RollbackDrillReport): void {
  console.log("\nSOCIALFLOW PRODUCTION ROLLBACK DRILL");
  console.log(`Status: ${report.status}`);
  console.log(`Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`Rollback Executable: ${report.rollbackExecutable ? "YES" : "NO"}`);
  console.log(`Rollback Commands Planned-Only: ${report.rollbackCommandsPlannedOnly ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`No Real Rollback Executed: ${report.noRealRollbackExecuted ? "YES" : "NO"}`);
  console.log(`Production Touched: ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`Remote Writes: ${report.remoteWrites}`);
  console.log();

  console.log("GOVERNANCE FIELDS (VALUES REDACTED)");
  console.log(`- SOCIALFLOW_PRODUCTION_APPROVAL_ID: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(`- SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`);
  console.log(`- SOCIALFLOW_PRODUCTION_ON_CALL_OWNER: ${report.onCallOwner.presence} (${report.onCallOwner.value})`);
  console.log(
    `- SOCIALFLOW_PRODUCTION_WINDOW_ID: ${report.productionWindowId.presence} (${report.productionWindowId.value})`,
  );
  console.log(`- SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID: ${report.abortCriteriaId.presence} (${report.abortCriteriaId.value})`);
  console.log(`- SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID: ${report.smokeSequenceId.presence} (${report.smokeSequenceId.value})`);
  console.log(
    `- SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID: ${report.monitoringPlanId.presence} (${report.monitoringPlanId.value})`,
  );
  console.log();

  console.log("ARTIFACTS");
  console.log(`- Routing Review Pack: ${report.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`- Controlled Execution Runbook: ${report.controlledExecutionRunbookPresent ? "YES" : "NO"}`);
  console.log(`- Production Approval Pack: ${report.productionApprovalPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Pack: ${report.rollbackDrillPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Script: ${report.rollbackDrillScriptPresent ? "YES" : "NO"}`);
  console.log();

  console.log("PLANNED-ONLY ROLLBACK SEQUENCE");
  report.plannedRollbackSequence.forEach((step, index) => console.log(`${index + 1}. ${step}`));
  console.log();

  console.log("CHECKLIST");
  console.log(`- Abort Conditions: ${report.drillChecklist.abortConditionsDocumented ? "YES" : "NO"}`);
  console.log(`- Planned Rollback Sequence: ${report.drillChecklist.plannedRollbackSequenceDocumented ? "YES" : "NO"}`);
  console.log(`- Routing Restore: ${report.drillChecklist.routingRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Worker Target Restore: ${report.drillChecklist.workerTargetRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Config Restore: ${report.drillChecklist.configRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Post-Rollback Smokes: ${report.drillChecklist.postRollbackSmokeDocumented ? "YES" : "NO"}`);
  console.log(`- Post-Rollback Monitoring: ${report.drillChecklist.postRollbackMonitoringDocumented ? "YES" : "NO"}`);
  console.log(`- Evidence Required: ${report.drillChecklist.evidenceRequiredDocumented ? "YES" : "NO"}`);
  console.log(`- Human Approval Required: ${report.drillChecklist.humanApprovalRequiredDocumented ? "YES" : "NO"}`);
  console.log(`- Future Execution Gate: ${report.drillChecklist.futureExecutionGateDocumented ? "YES" : "NO"}`);
  console.log(`- No Real Rollback Decision: ${report.drillChecklist.noRealRollbackDecisionDocumented ? "YES" : "NO"}`);
  console.log();

  console.log("BLOCKERS");
  if (report.blockers.length === 0) {
    console.log("None");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`Next Action: ${report.nextAction}`);
  console.log(report.status);
}

function printMarkdown(report: RollbackDrillReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION ROLLBACK DRILL\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Fixture Mode:** ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`**Production Touch Allowed:** ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`**Rollback Executable:** ${report.rollbackExecutable ? "YES" : "NO"}`);
  console.log(`**Rollback Commands Planned-Only:** ${report.rollbackCommandsPlannedOnly ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**No Real Rollback Executed:** ${report.noRealRollbackExecuted ? "YES" : "NO"}`);
  console.log(`**Production Touched:** ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`**Remote Writes:** ${report.remoteWrites}\n`);

  console.log("## Governance Fields (Values Redacted)\n");
  console.log(`- \`SOCIALFLOW_PRODUCTION_APPROVAL_ID\`: ${report.approvalId.presence} (${report.approvalId.value})`);
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID\`: ${report.rollbackPlanId.presence} (${report.rollbackPlanId.value})`,
  );
  console.log(`- \`SOCIALFLOW_PRODUCTION_ON_CALL_OWNER\`: ${report.onCallOwner.presence} (${report.onCallOwner.value})`);
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_WINDOW_ID\`: ${report.productionWindowId.presence} (${report.productionWindowId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID\`: ${report.abortCriteriaId.presence} (${report.abortCriteriaId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID\`: ${report.smokeSequenceId.presence} (${report.smokeSequenceId.value})`,
  );
  console.log(
    `- \`SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID\`: ${report.monitoringPlanId.presence} (${report.monitoringPlanId.value})\n`,
  );

  console.log("## Artifacts\n");
  console.log(`- Routing Review Pack: ${report.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`- Controlled Execution Runbook: ${report.controlledExecutionRunbookPresent ? "YES" : "NO"}`);
  console.log(`- Production Approval Pack: ${report.productionApprovalPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Pack: ${report.rollbackDrillPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Script: ${report.rollbackDrillScriptPresent ? "YES" : "NO"}\n`);

  console.log("## Planned-Only Rollback Sequence\n");
  report.plannedRollbackSequence.forEach((step, index) => console.log(`${index + 1}. ${step}`));
  console.log();

  console.log("## Checklist\n");
  console.log(`- Abort Conditions: ${report.drillChecklist.abortConditionsDocumented ? "YES" : "NO"}`);
  console.log(`- Planned Rollback Sequence: ${report.drillChecklist.plannedRollbackSequenceDocumented ? "YES" : "NO"}`);
  console.log(`- Routing Restore: ${report.drillChecklist.routingRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Worker Target Restore: ${report.drillChecklist.workerTargetRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Config Restore: ${report.drillChecklist.configRestoreDocumented ? "YES" : "NO"}`);
  console.log(`- Post-Rollback Smokes: ${report.drillChecklist.postRollbackSmokeDocumented ? "YES" : "NO"}`);
  console.log(`- Post-Rollback Monitoring: ${report.drillChecklist.postRollbackMonitoringDocumented ? "YES" : "NO"}`);
  console.log(`- Evidence Required: ${report.drillChecklist.evidenceRequiredDocumented ? "YES" : "NO"}`);
  console.log(`- Human Approval Required: ${report.drillChecklist.humanApprovalRequiredDocumented ? "YES" : "NO"}`);
  console.log(`- Future Execution Gate: ${report.drillChecklist.futureExecutionGateDocumented ? "YES" : "NO"}`);
  console.log(`- No Real Rollback Decision: ${report.drillChecklist.noRealRollbackDecisionDocumented ? "YES" : "NO"}\n`);

  console.log("## Blockers\n");
  if (report.blockers.length === 0) {
    console.log("- none");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`**Next Action:** ${report.nextAction}`);
  console.log(report.status);
}

function buildRedactedField(
  value: string | undefined,
  fixtureValue: string | undefined,
  fixtureMode: boolean,
): RedactedFieldStatus {
  return resolvePlannedApprovalField(value, fixtureValue, fixtureMode);
}

export async function simulateSocialflowProductionRollback(
  options: SimulateSocialflowProductionRollbackOptions = {},
): Promise<RollbackDrillReport> {
  const timestamp = new Date().toISOString();
  const blockers = new Set<string>();
  let fixtureError: string | null = null;
  let fixtureErrorSensitive = false;

  let fixtureResolution: ReturnType<typeof loadSocialflowPlannedApprovalFixture>;
  try {
    fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
  } catch (error) {
    fixtureError = error instanceof Error ? error.message : String(error);
    fixtureErrorSensitive =
      /sensitive-looking content/i.test(fixtureError ?? "") || /token/i.test(fixtureError ?? "");
    fixtureResolution = {
      fixtureMode: true,
      fixture: null,
      productionTouchAllowed: false,
    };
  }

  const fixture = fixtureResolution.fixture;
  const fixtureMode = fixtureResolution.fixtureMode;
  const productionTouchAllowed = fixtureResolution.productionTouchAllowed;

  const routingReviewPackPresent = existsSync(
    path.resolve(process.cwd(), ARTIFACT_PATHS.routingReviewPack),
  );
  const controlledExecutionRunbookPresent = existsSync(
    path.resolve(process.cwd(), ARTIFACT_PATHS.controlledExecutionRunbook),
  );
  const productionApprovalPackPresent = existsSync(
    path.resolve(process.cwd(), ARTIFACT_PATHS.productionApprovalPack),
  );
  const rollbackDrillPackPresent = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.rollbackDrillPack));
  const rollbackDrillScriptPresent = existsSync(path.resolve(process.cwd(), ARTIFACT_PATHS.rollbackDrillScript));

  const drillDoc = readTextIfExists(ARTIFACT_PATHS.rollbackDrillPack);
  const runbookContent = readTextIfExists(ARTIFACT_PATHS.controlledExecutionRunbook);
  const approvalPackContent = readTextIfExists(ARTIFACT_PATHS.productionApprovalPack);

  const drillChecklist = {
    abortConditionsDocumented:
      drillDoc.includes("## Abort Conditions") && runbookContent.includes("## 16. Condiciones de abort"),
    plannedRollbackSequenceDocumented:
      drillDoc.includes("## Planned-Only Sequence") || drillDoc.includes("## Planned Only Sequence"),
    routingRestoreDocumented:
      drillDoc.includes("## Rollback Routing Checklist") && runbookContent.includes("## 11. Checklist de rollback"),
    workerTargetRestoreDocumented:
      drillDoc.includes("## Rollback Worker Target Checklist") && runbookContent.includes("worker target"),
    configRestoreDocumented:
      drillDoc.includes("## Rollback Config Checklist") && runbookContent.includes("restore"),
    postRollbackSmokeDocumented:
      drillDoc.includes("## Post-Rollback Smoke Checklist")
      && runbookContent.includes("smoke-socialflow-production-health.ts")
      && runbookContent.includes("smoke-socialflow-production-readiness.ts")
      && runbookContent.includes("smoke-socialflow-production-postdeploy.ts"),
    postRollbackMonitoringDocumented:
      drillDoc.includes("## Post-Rollback Monitoring Checklist")
      && runbookContent.includes("monitor-socialflow-production-day.ts"),
    evidenceRequiredDocumented:
      drillDoc.includes("## Evidence Required") && runbookContent.includes("## 19. Evidencia requerida"),
    humanApprovalRequiredDocumented:
      drillDoc.includes("## Human Approval Required")
      && /## 12\. Checklist de aprob/i.test(runbookContent),
    futureExecutionGateDocumented:
      drillDoc.includes("## Criteria For P1.7")
      && approvalPackContent.includes("## P1.6 Rollback drill simulation"),
    noRealRollbackDecisionDocumented:
      drillDoc.includes("No real rollback") || drillDoc.includes("No Rollback Real"),
  };

  const approvalId = buildRedactedField(
    undefined,
    fixture?.approvalId,
    fixtureMode,
  );
  const rollbackPlanId = buildRedactedField(
    undefined,
    fixture?.rollbackPlanId,
    fixtureMode,
  );
  const onCallOwner = buildRedactedField(
    undefined,
    fixture?.onCallOwner,
    fixtureMode,
  );
  const productionWindowId = buildRedactedField(
    undefined,
    fixture?.productionWindowId,
    fixtureMode,
  );
  const abortCriteriaId = buildRedactedField(
    undefined,
    fixture?.abortCriteriaId,
    fixtureMode,
  );
  const smokeSequenceId = buildRedactedField(
    undefined,
    fixture?.smokeSequenceId,
    fixtureMode,
  );
  const monitoringPlanId = buildRedactedField(
    undefined,
    fixture?.monitoringPlanId,
    fixtureMode,
  );

  const rawValues = fixture
    ? [
        fixture.approvalId,
        fixture.rollbackPlanId,
        fixture.onCallOwner,
        fixture.productionWindowId,
        fixture.abortCriteriaId,
        fixture.smokeSequenceId,
        fixture.monitoringPlanId,
        fixture.productionBaseUrl,
        fixture.expectedHost,
        fixture.healthPath,
        fixture.readinessPath,
      ]
    : [];
  const tokenLeakageDetected = detectTokenLeakage(rawValues);

  const metadataComplete =
    approvalId.presence !== "MISSING"
    && rollbackPlanId.presence !== "MISSING"
    && onCallOwner.presence !== "MISSING"
    && productionWindowId.presence !== "MISSING"
    && abortCriteriaId.presence !== "MISSING"
    && smokeSequenceId.presence !== "MISSING"
    && monitoringPlanId.presence !== "MISSING";

  if (fixtureError) {
    blockers.add("FIXTURE_VALIDATION_FAILED");
  }
  if (tokenLeakageDetected || fixtureErrorSensitive) {
    blockers.add("TOKEN_LEAKAGE_DETECTED");
  }
  if (!fixtureMode) {
    blockers.add("PLANNED_ONLY_FIXTURE_REQUIRED");
  }
  if (!routingReviewPackPresent) blockers.add("ROUTING_REVIEW_PACK_MISSING");
  if (!controlledExecutionRunbookPresent) blockers.add("CONTROLLED_EXECUTION_RUNBOOK_MISSING");
  if (!productionApprovalPackPresent) blockers.add("PRODUCTION_APPROVAL_PACK_MISSING");
  if (!rollbackDrillPackPresent) blockers.add("ROLLBACK_DRILL_PACK_MISSING");
  if (!rollbackDrillScriptPresent) blockers.add("ROLLBACK_DRILL_SCRIPT_MISSING");
  if (!drillChecklist.abortConditionsDocumented) blockers.add("ABORT_CONDITIONS_NOT_DOCUMENTED");
  if (!drillChecklist.plannedRollbackSequenceDocumented) blockers.add("PLANNED_SEQUENCE_NOT_DOCUMENTED");
  if (!drillChecklist.routingRestoreDocumented) blockers.add("ROUTING_RESTORE_NOT_DOCUMENTED");
  if (!drillChecklist.workerTargetRestoreDocumented) blockers.add("WORKER_TARGET_RESTORE_NOT_DOCUMENTED");
  if (!drillChecklist.configRestoreDocumented) blockers.add("CONFIG_RESTORE_NOT_DOCUMENTED");
  if (!drillChecklist.postRollbackSmokeDocumented) blockers.add("POST_ROLLBACK_SMOKE_NOT_DOCUMENTED");
  if (!drillChecklist.postRollbackMonitoringDocumented) blockers.add("POST_ROLLBACK_MONITORING_NOT_DOCUMENTED");
  if (!drillChecklist.evidenceRequiredDocumented) blockers.add("EVIDENCE_REQUIRED_NOT_DOCUMENTED");
  if (!drillChecklist.humanApprovalRequiredDocumented) blockers.add("HUMAN_APPROVAL_NOT_DOCUMENTED");
  if (!drillChecklist.futureExecutionGateDocumented) blockers.add("FUTURE_EXECUTION_GATE_NOT_DOCUMENTED");
  if (!drillChecklist.noRealRollbackDecisionDocumented) blockers.add("NO_REAL_ROLLBACK_DECISION_NOT_DOCUMENTED");

  if (approvalId.presence === "MISSING") blockers.add("APPROVAL_ID_REQUIRED");
  if (rollbackPlanId.presence === "MISSING") blockers.add("ROLLBACK_PLAN_ID_REQUIRED");
  if (onCallOwner.presence === "MISSING") blockers.add("ON_CALL_OWNER_REQUIRED");
  if (productionWindowId.presence === "MISSING") blockers.add("WINDOW_ID_REQUIRED");
  if (abortCriteriaId.presence === "MISSING") blockers.add("ABORT_CRITERIA_ID_REQUIRED");
  if (smokeSequenceId.presence === "MISSING") blockers.add("SMOKE_SEQUENCE_ID_REQUIRED");
  if (monitoringPlanId.presence === "MISSING") blockers.add("MONITORING_PLAN_ID_REQUIRED");

  const readyForReview =
    fixtureMode
    && !fixtureError
    && !tokenLeakageDetected
    && metadataComplete
    && routingReviewPackPresent
    && controlledExecutionRunbookPresent
    && productionApprovalPackPresent
    && rollbackDrillPackPresent
    && rollbackDrillScriptPresent
    && drillChecklist.abortConditionsDocumented
    && drillChecklist.plannedRollbackSequenceDocumented
    && drillChecklist.routingRestoreDocumented
    && drillChecklist.workerTargetRestoreDocumented
    && drillChecklist.configRestoreDocumented
    && drillChecklist.postRollbackSmokeDocumented
    && drillChecklist.postRollbackMonitoringDocumented
    && drillChecklist.evidenceRequiredDocumented
    && drillChecklist.humanApprovalRequiredDocumented
    && drillChecklist.futureExecutionGateDocumented
    && drillChecklist.noRealRollbackDecisionDocumented;

  const status: RollbackDrillStatus = tokenLeakageDetected || fixtureErrorSensitive
    ? "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER"
    : readyForReview
    ? "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW"
    : "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED";

  const report: RollbackDrillReport = {
    ok: status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW",
    status,
    timestamp,
    fixtureMode,
    productionTouchAllowed,
    rollbackExecutable: false,
    rollbackCommandsPlannedOnly: true,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    noRealRollbackExecuted: true,
    productionTouched: false,
    remoteWrites: 0,
    approvalId,
    rollbackPlanId,
    onCallOwner,
    productionWindowId,
    abortCriteriaId,
    smokeSequenceId,
    monitoringPlanId,
    routingReviewPackPresent,
    controlledExecutionRunbookPresent,
    productionApprovalPackPresent,
    rollbackDrillPackPresent,
    rollbackDrillScriptPresent,
    drillChecklist,
    plannedRollbackSequence: [
      "Freeze production execution.",
      "Abort current cutover window.",
      "Restore previous worker route target.",
      "Restore previous DNS/routing state.",
      "Re-run health smoke.",
      "Re-run readiness smoke.",
      "Re-run postdeploy smoke.",
      "Monitor day window.",
      "Record rollback evidence.",
      "Require human sign-off.",
    ],
    postRollbackSmokes: [
      "health smoke",
      "readiness smoke",
      "postdeploy smoke",
    ],
    postRollbackMonitoring: [
      "day-1 monitor",
      "window monitoring review",
    ],
    evidenceRequired: [
      "JSON output from rollback drill script.",
      "JSON output from approval pack.",
      "JSON output from execution plan.",
      "Human sign-off record.",
    ],
    blockers: Array.from(blockers),
    nextAction: status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW"
      ? "SUBMIT_ROLLBACK_DRILL_FOR_HUMAN_REVIEW"
      : status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER"
      ? "REMOVE_SENSITIVE_VALUES_AND_RETRY"
      : fixtureMode
      ? "COMPLETE_ROLLBACK_DRILL_DOCS_AND_METADATA"
      : "PROVIDE_PLANNED_ONLY_FIXTURE_AND_RETRY",
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

  simulateSocialflowProductionRollback({ json, markdown, fixture })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED"
        || report.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_ERROR", error);
      process.exit(1);
    });
}
