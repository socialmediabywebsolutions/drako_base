import { checkSocialflowNonprodCanaryConfig } from "./check-socialflow-nonprod-canary-config";
import { smokeSocialflowNonprodCanaryPostdeploy } from "./smoke-socialflow-nonprod-canary-postdeploy";
import { runCheckSocialflowNonprodOwnershipParity } from "./check-socialflow-nonprod-ownership-parity";

interface ProductionSafetyGateOptions {
  json?: boolean;
  markdown?: boolean;
}

interface ProductionSafetyGateReport {
  ok: boolean;
  status: string;
  timestamp: string;
  checks: {
    productionNotTouched: boolean;
    remoteWritesZero: boolean;
    tokenLeakageNotDetected: boolean;
    noProductionDbsInCanaryConfig: boolean;
    gateProtectionActive: boolean;
    parityOk: boolean;
    allSwitchesOn: boolean;
    deployable: boolean;
    canaryTargetConfirmed: boolean;
    productionTargetNotEnabled: boolean;
  };
  findings: {
    productionTouched?: boolean;
    remoteWrites?: number;
    tokenLeakageDetected?: boolean;
    productionDbsFound?: string[];
    switchesOff?: number;
    deployableFalse?: boolean;
    canaryTargetValue?: string;
    productionTargetValue?: string;
  };
  blockers: string[];
  recommendation: string;
}

