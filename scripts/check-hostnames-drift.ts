import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SeverityLevel = "BLOCKER" | "WARN";
type CheckStatus = "PASS" | "FAIL" | "N/A";

type WorkersHostnameConfig = {
  meta: {
    updatedAt: string;
    owner: string;
    notes?: string;
  };
  criticalHostnames: Array<{
    hostname: string;
    expectedService: string;
  }>;
  criticalRoutes: Array<{
    pattern: string;
    expectedScript: string;
  }>;
  blockedMappings: {
    services: string[];
    scripts: string[];
  };
  severities: {
    hostnameMismatch: SeverityLevel;
    routeMismatch: SeverityLevel;
    blockedServiceHit: SeverityLevel;
    blockedScriptHit: SeverityLevel;
    unexpectedCriticalHostnameMissing: SeverityLevel;
    unexpectedCriticalRouteMissing: SeverityLevel;
  };
};

type WorkersDomainRecord = {
  hostname: string;
  service: string;
};

type WorkersRouteRecord = {
  pattern: string;
  script: string;
};

type HostnameCheckCode =
  | "hostnameMismatch"
  | "routeMismatch"
  | "blockedServiceHit"
  | "blockedScriptHit"
  | "unexpectedCriticalHostnameMissing"
  | "unexpectedCriticalRouteMissing";

type DriftCheckRecord = {
  checkCode: HostnameCheckCode;
  severity: SeverityLevel;
  targetType: "hostname" | "route" | "domain" | "route_global";
  targetName: string;
  status: CheckStatus;
  expected: unknown;
  actual: unknown;
  details: string;
};

type DriftViolationRecord = {
  checkCode: HostnameCheckCode;
  severity: SeverityLevel;
  targetType: DriftCheckRecord["targetType"];
  targetName: string;
  expected: unknown;
  actual: unknown;
  details: string;
};

type HostnamesDriftReport = {
  timestamp: string;
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  summary: {
    domainsTotal: number;
    routesTotal: number;
    checksTotal: number;
    checksPass: number;
    checksFail: number;
    checksNa: number;
    violationsTotal: number;
    blockersTotal: number;
    warningsTotal: number;
  };
  checks: DriftCheckRecord[];
  violations: DriftViolationRecord[];
  snapshots: {
    domains: WorkersDomainRecord[];
    routes: WorkersRouteRecord[];
  };
};

type DriftRunOptions = {
  sourceOfTruthPath?: string;
  fixturesDir?: string;
  writeReports?: boolean;
  reportJsonPath?: string;
  reportMarkdownPath?: string;
};

const DEFAULT_SOURCE_OF_TRUTH_PATH = "docs/config/workers-hostnames-expected-state.json";
const DEFAULT_REPORT_JSON_PATH = "docs/audits/hostnames-drift-latest.json";
const DEFAULT_REPORT_MARKDOWN_PATH = "docs/audits/hostnames-drift-latest.md";

function stripQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, "");
}

function resolveAbsolutePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return stripQuotes(value);
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeFileSafe(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

function validateConfig(config: WorkersHostnameConfig): void {
  if (!Array.isArray(config.criticalHostnames) || config.criticalHostnames.length === 0) {
    throw new Error("workers-hostnames-expected-state.json must include criticalHostnames.");
  }
  if (!Array.isArray(config.criticalRoutes)) {
    throw new Error("workers-hostnames-expected-state.json must include criticalRoutes.");
  }
  if (!config.blockedMappings || !Array.isArray(config.blockedMappings.services) || !Array.isArray(config.blockedMappings.scripts)) {
    throw new Error("workers-hostnames-expected-state.json must include blockedMappings.services/scripts arrays.");
  }
}

async function requestCloudflareApi<T>(params: {
  apiToken: string;
  pathName: string;
}): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${params.pathName}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json()) as { success?: boolean; result?: T; errors?: Array<{ code: number; message: string }> };
  if (!response.ok || payload.success === false) {
    const errorText = payload.errors?.map((item) => `${item.code}:${item.message}`).join(", ") || response.statusText;
    throw new Error(`Cloudflare API error for ${params.pathName}: ${errorText}`);
  }
  return payload.result as T;
}

