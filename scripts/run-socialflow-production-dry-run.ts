import { existsSync } from "node:fs";
import path from "node:path";
import { checkSocialflowProductionManualConfig } from "./check-socialflow-production-manual-config";
import { checkSocialflowProductionRollbackReadiness } from "./check-socialflow-production-rollback-readiness";
import { checkSocialflowProductionWindowReadiness } from "./check-socialflow-production-window-readiness";
import { monitorSocialflowProductionDay } from "./monitor-socialflow-production-day";
import { loadSocialflowPlannedApprovalFixture } from "./lib/socialflow-production-planned-approval-fixture";
import { planSocialflowProductionExecution } from "./plan-socialflow-production-execution";
import { prepareSocialflowProductionApprovalPack } from "./prepare-socialflow-production-approval-pack";
import { reviewSocialflowProductionRouting } from "./review-socialflow-production-routing";
import { simulateSocialflowProductionRollback } from "./simulate-socialflow-production-rollback";
import { smokeSocialflowProductionHealth } from "./smoke-socialflow-production-health";
import { smokeSocialflowProductionPostdeploy } from "./smoke-socialflow-production-postdeploy";
import { smokeSocialflowProductionReadiness } from "./smoke-socialflow-production-readiness";

interface RunSocialflowProductionDryRunOptions {
  json?: boolean;
  markdown?: boolean;
  fixture?: string;
}

type DryRunStatus =
  | "SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW"
  | "SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER";

type ApprovalPackSummary = {
  status:
    | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY_FOR_PLANNING_APPROVAL"
    | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED"
    | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION";
  readyForApproval: boolean;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  approvalScope: "APPROVAL_FOR_PLANNING_ONLY" | "BLOCKED";
  executionReadinessStatus: "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION";
  fixtureMode: boolean;
  productionTouchAllowed: false;
  dryRunRequired: true;
  dryRunReadyForPlanning: boolean;
  dryRunReadyForExecution: false;
  dryRunStatus: {
    status: DryRunStatus;
    dryRunScriptPresent: boolean;
    dryRunReportPresent: boolean;
    readyForPlanning: boolean;
    readyForExecution: false;
    executionAllowed: false;
    commandsArePlannedOnly: true;
    requiresHumanApproval: true;
    productionTouchAllowed: false;
  };
  readinessSummary: {
    planningApprovalEligible: boolean;
    executionEligible: false;
    technicalPlanningChecksHealthy: boolean;
    missingArtifactsCount: number;
  };
  blockers: string[];
  missingArtifacts: string[];
  noDeployConfirmation: true;
  noProductionTouchConfirmation: boolean;
  goNoGoRecommendation: string;
  executionAllowedStatement: string;
  nextAction: string;
};

type ManualConfigReport = Awaited<ReturnType<typeof checkSocialflowProductionManualConfig>>;
type WindowReport = Awaited<ReturnType<typeof checkSocialflowProductionWindowReadiness>>;
type RoutingReport = Awaited<ReturnType<typeof reviewSocialflowProductionRouting>>;
type RollbackReadinessReport = Awaited<ReturnType<typeof checkSocialflowProductionRollbackReadiness>>;
type RollbackDrillReport = Awaited<ReturnType<typeof simulateSocialflowProductionRollback>>;
type ExecutionPlanReport = Awaited<ReturnType<typeof planSocialflowProductionExecution>>;
type SmokeHealthReport = Awaited<ReturnType<typeof smokeSocialflowProductionHealth>>;
type SmokeReadinessReport = Awaited<ReturnType<typeof smokeSocialflowProductionReadiness>>;
type SmokePostdeployReport = Awaited<ReturnType<typeof smokeSocialflowProductionPostdeploy>>;
type MonitorReport = Awaited<ReturnType<typeof monitorSocialflowProductionDay>>;

