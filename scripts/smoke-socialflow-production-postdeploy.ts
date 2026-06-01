interface SmokeSocialflowProductionPostdeployOptions {
  json?: boolean;
  markdown?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type SmokeSocialflowProductionPostdeployStatus =
  | "SOCIALFLOW_PRODUCTION_POSTDEPLOY_OK"
  | "SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED"
  | "SOCIALFLOW_PRODUCTION_POSTDEPLOY_FAILED"
  | "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";

interface EndpointSmokeResult {
  endpoint: string;
  httpStatus?: number;
  ok: boolean;
  tokenLeakageDetected: boolean;
  error?: string;
}

interface SmokeSocialflowProductionPostdeployReport {
  ok: boolean;
  status: SmokeSocialflowProductionPostdeployStatus;
  timestamp: string;
  productionRouteConfigured: boolean;
  productionBaseUrl: string | null;
  productionTouched: boolean;
  remoteWrites: number;
  tokenLeakageDetected: boolean;
  health: EndpointSmokeResult;
  readiness: EndpointSmokeResult;
  requiresHumanApproval: true;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  nextAction: string;
  errors?: string[];
}

const PRODUCTION_BASE_URL_KEYS = [
  "SOCIALFLOW_PRODUCTION_BASE_URL",
  "SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL",
] as const;
const HEALTH_ENDPOINT_PATH = "/api/socialflow/runtime/health";
const READINESS_ENDPOINT_PATH = "/api/socialflow/runtime/readiness";
const USER_AGENT = "Drako-SocialFlow-Production-Postdeploy-Smoke/1.0";
const TOKEN_LEAKAGE_PATTERNS = [
  /\baccess_token\b/i,
  /\brefresh_token\b/i,
  /\bencrypted_access_token\b/i,
  /\bencrypted_refresh_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
];

function resolveProductionBaseUrl(explicitBaseUrl?: string): string | null {
  if (explicitBaseUrl && explicitBaseUrl.trim().length > 0) {
    return explicitBaseUrl.trim().replace(/\/+$/, "");
  }

  for (const key of PRODUCTION_BASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value.replace(/\/+$/, "");
    }
  }

  return null;
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = "";
    parsed.password = "";
    if (parsed.search) {
      parsed.search = "?REDACTED_QUERY";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "[INVALID_URL_REDACTED]";
  }
}

function detectTokenLeakage(payload: string): boolean {
  return TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(payload));
}

