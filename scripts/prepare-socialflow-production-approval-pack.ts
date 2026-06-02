import { existsSync } from "node:fs";
import path from "node:path";
import { checkProductionSafetyGate } from "./check-socialflow-production-safety-gate";
import { checkRouteDnsReadiness } from "./check-socialflow-route-dns-readiness";
import { checkProductionCutoverReadiness } from "./check-socialflow-production-cutover-readiness";
import { runCheckSocialflowNonprodOwnershipParity } from "./check-socialflow-nonprod-ownership-parity";
import { checkSocialflowProductionManualConfig } from "./check-socialflow-production-manual-config";
import { checkSocialflowProductionRollbackReadiness } from "./check-socialflow-production-rollback-readiness";
import { checkSocialflowProductionWindowReadiness } from "./check-socialflow-production-window-readiness";
import { loadSocialflowPlannedApprovalFixture } from "./lib/socialflow-production-planned-approval-fixture";
import { simulateSocialflowProductionRollback } from "./simulate-socialflow-production-rollback";
import { reviewSocialflowProductionRouting } from "./review-socialflow-production-routing";

interface ApprovalPackOptions {
  json?: boolean;
  markdown?: boolean;
  fixture?: string;
}

type ApprovalPackStatus =
  | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY_FOR_PLANNING_APPROVAL"
  | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION";

interface ApprovalPackReport {
  readyForApproval: boolean;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  approvalScope: "APPROVAL_FOR_PLANNING_ONLY" | "BLOCKED";
  status: ApprovalPackStatus;
  executionReadinessStatus: "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION";
  timestamp: string;
  fixtureMode: boolean;
  productionTouchAllowed: false;
  readinessSummary: {
    planningApprovalEligible: boolean;
    executionEligible: false;
    technicalPlanningChecksHealthy: boolean;
    missingArtifactsCount: number;
  };
  manualConfigurationRequired: true;
  manualConfigurationSatisfiedForReview: boolean;
  dnsRoutingRequired: true;
  rollbackRequired: true;
  rollbackSatisfiedForReview: boolean;
  rollbackDrillRequired: true;
  rollbackDrillSatisfiedForReview: boolean;
  monitoringRequired: true;
  monitoringSatisfiedForReview: boolean;
  productionWindowRequired: true;
  productionWindowSatisfiedForReview: boolean;
  humanApprovalRequired: true;
  productionTemplateStatus: {
    path: string;
    present: boolean;
    status:
      | "PRODUCTION_TEMPLATE_PRESENT_MANUAL_CONFIGURATION_REQUIRED"
      | "PRODUCTION_TEMPLATE_MISSING";
  };
  smokesStatus: {
    healthPresent: boolean;
    readinessPresent: boolean;
    postdeployPresent: boolean;
    status: "ALL_PRESENT" | "MISSING_ONE_OR_MORE";
  };
  monitorStatus: {
    dayMonitorPresent: boolean;
    status: "PRESENT" | "MISSING";
  };
  manualConfigStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW"
      | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED"
      | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER";
    manualConfigurationComplete: boolean;
    missingVariables: string[];
    tokenLeakageDetected: boolean;
  };
  rollbackReadinessStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW"
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_BLOCKED"
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_NOT_EXECUTABLE";
    rollbackPlanDocumented: boolean;
    rollbackCommandSetPlannedOnly: boolean;
    restorePathDocumented: boolean;
    postRollbackSmokeListDocumented: boolean;
    abortConditionsDocumented: boolean;
  };
  productionWindowStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW"
      | "SOCIALFLOW_PRODUCTION_WINDOW_BLOCKED"
      | "SOCIALFLOW_PRODUCTION_WINDOW_NOT_APPROVED";
    monitoringPlanPresent: boolean;
    smokeSequencePresent: boolean;
    abortCriteriaPresent: boolean;
  };
  monitoringReadinessStatus: {
    status: "PRODUCTION_MONITORING_READINESS_REQUIRED" | "PRODUCTION_MONITORING_READY_FOR_REVIEW";
    monitoringPlanPresent: boolean;
    productionWindowDefined: boolean;
    onCallDefined: boolean;
  };
  executionPlanStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_MISSING_ARTIFACTS"
      | "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_PENDING_MANUAL_APPROVAL";
    missingArtifacts: string[];
    readyForExecution: false;
    executionAllowed: false;
    commandsArePlannedOnly: true;
    requiresHumanApproval: true;
    manualConfigurationRequired: true;
  };
  currentStatus: {
    safetyGateOk: boolean;
    routeDnsReady: boolean;
    cutoverReadyForPlanning: boolean;
    parityOk: boolean;
    productionTouched: boolean;
    remoteWrites: number;
    tokenLeakageDetected: boolean;
  };
  routeDnsAssessment: {
    routeDnsCriticalReady: boolean;
    routeDnsCriticalBlockers: string[];
    productionRouteNotReadyByDesign: boolean;
    productionRoutingConfiguredForExecution: boolean;
  };
  routingReviewStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED"
      | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING"
      | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_TOKEN_LEAKAGE_BLOCKER";
    routingReviewPackPresent: boolean;
    routingReviewScriptPresent: boolean;
    readyForPlanning: boolean;
    readyForExecution: false;
    executionAllowed: false;
    commandsArePlannedOnly: true;
    requiresHumanApproval: true;
    manualConfigurationRequired: true;
    dnsRoutingRequired: true;
    productionTouchAllowed: false;
  };
  rollbackDrillStatus: {
    status:
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_BLOCKED"
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW"
      | "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_TOKEN_LEAKAGE_BLOCKER";
    rollbackDrillPackPresent: boolean;
    rollbackDrillScriptPresent: boolean;
    readyForPlanning: boolean;
    readyForExecution: false;
    executionAllowed: false;
    commandsArePlannedOnly: true;
    requiresHumanApproval: true;
    productionTouchAllowed: false;
  };
  monitoringEvidence: {
    daysMonitored: number;
    minimumDaysReached: boolean;
    driftDetected: boolean;
    stableConfig: boolean;
    productionMonitoringActive: boolean;
  };
  gatesEvidence: {
    safetyGate: string;
    routeDns: string;
    cutoverReadiness: string;
    parity: string;
  };
  safetyEvidence: {
    noProductionTouch: boolean;
    zeroRemoteWrites: boolean;
    noTokenLeakage: boolean;
    gateProtectionActive: boolean;
  };
  rollbackReadiness: {
    rollbackCommandsAvailable: boolean;
    rollbackTested: boolean;
    rollbackOwnerRequired: boolean;
    rollbackValidatedForExecution: boolean;
  };
  blockers: string[];
  approvals: {
    stakeholderApprovalRequired: true;
    technicalLeadApprovalRequired: true;
    onCallEngineerRequired: true;
    productionWindowRequired: true;
    stakeholderApprovalGranted: false;
    technicalLeadApprovalGranted: false;
    onCallEngineerAssigned: false;
    productionWindowScheduled: false;
  };
  missingArtifacts: string[];
  noDeployConfirmation: true;
  noProductionTouchConfirmation: boolean;
  goNoGoRecommendation: string;
  executionAllowedStatement: string;
  nextAction: string;
}

