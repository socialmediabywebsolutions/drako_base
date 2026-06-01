import { checkProductionSafetyGate } from "./check-socialflow-production-safety-gate";
import { checkRouteDnsReadiness } from "./check-socialflow-route-dns-readiness";
import { checkProductionCutoverReadiness } from "./check-socialflow-production-cutover-readiness";
import { runCheckSocialflowNonprodOwnershipParity } from "./check-socialflow-nonprod-ownership-parity";

interface ApprovalPackOptions {
  json?: boolean;
  markdown?: boolean;
}

interface ApprovalPackReport {
  readyForApproval: boolean;
  readyForExecution: boolean;
  requiresHumanApproval: boolean;
  approvalScope: "APPROVAL_FOR_PLANNING_ONLY" | "BLOCKED";
  status: string;
  timestamp: string;
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
  };
  monitoringEvidence: {
    daysMonitored: number;
    minimumDaysReached: boolean;
    driftDetected: boolean;
    stableConfig: boolean;
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
  };
  productionBlockers: string[];
  approvalsRequired: {
    stakeholderApproval: boolean;
    technicalLeadApproval: boolean;
    onCallEngineerAssigned: boolean;
    productionWindowScheduled: boolean;
  };
  goNoGoRecommendation: string;
  executionAllowedStatement: string;
}

