interface MonitorSocialflowProductionDayOptions {
  day?: number;
  json?: boolean;
  markdown?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type MonitorSocialflowProductionDayStatus =
  | "SOCIALFLOW_PRODUCTION_MONITOR_OK"
  | "SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED"
  | "SOCIALFLOW_PRODUCTION_MONITOR_FAILED"
  | "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";

interface MonitorEndpointResult {
  endpoint: string;
  httpStatus?: number;
  ok: boolean;
  tokenLeakageDetected: boolean;
  error?: string;
}

interface MonitorSocialflowProductionDayReport {
  ok: boolean;
  status: MonitorSocialflowProductionDayStatus;
  day: number;
  timestamp: string;
  productionRouteConfigured: boolean;
  productionBaseUrl: string | null;
  productionTouched: boolean;
  productionTouchedBySafeReadOnlyChecks: boolean;
  remoteWrites: number;
  tokenLeakageDetected: boolean;
  readyForCutover: false;
  requiresHumanApproval: true;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  health: MonitorEndpointResult;
  readiness: MonitorEndpointResult;
  nextAction: string;
  errors?: string[];
}

const PRODUCTION_BASE_URL_KEYS = [
  "SOCIALFLOW_PRODUCTION_BASE_URL",
  "SOCIALFLOW_PRODUCTION_RUNTIME_BASE_URL",
] as const;
const HEALTH_ENDPOINT_PATH = "/api/socialflow/runtime/health";
const READINESS_ENDPOINT_PATH = "/api/socialflow/runtime/readiness";
const USER_AGENT = "Drako-SocialFlow-Production-Monitor/1.0";
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
): Promise<MonitorEndpointResult> {
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

function printNormal(report: MonitorSocialflowProductionDayReport): void {
  console.log(`\nSOCIALFLOW PRODUCTION MONITOR - DAY ${report.day}`);
  console.log(`Status: ${report.status}`);
  console.log(`Production Route Configured: ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`Production Touched: ${report.productionTouched ? "YES" : "NO"}`);
  console.log(
    `Production Touched by Safe Read-Only Checks: ${report.productionTouchedBySafeReadOnlyChecks ? "YES" : "NO"}`,
  );
  console.log(`Remote Writes: ${report.remoteWrites}`);
  console.log(`Token Leakage Detected: ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`Ready for Cutover: ${report.readyForCutover ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
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

function printMarkdown(report: MonitorSocialflowProductionDayReport): void {
  console.log(`\n# SOCIALFLOW PRODUCTION MONITOR - DAY ${report.day}\n`);
  console.log(`**Status:** ${report.status}`);
  console.log(`**Production Route Configured:** ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`**Production Touched:** ${report.productionTouched ? "YES" : "NO"}`);
  console.log(
    `**Production Touched by Safe Read-Only Checks:** ${report.productionTouchedBySafeReadOnlyChecks ? "YES" : "NO"}`,
  );
  console.log(`**Remote Writes:** ${report.remoteWrites}`);
  console.log(`**Token Leakage Detected:** ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  console.log(`**Ready for Cutover:** ${report.readyForCutover ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
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

function createBlockedEndpointResult(): MonitorEndpointResult {
  return {
    endpoint: "[ROUTE_NOT_CONFIGURED]",
    ok: false,
    tokenLeakageDetected: false,
    error: "PRODUCTION_ROUTE_NOT_CONFIGURED",
  };
}

export async function monitorSocialflowProductionDay(
  options: MonitorSocialflowProductionDayOptions = {},
): Promise<MonitorSocialflowProductionDayReport> {
  const day = Number.isInteger(options.day) && (options.day ?? 0) > 0 ? (options.day as number) : 1;
  const errors: string[] = [];
  const productionBaseUrl = resolveProductionBaseUrl(options.baseUrl);
  const timestamp = new Date().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!productionBaseUrl) {
    const blockedEndpointResult = createBlockedEndpointResult();
    const blockedReport: MonitorSocialflowProductionDayReport = {
      ok: false,
      status: "SOCIALFLOW_PRODUCTION_MONITOR_BLOCKED_UNTIL_ROUTE_CONFIGURED",
      day,
      timestamp,
      productionRouteConfigured: false,
      productionBaseUrl: null,
      productionTouched: false,
      productionTouchedBySafeReadOnlyChecks: false,
      remoteWrites: 0,
      tokenLeakageDetected: false,
      readyForCutover: false,
      requiresHumanApproval: true,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      health: blockedEndpointResult,
      readiness: blockedEndpointResult,
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
  const status: MonitorSocialflowProductionDayStatus = tokenLeakageDetected
    ? "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER"
    : ok
    ? "SOCIALFLOW_PRODUCTION_MONITOR_OK"
    : "SOCIALFLOW_PRODUCTION_MONITOR_FAILED";

  const report: MonitorSocialflowProductionDayReport = {
    ok,
    status,
    day,
    timestamp,
    productionRouteConfigured: true,
    productionBaseUrl: sanitizeUrl(productionBaseUrl),
    productionTouched: true,
    productionTouchedBySafeReadOnlyChecks: true,
    remoteWrites: 0,
    tokenLeakageDetected,
    readyForCutover: false,
    requiresHumanApproval: true,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    health: healthResult,
    readiness: readinessResult,
    nextAction: ok
      ? "CONTINUE_MONITORING_AND_KEEP_EXECUTION_BLOCKED"
      : tokenLeakageDetected
      ? "STOP_AND_INVESTIGATE_TOKEN_LEAKAGE"
      : "INVESTIGATE_PRODUCTION_MONITOR_FAILURES",
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
  const dayArg = args.find((arg) => arg.startsWith("--day="));
  const parsedDay = dayArg ? Number.parseInt(dayArg.split("=")[1] ?? "1", 10) : 1;
  const day = Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : 1;

  monitorSocialflowProductionDay({ day, json, markdown })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_MONITOR_FAILED"
        || report.status === "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_MONITOR_ERROR", error);
      process.exit(1);
    });
}