interface RunSocialflowProductionDryRunReport {
  ok: boolean;
  status: DryRunStatus;
  timestamp: string;
  fixtureMode: boolean;
  dryRunRequired: true;
  dryRunReadyForPlanning: boolean;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  productionTouchAllowed: false;
  productionTouched: false;
  remoteWrites: 0;
  tokenLeakageDetected: boolean;
  dryRunScriptPresent: boolean;
  dryRunReportPresent: boolean;
  approvalPackStatus: ApprovalPackSummary;
  manualConfigStatus: ManualConfigReport;
  productionWindowStatus: WindowReport;
  routingReviewStatus: RoutingReport;
  rollbackReadinessStatus: RollbackReadinessReport;
  rollbackDrillStatus: RollbackDrillReport;
  executionPlanStatus: ExecutionPlanReport;
  smokeHealthStatus: SmokeHealthReport;
  smokeReadinessStatus: SmokeReadinessReport;
  smokePostdeployStatus: SmokePostdeployReport;
  monitorStatus: MonitorReport;
  blockers: string[];
  missingArtifacts: string[];
  recommendation: string;
  nextAction: string;
}

const ARTIFACT_PATHS = {
  dryRunScript: "scripts/run-socialflow-production-dry-run.ts",
  dryRunReport: "docs/architecture/socialflow-production-dry-run-report.md",
} as const;

const PRODUCTION_BASE_URL_ENV_KEYS = [
  "SOCIALFLOW_PRODUCTION_BASE_URL",
  "SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL",
] as const;

async function suppressConsoleLog<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  console.log = (() => undefined) as typeof console.log;
  try {
    return await fn();
  } finally {
    console.log = originalLog;
  }
}

function artifactExists(relativePath: string): boolean {
  return existsSync(path.resolve(process.cwd(), relativePath));
}