export async function prepareSocialflowProductionApprovalPack(
  options: ApprovalPackOptions = {},
): Promise<ApprovalPackReport> {
  const timestamp = new Date().toISOString();
  const productionBlockers: string[] = [];
  const routeDnsNonCriticalBlockers = new Set(["PRODUCTION_HOST_NOT_READY_BY_DESIGN"]);

  const safetyGate = await checkProductionSafetyGate();
  const routeDns = await checkRouteDnsReadiness();
  const cutoverReadiness = await checkProductionCutoverReadiness();

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
  const rollbackReady = cutoverReadiness.gates?.rollbackReady === true;

  if (!safetyGateOk) {
    productionBlockers.push("SAFETY_GATE_NOT_OK");
  }
  if (!routeDnsCriticalReady) {
    productionBlockers.push("ROUTE_DNS_CRITICAL_NOT_READY");
  }
  if (!minimumMonitoringReached) {
    productionBlockers.push("MINIMUM_MONITORING_NOT_REACHED");
  }
  if (!stableConfig) {
    productionBlockers.push("STABLE_CONFIG_NOT_CONFIRMED");
  }
  if (driftDetected) {
    productionBlockers.push("DRIFT_DETECTED");
  }
  if (!parityOk) {
    productionBlockers.push("PARITY_NOT_OK");
  }
  if (productionTouched) {
    productionBlockers.push("PRODUCTION_TOUCHED");
  }
  if (remoteWrites > 0) {
    productionBlockers.push("REMOTE_WRITES_DETECTED");
  }
  if (tokenLeakageDetected) {
    productionBlockers.push("TOKEN_LEAKAGE_DETECTED");
  }
  if (!rollbackReady) {
    productionBlockers.push("ROLLBACK_NOT_READY");
  }
  if (!cutoverReadyForPlanning) {
    productionBlockers.push("CUTOVER_NOT_READY_FOR_PLANNING");
  }

  productionBlockers.push("STAKEHOLDER_APPROVAL_REQUIRED");
  productionBlockers.push("PRODUCTION_WINDOW_REQUIRED");
  productionBlockers.push("ON_CALL_REQUIRED");

  const readyForApproval =
    safetyGateOk &&
    routeDnsCriticalReady &&
    minimumMonitoringReached &&
    stableConfig &&
    !driftDetected &&
    parityOk &&
    !productionTouched &&
    remoteWrites === 0 &&
    !tokenLeakageDetected &&
    rollbackReady &&
    cutoverReadyForPlanning;
  const approvalScope = readyForApproval ? "APPROVAL_FOR_PLANNING_ONLY" : "BLOCKED";
  const status = readyForApproval
    ? "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_READY"
    : "SOCIALFLOW_PRODUCTION_APPROVAL_PACK_BLOCKED";
  const goNoGoRecommendation = readyForApproval
    ? productionRouteNotReadyByDesign
      ? "GO_FOR_APPROVAL_PLANNING_ONLY - Production route remains NOT_READY_BY_DESIGN; planning approval only, no execution."
      : "GO_FOR_APPROVAL_PLANNING_ONLY - Technical gates healthy; planning approval only, no execution."
    : `NO_GO - Blockers: ${productionBlockers.filter((b) => !b.includes("REQUIRED")).join(", ")}`;

  const report: ApprovalPackReport = {
    readyForApproval,
    readyForExecution: false,
    requiresHumanApproval: true,
    approvalScope,
    status,
    timestamp,
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
    },
    monitoringEvidence: {
      daysMonitored,
      minimumDaysReached: minimumMonitoringReached,
      driftDetected,
      stableConfig,
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
      rollbackCommandsAvailable: rollbackReady,
      rollbackTested: false,
      rollbackOwnerRequired: true,
    },
    productionBlockers,
    approvalsRequired: {
      stakeholderApproval: true,
      technicalLeadApproval: true,
      onCallEngineerAssigned: true,
      productionWindowScheduled: true,
    },
    goNoGoRecommendation,
    executionAllowedStatement:
      "EXECUTION NOT ALLOWED - Human approval, production window, and on-call engineer required",
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

function printNormal(report: ApprovalPackReport): void {
  console.log("\nSOCIALFLOW PRODUCTION APPROVAL PACK");
  console.log(`Status: ${report.status}`);
  console.log(`Ready for Approval: ${report.readyForApproval ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`Approval Scope: ${report.approvalScope}\n`);

  console.log("CURRENT STATUS");
  console.log(`- Safety Gate OK: ${report.currentStatus.safetyGateOk ? "YES" : "NO"}`);
  console.log(`- Route/DNS Ready: ${report.currentStatus.routeDnsReady ? "YES" : "NO"}`);
  console.log(
    `- Cutover Ready for Planning: ${report.currentStatus.cutoverReadyForPlanning ? "YES" : "NO"}`,
  );
  console.log(`- Parity OK: ${report.currentStatus.parityOk ? "YES" : "NO"}`);
  console.log(`- Production Touched: ${report.currentStatus.productionTouched ? "YES" : "NO"}`);
  console.log(`- Remote Writes: ${report.currentStatus.remoteWrites}`);
  console.log(`- Token Leakage Detected: ${report.currentStatus.tokenLeakageDetected ? "YES" : "NO"}\n`);

  console.log("MONITORING EVIDENCE");
  console.log(`- Days Monitored: ${report.monitoringEvidence.daysMonitored}`);
  console.log(`- Minimum Days Reached: ${report.monitoringEvidence.minimumDaysReached ? "YES" : "NO"}`);
  console.log(`- Drift Detected: ${report.monitoringEvidence.driftDetected ? "YES" : "NO"}`);
  console.log(`- Stable Config: ${report.monitoringEvidence.stableConfig ? "YES" : "NO"}\n`);

  console.log("ROUTE/DNS ASSESSMENT");
  console.log(`- Route/DNS Critical Ready: ${report.routeDnsAssessment.routeDnsCriticalReady ? "YES" : "NO"}`);
  console.log(
    `- Production Route Not Ready by Design: ${report.routeDnsAssessment.productionRouteNotReadyByDesign ? "YES" : "NO"}`,
  );
  console.log(
    `- Route/DNS Critical Blockers: ${
      report.routeDnsAssessment.routeDnsCriticalBlockers.length > 0
        ? report.routeDnsAssessment.routeDnsCriticalBlockers.join(", ")
        : "none"
    }\n`,
  );

  console.log("SAFETY EVIDENCE");
  console.log(`- No Production Touch: ${report.safetyEvidence.noProductionTouch ? "YES" : "NO"}`);
  console.log(`- Zero Remote Writes: ${report.safetyEvidence.zeroRemoteWrites ? "YES" : "NO"}`);
  console.log(`- No Token Leakage: ${report.safetyEvidence.noTokenLeakage ? "YES" : "NO"}`);
  console.log(`- Gate Protection Active: ${report.safetyEvidence.gateProtectionActive ? "YES" : "NO"}\n`);

  console.log("ROLLBACK READINESS");
  console.log(
    `- Rollback Commands Available: ${report.rollbackReadiness.rollbackCommandsAvailable ? "YES" : "NO"}`,
  );
  console.log(`- Rollback Owner Required: ${report.rollbackReadiness.rollbackOwnerRequired ? "YES" : "NO"}\n`);

  console.log("APPROVALS REQUIRED");
  console.log(`- Stakeholder Approval: ${report.approvalsRequired.stakeholderApproval ? "REQUIRED" : "NO"}`);
  console.log(
    `- Technical Lead Approval: ${report.approvalsRequired.technicalLeadApproval ? "REQUIRED" : "NO"}`,
  );
  console.log(
    `- On-Call Engineer Assigned: ${report.approvalsRequired.onCallEngineerAssigned ? "REQUIRED" : "NO"}`,
  );
  console.log(
    `- Production Window Scheduled: ${report.approvalsRequired.productionWindowScheduled ? "REQUIRED" : "NO"}\n`,
  );

  console.log(
    `Production Blockers: ${report.productionBlockers.length > 0 ? report.productionBlockers.join(", ") : "none"}`,
  );
  console.log(`Recommendation: ${report.goNoGoRecommendation}`);
  console.log(`\n${report.executionAllowedStatement}\n`);
  console.log(report.status);
}

function printMarkdown(report: ApprovalPackReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION APPROVAL PACK\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Ready for Approval:** ${report.readyForApproval ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**Approval Scope:** ${report.approvalScope}\n`);

  console.log("## Current Status\n");
  console.log(`- Safety Gate OK: ${report.currentStatus.safetyGateOk ? "YES" : "NO"}`);
  console.log(`- Route/DNS Ready: ${report.currentStatus.routeDnsReady ? "YES" : "NO"}`);
  console.log(
    `- Cutover Ready for Planning: ${report.currentStatus.cutoverReadyForPlanning ? "YES" : "NO"}`,
  );
  console.log(`- Parity OK: ${report.currentStatus.parityOk ? "YES" : "NO"}`);
  console.log(`- Production Touched: ${report.currentStatus.productionTouched ? "YES" : "NO"}`);
  console.log(`- Remote Writes: ${report.currentStatus.remoteWrites}`);
  console.log(`- Token Leakage Detected: ${report.currentStatus.tokenLeakageDetected ? "YES" : "NO"}\n`);

  console.log("## Monitoring Evidence\n");
  console.log(`- Days Monitored: ${report.monitoringEvidence.daysMonitored}`);
  console.log(`- Minimum Days Reached: ${report.monitoringEvidence.minimumDaysReached ? "YES" : "NO"}`);
  console.log(`- Drift Detected: ${report.monitoringEvidence.driftDetected ? "YES" : "NO"}`);
  console.log(`- Stable Config: ${report.monitoringEvidence.stableConfig ? "YES" : "NO"}\n`);

  console.log("## Route/DNS Assessment\n");
  console.log(`- Route/DNS Critical Ready: ${report.routeDnsAssessment.routeDnsCriticalReady ? "YES" : "NO"}`);
  console.log(
    `- Production Route Not Ready by Design: ${report.routeDnsAssessment.productionRouteNotReadyByDesign ? "YES" : "NO"}`,
  );
  console.log(
    `- Route/DNS Critical Blockers: ${
      report.routeDnsAssessment.routeDnsCriticalBlockers.length > 0
        ? report.routeDnsAssessment.routeDnsCriticalBlockers.join(", ")
        : "none"
    }\n`,
  );

  console.log("## Safety Evidence\n");
  console.log(`- No Production Touch: ${report.safetyEvidence.noProductionTouch ? "YES" : "NO"}`);
  console.log(`- Zero Remote Writes: ${report.safetyEvidence.zeroRemoteWrites ? "YES" : "NO"}`);
  console.log(`- No Token Leakage: ${report.safetyEvidence.noTokenLeakage ? "YES" : "NO"}`);
  console.log(`- Gate Protection Active: ${report.safetyEvidence.gateProtectionActive ? "YES" : "NO"}\n`);

  console.log("## Approvals Required\n");
  console.log(`- Stakeholder Approval: ${report.approvalsRequired.stakeholderApproval ? "REQUIRED" : "NO"}`);
  console.log(
    `- Technical Lead Approval: ${report.approvalsRequired.technicalLeadApproval ? "REQUIRED" : "NO"}`,
  );
  console.log(`- On-Call Engineer: ${report.approvalsRequired.onCallEngineerAssigned ? "REQUIRED" : "NO"}`);
  console.log(
    `- Production Window: ${report.approvalsRequired.productionWindowScheduled ? "REQUIRED" : "NO"}\n`,
  );

  console.log(`**Recommendation:** ${report.goNoGoRecommendation}\n`);
  console.log(`**Execution:** ${report.executionAllowedStatement}\n`);
  console.log(report.status);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  prepareSocialflowProductionApprovalPack({ json, markdown })
    .then((report) => {
      process.exit(report.readyForApproval && !report.readyForExecution ? 0 : 1);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_APPROVAL_PACK_ERROR", error);
      process.exit(1);
    });
}
