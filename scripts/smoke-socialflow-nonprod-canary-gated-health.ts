interface GatedHealthOptions {
  json?: boolean;
}

interface GatedHealthReport {
  ok: boolean;
  status: string;
  timestamp: string;
  healthUrl: string;
  readinessUrl: string;
  healthChecked: boolean;
  readinessChecked: boolean;
  healthResult?: string;
  readinessResult?: string;
  healthStatus?: number;
  readinessStatus?: number;
  productionTouched: boolean;
  tokenLeakageDetected: boolean;
  gateSecretAvailable: boolean;
  rollbackCommands: string[];
  errors?: string[];
  nextAction: string;
}

const HEALTH_URL = "https://socialflow-canary.drako.systems/api/socialflow/runtime/health";
const READINESS_URL = "https://socialflow-canary.drako.systems/api/socialflow/runtime/readiness";
const CANARY_GATE_HEADER = "x-socialflow-canary-gate";

const ROLLBACK_COMMANDS = [
  'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
  'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
  "Re-deploy with rollback config",
];

function getGateSecret(): string | null {
  if (typeof process === "undefined" || !process.env) {
    return null;
  }

  const secret = process.env.SOCIALFLOW_CANARY_GATE_TOKEN?.trim();
  return secret && secret.length > 0 ? secret : null;
}

function detectTokenLeakage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("access_token")
    || lower.includes("refresh_token")
    || lower.includes("encrypted_access_token")
    || lower.includes("encrypted_refresh_token")
    || lower.includes("socialflow_canary_gate_token")
  );
}