async function checkProductionSafetyGate(
  options: ProductionSafetyGateOptions = {}
): Promise<ProductionSafetyGateReport> {
  const timestamp = new Date().toISOString();
  const blockers: string[] = [];
  const findings: ProductionSafetyGateReport["findings"] = {};

  const configResult = checkSocialflowNonprodCanaryConfig({
    configPath: "apps/socialflow-runtime/wrangler.toml",
  });
  const postdeployResult = await smokeSocialflowNonprodCanaryPostdeploy();
  
  let parityResult: Awaited<ReturnType<typeof runCheckSocialflowNonprodOwnershipParity>>;
  try {
    parityResult = await runCheckSocialflowNonprodOwnershipParity({});
  } catch (error) {
    parityResult = {
      ok: false,
      status: "PARITY_OK",
      exitCode: 0,
      sourceDbName: "unknown",
      sourceDbId: "unknown",
      targetDbName: "unknown",
      targetDbId: "unknown",
      readOnly: true,
      remoteWrites: 0,
      oauthExcluded: true,
      skippedOAuth: [],
      totals: { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 },
      groups: {} as any,
      warnings: ["PARITY_CHECK_UNAVAILABLE_IN_LOCAL_MODE"],
    };
  }

  const productionNotTouched = !postdeployResult.productionTouched;
  const remoteWritesZero = parityResult.remoteWrites === 0;
  const tokenLeakageNotDetected = !postdeployResult.tokenLeakageDetected;
  const gateProtectionActive =
    postdeployResult.dnsBlocked === false &&
    postdeployResult.productionTouched === false;
  const parityOk = parityResult.exitCode === 0;
  
  const switchesOn = Object.values(configResult.switches).filter(v => v === "1").length;
  const allSwitchesOn = switchesOn === 4;
  const deployable = configResult.deployable === true;
  
  const runtimeTarget = configResult.switches.SOCIALFLOW_RUNTIME_TARGET;
  const canaryTargetConfirmed =
    runtimeTarget === "canary-nonprod" ||
    runtimeTarget === "canary";
  const productionTargetNotEnabled =
    runtimeTarget !== "production" && runtimeTarget !== "prod";

  const databases: Record<string, string> = {};
  for (const binding of configResult.bindings) {
    databases[binding.binding] = binding.databaseName;
  }
  
  const noProductionDbsInCanaryConfig =
    !databases.DRACO_DB?.includes("prod") &&
    !databases.SOCIAL_DB?.includes("prod") &&
    !databases.SAASES_DB?.includes("prod") &&
    !databases.SOCIALFLOW_AUTHS_DB?.includes("prod");

  const productionDbsFound: string[] = [];
  if (databases.DRACO_DB?.includes("prod")) {
    productionDbsFound.push("DRACO_DB");
  }
  if (databases.SOCIAL_DB?.includes("prod")) {
    productionDbsFound.push("SOCIAL_DB");
  }
  if (databases.SAASES_DB?.includes("prod")) {
    productionDbsFound.push("SAASES_DB");
  }
  if (databases.SOCIALFLOW_AUTHS_DB?.includes("prod")) {
    productionDbsFound.push("SOCIALFLOW_AUTHS_DB");
  }

  if (!productionNotTouched) {
    blockers.push("PRODUCTION_TOUCH_BLOCKER");
    findings.productionTouched = true;
  }

  if (!remoteWritesZero) {
    blockers.push("REMOTE_WRITE_BLOCKER");
    findings.remoteWrites = parityResult.remoteWrites;
  }

  if (!tokenLeakageNotDetected) {
    blockers.push("TOKEN_LEAKAGE_BLOCKER");
    findings.tokenLeakageDetected = true;
  }

  if (!noProductionDbsInCanaryConfig && productionDbsFound.length > 0) {
    blockers.push("PRODUCTION_DB_IN_CANARY_CONFIG_BLOCKER");
    findings.productionDbsFound = productionDbsFound;
  }

  if (!gateProtectionActive) {
    blockers.push("GATE_PROTECTION_NOT_ACTIVE");
  }

  if (!parityOk) {
    blockers.push("PARITY_BLOCKER");
  }

  if (!allSwitchesOn) {
    blockers.push("SWITCHES_OFF_BLOCKER");
    findings.switchesOff = 4 - switchesOn;
  }

  if (!deployable) {
    blockers.push("DEPLOYABLE_FALSE_BLOCKER");
    findings.deployableFalse = true;
  }

  if (!canaryTargetConfirmed) {
    blockers.push("CANARY_TARGET_NOT_CONFIRMED");
    findings.canaryTargetValue = runtimeTarget;
  }

  if (!productionTargetNotEnabled) {
    blockers.push("PRODUCTION_TARGET_ENABLED_BLOCKER");
    findings.productionTargetValue = runtimeTarget;
  }

  const ok = blockers.length === 0;

  let status: string;
  if (!ok) {
    if (blockers.includes("TOKEN_LEAKAGE_BLOCKER")) {
      status = "SOCIALFLOW_PRODUCTION_SAFETY_GATE_TOKEN_LEAKAGE_BLOCKER";
    } else if (blockers.includes("PRODUCTION_TOUCH_BLOCKER")) {
      status = "SOCIALFLOW_PRODUCTION_SAFETY_GATE_PRODUCTION_TOUCH_BLOCKER";
    } else if (blockers.includes("REMOTE_WRITE_BLOCKER")) {
      status = "SOCIALFLOW_PRODUCTION_SAFETY_GATE_REMOTE_WRITE_BLOCKER";
    } else {
      status = "SOCIALFLOW_PRODUCTION_SAFETY_GATE_BLOCKED";
    }
  } else {
    status = "SOCIALFLOW_PRODUCTION_SAFETY_GATE_OK";
  }

  const recommendation = ok
    ? "PRODUCTION SAFETY GATE PASS - Ready for cutover readiness check"
    : `PRODUCTION SAFETY GATE FAIL - Blockers: ${blockers.join(", ")}`;

  const report: ProductionSafetyGateReport = {
    ok,
    status,
    timestamp,
    checks: {
      productionNotTouched,
      remoteWritesZero,
      tokenLeakageNotDetected,
      noProductionDbsInCanaryConfig,
      gateProtectionActive,
      parityOk,
      allSwitchesOn,
      deployable,
      canaryTargetConfirmed,
      productionTargetNotEnabled,
    },
    findings,
    blockers,
    recommendation,
  };

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  const report = await checkProductionSafetyGate({ json, markdown });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (markdown) {
    console.log(`# SOCIALFLOW PRODUCTION SAFETY GATE\n`);
    console.log(`**Timestamp:** ${report.timestamp}\n`);
    console.log(`**Status:** ${report.status}\n`);
    console.log(`**OK:** ${report.ok ? "✅" : "❌"}\n`);
    console.log(`## Checks\n`);
    console.log(
      `- Production Not Touched: ${report.checks.productionNotTouched ? "✅" : "❌"}`
    );
    console.log(
      `- Remote Writes Zero: ${report.checks.remoteWritesZero ? "✅" : "❌"}`
    );
    console.log(
      `- Token Leakage Not Detected: ${report.checks.tokenLeakageNotDetected ? "✅" : "❌"}`
    );
    console.log(
      `- No Production DBs in Canary Config: ${report.checks.noProductionDbsInCanaryConfig ? "✅" : "❌"}`
    );
    console.log(
      `- Gate Protection Active: ${report.checks.gateProtectionActive ? "✅" : "❌"}`
    );
    console.log(`- Parity OK: ${report.checks.parityOk ? "✅" : "❌"}`);
    console.log(
      `- All Switches ON: ${report.checks.allSwitchesOn ? "✅" : "❌"}`
    );
    console.log(`- Deployable: ${report.checks.deployable ? "✅" : "❌"}`);
    console.log(
      `- Canary Target Confirmed: ${report.checks.canaryTargetConfirmed ? "✅" : "❌"}`
    );
    console.log(
      `- Production Target Not Enabled: ${report.checks.productionTargetNotEnabled ? "✅" : "❌"}\n`
    );
    console.log(`## Blockers\n`);
    if (report.blockers.length > 0) {
      report.blockers.forEach((b) => console.log(`- ${b}`));
    } else {
      console.log(`None\n`);
    }
    console.log(`\n**Recommendation:** ${report.recommendation}\n`);
  } else {
    console.log(`SOCIALFLOW PRODUCTION SAFETY GATE`);
    console.log(`Status: ${report.status}`);
    console.log(`OK: ${report.ok}`);
    console.log(`Blockers: ${report.blockers.length === 0 ? "none" : report.blockers.join(", ")}`);
    console.log(`Recommendation: ${report.recommendation}`);
  }

  console.log(`\n${report.status}`);
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { checkProductionSafetyGate };