async function safeReadOnlyCheck(
  fetchImpl: typeof fetch,
  endpoint: string,
): Promise<EndpointSmokeResult> {
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
    const body = await response.text();
    const tokenLeakageDetected = detectTokenLeakage(body);
    return {
      endpoint: sanitizeUrl(endpoint),
      httpStatus: response.status,
      ok: response.ok && !tokenLeakageDetected,
      tokenLeakageDetected,
    };
  } catch (error) {
    return {
      endpoint: sanitizeUrl(endpoint),
      ok: false,
      tokenLeakageDetected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printNormal(report: SmokeSocialflowProductionPostdeployReport): void {
  console.log("\nSOCIALFLOW PRODUCTION POSTDEPLOY SMOKE");
  console.log(`Status: ${report.status}`);
  console.log(`Production Route Configured: ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`Production Touched: ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`Remote Writes: ${report.remoteWrites}`);
  console.log(`Token Leakage Detected: ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`Health Check: ${report.health.ok ? "OK" : "FAILED"} (${report.health.endpoint})`);
  if (report.health.httpStatus !== undefined) {
    console.log(`Health HTTP Status: ${report.health.httpStatus}`);
  }
  console.log(`Readiness Check: ${report.readiness.ok ? "OK" : "FAILED"} (${report.readiness.endpoint})`);
  if (report.readiness.httpStatus !== undefined) {
    console.log(`Readiness HTTP Status: ${report.readiness.httpStatus}`);
  }
  if (report.errors && report.errors.length > 0) {
    console.log(`Errors: ${report.errors.join(", ")}`);
  }
  console.log(`Next Action: ${report.nextAction}\n`);
  console.log(report.status);
}

function printMarkdown(report: SmokeSocialflowProductionPostdeployReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION POSTDEPLOY SMOKE\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Production Route Configured:** ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`**Production Touched:** ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`**Remote Writes:** ${report.remoteWrites}`);
  console.log(`**Token Leakage Detected:** ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`- Health: ${report.health.ok ? "OK" : "FAILED"} (${report.health.endpoint})`);
  if (report.health.httpStatus !== undefined) {
    console.log(`  - HTTP Status: ${report.health.httpStatus}`);
  }
  console.log(`- Readiness: ${report.readiness.ok ? "OK" : "FAILED"} (${report.readiness.endpoint})`);
  if (report.readiness.httpStatus !== undefined) {
    console.log(`  - HTTP Status: ${report.readiness.httpStatus}`);
  }
  if (report.errors && report.errors.length > 0) {
    console.log(`**Errors:** ${report.errors.join(", ")}`);
  }
  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(report.status);
}

export async function smokeSocialflowProductionPostdeploy(
  options: SmokeSocialflowProductionPostdeployOptions = {},
): Promise<SmokeSocialflowProductionPostdeployReport> {
  const errors: string[] = [];
  const productionBaseUrl = resolveProductionBaseUrl(options.baseUrl);
  const timestamp = new Date().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!productionBaseUrl) {
    const blockedEndpointResult: EndpointSmokeResult = {
      endpoint: "[ROUTE_NOT_CONFIGURED]",
      ok: false,
      tokenLeakageDetected: false,
      error: "PRODUCTION_ROUTE_NOT_CONFIGURED",
    };

    const blockedReport: SmokeSocialflowProductionPostdeployReport = {
      ok: false,
      status: "SOCIALFLOW_PRODUCTION_POSTDEPLOY_BLOCKED_UNTIL_ROUTE_CONFIGURED",
      timestamp,
      productionRouteConfigured: false,
      productionBaseUrl: null,
      productionTouched: false,
      remoteWrites: 0,
      tokenLeakageDetected: false,
      health: blockedEndpointResult,
      readiness: blockedEndpointResult,
      requiresHumanApproval: true,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      nextAction: "SET_SOCIALFLOW_PRODUCTION_BASE_URL_AND_RETRY",
      errors: ["PRODUCTION_ROUTE_NOT_CONFIGURED"],
    };

    if (options.json) {
      console.log(JSON.stringify(blockedReport, null, 2));
      console.log(`\n${blockedReport.status}`);
    } else if (options.markdown) {
      printMarkdown(blockedReport);
    } else {
      printNormal(blockedReport);
    }

    return blockedReport;
  }

  const healthResult = await safeReadOnlyCheck(fetchImpl, `${productionBaseUrl}${HEALTH_ENDPOINT_PATH}`);
  const readinessResult = await safeReadOnlyCheck(fetchImpl, `${productionBaseUrl}${READINESS_ENDPOINT_PATH}`);

  if (healthResult.error) {
    errors.push(`HEALTH_REQUEST_ERROR:${healthResult.error}`);
  }
  if (readinessResult.error) {
    errors.push(`READINESS_REQUEST_ERROR:${readinessResult.error}`);
  }

  const tokenLeakageDetected = healthResult.tokenLeakageDetected || readinessResult.tokenLeakageDetected;
  if (tokenLeakageDetected) {
    errors.push("TOKEN_LEAKAGE_DETECTED");
  }

  const checksOk = healthResult.ok && readinessResult.ok;
  const ok = checksOk && !tokenLeakageDetected;
  const status: SmokeSocialflowProductionPostdeployStatus = tokenLeakageDetected
    ? "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER"
    : ok
    ? "SOCIALFLOW_PRODUCTION_POSTDEPLOY_OK"
    : "SOCIALFLOW_PRODUCTION_POSTDEPLOY_FAILED";

  const report: SmokeSocialflowProductionPostdeployReport = {
    ok,
    status,
    timestamp,
    productionRouteConfigured: true,
    productionBaseUrl: sanitizeUrl(productionBaseUrl),
    productionTouched: true,
    remoteWrites: 0,
    tokenLeakageDetected,
    health: healthResult,
    readiness: readinessResult,
    requiresHumanApproval: true,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    nextAction: ok
      ? "KEEP_PRODUCTION_EXECUTION_BLOCKED_UNTIL_HUMAN_APPROVAL"
      : tokenLeakageDetected
      ? "STOP_AND_INVESTIGATE_TOKEN_LEAKAGE"
      : "INVESTIGATE_PRODUCTION_POSTDEPLOY_ENDPOINTS",
    errors: errors.length > 0 ? errors : undefined,
  };

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

  smokeSocialflowProductionPostdeploy({ json, markdown })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_POSTDEPLOY_FAILED"
        || report.status === "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_POSTDEPLOY_SMOKE_ERROR", error);
      process.exit(1);
    });
}