const ARTIFACT_PATHS = {
  productionTemplate: "apps/socialflow-runtime/wrangler.production.toml",
  smokeHealth: "scripts/smoke-socialflow-production-health.ts",
  smokeReadiness: "scripts/smoke-socialflow-production-readiness.ts",
  smokePostdeploy: "scripts/smoke-socialflow-production-postdeploy.ts",
  dayMonitor: "scripts/monitor-socialflow-production-day.ts",
  routingReviewScript: "scripts/review-socialflow-production-routing.ts",
  routingReviewPack: "docs/architecture/socialflow-production-routing-review-pack.md",
  rollbackDrillScript: "scripts/simulate-socialflow-production-rollback.ts",
  rollbackDrillPack: "docs/architecture/socialflow-production-rollback-drill.md",
  controlledRunbook: "docs/runbooks/socialflow-production-controlled-execution.md",
  decisionPack: "docs/architecture/socialflow-production-approval-pack.md",
} as const;

function artifactExists(relativePath: string): boolean {
  return existsSync(path.resolve(process.cwd(), relativePath));
}

function printNormal(report: ApprovalPackReport): void {
  console.log("\nSOCIALFLOW PRODUCTION APPROVAL PACK");
  console.log(`Status: ${report.status}`);
  console.log(`Execution Readiness Status: ${report.executionReadinessStatus}`);
  console.log(`Ready for Approval: ${report.readyForApproval ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`Approval Scope: ${report.approvalScope}\n`);

  console.log("P1.3 FIXTURE READINESS");
  console.log(`- Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`- Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`- Manual Config Satisfied For Review: ${report.manualConfigurationSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Rollback Satisfied For Review: ${report.rollbackSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Satisfied For Review: ${report.rollbackDrillSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Monitoring Satisfied For Review: ${report.monitoringSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Production Window Satisfied For Review: ${report.productionWindowSatisfiedForReview ? "YES" : "NO"}\n`);

  console.log("P1.5 ROUTING REVIEW");
  console.log(`- Routing Review Status: ${report.routingReviewStatus.status}`);
  console.log(`- Routing Review Pack Present: ${report.routingReviewStatus.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`- Routing Review Script Present: ${report.routingReviewStatus.routingReviewScriptPresent ? "YES" : "NO"}`);
  console.log(`- Routing Ready For Planning: ${report.routingReviewStatus.readyForPlanning ? "YES" : "NO"}`);
  console.log(`- Routing Ready For Execution: ${report.routingReviewStatus.readyForExecution ? "YES" : "NO"}`);
  console.log(`- Routing Execution Allowed: ${report.routingReviewStatus.executionAllowed ? "YES" : "NO"}`);
  console.log(`- Routing Commands Are Planned Only: ${report.routingReviewStatus.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`- Routing Requires Human Approval: ${report.routingReviewStatus.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("## P1.6 Rollback Drill\n");
  console.log(`- Rollback Drill Status: ${report.rollbackDrillStatus.status}`);
  console.log(`- Rollback Drill Pack Present: ${report.rollbackDrillStatus.rollbackDrillPackPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Script Present: ${report.rollbackDrillStatus.rollbackDrillScriptPresent ? "YES" : "NO"}`);
  console.log(`- Rollback Ready For Planning: ${report.rollbackDrillStatus.readyForPlanning ? "YES" : "NO"}`);
  console.log(`- Rollback Ready For Execution: ${report.rollbackDrillStatus.readyForExecution ? "YES" : "NO"}`);
  console.log(`- Rollback Execution Allowed: ${report.rollbackDrillStatus.executionAllowed ? "YES" : "NO"}`);
  console.log(`- Rollback Commands Are Planned Only: ${report.rollbackDrillStatus.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`- Rollback Requires Human Approval: ${report.rollbackDrillStatus.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("READINESS SUMMARY");
  console.log(
    `- Planning Approval Eligible: ${report.readinessSummary.planningApprovalEligible ? "YES" : "NO"}`,
  );
  console.log(`- Execution Eligible: ${report.readinessSummary.executionEligible ? "YES" : "NO"}`);
  console.log(
    `- Technical Planning Checks Healthy: ${report.readinessSummary.technicalPlanningChecksHealthy ? "YES" : "NO"}`,
  );
  console.log(`- Missing Artifacts Count: ${report.readinessSummary.missingArtifactsCount}\n`);

  console.log("ARTIFACT STATUS");
  console.log(
    `- Production Template: ${report.productionTemplateStatus.present ? "PRESENT" : "MISSING"} [${report.productionTemplateStatus.status}]`,
  );
  console.log(`- Smokes Status: ${report.smokesStatus.status}`);
  console.log(`  health=${report.smokesStatus.healthPresent ? "PRESENT" : "MISSING"}`);
  console.log(`  readiness=${report.smokesStatus.readinessPresent ? "PRESENT" : "MISSING"}`);
  console.log(`  postdeploy=${report.smokesStatus.postdeployPresent ? "PRESENT" : "MISSING"}`);
  console.log(`- Monitor Day Script: ${report.monitorStatus.status}`);
  console.log(
    `- Missing Artifacts: ${report.missingArtifacts.length > 0 ? report.missingArtifacts.join(", ") : "none"}\n`,
  );

  console.log("EXECUTION BLOCKERS");
  report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  console.log();

  console.log("P1.2 VALIDATOR STATUS");
  console.log(`- Manual Config: ${report.manualConfigStatus.status}`);
  console.log(`- Rollback Readiness: ${report.rollbackReadinessStatus.status}`);
  console.log(`- Production Window: ${report.productionWindowStatus.status}`);
  console.log(`- Monitoring Readiness: ${report.monitoringReadinessStatus.status}\n`);

  console.log("REQUIRED FLAGS");
  console.log(`- manualConfigurationRequired: ${report.manualConfigurationRequired}`);
  console.log(`- dnsRoutingRequired: ${report.dnsRoutingRequired}`);
  console.log(`- rollbackRequired: ${report.rollbackRequired}`);
  console.log(`- rollbackDrillRequired: ${report.rollbackDrillRequired}`);
  console.log(`- monitoringRequired: ${report.monitoringRequired}`);
  console.log(`- humanApprovalRequired: ${report.humanApprovalRequired}\n`);

  console.log("CONFIRMATIONS");
  console.log(`- noDeployConfirmation: ${report.noDeployConfirmation}`);
  console.log(`- noProductionTouchConfirmation: ${report.noProductionTouchConfirmation}\n`);

  console.log(`Recommendation: ${report.goNoGoRecommendation}`);
  console.log(`Next Action: ${report.nextAction}`);
  console.log(`\n${report.executionAllowedStatement}\n`);
  console.log(report.status);
}

function printMarkdown(report: ApprovalPackReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION APPROVAL PACK\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Execution Readiness Status:** ${report.executionReadinessStatus}`);
  console.log(`**Ready for Approval:** ${report.readyForApproval ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**Approval Scope:** ${report.approvalScope}\n`);

  console.log("## P1.3 Fixture Readiness\n");
  console.log(`- Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`- Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`- Manual Config Satisfied For Review: ${report.manualConfigurationSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Rollback Satisfied For Review: ${report.rollbackSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Rollback Drill Satisfied For Review: ${report.rollbackDrillSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Monitoring Satisfied For Review: ${report.monitoringSatisfiedForReview ? "YES" : "NO"}`);
  console.log(`- Production Window Satisfied For Review: ${report.productionWindowSatisfiedForReview ? "YES" : "NO"}\n`);

  console.log("## P1.5 Routing Review\n");
  console.log(`- Routing Review Status: ${report.routingReviewStatus.status}`);
  console.log(`- Routing Review Pack Present: ${report.routingReviewStatus.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`- Routing Review Script Present: ${report.routingReviewStatus.routingReviewScriptPresent ? "YES" : "NO"}`);
  console.log(`- Routing Ready For Planning: ${report.routingReviewStatus.readyForPlanning ? "YES" : "NO"}`);
  console.log(`- Routing Ready For Execution: ${report.routingReviewStatus.readyForExecution ? "YES" : "NO"}`);
  console.log(`- Routing Execution Allowed: ${report.routingReviewStatus.executionAllowed ? "YES" : "NO"}`);
  console.log(`- Routing Commands Are Planned Only: ${report.routingReviewStatus.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`- Routing Requires Human Approval: ${report.routingReviewStatus.requiresHumanApproval ? "YES" : "NO"}\n`);

  console.log("## Readiness Summary\n");
  console.log(`- Planning Approval Eligible: ${report.readinessSummary.planningApprovalEligible ? "YES" : "NO"}`);
  console.log(`- Execution Eligible: ${report.readinessSummary.executionEligible ? "YES" : "NO"}`);
  console.log(
    `- Technical Planning Checks Healthy: ${report.readinessSummary.technicalPlanningChecksHealthy ? "YES" : "NO"}`,
  );
  console.log(`- Missing Artifacts Count: ${report.readinessSummary.missingArtifactsCount}\n`);

  console.log("## Required Flags\n");
  console.log(`- manualConfigurationRequired: ${report.manualConfigurationRequired}`);
  console.log(`- dnsRoutingRequired: ${report.dnsRoutingRequired}`);
  console.log(`- rollbackRequired: ${report.rollbackRequired}`);
  console.log(`- rollbackDrillRequired: ${report.rollbackDrillRequired}`);
  console.log(`- monitoringRequired: ${report.monitoringRequired}`);
  console.log(`- humanApprovalRequired: ${report.humanApprovalRequired}\n`);

  console.log("## Artifact Status\n");
  console.log(
    `- Production Template: ${report.productionTemplateStatus.present ? "PRESENT" : "MISSING"} [${report.productionTemplateStatus.status}]`,
  );
  console.log(`- Smokes Status: ${report.smokesStatus.status}`);
  console.log(`- Monitor Day Script: ${report.monitorStatus.status}`);
  console.log(
    `- Missing Artifacts: ${report.missingArtifacts.length > 0 ? report.missingArtifacts.join(", ") : "none"}\n`,
  );

  console.log("## P1.2 Validator Status\n");
  console.log(`- Manual Config: ${report.manualConfigStatus.status}`);
  console.log(`- Rollback Readiness: ${report.rollbackReadinessStatus.status}`);
  console.log(`- Production Window: ${report.productionWindowStatus.status}`);
  console.log(`- Monitoring Readiness: ${report.monitoringReadinessStatus.status}\n`);

  console.log("## Blockers\n");
  report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  console.log();

  console.log("## Confirmations\n");
  console.log(`- noDeployConfirmation: ${report.noDeployConfirmation}`);
  console.log(`- noProductionTouchConfirmation: ${report.noProductionTouchConfirmation}\n`);

  console.log(`**Recommendation:** ${report.goNoGoRecommendation}\n`);
  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(`**Execution:** ${report.executionAllowedStatement}\n`);
  console.log(report.status);
}

export async function prepareSocialflowProductionApprovalPack(
  options: ApprovalPackOptions = {},
): Promise<ApprovalPackReport> {
  const timestamp = new Date().toISOString();
  const blockers = new Set<string>();
  const routeDnsNonCriticalBlockers = new Set(["PRODUCTION_HOST_NOT_READY_BY_DESIGN"]);
  const fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
  const fixturePath = fixtureResolution.fixturePath;

  const safetyGate = await checkProductionSafetyGate();
  const routeDns = await checkRouteDnsReadiness();
  const cutoverReadiness = await checkProductionCutoverReadiness();
  const manualConfig = await checkSocialflowProductionManualConfig({ silent: true, fixture: fixturePath });
  const rollbackReadiness = await checkSocialflowProductionRollbackReadiness({ silent: true, fixture: fixturePath });
  const productionWindow = await checkSocialflowProductionWindowReadiness({ silent: true, fixture: fixturePath });
  const routingReview = await reviewSocialflowProductionRouting({ silent: true, fixture: fixturePath });
  const rollbackDrill = await simulateSocialflowProductionRollback({ silent: true, fixture: fixturePath });

  let parityResult;
  try {
    parityResult = await runCheckSocialflowNonprodOwnershipParity();
  } catch {
    parityResult = {
      exitCode: -1,
      status: "PARITY_CHECK_UNAVAILABLE_IN_LOCAL_MODE",
      remoteWrites: 0,
      ok: false,
    };
  }

  const productionTemplatePresent = artifactExists(ARTIFACT_PATHS.productionTemplate);
  const smokeHealthPresent = artifactExists(ARTIFACT_PATHS.smokeHealth);
  const smokeReadinessPresent = artifactExists(ARTIFACT_PATHS.smokeReadiness);
  const smokePostdeployPresent = artifactExists(ARTIFACT_PATHS.smokePostdeploy);
  const monitorPresent = artifactExists(ARTIFACT_PATHS.dayMonitor);
  const routingReviewScriptPresent = artifactExists(ARTIFACT_PATHS.routingReviewScript);
  const routingReviewPackPresent = artifactExists(ARTIFACT_PATHS.routingReviewPack);
  const rollbackDrillScriptPresent = artifactExists(ARTIFACT_PATHS.rollbackDrillScript);
  const rollbackDrillPackPresent = artifactExists(ARTIFACT_PATHS.rollbackDrillPack);
  const runbookPresent = artifactExists(ARTIFACT_PATHS.controlledRunbook);
  const decisionPackPresent = artifactExists(ARTIFACT_PATHS.decisionPack);

  const missingArtifacts: string[] = [];
  if (!productionTemplatePresent) missingArtifacts.push(ARTIFACT_PATHS.productionTemplate);
  if (!smokeHealthPresent) missingArtifacts.push(ARTIFACT_PATHS.smokeHealth);
  if (!smokeReadinessPresent) missingArtifacts.push(ARTIFACT_PATHS.smokeReadiness);
  if (!smokePostdeployPresent) missingArtifacts.push(ARTIFACT_PATHS.smokePostdeploy);
  if (!monitorPresent) missingArtifacts.push(ARTIFACT_PATHS.dayMonitor);
  if (!routingReviewScriptPresent) missingArtifacts.push(ARTIFACT_PATHS.routingReviewScript);
  if (!routingReviewPackPresent) missingArtifacts.push(ARTIFACT_PATHS.routingReviewPack);
  if (!rollbackDrillScriptPresent) missingArtifacts.push(ARTIFACT_PATHS.rollbackDrillScript);
  if (!rollbackDrillPackPresent) missingArtifacts.push(ARTIFACT_PATHS.rollbackDrillPack);
  if (!runbookPresent) missingArtifacts.push(ARTIFACT_PATHS.controlledRunbook);
  if (!decisionPackPresent) missingArtifacts.push(ARTIFACT_PATHS.decisionPack);

  const safetyGateOk = safetyGate.ok === true;
  const routeDnsReady = routeDns.ok === true;
  const cutoverReadyForPlanning = cutoverReadiness.readyForPlanning === true;
  const parityOk = parityResult.exitCode === 0;
  const productionTouched = safetyGate.findings.productionTouched === true;
  const remoteWrites = safetyGate.findings.remoteWrites ?? 0;
  const tokenLeakageDetected = safetyGate.findings.tokenLeakageDetected === true;
  const routeDnsCriticalBlockers = (routeDns.blockers ?? []).filter(
    (blocker) => !routeDnsNonCriticalBlockers.has(blocker),
  );
  const routeDnsCriticalReady = routeDnsReady && routeDnsCriticalBlockers.length === 0;
  const productionRouteNotReadyByDesign = routeDns.productionRoutes?.notReadyByDesign === true;
  const productionRoutingConfiguredForExecution = routeDns.productionRoutes?.productionHostNotReady === false;
  const daysMonitored = cutoverReadiness.monitoring?.daysCompleted ?? 0;
  const minimumMonitoringReached = cutoverReadiness.monitoring?.minimumMonitoringReached === true;
  const stableConfig =
    cutoverReadiness.configuration?.allSwitchesOn === true &&
    cutoverReadiness.configuration?.deployable === true &&
    cutoverReadiness.configuration?.allowDeploy === true;
  const driftSignals = new Set([
    "SWITCHES_OFF",
    "DEPLOYABLE_FALSE",
    "ALLOW_DEPLOY_FALSE",
    "ROUTE_DNS_NOT_READY",
    "PARITY_FAILED",
  ]);
  const driftDetected =
    (cutoverReadiness.blockedBy ?? []).some((blocker) => driftSignals.has(blocker)) || !stableConfig;
  const rollbackCommandsAvailable = cutoverReadiness.gates?.rollbackReady === true;
  const manualConfigurationSatisfiedForReview =
    manualConfig.status === "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW";
  const rollbackSatisfiedForReview =
    rollbackReadiness.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW";
  const productionWindowSatisfiedForReview =
    productionWindow.status === "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW";
  const rollbackDrillSatisfiedForReview =
    rollbackDrill.status === "SOCIALFLOW_PRODUCTION_ROLLBACK_DRILL_READY_FOR_REVIEW";
  const routingReviewReadyForPlanning = routingReview.ok === true;
  const routingReviewReviewHealthy = !fixtureResolution.fixtureMode || routingReviewReadyForPlanning;
  const rollbackDrillReviewHealthy = !fixtureResolution.fixtureMode || rollbackDrillSatisfiedForReview;
  const monitoringSatisfiedForReview =
    productionWindowSatisfiedForReview
    && productionWindow.monitoringPlanPresent
    && productionWindow.smokeSequencePresent
    && productionWindow.abortCriteriaPresent;

  if (missingArtifacts.length > 0) blockers.add("MISSING_ARTIFACTS");
  if (!safetyGateOk) blockers.add("SAFETY_GATE_NOT_OK");
  if (!routeDnsCriticalReady) blockers.add("ROUTE_DNS_CRITICAL_NOT_READY");
  if (!minimumMonitoringReached) blockers.add("MINIMUM_MONITORING_NOT_REACHED");
  if (!stableConfig) blockers.add("STABLE_CONFIG_NOT_CONFIRMED");
  if (driftDetected) blockers.add("DRIFT_DETECTED");
  if (!parityOk) blockers.add("PARITY_NOT_OK");
  if (productionTouched) blockers.add("PRODUCTION_TOUCHED");
  if (remoteWrites > 0) blockers.add("REMOTE_WRITES_DETECTED");
  if (tokenLeakageDetected) blockers.add("TOKEN_LEAKAGE_DETECTED");
  if (!rollbackCommandsAvailable) blockers.add("ROLLBACK_NOT_READY");
  if (!cutoverReadyForPlanning) blockers.add("CUTOVER_NOT_READY_FOR_PLANNING");
  if (manualConfig.status !== "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW") {
    blockers.add("MANUAL_CONFIG_REVIEW_NOT_READY");
  }
  if (manualConfig.tokenLeakageDetected) {
    blockers.add("MANUAL_CONFIG_TOKEN_LEAKAGE_DETECTED");
  }
  if (rollbackReadiness.status !== "SOCIALFLOW_PRODUCTION_ROLLBACK_READY_FOR_REVIEW") {
    blockers.add("ROLLBACK_REVIEW_NOT_READY");
  }
  if (productionWindow.status !== "SOCIALFLOW_PRODUCTION_WINDOW_READY_FOR_REVIEW") {
    blockers.add("PRODUCTION_WINDOW_REVIEW_NOT_READY");
  }

  const technicalPlanningChecksHealthy =
    missingArtifacts.length === 0 &&
    safetyGateOk &&
    routeDnsCriticalReady &&
    minimumMonitoringReached &&
    stableConfig &&
    !driftDetected &&
    parityOk &&
    !productionTouched &&
    remoteWrites === 0 &&
    !tokenLeakageDetected &&
    rollbackCommandsAvailable &&
    cutoverReadyForPlanning &&
    routingReviewReviewHealthy &&
    rollbackDrillReviewHealthy;

  const manualConfigurationApproved = false;
  const rollbackValidatedForExecution = false;
  const productionMonitoringActive = false;
  const stakeholderApprovalGranted = false;
  const technicalLeadApprovalGranted = false;
  const onCallEngineerAssigned = false;
  const productionWindowScheduled = false;

  if (!manualConfigurationApproved) blockers.add("MANUAL_CONFIGURATION_REQUIRED_FOR_EXECUTION");
  if (!productionRoutingConfiguredForExecution) blockers.add("DNS_ROUTING_REQUIRED_FOR_EXECUTION");
  if (!rollbackValidatedForExecution) blockers.add("ROLLBACK_VALIDATION_REQUIRED_FOR_EXECUTION");
  if (!productionMonitoringActive) blockers.add("PRODUCTION_MONITORING_REQUIRED_FOR_EXECUTION");
  if (!stakeholderApprovalGranted || !technicalLeadApprovalGranted) {
    blockers.add("HUMAN_APPROVAL_REQUIRED_FOR_EXECUTION");
  }
  if (!onCallEngineerAssigned) blockers.add("ON_CALL_REQUIRED_FOR_EXECUTION");
  if (!productionWindowScheduled) blockers.add("PRODUCTION_WINDOW_REQUIRED_FOR_EXECUTION");

  const monitoringReadinessStatus: ApprovalPackReport["monitoringReadinessStatus"] = {
    status:
      productionWindow.monitoringPlanPresent
      && productionWindow.productionWindowId.presence !== "MISSING"
      && productionWindow.onCallOwner.presence !== "MISSING"
        ? "PRODUCTION_MONITORING_READY_FOR_REVIEW"
        : "PRODUCTION_MONITORING_READINESS_REQUIRED",
    monitoringPlanPresent: productionWindow.monitoringPlanPresent,
    productionWindowDefined: productionWindow.productionWindowId.presence !== "MISSING",
    onCallDefined: productionWindow.onCallOwner.presence !== "MISSING",
  };

  const blockersList = Array.from(blockers);
  const readyForApproval = technicalPlanningChecksHealthy;
  const approvalScope = readyForApproval ? "APPROVAL_FOR_PLANNING_ONLY" : "BLOCKED";
  const status: ApprovalPackStatus = readyForApproval
    ? "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY_FOR_PLANNING_APPROVAL"
    : "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED";

  const report: ApprovalPackReport = {
    readyForApproval,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    approvalScope,
    status,
    executionReadinessStatus: "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_NOT_READY_FOR_EXECUTION",
    timestamp,
    fixtureMode: fixtureResolution.fixtureMode,
    productionTouchAllowed: false,
    readinessSummary: {
      planningApprovalEligible: readyForApproval,
      executionEligible: false,
      technicalPlanningChecksHealthy,
      missingArtifactsCount: missingArtifacts.length,
    },
    manualConfigurationRequired: true,
    manualConfigurationSatisfiedForReview,
    dnsRoutingRequired: true,
    rollbackRequired: true,
    rollbackSatisfiedForReview,
    rollbackDrillRequired: true,
    rollbackDrillSatisfiedForReview,
    monitoringRequired: true,
    monitoringSatisfiedForReview,
    productionWindowRequired: true,
    productionWindowSatisfiedForReview,
    humanApprovalRequired: true,
    productionTemplateStatus: {
      path: ARTIFACT_PATHS.productionTemplate,
      present: productionTemplatePresent,
      status: productionTemplatePresent
        ? "PRODUCTION_TEMPLATE_PRESENT_MANUAL_CONFIGURATION_REQUIRED"
        : "PRODUCTION_TEMPLATE_MISSING",
    },
    smokesStatus: {
      healthPresent: smokeHealthPresent,
      readinessPresent: smokeReadinessPresent,
      postdeployPresent: smokePostdeployPresent,
      status:
        smokeHealthPresent && smokeReadinessPresent && smokePostdeployPresent
          ? "ALL_PRESENT"
          : "MISSING_ONE_OR_MORE",
    },
    monitorStatus: {
      dayMonitorPresent: monitorPresent,
      status: monitorPresent ? "PRESENT" : "MISSING",
    },
    manualConfigStatus: {
      status: manualConfig.status,
      manualConfigurationComplete: manualConfig.manualConfigurationComplete,
      missingVariables: manualConfig.missingVariables,
      tokenLeakageDetected: manualConfig.tokenLeakageDetected,
    },
    rollbackReadinessStatus: {
      status: rollbackReadiness.status,
      rollbackPlanDocumented: rollbackReadiness.rollbackPlanDocumented,
      rollbackCommandSetPlannedOnly: rollbackReadiness.rollbackCommandSetPlannedOnly,
      restorePathDocumented: rollbackReadiness.restorePathDocumented,
      postRollbackSmokeListDocumented: rollbackReadiness.postRollbackSmokeListDocumented,
      abortConditionsDocumented: rollbackReadiness.abortConditionsDocumented,
    },
    productionWindowStatus: {
      status: productionWindow.status,
      monitoringPlanPresent: productionWindow.monitoringPlanPresent,
      smokeSequencePresent: productionWindow.smokeSequencePresent,
      abortCriteriaPresent: productionWindow.abortCriteriaPresent,
    },
    monitoringReadinessStatus,
    executionPlanStatus: {
      status:
        missingArtifacts.length > 0
          ? "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_MISSING_ARTIFACTS"
          : "SOCIALFLOW_PRODUCTION_EXECUTION_PLAN_BLOCKED_PENDING_MANUAL_APPROVAL",
      missingArtifacts,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      requiresHumanApproval: true,
      manualConfigurationRequired: true,
    },
    currentStatus: {
      safetyGateOk,
      routeDnsReady,
      cutoverReadyForPlanning,
      parityOk,
      productionTouched,
      remoteWrites,
      tokenLeakageDetected,
    },
    routeDnsAssessment: {
      routeDnsCriticalReady,
      routeDnsCriticalBlockers,
      productionRouteNotReadyByDesign,
      productionRoutingConfiguredForExecution,
    },
    routingReviewStatus: {
      status: routingReview.status,
      routingReviewPackPresent,
      routingReviewScriptPresent,
      readyForPlanning: routingReviewReadyForPlanning,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      requiresHumanApproval: true,
      manualConfigurationRequired: true,
      dnsRoutingRequired: true,
      productionTouchAllowed: false,
    },
    rollbackDrillStatus: {
      status: rollbackDrill.status,
      rollbackDrillPackPresent,
      rollbackDrillScriptPresent,
      readyForPlanning: rollbackDrillSatisfiedForReview,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      requiresHumanApproval: true,
      productionTouchAllowed: false,
    },
    monitoringEvidence: {
      daysMonitored,
      minimumDaysReached: minimumMonitoringReached,
      driftDetected,
      stableConfig,
      productionMonitoringActive,
    },
    gatesEvidence: {
      safetyGate: safetyGate.status,
      routeDns: routeDns.status,
      cutoverReadiness: cutoverReadiness.status,
      parity: parityResult.status,
    },
    safetyEvidence: {
      noProductionTouch: !productionTouched,
      zeroRemoteWrites: remoteWrites === 0,
      noTokenLeakage: !tokenLeakageDetected,
      gateProtectionActive: safetyGate.checks?.gateProtectionActive ?? false,
    },
    rollbackReadiness: {
      rollbackCommandsAvailable,
      rollbackTested: false,
      rollbackOwnerRequired: true,
      rollbackValidatedForExecution,
    },
    blockers: blockersList,
    approvals: {
      stakeholderApprovalRequired: true,
      technicalLeadApprovalRequired: true,
      onCallEngineerRequired: true,
      productionWindowRequired: true,
      stakeholderApprovalGranted,
      technicalLeadApprovalGranted,
      onCallEngineerAssigned,
      productionWindowScheduled,
    },
    missingArtifacts,
    noDeployConfirmation: true,
    noProductionTouchConfirmation: !productionTouched,
    goNoGoRecommendation: readyForApproval
      ? "GO_FOR_PLANNING_APPROVAL_ONLY - Execution remains blocked until DNS/routing, rollback validation, rollback drill, monitoring, and human approvals are complete."
      : `NO_GO - Resolve blockers first: ${blockersList.join(", ")}`,
    executionAllowedStatement:
      "EXECUTION NOT ALLOWED - planning artifacts are ready, but manual configuration, DNS/routing, rollback validation, rollback drill, monitoring, and human approvals are still required.",
    nextAction: readyForApproval
      ? "COMPLETE_MANUAL_CONFIG_AND_APPROVAL_WINDOW_BEFORE_ANY_EXECUTION"
      : "RESOLVE_TECHNICAL_AND_ARTIFACT_BLOCKERS",
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    console.log(`\n${status}`);
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

  prepareSocialflowProductionApprovalPack({ json, markdown, fixture })
    .then((report) => {
      process.exit(report.status === "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED" ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_ERROR", error);
      process.exit(1);
    });
}