function extractArrayPayloads<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "result" in value) {
    const wrapped = value as { result?: unknown; success?: boolean };
    if (wrapped.success === false) {
      throw new Error("Fixture payload has success=false.");
    }
    if (Array.isArray(wrapped.result)) {
      return wrapped.result as T[];
    }
  }
  return [];
}

function normalizeDomains(records: unknown[]): WorkersDomainRecord[] {
  return records
    .map((record) => record as Partial<WorkersDomainRecord>)
    .filter((record) => typeof record.hostname === "string" && typeof record.service === "string")
    .map((record) => ({ hostname: record.hostname!.toLowerCase(), service: record.service! }));
}

function normalizeRoutes(records: unknown[]): WorkersRouteRecord[] {
  return records
    .map((record) => record as Partial<WorkersRouteRecord>)
    .filter((record) => typeof record.pattern === "string" && typeof record.script === "string")
    .map((record) => ({ pattern: record.pattern!, script: record.script! }));
}

async function collectRealDatas(): Promise<{ domains: WorkersDomainRecord[]; routes: WorkersRouteRecord[] }> {
  const apiToken = readRequiredEnv("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = readRequiredEnv("CLOUDFLARE_ZONE_ID");

  const domains = await requestCloudflareApi<WorkersDomainRecord[]>({
    apiToken,
    pathName: `/accounts/${accountId}/workers/domains`,
  });
  const routes = await requestCloudflareApi<WorkersRouteRecord[]>({
    apiToken,
    pathName: `/zones/${zoneId}/workers/routes`,
  });

  return {
    domains: normalizeDomains(domains as unknown[]),
    routes: normalizeRoutes(routes as unknown[]),
  };
}

async function collectFixturesDatas(fixturesDir: string): Promise<{ domains: WorkersDomainRecord[]; routes: WorkersRouteRecord[] }> {
  const absoluteDir = resolveAbsolutePath(fixturesDir);
  const domainsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "domains.json"));
  const routesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "routes.json"));
  const domains = normalizeDomains(extractArrayPayloads<unknown>(domainsPayload));
  const routes = normalizeRoutes(extractArrayPayloads<unknown>(routesPayload));
  return { domains, routes };
}

