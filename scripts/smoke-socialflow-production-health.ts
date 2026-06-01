interface SmokeSocialflowProductionHealthOptions {
  json?: boolean;
  markdown?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type SmokeSocialflowProductionHealthStatus =
  | "SOCIALFLOW_PRODUCTION_HEALTH_OK"
  | "SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED"
  | "SOCIALFLOW_PRODUCTION_HEALTH_FAILED"
  | "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";

interface SmokeSocialflowProductionHealthReport {
  ok: boolean;
  status: SmokeSocialflowProductionHealthStatus;
  timestamp: string;
  productionRouteConfigured: boolean;
  productionBaseUrl: string | null;
  endpoint: string | null;
  productionTouched: boolean;
  remoteWrites: number;
  tokenLeakageDetected: boolean;
  httpStatus?: number;
  result: string;
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
const USER_AGENT = "Drako-SocialFlow-Production-Health-Smoke/1.0";
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

function printNormal(report: SmokeSocialflowProductionHealthReport): void {
  console.log("\nSOCIALFLOW PRODUCTION HEALTH SMOKE");
  console.log(`Status: ${report.status}`);
  console.log(`Production Route Configured: ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`Production Touched: ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`Remote Writes: ${report.remoteWrites}`);
  console.log(`Token Leakage Detected: ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  if (report.endpoint) {
    console.log(`Endpoint: ${report.endpoint}`);
  }
  if (report.httpStatus !== undefined) {
    console.log(`HTTP Status: ${report.httpStatus}`);
  }
  if (report.errors && report.errors.length > 0) {
    console.log(`Errors: ${report.errors.join(", ")}`);
  }
  console.log(`Result: ${report.result}`);
  console.log(`Next Action: ${report.nextAction}\n`);
  console.log(report.status);
}

function printMarkdown(report: SmokeSocialflowProductionHealthReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION HEALTH SMOKE\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Production Route Configured:** ${report.productionRouteConfigured ? "YES" : "NO"}`);
  console.log(`**Production Touched:** ${report.productionTouched ? "YES" : "NO"}`);
  console.log(`**Remote Writes:** ${report.remoteWrites}`);
  console.log(`**Token Leakage Detected:** ${report.tokenLeakageDetected ? "YES" : "NO"}`);
  if (report.endpoint) {
    console.log(`**Endpoint:** ${report.endpoint}`);
  }
  if (report.httpStatus !== undefined) {
    console.log(`**HTTP Status:** ${report.httpStatus}`);
  }
  if (report.errors && report.errors.length > 0) {
    console.log(`**Errors:** ${report.errors.join(", ")}`);
  }
  console.log(`**Result:** ${report.result}`);
  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(report.status);
}

export async function smokeSocialflowProductionHealth(
  options: SmokeSocialflowProductionHealthOptions = {},
): Promise<SmokeSocialflowProductionHealthReport> {
  const errors: string[] = [];
  const productionBaseUrl = resolveProductionBaseUrl(options.baseUrl);
  const timestamp = new Date().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!productionBaseUrl) {
    const blockedReport: SmokeSocialflowProductionHealthReport = {
      ok: false,
      status: "SOCIALFLOW_PRODUCTION_HEALTH_BLOCKED_UNTIL_ROUTE_CONFIGURED",
      timestamp,
      productionRouteConfigured: false,
      productionBaseUrl: null,
      endpoint: null,
      productionTouched: false,
      remoteWrites: 0,
      tokenLeakageDetected: false,
      result: "PRODUCTION_ROUTE_NOT_CONFIGURED",
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

  const endpoint = sanitizeUrl(`${productionBaseUrl}${HEALTH_ENDPOINT_PATH}`);
  let tokenLeakageDetected = false;
  let httpStatus: number | undefined;

  try {
    const response = await fetchImpl(`${productionBaseUrl}${HEALTH_ENDPOINT_PATH}`, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    httpStatus = response.status;
    const body = await response.text();
    tokenLeakageDetected = detectTokenLeakage(body);

    if (tokenLeakageDetected) {
      errors.push("TOKEN_LEAKAGE_DETECTED");
    }

    const ok = response.ok && !tokenLeakageDetected;
    const status: SmokeSocialflowProductionHealthStatus = tokenLeakageDetected
      ? "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER"
      : ok
      ? "SOCIALFLOW_PRODUCTION_HEALTH_OK"
      : "SOCIALFLOW_PRODUCTION_HEALTH_FAILED";

    const report: SmokeSocialflowProductionHealthReport = {
      ok,
      status,
      timestamp,
      productionRouteConfigured: true,
      productionBaseUrl: sanitizeUrl(productionBaseUrl),
      endpoint,
      productionTouched: true,
      remoteWrites: 0,
      tokenLeakageDetected,
      httpStatus,
      result: ok ? "HEALTH_ENDPOINT_OK" : `HEALTH_ENDPOINT_FAILED_${response.status}`,
      requiresHumanApproval: true,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      nextAction: ok
        ? "KEEP_PRODUCTION_EXECUTION_BLOCKED_UNTIL_HUMAN_APPROVAL"
        : tokenLeakageDetected
        ? "STOP_AND_INVESTIGATE_TOKEN_LEAKAGE"
        : "INVESTIGATE_PRODUCTION_HEALTH_ENDPOINT",
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
  } catch (error) {
    errors.push(`HEALTH_REQUEST_ERROR:${error instanceof Error ? error.message : String(error)}`);

    const report: SmokeSocialflowProductionHealthReport = {
      ok: false,
      status: "SOCIALFLOW_PRODUCTION_HEALTH_FAILED",
      timestamp,
      productionRouteConfigured: true,
      productionBaseUrl: sanitizeUrl(productionBaseUrl),
      endpoint,
      productionTouched: true,
      remoteWrites: 0,
      tokenLeakageDetected: false,
      result: "HEALTH_REQUEST_FAILED",
      requiresHumanApproval: true,
      readyForExecution: false,
      executionAllowed: false,
      commandsArePlannedOnly: true,
      nextAction: "VERIFY_PRODUCTION_ROUTE_AND_HEALTH_ENDPOINT",
      errors,
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
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  smokeSocialflowProductionHealth({ json, markdown })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_HEALTH_FAILED"
        || report.status === "SOCIALFLOW_PRODUCTION_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_HEALTH_SMOKE_ERROR", error);
      process.exit(1);
    });
}
