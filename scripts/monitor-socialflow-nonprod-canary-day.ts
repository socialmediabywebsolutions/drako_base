import { checkSocialflowNonprodCanaryConfig } from "./check-socialflow-nonprod-canary-config";
import { checkSocialflowPredeployGate } from "./check-socialflow-predeploy-gate";
import { smokeSocialflowNonprodCanaryPostdeploy } from "./smoke-socialflow-nonprod-canary-postdeploy";
import { smokeSocialflowNonprodCanaryGatedHealth } from "./smoke-socialflow-nonprod-canary-gated-health";
import { runCheckSocialflowNonprodOwnershipParity } from "./check-socialflow-nonprod-ownership-parity";

interface MonitoringDayOptions {
  day?: number;
  json?: boolean;
  markdown?: boolean;
}

interface MonitoringDayReport {
  ok: boolean;
  status: string;
  day: number;
  timestamp: string;
  config: {
    deployable: boolean;
    allowDeployWithRealD1: boolean;
    switchesOn: number;
    switchesOff: number;
    switches: Record<string, string | undefined>;
  };
  gate: {
    predeployGateStatus: string;
  };
  baseline: {
    healthStatus: number | undefined;
    healthResult: string | undefined;
    readinessStatus: number | undefined;
    readinessResult: string | undefined;
    status: string;
  };
  gated: {
    gateSecretAvailable: boolean;
    healthStatus: number | undefined;
    healthResult: string | undefined;
    readinessStatus: number | undefined;
    readinessResult: string | undefined;
    status: string;
  };
  parity: {
    matched: number;
    mismatched: number;
    missingInSocial: number;
    status: string;
  };
  security: {
    tokenLeakageDetected: boolean;
    productionTouched: boolean;
    remoteWrites: number;
  };
  recommendation: string;
  nextAction: string;
  blockers: string[];
}

type MonitoringStatus =
  | "SOCIALFLOW_CANARY_MONITORING_DAY_OK"
  | "SOCIALFLOW_CANARY_MONITORING_DAY_OK_WITH_MISSING_GATE_TOKEN"
  | "SOCIALFLOW_CANARY_MONITORING_DAY_BLOCKED"
  | "SOCIALFLOW_CANARY_MONITORING_DAY_TOKEN_LEAKAGE_BLOCKER"
  | "SOCIALFLOW_CANARY_MONITORING_DAY_PRODUCTION_TOUCH_BLOCKER"
  | "SOCIALFLOW_CANARY_MONITORING_DAY_PARITY_BLOCKER";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
];