export async function smokeSocialflowNonprodCanaryGatedHealth(
  options: GatedHealthOptions = {},
): Promise<GatedHealthReport> {
  const errors: string[] = [];
  let healthChecked = false;
  let readinessChecked = false;
  let healthResult: string | undefined;
  let readinessResult: string | undefined;
  let healthStatus: number | undefined;
  let readinessStatus: number | undefined;
  let tokenLeakageDetected = false;

  const gateSecret = getGateSecret();
  const gateSecretAvailable = gateSecret !== null;

  if (!gateSecretAvailable) {
    console.log("\n⚠️  SOCIALFLOW_CANARY_GATE_TOKEN not available in environment\n");
    console.log("This script requires the canary gate secret to validate gated endpoints.");
    console.log("Set SOCIALFLOW_CANARY_GATE_TOKEN environment variable and retry.\n");

    return {
      ok: false,
      status: "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET",
      timestamp: new Date().toISOString(),
      healthUrl: HEALTH_URL,
      readinessUrl: READINESS_URL,
      healthChecked: false,
      readinessChecked: false,
      productionTouched: false,
      tokenLeakageDetected: false,
      gateSecretAvailable: false,
      rollbackCommands: ROLLBACK_COMMANDS,
      errors: ["MISSING_GATE_SECRET"],
      nextAction: "SET_SOCIALFLOW_CANARY_GATE_TOKEN_AND_RETRY",
    };
  }

  try {
    console.log(`\n🔍 GATED HEALTH SMOKE: Health Check\n`);
    console.log(`URL: ${HEALTH_URL}`);
    console.log(`Header: ${CANARY_GATE_HEADER} (secret provided, not printed)\n`);

    const healthResponse = await fetch(HEALTH_URL, {
      headers: {
        [CANARY_GATE_HEADER]: gateSecret,
        "User-Agent": "Drako-SocialFlow-Gated-Health-Smoke/1.0",
      },
    });

    healthChecked = true;
    healthStatus = healthResponse.status;
    const healthText = await healthResponse.text();

    if (detectTokenLeakage(healthText)) {
      tokenLeakageDetected = true;
      errors.push("TOKEN_LEAKAGE_DETECTED_IN_HEALTH");
      console.log("❌ Token leakage detected in health response");
    }

    if (healthResponse.status === 200) {
      healthResult = "HEALTH_OK_WITH_GATE";
      console.log("✅ Health check with gate: 200 OK");
      try {
        const healthJson = JSON.parse(healthText);
        console.log(`   Health data: ${JSON.stringify(healthJson)}`);
      } catch {
        console.log("   Health response is not JSON");
      }
    } else if (healthResponse.status === 403) {
      healthResult = "HEALTH_GATE_REJECTED_403";
      errors.push("HEALTH_CHECK_GATE_REJECTED:403");
      console.log("❌ Health check with gate: 403 (gate rejected - invalid token?)");
    } else {
      healthResult = `HEALTH_FAIL_${healthResponse.status}`;
      errors.push(`HEALTH_CHECK_FAILED:${healthResponse.status}`);
      console.log(`❌ Health check with gate: ${healthResponse.status}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    healthResult = "HEALTH_ERROR";
    errors.push(`HEALTH_CHECK_ERROR:${errorMessage}`);
    console.log(`❌ Health check error: ${errorMessage}`);
  }

  try {
    console.log(`\n🔍 GATED HEALTH SMOKE: Readiness Check\n`);
    console.log(`URL: ${READINESS_URL}`);
    console.log(`Header: ${CANARY_GATE_HEADER} (secret provided, not printed)\n`);

    const readinessResponse = await fetch(READINESS_URL, {
      headers: {
        [CANARY_GATE_HEADER]: gateSecret,
        "User-Agent": "Drako-SocialFlow-Gated-Health-Smoke/1.0",
      },
    });

    readinessChecked = true;
    readinessStatus = readinessResponse.status;
    const readinessText = await readinessResponse.text();

    if (detectTokenLeakage(readinessText)) {
      tokenLeakageDetected = true;
      errors.push("TOKEN_LEAKAGE_DETECTED_IN_READINESS");
      console.log("❌ Token leakage detected in readiness response");
    }

    if (readinessResponse.status === 200) {
      readinessResult = "READINESS_OK_WITH_GATE";
      console.log("✅ Readiness check with gate: 200 OK");
      try {
        const readinessJson = JSON.parse(readinessText);
        console.log(`   Readiness data: ${JSON.stringify(readinessJson)}`);
      } catch {
        console.log("   Readiness response is not JSON");
      }
    } else if (readinessResponse.status === 403) {
      readinessResult = "READINESS_GATE_REJECTED_403";
      errors.push("READINESS_CHECK_GATE_REJECTED:403");
      console.log("❌ Readiness check with gate: 403 (gate rejected - invalid token?)");
    } else {
      readinessResult = `READINESS_FAIL_${readinessResponse.status}`;
      errors.push(`READINESS_CHECK_FAILED:${readinessResponse.status}`);
      console.log(`❌ Readiness check with gate: ${readinessResponse.status}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    readinessResult = "READINESS_ERROR";
    errors.push(`READINESS_CHECK_ERROR:${errorMessage}`);
    console.log(`❌ Readiness check error: ${errorMessage}`);
  }

  const allOk = healthResult === "HEALTH_OK_WITH_GATE" && readinessResult === "READINESS_OK_WITH_GATE";
  const ok = gateSecretAvailable && !tokenLeakageDetected && allOk;

  let status: string;
  if (tokenLeakageDetected) {
    status = "SOCIALFLOW_CANARY_GATED_HEALTH_TOKEN_LEAKAGE_BLOCKER";
  } else if (!gateSecretAvailable) {
    status = "SOCIALFLOW_CANARY_GATED_HEALTH_MISSING_GATE_SECRET";
  } else if (healthResult === "HEALTH_GATE_REJECTED_403" || readinessResult === "READINESS_GATE_REJECTED_403") {
    status = "SOCIALFLOW_CANARY_GATED_HEALTH_UNAUTHORIZED";
  } else if (allOk) {
    status = "SOCIALFLOW_CANARY_GATED_HEALTH_OK";
  } else {
    status = "SOCIALFLOW_CANARY_GATED_HEALTH_ENDPOINT_FAILED";
  }

  let nextAction: string;
  if (tokenLeakageDetected) {
    nextAction = "ROLLBACK_IMMEDIATELY_TOKEN_LEAKAGE";
  } else if (!gateSecretAvailable) {
    nextAction = "SET_SOCIALFLOW_CANARY_GATE_TOKEN_AND_RETRY";
  } else if (healthResult === "HEALTH_GATE_REJECTED_403" || readinessResult === "READINESS_GATE_REJECTED_403") {
    nextAction = "VERIFY_GATE_TOKEN_CORRECTNESS";
  } else if (allOk) {
    nextAction = "MONITOR_CANARY_HEALTH_GATED_ENDPOINTS_OPERATIONAL";
  } else {
    nextAction = "INVESTIGATE_ENDPOINT_FAILURES";
  }

  return {
    ok,
    status,
    timestamp: new Date().toISOString(),
    healthUrl: HEALTH_URL,
    readinessUrl: READINESS_URL,
    healthChecked,
    readinessChecked,
    healthResult,
    readinessResult,
    healthStatus,
    readinessStatus,
    productionTouched: false,
    tokenLeakageDetected,
    gateSecretAvailable,
    rollbackCommands: ROLLBACK_COMMANDS,
    errors: errors.length > 0 ? errors : undefined,
    nextAction,
  };
}

if (require.main === module) {
  const jsonMode = process.argv.includes("--json");

  smokeSocialflowNonprodCanaryGatedHealth({ json: jsonMode })
    .then((report) => {
      if (jsonMode) {
        console.log("\n" + JSON.stringify(report, null, 2));
      }
      console.log(`\n${report.status}\n`);
      process.exit(report.ok ? 0 : 1);
    })
    .catch((error) => {
      console.error("\nGATED_HEALTH_SMOKE_ERROR:", error);
      process.exit(1);
    });
}