function buildChecks(config: WorkersHostnameConfig, domains: WorkersDomainRecord[], routes: WorkersRouteRecord[]): DriftCheckRecord[] {
  const checks: DriftCheckRecord[] = [];
  const domainsByHostnames = new Map<string, WorkersDomainRecord>();
  for (const domain of domains) domainsByHostnames.set(domain.hostname.toLowerCase(), domain);

  for (const item of config.criticalHostnames) {
    const key = item.hostname.toLowerCase();
    const actualDomain = domainsByHostnames.get(key);
    const missingStatus: CheckStatus = actualDomain ? "PASS" : "FAIL";
    checks.push({
      checkCode: "unexpectedCriticalHostnameMissing",
      severity: config.severities.unexpectedCriticalHostnameMissing,
      targetType: "hostname",
      targetName: item.hostname,
      status: missingStatus,
      expected: "present",
      actual: actualDomain ? "present" : "missing",
      details: actualDomain
        ? `Critical hostname ${item.hostname} exists.`
        : `Critical hostname ${item.hostname} is missing from workers domains.`,
    });

    if (!actualDomain) {
      checks.push({
        checkCode: "hostnameMismatch",
        severity: config.severities.hostnameMismatch,
        targetType: "hostname",
        targetName: item.hostname,
        status: "N/A",
        expected: item.expectedService,
        actual: null,
        details: `Ownership check skipped because hostname ${item.hostname} is missing.`,
      });
      continue;
    }

    const ownershipStatus: CheckStatus = actualDomain.service === item.expectedService ? "PASS" : "FAIL";
    checks.push({
      checkCode: "hostnameMismatch",
      severity: config.severities.hostnameMismatch,
      targetType: "hostname",
      targetName: item.hostname,
      status: ownershipStatus,
      expected: item.expectedService,
      actual: actualDomain.service,
      details:
        ownershipStatus === "PASS"
          ? `Hostname ${item.hostname} points to expected service ${item.expectedService}.`
          : `Hostname ${item.hostname} points to unexpected service ${actualDomain.service}.`,
    });
  }

  for (const domain of domains) {
    const blocked = config.blockedMappings.services.includes(domain.service);
    checks.push({
      checkCode: "blockedServiceHit",
      severity: config.severities.blockedServiceHit,
      targetType: "domain",
      targetName: domain.hostname,
      status: blocked ? "FAIL" : "PASS",
      expected: `service NOT IN [${config.blockedMappings.services.join(", ")}]`,
      actual: domain.service,
      details: blocked
        ? `Blocked service ${domain.service} is assigned to domain ${domain.hostname}.`
        : `Domain ${domain.hostname} does not use blocked services.`,
    });
  }

  const routesByPatterns = new Map<string, WorkersRouteRecord>();
  for (const route of routes) routesByPatterns.set(route.pattern, route);

  for (const item of config.criticalRoutes) {
    const actualRoute = routesByPatterns.get(item.pattern);
    const missingStatus: CheckStatus = actualRoute ? "PASS" : "FAIL";
    checks.push({
      checkCode: "unexpectedCriticalRouteMissing",
      severity: config.severities.unexpectedCriticalRouteMissing,
      targetType: "route",
      targetName: item.pattern,
      status: missingStatus,
      expected: "present",
      actual: actualRoute ? "present" : "missing",
      details: actualRoute
        ? `Critical route ${item.pattern} exists.`
        : `Critical route ${item.pattern} is missing from workers routes.`,
    });

    if (!actualRoute) {
      checks.push({
        checkCode: "routeMismatch",
        severity: config.severities.routeMismatch,
        targetType: "route",
        targetName: item.pattern,
        status: "N/A",
        expected: item.expectedScript,
        actual: null,
        details: `Route ownership check skipped because route ${item.pattern} is missing.`,
      });
      continue;
    }

    const routeStatus: CheckStatus = actualRoute.script === item.expectedScript ? "PASS" : "FAIL";
    checks.push({
      checkCode: "routeMismatch",
      severity: config.severities.routeMismatch,
      targetType: "route",
      targetName: item.pattern,
      status: routeStatus,
      expected: item.expectedScript,
      actual: actualRoute.script,
      details:
        routeStatus === "PASS"
          ? `Route ${item.pattern} points to expected script ${item.expectedScript}.`
          : `Route ${item.pattern} points to unexpected script ${actualRoute.script}.`,
    });
  }

  for (const route of routes) {
    const blocked = config.blockedMappings.scripts.includes(route.script);
    checks.push({
      checkCode: "blockedScriptHit",
      severity: config.severities.blockedScriptHit,
      targetType: "route_global",
      targetName: route.pattern,
      status: blocked ? "FAIL" : "PASS",
      expected: `script NOT IN [${config.blockedMappings.scripts.join(", ")}]`,
      actual: route.script,
      details: blocked
        ? `Blocked script ${route.script} is assigned to route ${route.pattern}.`
        : `Route ${route.pattern} does not use blocked scripts.`,
    });
  }

  return checks;
}