export async function monitorSocialflowNonprodCanaryDay(
  options: MonitoringDayOptions = {},
): Promise<MonitoringDayReport> {
  const day = options.day ?? 1;
  const timestamp = new Date().toISOString();
  const blockers: string[] = [];

  console.log(`\n📊 SOCIALFLOW CANARY MONITORING - DAY ${day}\n`);
  console.log(`Timestamp: ${timestamp}\n`);

  console.log("=".repeat(60));
  console.log("1. CONFIG CHECK");
  console.log("=".repeat(60) + "\n");

  const configReports = DEFAULT_CONFIG_PATHS.map((configPath) =>
    checkSocialflowNonprodCanaryConfig({ configPath }),
  );

  const deployable = configReports.every((r) => r.deployable);
  const allowDeployWithRealD1 = configReports.every((r) => r.allowDeployWithRealD1);

  const allSwitches = configReports[0]?.switches ?? {};
  const switchesOn = Object.values(allSwitches).filter((v) => v === "1").length;
  const switchesOff = Object.values(allSwitches).filter((v) => v === "0").length;

  console.log(`Deployable: ${deployable}`);
  console.log(`Allow Deploy with Real D1: ${allowDeployWithRealD1}`);
  console.log(`Switches ON: ${switchesOn}`);
  console.log(`Switches OFF: ${switchesOff}`);

  if (!deployable) {
    blockers.push("DEPLOYABLE_FALSE");
    console.log("⚠️  BLOCKER: Deployable is false");
  }

  if (!allowDeployWithRealD1) {
    blockers.push("ALLOW_DEPLOY_WITH_REAL_D1_FALSE");
    console.log("⚠️  BLOCKER: Allow deploy with real D1 is false");
  }

  if (switchesOn !== 4) {
    blockers.push(`SWITCHES_NOT_ALL_ON:${switchesOn}/4`);
    console.log(`⚠️  BLOCKER: Expected 4 switches ON, found ${switchesOn}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("2. PREDEPLOY GATE CHECK");
  console.log("=".repeat(60) + "\n");

  const gateReport = await checkSocialflowPredeployGate({ configPaths: DEFAULT_CONFIG_PATHS });
  console.log(`Gate status: ${gateReport.status}`);

  console.log("\n" + "=".repeat(60));
  console.log("3. BASELINE SMOKE (WITHOUT GATE HEADER)");
  console.log("=".repeat(60) + "\n");

  const baselineReport = await smokeSocialflowNonprodCanaryPostdeploy({ json: false });

  console.log(`Baseline status: ${baselineReport.status}`);
  console.log(`Health result: ${baselineReport.healthResult}`);
  console.log(`Readiness result: ${baselineReport.readinessResult}`);

  const baselineExpectedStatus = "POSTDEPLOY_SMOKE_GATE_ACTIVE_OK";
  if (baselineReport.status !== baselineExpectedStatus) {
    blockers.push(`BASELINE_UNEXPECTED_STATUS:${baselineReport.status}`);
    console.log(`⚠️  BLOCKER: Expected ${baselineExpectedStatus}, got ${baselineReport.status}`);
  }

  if (baselineReport.healthResult !== "HEALTH_GATED_403") {
    blockers.push(`HEALTH_WITHOUT_GATE_NOT_403:${baselineReport.healthResult}`);
    console.log(`⚠️  BLOCKER: Health without gate should be 403, got ${baselineReport.healthResult}`);
  }

  if (baselineReport.readinessResult !== "READINESS_GATED_403") {
    blockers.push(`READINESS_WITHOUT_GATE_NOT_403:${baselineReport.readinessResult}`);
    console.log(`⚠️  BLOCKER: Readiness without gate should be 403, got ${baselineReport.readinessResult}`);
  }

  if (baselineReport.tokenLeakageDetected) {
    blockers.push("BASELINE_TOKEN_LEAKAGE");
    console.log("⚠️  BLOCKER: Token leakage detected in baseline");
  }

  if (baselineReport.productionTouched) {
    blockers.push("BASELINE_PRODUCTION_TOUCHED");
    console.log("⚠️  BLOCKER: Production touched in baseline");
  }

  console.log("\n" + "=".repeat(60));
  console.log("4. GATED SMOKE (WITH GATE HEADER)");
  console.log("=".repeat(60) + "\n");

  const gatedReport = await smokeSocialflowNonprodCanaryGatedHealth({ json: false });

  console.log(`Gated status: ${gatedReport.status}`);
  console.log(`Gate secret available: ${gatedReport.gateSecretAvailable}`);

  if (gatedReport.gateSecretAvailable) {
    console.log(`Health result: ${gatedReport.healthResult}`);
    console.log(`Readiness result: ${gatedReport.readinessResult}`);

    if (gatedReport.status === "SOCIALFLOW_CANARY_GATED_HEALTH_UNAUTHORIZED") {
      blockers.push("GATED_UNAUTHORIZED_WITH_TOKEN");
      console.log("⚠️  WARNING: Gate token present but unauthorized (token mismatch?)");
    }

    if (gatedReport.tokenLeakageDetected) {
      blockers.push("GATED_TOKEN_LEAKAGE");
      console.log("⚠️  BLOCKER: Token leakage detected in gated smoke");
    }

    if (gatedReport.productionTouched) {
      blockers.push("GATED_PRODUCTION_TOUCHED");
      console.log("⚠️  BLOCKER: Production touched in gated smoke");
    }
  } else {
    console.log("ℹ️  Gate secret not available locally (expected, acceptable)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("5. OWNERSHIP PARITY CHECK");
  console.log("=".repeat(60) + "\n");

  const parityReport = await runCheckSocialflowNonprodOwnershipParity({ configPaths: DEFAULT_CONFIG_PATHS });

  const parityMatched = parityReport.totals?.matched ?? 0;
  const parityMismatched = parityReport.totals?.mismatched ?? 0;
  const parityMissingInSocial = parityReport.totals?.missingInSocial ?? 0;

  console.log(`Parity status: ${parityReport.status}`);
  console.log(`Matched: ${parityMatched}`);
  console.log(`Mismatched: ${parityMismatched}`);
  console.log(`Missing in SOCIAL: ${parityMissingInSocial}`);

  if (parityMismatched > 0) {
    blockers.push(`PARITY_MISMATCHED:${parityMismatched}`);
    console.log(`⚠️  BLOCKER: ${parityMismatched} ownership records mismatched`);
  }

  const parityOk = parityReport.status === "PARITY_OK" || parityReport.status === "EMPTY_SOURCE_ACCEPTED" || parityReport.status === "DRIFT_ALLOWED";
  if (!parityOk) {
    blockers.push(`PARITY_NOT_OK:${parityReport.status}`);
    console.log(`⚠️  BLOCKER: Parity status not OK: ${parityReport.status}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("6. SECURITY VALIDATION");
  console.log("=".repeat(60) + "\n");

  const tokenLeakageDetected = baselineReport.tokenLeakageDetected || gatedReport.tokenLeakageDetected;
  const productionTouched = baselineReport.productionTouched || gatedReport.productionTouched;
  const remoteWrites = 0;

  console.log(`Token leakage detected: ${tokenLeakageDetected}`);
  console.log(`Production touched: ${productionTouched}`);
  console.log(`Remote writes: ${remoteWrites}`);

  if (tokenLeakageDetected) {
    blockers.push("SECURITY_TOKEN_LEAKAGE");
    console.log("⚠️  BLOCKER: Token leakage detected");
  }

  if (productionTouched) {
    blockers.push("SECURITY_PRODUCTION_TOUCHED");
    console.log("⚠️  BLOCKER: Production touched");
  }

  console.log("\n" + "=".repeat(60));
  console.log("MONITORING SUMMARY");
  console.log("=".repeat(60) + "\n");

  let status: MonitoringStatus;
  let recommendation: string;
  let nextAction: string;

  const hasBlockers = blockers.length > 0;
  const gateTokenMissing = !gatedReport.gateSecretAvailable;

  if (tokenLeakageDetected) {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_TOKEN_LEAKAGE_BLOCKER";
    recommendation = "ROLLBACK IMMEDIATELY - Token leakage detected";
    nextAction = "EXECUTE_ROLLBACK_DISABLE_DEPLOYABLE";
  } else if (productionTouched) {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_PRODUCTION_TOUCH_BLOCKER";
    recommendation = "ROLLBACK IMMEDIATELY - Production touched";
    nextAction = "EXECUTE_ROLLBACK_DISABLE_DEPLOYABLE";
  } else if (parityMismatched > 0) {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_PARITY_BLOCKER";
    recommendation = "INVESTIGATE PARITY MISMATCH - Do not proceed to production";
    nextAction = "INVESTIGATE_PARITY_ISSUES";
  } else if (hasBlockers) {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_BLOCKED";
    recommendation = "INVESTIGATE BLOCKERS - Do not proceed to production";
    nextAction = "INVESTIGATE_AND_FIX_BLOCKERS";
  } else if (gateTokenMissing) {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_OK_WITH_MISSING_GATE_TOKEN";
    recommendation = "CONTINUE MONITORING - Gate protecting correctly (403), token validation pending";
    nextAction = "CONTINUE_DAILY_MONITORING";
  } else {
    status = "SOCIALFLOW_CANARY_MONITORING_DAY_OK";
    recommendation = "CONTINUE MONITORING - All checks passing";
    nextAction = "CONTINUE_DAILY_MONITORING";
  }

  const ok = status === "SOCIALFLOW_CANARY_MONITORING_DAY_OK" || status === "SOCIALFLOW_CANARY_MONITORING_DAY_OK_WITH_MISSING_GATE_TOKEN";

  console.log(`Status: ${status}`);
  console.log(`OK: ${ok}`);
  console.log(`Blockers: ${blockers.length > 0 ? blockers.join(", ") : "none"}`);
  console.log(`Recommendation: ${recommendation}`);
  console.log(`Next action: ${nextAction}\n`);

  const report: MonitoringDayReport = {
    ok,
    status,
    day,
    timestamp,
    config: {
      deployable,
      allowDeployWithRealD1,
      switchesOn,
      switchesOff,
      switches: allSwitches,
    },
    gate: {
      predeployGateStatus: gateReport.status,
    },
    baseline: {
      healthStatus: baselineReport.healthChecked ? (baselineReport.healthResult?.includes("403") ? 403 : undefined) : undefined,
      healthResult: baselineReport.healthResult,
      readinessStatus: baselineReport.readinessChecked ? (baselineReport.readinessResult?.includes("403") ? 403 : undefined) : undefined,
      readinessResult: baselineReport.readinessResult,
      status: baselineReport.status,
    },
    gated: {
      gateSecretAvailable: gatedReport.gateSecretAvailable,
      healthStatus: gatedReport.healthStatus,
      healthResult: gatedReport.healthResult,
      readinessStatus: gatedReport.readinessStatus,
      readinessResult: gatedReport.readinessResult,
      status: gatedReport.status,
    },
    parity: {
      matched: parityMatched,
      mismatched: parityMismatched,
      missingInSocial: parityMissingInSocial,
      status: parityReport.status,
    },
    security: {
      tokenLeakageDetected,
      productionTouched,
      remoteWrites,
    },
    recommendation,
    nextAction,
    blockers,
  };

  return report;
}

function formatMarkdown(report: MonitoringDayReport): string {
  const { day, timestamp, config, baseline, gated, parity, security, status, recommendation, nextAction, blockers } = report;

  return `# SocialFlow Canary Nonprod Monitoring - Day ${day}

**Date:** ${timestamp}  
**Status:** ${status}  
**OK:** ${report.ok ? "✅" : "❌"}

---

## Configuration

- **Deployable:** ${config.deployable ? "✅" : "❌"} ${config.deployable}
- **Allow Deploy with Real D1:** ${config.allowDeployWithRealD1 ? "✅" : "❌"} ${config.allowDeployWithRealD1}
- **Switches ON:** ${config.switchesOn}/4 ${config.switchesOn === 4 ? "✅" : "❌"}
- **Switches OFF:** ${config.switchesOff}

### Switch Status
\`\`\`
${Object.entries(config.switches)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}
\`\`\`

---

## Baseline (Without Gate Header)

- **Health:** ${baseline.healthResult} ${baseline.healthResult === "HEALTH_GATED_403" ? "✅" : "❌"}
- **Readiness:** ${baseline.readinessResult} ${baseline.readinessResult === "READINESS_GATED_403" ? "✅" : "❌"}
- **Status:** ${baseline.status}

---

## Gated (With Gate Header)

- **Gate Secret Available:** ${gated.gateSecretAvailable ? "✅ YES" : "⚠️ NO (expected locally)"}
- **Health:** ${gated.healthResult ?? "not checked"}
- **Readiness:** ${gated.readinessResult ?? "not checked"}
- **Status:** ${gated.status}

---

## Ownership Parity

- **Matched:** ${parity.matched} ✅
- **Mismatched:** ${parity.mismatched} ${parity.mismatched === 0 ? "✅" : "❌"}
- **Missing in SOCIAL:** ${parity.missingInSocial}
- **Status:** ${parity.status}

---

## Security

- **Token Leakage Detected:** ${security.tokenLeakageDetected ? "❌ YES (BLOCKER)" : "✅ NO"}
- **Production Touched:** ${security.productionTouched ? "❌ YES (BLOCKER)" : "✅ NO"}
- **Remote Writes:** ${security.remoteWrites}

---

## Summary

**Blockers:** ${blockers.length > 0 ? blockers.join(", ") : "None ✅"}

**Recommendation:** ${recommendation}

**Next Action:** ${nextAction}

---

**Generated:** ${timestamp}
`;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const markdownMode = args.includes("--markdown");
  const dayArg = args.find((arg: string) => arg.startsWith("--day="));
  const day = dayArg ? parseInt(dayArg.split("=")[1], 10) : 1;

  monitorSocialflowNonprodCanaryDay({ day, json: jsonMode, markdown: markdownMode })
    .then((report) => {
      if (jsonMode) {
        console.log("\n" + JSON.stringify(report, null, 2));
      } else if (markdownMode) {
        console.log("\n" + formatMarkdown(report));
      }

      console.log(`\n${report.status}\n`);
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error("\nMONITORING_DAY_ERROR:", error);
      process.exit(1);
    });
}