async function withClearedProductionBaseUrlEnv<T>(fn: () => Promise<T>): Promise<T> {
  const snapshot = PRODUCTION_BASE_URL_ENV_KEYS.map((key) => [key, process.env[key]] as const);

  try {
    for (const [key] of snapshot) {
      delete process.env[key];
    }
    return await fn();
  } finally {
    for (const [key, value] of snapshot) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function createBlockedApprovalPackSummary(missingArtifactsCount: number): ApprovalPackSummary {
  const dryRunScriptPresent = artifactExists(ARTIFACT_PATHS.dryRunScript);
  const dryRunReportPresent = artifactExists(ARTIFACT_PATHS.dryRunReport);

  return {
    status: "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED",
    readyForApproval: false,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    approvalScope: "BLOCKED",
    executionReadinessStatus: "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION",
    fixtureMode: false,
    productionTouchAllowed: false,
    dryRunRequired: true,
    dryRunReadyForPlanning: false,
    dryRunReadyForExecution: false,
    dryRunStatus: {
      status: "SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED",
      dryRunScriptPresent,
      dryRunReportPresent,
      readyForPlanning: false,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      requiresHumanApproval: true,
      productionTouchAllowed: false,
    },
    readinessSummary: {
      planningApprovalEligible: false,
      executionEligible: false,
      technicalPlanningChecksHealthy: false,
      missingArtifactsCount,
    },
    blockers: ["DRY_RUN_FIXTURE_REQUIRED"],
    missingArtifacts: [],
    noDeployConfirmation: true,
    noProductionTouchConfirmation: true,
    goNoGoRecommendation: "NO_GO - Dry-run fixture review is required before planning approval can be assessed.",
    executionAllowedStatement: "EXECUTION NOT ALLOWED - dry-run planning review is blocked until a fixture-backed review is available.",
    nextAction: "PROVIDE_DRY_RUN_FIXTURE_AND_RETRY",
  };
}

function summarizeApprovalPack(report: Awaited<ReturnType<typeof prepareSocialflowProductionApprovalPack>>): ApprovalPackSummary {
  return {
    status: report.status,
    readyForApproval: report.readyForApproval,
    readyForExecution: report.readyForExecution,
    executionAllowed: report.executionAllowed,
    commandsArePlannedOnly: report.commandsArePlannedOnly,
    requiresHumanApproval: report.requiresHumanApproval,
    approvalScope: report.approvalScope,
    executionReadinessStatus: report.executionReadinessStatus,
    fixtureMode: report.fixtureMode,
    productionTouchAllowed: report.productionTouchAllowed,
    dryRunRequired: report.dryRunRequired,
    dryRunReadyForPlanning: report.dryRunReadyForPlanning,
    dryRunReadyForExecution: report.dryRunReadyForExecution,
    dryRunStatus: report.dryRunStatus,
    readinessSummary: report.readinessSummary,
    blockers: report.blockers,
    missingArtifacts: report.missingArtifacts,
    noDeployConfirmation: report.noDeployConfirmation,
    noProductionTouchConfirmation: report.noProductionTouchConfirmation,
    goNoGoRecommendation: report.goNoGoRecommendation,
    executionAllowedStatement: report.executionAllowedStatement,
    nextAction: report.nextAction,
  };
}

function collectTokenLeakage(report: RunSocialflowProductionDryRunReport): boolean {
  return (
    report.manualConfigStatus.tokenLeakageDetected ||
    report.rollbackDrillStatus.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER" ||
    report.routingReviewStatus.status === "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_TOKEN_LEAKAGE_BLOCKER" ||
    report.smokeHealthStatus.tokenLeakageDetected ||
    report.smokeReadinessStatus.tokenLeakageDetected ||
    report.smokePostdeployStatus.tokenLeakageDetected ||
    report.monitorStatus.tokenLeakageDetected ||
    report.approvalPackStatus.dryRunStatus.status === "SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER"
  );
}

function buildBlockers(report: RunSocialflowProductionDryRunReport): string[] {
  const blockers = new Set<string>();

  if (!report.fixtureMode) {
    blockers.add("DRY_RUN_FIXTURE_REQUIRED");
  }
  if (report.manualConfigStatus.status !== "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW") {
    blockers.add("MANUAL_CONFIG_REVIEW_NOT_READY");
  }
  if (report.productionWindowStatus.status !== "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW") {
    blockers.add("PRODUCTION_WINDOW_REVIEW_NOT_READY");
  }
  if (report.routingReviewStatus.status !== "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING") {
    blockers.add("ROUTING_REVIEW_NOT_READY");
  }
  if (report.rollbackReadinessStatus.status !== "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW") {
    blockers.add("ROLLBACK_REVIEW_NOT_READY");
  }
  if (report.rollbackDrillStatus.status !== "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW") {
    blockers.add("ROLLBACK_DRILL_REVIEW_NOT_READY");
  }
  if (!report.approvalPackStatus.readyForApproval) {
    blockers.add("APPROVAL_PACK_NOT_READY");
  }
  if (report.executionPlanStatus.missingArtifacts.length > 0) {
    blockers.add("EXECUTION_PLAN_MISSING_ARTIFACTS");
  }
  if (!report.dryRunScriptPresent) {
    blockers.add("DRY_RUN_SCRIPT_MISSING");
  }
  if (!report.dryRunReportPresent) {
    blockers.add("DRY_RUN_REPORT_MISSING");
  }
  if (collectTokenLeakage(report)) {
    blockers.add("TOKEN_LEAKAGE_DETECTED");
  }

  return Array.from(blockers);
}

function printNormal(report: RunSocialflowProductionDryRunReport): void {
  console.log("\nSOCIALFLOW PRODUCTION DRY-RUN MASTER");
  console.log(`Status: ${report.status}`);
  console.log(`Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`Dry Run Required: ${report.dryRunRequired ? "YES" : "NO"}`);
  console.log(`Ready for Planning Review: ${report.dryRunReadyForPlanning ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`Production Touched: ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`Remote Writes: ${report.remoteWrites}`);
  console.log(`Token Leakage Detected: ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`Dry Run Script Present: ${report.dryRunScriptPresent ? "YES" : "NO"}`);
  console.log(`Dry Run Report Present: ${report.dryRunReportPresent ? "YES" : "NO"}\n`);

  console.log("P1.2 VALIDATORS");
  console.log(`- Manual Config: ${report.manualConfigStatus.status}`);
  console.log(`- Production Window: ${report.productionWindowStatus.status}`);
  console.log(`- Routing Review: ${report.routingReviewStatus.status}`);
  console.log(`- Rollback Readiness: ${report.rollbackReadinessStatus.status}\n`);

  console.log("P1.6 ROLLBACK DRILL");
  console.log(`- Rollback Drill Status: ${report.rollbackDrillStatus.status}`);
  console.log(`- Rollback Drill Pack Present: ${report.rollbackDrillStatus.rollbackDrillPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Script Present: ${report.rollbackDrillStatus.rollbackDrillScriptPresent ? "YES" : "NO"}\n`);

  console.log("P1.7 APPROVAL PACK");
  console.log(`- Approval Pack Status: ${report.approvalPackStatus.status}`);
  console.log(`- Ready For Approval: ${report.approvalPackStatus.readyForApproval ? "YES" : "NO"}`);
  console.log(`- Dry Run Status: ${report.approvalPackStatus.dryRunStatus.status}`);
  console.log(`- Dry Run Ready For Planning: ${report.approvalPackStatus.dryRunStatus.readyForPlanning ? "YES" : "NO"}`);
  console.log(`- Dry Run Script Present: ${report.approvalPackStatus.dryRunStatus.dryRunScriptPresent ? "YES" : "NO"}`);
  console.log(`- Dry Run Report Present: ${report.approvalPackStatus.dryRunStatus.dryRunReportPresent ? "YES" : "NO"}\n`);

  console.log("P1.7 EXECUTION PLAN");
  console.log(`- Execution Plan Status: ${report.executionPlanStatus.status}`);
  console.log(`- Missing Artifacts: ${report.executionPlanStatus.missingArtifacts.length > 0 ? report.executionPlanStatus.missingArtifacts.join(", ") : "none"}`);
  console.log(`- Verify Dry Run Master Checklist: ${report.executionPlanStatus.preExecution.some((step) => step.step === "Verify Dry Run Master Checklist") ? "YES" : "NO"}\n`);

  console.log("P1.7 SMOKES AND MONITOR");
  console.log(`- Health Smoke: ${report.smokeHealthStatus.status}`);
  console.log(`- Readiness Smoke: ${report.smokeReadinessStatus.status}`);
  console.log(`- Postdeploy Smoke: ${report.smokePostdeployStatus.status}`);
  console.log(`- Monitor Day 1: ${report.monitorStatus.status}\n`);

  console.log("MISSING ARTIFACTS");
  console.log(`- ${report.missingArtifacts.length > 0 ? report.missingArtifacts.join(", ") : "none"}\n`);

  console.log("BLOCKERS");
  if (report.blockers.length === 0) {
    console.log("None");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`Recommendation: ${report.recommendation}`);
  console.log(`Next Action: ${report.nextAction}`);
  console.log(report.status);
}

function printMarkdown(report: RunSocialflowProductionDryRunReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION DRY-RUN MASTER\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Fixture Mode:** ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`**Dry Run Required:** ${report.dryRunRequired ? "YES" : "NO"}`);
  console.log(`**Ready for Planning Review:** ${report.dryRunReadyForPlanning ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**Production Touch Allowed:** ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`**Production Touched:** ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`**Remote Writes:** ${report.remoteWrites}`);
  console.log(`**Token Leakage Detected:** ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`**Dry Run Script Present:** ${report.dryRunScriptPresent ? "YES" : "NO"}`);
  console.log(`**Dry Run Report Present:** ${report.dryRunReportPresent ? "YES" : "NO"}\n`);

  console.log("## P1.2 Validators\n");
  console.log(`- Manual Config: ${report.manualConfigStatus.status}`);
  console.log(`- Production Window: ${report.productionWindowStatus.status}`);
  console.log(`- Routing Review: ${report.routingReviewStatus.status}`);
  console.log(`- Rollback Readiness: ${report.rollbackReadinessStatus.status}\n`);

  console.log("## P1.6 Rollback Drill\n");
  console.log(`- Rollback Drill Status: ${report.rollbackDrillStatus.status}`);
  console.log(`- Rollback Drill Pack Present: ${report.rollbackDrillStatus.rollbackDrillPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Script Present: ${report.rollbackDrillStatus.rollbackDrillScriptPresent ? "YES" : "NO"}\n`);

  console.log("## P1.7 Approval Pack\n");
  console.log(`- Approval Pack Status: ${report.approvalPackStatus.status}`);
  console.log(`- Ready For Approval: ${report.approvalPackStatus.readyForApproval ? "YES" : "NO"}`);
  console.log(`- Dry Run Status: ${report.approvalPackStatus.dryRunStatus.status}`);
  console.log(`- Dry Run Ready For Planning: ${report.approvalPackStatus.dryRunStatus.readyForPlanning ? "YES" : "NO"}`);
  console.log(`- Dry Run Script Present: ${report.approvalPackStatus.dryRunStatus.dryRunScriptPresent ? "YES" : "NO"}`);
  console.log(`- Dry Run Report Present: ${report.approvalPackStatus.dryRunStatus.dryRunReportPresent ? "YES" : "NO"}\n`);

  console.log("## P1.7 Execution Plan\n");
  console.log(`- Execution Plan Status: ${report.executionPlanStatus.status}`);
  console.log(
    `- Missing Artifacts: ${report.executionPlanStatus.missingArtifacts.length > 0 ? report.executionPlanStatus.missingArtifacts.join(", ") : "none"}`,
  );
  console.log(
    `- Verify Dry Run Master Checklist: ${report.executionPlanStatus.preExecution.some((step) => step.step === "Verify Dry Run Master Checklist") ? "YES" : "NO"}\n`,
  );

  console.log("## P1.7 Smokes and Monitor\n");
  console.log(`- Health Smoke: ${report.smokeHealthStatus.status}`);
  console.log(`- Readiness Smoke: ${report.smokeReadinessStatus.status}`);
  console.log(`- Postdeploy Smoke: ${report.smokePostdeployStatus.status}`);
  console.log(`- Monitor Day 1: ${report.monitorStatus.status}\n`);

  console.log("## Missing Artifacts\n");
  console.log(`- ${report.missingArtifacts.length > 0 ? report.missingArtifacts.join(", ") : "none"}\n`);

  console.log("## Blockers\n");
  if (report.blockers.length === 0) {
    console.log("- none");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`**Recommendation:** ${report.recommendation}\n`);
  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(report.status);
}

export async function runSocialflowProductionDryRun(
  options: RunSocialflowProductionDryRunOptions = {},
): Promise<RunSocialflowProductionDryRunReport> {
  const timestamp = new Date().toISOString();
  const fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
  const fixturePath = fixtureResolution.fixturePath;

  const [manualConfigStatus, productionWindowStatus, routingReviewStatus, rollbackReadinessStatus, rollbackDrillStatus] =
    await Promise.all([
      checkSocialflowProductionManualConfig({ silent: true, fixture: fixturePath }),
      checkSocialflowProductionWindowReadiness({ silent: true, fixture: fixturePath }),
      reviewSocialflowProductionRouting({ silent: true, fixture: fixturePath }),
      checkSocialflowProductionRollbackReadiness({ silent: true, fixture: fixturePath }),
      simulateSocialflowProductionRollback({ silent: true, fixture: fixturePath }),
    ]);

  const executionPlanStatus = await suppressConsoleLog(() =>
    planSocialflowProductionExecution({ fixture: fixturePath }),
  );
  const smokeHealthStatus = await withClearedProductionBaseUrlEnv(() =>
    suppressConsoleLog(() => smokeSocialflowProductionHealth()),
  );
  const smokeReadinessStatus = await withClearedProductionBaseUrlEnv(() =>
    suppressConsoleLog(() => smokeSocialflowProductionReadiness()),
  );
  const smokePostdeployStatus = await withClearedProductionBaseUrlEnv(() =>
    suppressConsoleLog(() => smokeSocialflowProductionPostdeploy()),
  );
  const monitorStatus = await withClearedProductionBaseUrlEnv(() =>
    suppressConsoleLog(() => monitorSocialflowProductionDay({ day: 1 })),
  );

  const dryRunScriptPresent = artifactExists(ARTIFACT_PATHS.dryRunScript);
  const dryRunReportPresent = artifactExists(ARTIFACT_PATHS.dryRunReport);

  const reportBase = {
    timestamp,
    fixtureMode: fixtureResolution.fixtureMode,
    dryRunRequired: true as const,
    readyForExecution: false as const,
    executionAllowed: false as const,
    commandsArePlannedOnly: true as const,
    requiresHumanApproval: true as const,
    productionTouchAllowed: false as const,
    productionTouched: false as const,
    remoteWrites: 0 as const,
    manualConfigStatus,
    productionWindowStatus,
    routingReviewStatus,
    rollbackReadinessStatus,
    rollbackDrillStatus,
    executionPlanStatus,
    smokeHealthStatus,
    smokeReadinessStatus,
    smokePostdeployStatus,
    monitorStatus,
    dryRunScriptPresent,
    dryRunReportPresent,
  };

  const approvalPackStatus = fixtureResolution.fixtureMode
    ? summarizeApprovalPack(
        await withClearedProductionBaseUrlEnv(() =>
          suppressConsoleLog(() => prepareSocialflowProductionApprovalPack({ fixture: fixturePath })),
        ),
      )
    : createBlockedApprovalPackSummary(executionPlanStatus.missingArtifacts.length);

  const report: RunSocialflowProductionDryRunReport = {
    ok: false,
    status: "SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED",
    ...reportBase,
    tokenLeakageDetected: false,
    dryRunReadyForPlanning: false,
    approvalPackStatus,
    blockers: [],
    missingArtifacts: executionPlanStatus.missingArtifacts.map((artifact) => artifact.artifact),
    recommendation: "",
    nextAction: "",
  };

  report.tokenLeakageDetected = collectTokenLeakage(report);
  report.dryRunReadyForPlanning =
    fixtureResolution.fixtureMode &&
    dryRunScriptPresent &&
    dryRunReportPresent &&
    !report.tokenLeakageDetected &&
    report.manualConfigStatus.status === "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW" &&
    report.productionWindowStatus.status === "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW" &&
    report.routingReviewStatus.status === "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING" &&
    report.rollbackReadinessStatus.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW" &&
    report.rollbackDrillStatus.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW" &&
    report.approvalPackStatus.readyForApproval &&
    report.executionPlanStatus.missingArtifacts.length === 0;

  report.status = report.tokenLeakageDetected
    ? "SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER"
    : report.dryRunReadyForPlanning
    ? "SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW"
    : "SOCIALFLOW_PRODUCTION_DRY_RUN_BLOCKED";
  report.ok = report.status === "SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW";
  report.blockers = buildBlockers(report);
  report.recommendation = report.ok
    ? "GO_FOR_PLANNING_REVIEW_ONLY - Dry-run checklist is ready, but execution remains blocked."
    : report.status === "SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER"
    ? "NO_GO - Token leakage must be removed before any planning review proceeds."
    : `NO_GO - Resolve blockers first: ${report.blockers.join(", ")}`;
  report.nextAction = report.ok
    ? "REVIEW_DRY_RUN_CHECKLIST_AND_KEEP_EXECUTION_BLOCKED"
    : report.status === "SOCIALFLOW_PRODUCTION_DRY_RUN_TOKEN_LEAKAGE_BLOCKER"
    ? "REMOVE_TOKEN_LEAKAGE_AND_RETRY"
    : "RESOLVE_DRY_RUN_BLOCKERS_AND_RETRY";

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n${report.status}`);
  } else if (options.markdown) {
    printMarkdown(report);
  } else {
    printNormal(report);
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

  runSocialflowProductionDryRun({ json, markdown, fixture })
    .then((report) => {
      process.exit(report.status === "SOCIALFLOW_PRODUCTION_DRY_RUN_READY_FOR_PLANNING_REVIEW" ? 0 : 1);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_DRY_RUN_ERROR", error);
      process.exit(1);
    });
}