function buildReports(params: {
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  domains: WorkersDomainRecord[];
  routes: WorkersRouteRecord[];
  checks: DriftCheckRecord[];
}): HostnamesDriftReport {
  const violations: DriftViolationRecord[] = params.checks
    .filter((item) => item.status === "FAIL")
    .map((item) => ({
      checkCode: item.checkCode,
      severity: item.severity,
      targetType: item.targetType,
      targetName: item.targetName,
      expected: item.expected,
      actual: item.actual,
      details: item.details,
    }));

  const checksPass = params.checks.filter((item) => item.status === "PASS").length;
  const checksFail = params.checks.filter((item) => item.status === "FAIL").length;
  const checksNa = params.checks.filter((item) => item.status === "N/A").length;
  const blockersTotal = violations.filter((item) => item.severity === "BLOCKER").length;
  const warningsTotal = violations.filter((item) => item.severity === "WARN").length;

  return {
    timestamp: new Date().toISOString(),
    mode: params.mode,
    sourceOfTruthPath: params.sourceOfTruthPath,
    fixturesDir: params.fixturesDir,
    summary: {
      domainsTotal: params.domains.length,
      routesTotal: params.routes.length,
      checksTotal: params.checks.length,
      checksPass,
      checksFail,
      checksNa,
      violationsTotal: violations.length,
      blockersTotal,
      warningsTotal,
    },
    checks: params.checks,
    violations,
    snapshots: {
      domains: params.domains,
      routes: params.routes,
    },
  };
}

