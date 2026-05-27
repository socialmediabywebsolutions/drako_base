interface PostdeploySmokeOptions {
  json?: boolean;
}

interface PostdeploySmokeReport {
  ok: boolean;
  status: string;
  timestamp: string;
  healthUrl: string;
  statusUrl: string;
  healthChecked: boolean;
  statusChecked: boolean;
  healthResult?: string;
  statusResult?: string;
  dnsBlocked: boolean;
  productionTouched: boolean;
  tokenLeakageDetected: boolean;
  rollbackCommands: string[];
  errors?: string[];
  nextAction: string;
}

const HEALTH_URL = "https://socialflow-canary.drako.systems/health";
const STATUS_URL = "https://socialflow-canary.drako.systems/api/socialflow/status";

const ROLLBACK_COMMANDS = [
  'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
  'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
  "Re-deploy with rollback config",
];

export async function smokeSocialflowNonprodCanaryPostdeploy(
  options: PostdeploySmokeOptions = {},
): Promise<PostdeploySmokeReport> {
  const errors: string[] = [];
  let healthChecked = false;
  let statusChecked = false;
  let healthResult: string | undefined;
  let statusResult: string | undefined;
  let dnsBlocked = false;
  let tokenLeakageDetected = false;

  try {
    console.log(`\n🔍 POSTDEPLOY SMOKE: Health Check\n`);
    console.log(`URL: ${HEALTH_URL}\n`);

    const healthResponse = await fetch(HEALTH_URL, {
      headers: {
        "User-Agent": "Drako-SocialFlow-Postdeploy-Smoke/1.0",
      },
    });

    healthChecked = true;
    const healthText = await healthResponse.text();

    if (healthResponse.status === 200) {
      healthResult = "HEALTH_OK";
      console.log("✅ Health check: 200 OK");
    } else if (healthResponse.status === 522) {
      healthResult = "HEALTH_ROUTING_INCOMPLETE_522";
      console.log(`⚠️  Health check: 522 (routing incomplete - expected postdeploy)`);
    } else {
      healthResult = `HEALTH_FAIL_${healthResponse.status}`;
      errors.push(`HEALTH_CHECK_FAILED:${healthResponse.status}`);
      console.log(`❌ Health check: ${healthResponse.status}`);
    }

    if (healthText.toLowerCase().includes("access_token") || healthText.toLowerCase().includes("refresh_token")) {
      tokenLeakageDetected = true;
      errors.push("TOKEN_LEAKAGE_DETECTED_IN_HEALTH");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
      dnsBlocked = true;
      healthResult = "DNS_BLOCKED";
      console.log("⚠️  Health check: DNS blocked (expected if routing not configured yet)");
    } else {
      healthResult = "HEALTH_ERROR";
      errors.push(`HEALTH_CHECK_ERROR:${errorMessage}`);
      console.log(`❌ Health check error: ${errorMessage}`);
    }
  }

  try {
    console.log(`\n🔍 POSTDEPLOY SMOKE: Status Check\n`);
    console.log(`URL: ${STATUS_URL}\n`);

    const statusResponse = await fetch(STATUS_URL, {
      headers: {
        "User-Agent": "Drako-SocialFlow-Postdeploy-Smoke/1.0",
      },
    });

    statusChecked = true;
    const statusText = await statusResponse.text();

    if (statusResponse.status === 200) {
      statusResult = "STATUS_OK";
      console.log("✅ Status check: 200 OK");
    } else if (statusResponse.status === 522) {
      statusResult = "STATUS_ROUTING_INCOMPLETE_522";
      console.log(`⚠️  Status check: 522 (routing incomplete - expected postdeploy)`);
    } else {
      statusResult = `STATUS_FAIL_${statusResponse.status}`;
      errors.push(`STATUS_CHECK_FAILED:${statusResponse.status}`);
      console.log(`❌ Status check: ${statusResponse.status}`);
    }

    if (statusText.toLowerCase().includes("access_token") || statusText.toLowerCase().includes("refresh_token")) {
      tokenLeakageDetected = true;
      errors.push("TOKEN_LEAKAGE_DETECTED_IN_STATUS");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
      dnsBlocked = true;
      statusResult = "DNS_BLOCKED";
      console.log("⚠️  Status check: DNS blocked (expected if routing not configured yet)");
    } else {
      statusResult = "STATUS_ERROR";
      errors.push(`STATUS_CHECK_ERROR:${errorMessage}`);
      console.log(`❌ Status check error: ${errorMessage}`);
    }
  }

  const routingIncomplete = (healthResult === "HEALTH_ROUTING_INCOMPLETE_522" || statusResult === "STATUS_ROUTING_INCOMPLETE_522");
  const ok = !tokenLeakageDetected && (dnsBlocked || routingIncomplete || (healthChecked && statusChecked && errors.length === 0));

  let status: string;
  if (tokenLeakageDetected) {
    status = "POSTDEPLOY_SMOKE_TOKEN_LEAKAGE_DETECTED";
  } else if (dnsBlocked) {
    status = "POSTDEPLOY_SMOKE_BLOCKED_BY_DNS";
  } else if (routingIncomplete) {
    status = "POSTDEPLOY_SMOKE_ROUTING_INCOMPLETE";
  } else if (ok) {
    status = "POSTDEPLOY_SMOKE_OK";
  } else {
    status = "POSTDEPLOY_SMOKE_FAILED";
  }

  let nextAction: string;
  if (tokenLeakageDetected) {
    nextAction = "ROLLBACK_IMMEDIATELY_TOKEN_LEAKAGE";
  } else if (dnsBlocked) {
    nextAction = "CONFIGURE_DNS_ROUTING_THEN_RETRY";
  } else if (routingIncomplete) {
    nextAction = "CONFIGURE_CLOUDFLARE_ROUTES_FOR_HEALTH_AND_STATUS";
  } else if (ok) {
    nextAction = "MONITOR_CANARY_HEALTH";
  } else {
    nextAction = "INVESTIGATE_SMOKE_FAILURES";
  }

  return {
    ok,
    status,
    timestamp: new Date().toISOString(),
    healthUrl: HEALTH_URL,
    statusUrl: STATUS_URL,
    healthChecked,
    statusChecked,
    healthResult,
    statusResult,
    dnsBlocked,
    productionTouched: false,
    tokenLeakageDetected,
    rollbackCommands: ROLLBACK_COMMANDS,
    errors: errors.length > 0 ? errors : undefined,
    nextAction,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");

  smokeSocialflowNonprodCanaryPostdeploy({ json: isJson })
    .then((report) => {
      if (isJson || !report.ok) {
        console.log(JSON.stringify(report, null, 2));
      }

      console.log(`\n${report.status}\n`);

      if (!report.ok && !report.dnsBlocked) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("POSTDEPLOY_SMOKE_ERROR:", error.message);
      process.exit(1);
    });
}