function buildMarkdownReports(report: HostnamesDriftReport): string {
  const lines: string[] = [];
  lines.push("# Hostnames Drift Report");
  lines.push("");
  lines.push(`- Timestamp: \`${report.timestamp}\``);
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Source of truth: \`${report.sourceOfTruthPath}\``);
  lines.push(`- Fixtures dir: \`${report.fixturesDir ?? "n/a"}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Domains total: ${report.summary.domainsTotal}`);
  lines.push(`- Routes total: ${report.summary.routesTotal}`);
  lines.push(`- Checks total: ${report.summary.checksTotal}`);
  lines.push(`- Checks pass: ${report.summary.checksPass}`);
  lines.push(`- Checks fail: ${report.summary.checksFail}`);
  lines.push(`- Checks N/A: ${report.summary.checksNa}`);
  lines.push(`- Blockers: ${report.summary.blockersTotal}`);
  lines.push(`- Warnings: ${report.summary.warningsTotal}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Severity | Target Type | Target | Status | Expected | Actual |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(
      `| ${check.checkCode} | ${check.severity} | ${check.targetType} | ${check.targetName} | ${check.status} | ${JSON.stringify(check.expected)} | ${JSON.stringify(check.actual)} |`,
    );
  }
  lines.push("");
  lines.push("## Drift Matrix");
  lines.push("");
  lines.push("| Target | hostnameMissing | hostnameMismatch | routeMissing | routeMismatch | blockedService | blockedScript |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  const targets = Array.from(new Set(report.checks.map((item) => item.targetName)));
  for (const target of targets) {
    const read = (code: HostnameCheckCode) => {
      const check = report.checks.find((item) => item.targetName === target && item.checkCode === code);
      return check ? check.status : "N/A";
    };
    lines.push(
      `| ${target} | ${read("unexpectedCriticalHostnameMissing")} | ${read("hostnameMismatch")} | ${read("unexpectedCriticalRouteMissing")} | ${read("routeMismatch")} | ${read("blockedServiceHit")} | ${read("blockedScriptHit")} |`,
    );
  }
  lines.push("");
  lines.push("## Violations");
  lines.push("");
  if (report.violations.length === 0) {
    lines.push("- None");
  } else {
    for (const violation of report.violations) {
      lines.push(
        `- ${violation.severity} ${violation.checkCode} @ ${violation.targetName}: expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

async function writeReports(report: HostnamesDriftReport, reportJsonPath: string, reportMarkdownPath: string): Promise<void> {
  await writeFileSafe(resolveAbsolutePath(reportJsonPath), `${JSON.stringify(report, null, 2)}\n`);
  await writeFileSafe(resolveAbsolutePath(reportMarkdownPath), buildMarkdownReports(report));
}

function printBlockerMessages(report: HostnamesDriftReport): void {
  for (const violation of report.violations.filter((item) => item.severity === "BLOCKER")) {
    let title = "DRIFT DETECTED: ownership mismatch";
    if (violation.checkCode === "hostnameMismatch") title = "DRIFT DETECTED: hostname ownership mismatch";
    if (violation.checkCode === "routeMismatch") title = "DRIFT DETECTED: route ownership mismatch";
    if (violation.checkCode === "blockedServiceHit") title = "DRIFT DETECTED: blocked service mapping";
    if (violation.checkCode === "blockedScriptHit") title = "DRIFT DETECTED: blocked script mapping";
    if (violation.checkCode === "unexpectedCriticalHostnameMissing") title = "DRIFT DETECTED: critical hostname missing";
    console.error(title);
    console.error(`EXPECTED: ${JSON.stringify(violation.expected)}`);
    console.error(`ACTUAL: ${JSON.stringify(violation.actual)}`);
  }
}

export async function runHostnamesDriftChecks(options: DriftRunOptions = {}): Promise<{ exitCode: number; report: HostnamesDriftReport }> {
  const sourceOfTruthPath = options.sourceOfTruthPath ?? DEFAULT_SOURCE_OF_TRUTH_PATH;
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? "";
  const mode: "real" | "fixtures" = fixturesDir ? "fixtures" : "real";
  const writeReportsEnabled = options.writeReports ?? true;
  const reportJsonPath = options.reportJsonPath ?? DEFAULT_REPORT_JSON_PATH;
  const reportMarkdownPath = options.reportMarkdownPath ?? DEFAULT_REPORT_MARKDOWN_PATH;

  const config = await readJsonFile<WorkersHostnameConfig>(resolveAbsolutePath(sourceOfTruthPath));
  validateConfig(config);

  const datasets =
    mode === "fixtures" ? await collectFixturesDatas(fixturesDir) : await collectRealDatas();
  const checks = buildChecks(config, datasets.domains, datasets.routes);
  const report = buildReports({
    mode,
    sourceOfTruthPath,
    fixturesDir: mode === "fixtures" ? fixturesDir : null,
    domains: datasets.domains,
    routes: datasets.routes,
    checks,
  });

  if (writeReportsEnabled) {
    await writeReports(report, reportJsonPath, reportMarkdownPath);
  }

  printBlockerMessages(report);
  for (const violation of report.violations.filter((item) => item.severity === "WARN")) {
    console.warn(
      `WARN: ${violation.checkCode} @ ${violation.targetName} expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
    );
  }

  if (report.summary.blockersTotal > 0) {
    return { exitCode: 1, report };
  }

  console.log("Hostnames state consistent");
  return { exitCode: 0, report };
}

async function executeCli(): Promise<void> {
  try {
    const result = await runHostnamesDriftChecks();
    process.exit(result.exitCode);
  } catch (error) {
    const report: HostnamesDriftReport = {
      timestamp: new Date().toISOString(),
      mode: process.env.FIXTURES_DIR ? "fixtures" : "real",
      sourceOfTruthPath: DEFAULT_SOURCE_OF_TRUTH_PATH,
      fixturesDir: process.env.FIXTURES_DIR ?? null,
      summary: {
        domainsTotal: 0,
        routesTotal: 0,
        checksTotal: 1,
        checksPass: 0,
        checksFail: 1,
        checksNa: 0,
        violationsTotal: 1,
        blockersTotal: 1,
        warningsTotal: 0,
      },
      checks: [
        {
          checkCode: "hostnameMismatch",
          severity: "BLOCKER",
          targetType: "hostname",
          targetName: "global",
          status: "FAIL",
          expected: "successful hostnames drift execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in checker execution.",
        },
      ],
      violations: [
        {
          checkCode: "hostnameMismatch",
          severity: "BLOCKER",
          targetType: "hostname",
          targetName: "global",
          expected: "successful hostnames drift execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in checker execution.",
        },
      ],
      snapshots: {
        domains: [],
        routes: [],
      },
    };
    await writeReports(report, DEFAULT_REPORT_JSON_PATH, DEFAULT_REPORT_MARKDOWN_PATH);
    console.error("Hostnames drift check failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  executeCli();
}
