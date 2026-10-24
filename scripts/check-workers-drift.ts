import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SeverityLevel = "BLOCKER" | "WARN";
type WorkerStatus = "ARCHIVED" | "ACTIVE";

type CloudflareApiResponse<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
};

type WorkerExpectedState = {
  name: string;
  status: WorkerStatus;
  severity?: SeverityLevel;
  expected: {
    subdomain?: {
      enabled: boolean;
      previews_enabled: boolean;
    };
    schedulesCount?: number;
    domainsCount?: number;
    routesCount?: number;
  };
};

type WorkersExpectedStateConfig = {
  meta: {
    updatedAt: string;
    owner: string;
  };
  workers: WorkerExpectedState[];
};

type WorkerActualState = {
  subdomain: { enabled: boolean; previews_enabled: boolean } | null;
  schedulesCount: number;
  domainsCount: number;
  routesCount: number;
};

type CheckResult = {
  checkName: string;
  expected: unknown;
  actual: unknown;
  status: "PASS" | "FAIL" | "N/A";
};

type Violation = {
  workerName: string;
  workerStatus: WorkerStatus;
  severity: SeverityLevel;
  checkName: string;
  expected: unknown;
  actual: unknown;
};

type WorkerReport = {
  workerName: string;
  workerStatus: WorkerStatus;
  severity: SeverityLevel;
  expected: WorkerExpectedState["expected"];
  actual: WorkerActualState;
  checks: CheckResult[];
  hasFailures: boolean;
};

type DriftReport = {
  timestamp: string;
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  autoRemediation: {
    enabled: boolean;
    attempted: boolean;
    actions: string[];
    reranAfterRemediation: boolean;
  };
  summary: {
    workersTotal: number;
    workersWithFailures: number;
    checksTotal: number;
    checksFailed: number;
    violationsTotal: number;
    blockersTotal: number;
    warningsTotal: number;
  };
  workers: WorkerReport[];
  violations: Violation[];
};

type DriftRunOptions = {
  sourceOfTruthPath?: string;
  fixturesDir?: string;
  autoRemediateArchived?: boolean;
  writeReports?: boolean;
  reportJsonPath?: string;
  reportMarkdownPath?: string;
};

const DEFAULT_SOURCE_OF_TRUTH_PATH = "docs/config/workers-expected-state.json";
const DEFAULT_REPORT_JSON_PATH = "docs/audits/workers-drift-latest.json";
const DEFAULT_REPORT_MARKDOWN_PATH = "docs/audits/workers-drift-latest.md";

const MATRIX_CHECK_NAMES = [
  "subdomain.enabled",
  "subdomain.previews_enabled",
  "schedulesCount",
  "domainsCount",
  "routesCount",
] as const;

function stripQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, "");
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return stripQuotes(value);
}

function readOptionalBooleanEnv(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function resolvePath(projectPath: string): string {
  return path.resolve(process.cwd(), projectPath);
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

function extractApiResult<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "result" in payload) {
    const wrapped = payload as CloudflareApiResponse<T>;
    if (wrapped.success === false) {
      const errorMessage =
        wrapped.errors?.map((item) => `${item.code}:${item.message}`).join(", ") ?? "Unknown Cloudflare API error.";
      throw new Error(errorMessage);
    }
    return wrapped.result as T;
  }
  return payload as T;
}

async function writeFileSafe(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

function validateSourceOfTruth(config: WorkersExpectedStateConfig): void {
  if (!Array.isArray(config.workers) || config.workers.length === 0) {
    throw new Error("workers-expected-state.json must include at least one worker.");
  }
  for (const worker of config.workers) {
    if (!worker.name) throw new Error("Worker config is missing name.");
    if (worker.status !== "ARCHIVED" && worker.status !== "ACTIVE") {
      throw new Error(`Worker ${worker.name} has invalid status: ${worker.status}`);
    }
    if (!worker.expected || typeof worker.expected !== "object") {
      throw new Error(`Worker ${worker.name} is missing expected object.`);
    }
    if (worker.severity && worker.severity !== "BLOCKER" && worker.severity !== "WARN") {
      throw new Error(`Worker ${worker.name} has invalid severity: ${worker.severity}`);
    }
  }
}

async function requestCloudflareApi<T>(params: {
  method: "GET" | "POST" | "PUT";
  pathName: string;
  apiToken: string;
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${params.pathName}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      "content-type": "application/json",
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });
  const payload = (await response.json()) as CloudflareApiResponse<T>;
  if (!response.ok || payload.success === false) {
    const errorText = payload.errors?.map((item) => `${item.code}:${item.message}`).join(", ") || response.statusText;
    throw new Error(`Cloudflare API error for ${params.pathName}: ${errorText}`);
  }
  return payload.result as T;
}

async function collectRealStates(config: WorkersExpectedStateConfig): Promise<Record<string, WorkerActualState>> {
  const apiToken = readRequiredEnv("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = readRequiredEnv("CLOUDFLARE_ZONE_ID");

  const routes = await requestCloudflareApi<Array<{ script?: string }>>({
    method: "GET",
    pathName: `/zones/${zoneId}/workers/routes`,
    apiToken,
  });
  const domains = await requestCloudflareApi<Array<{ service?: string }>>({
    method: "GET",
    pathName: `/accounts/${accountId}/workers/domains`,
    apiToken,
  });

  const states: Record<string, WorkerActualState> = {};
  for (const worker of config.workers) {
    const subdomain = await requestCloudflareApi<{ enabled: boolean; previews_enabled: boolean }>({
      method: "GET",
      pathName: `/accounts/${accountId}/workers/scripts/${worker.name}/subdomain`,
      apiToken,
    });
    const schedules = await requestCloudflareApi<{ schedules?: Array<{ cron: string }> }>({
      method: "GET",
      pathName: `/accounts/${accountId}/workers/scripts/${worker.name}/schedules`,
      apiToken,
    });

    states[worker.name] = {
      subdomain: {
        enabled: Boolean(subdomain.enabled),
        previews_enabled: Boolean(subdomain.previews_enabled),
      },
      schedulesCount: (schedules.schedules ?? []).length,
      routesCount: routes.filter((item) => item.script === worker.name).length,
      domainsCount: domains.filter((item) => item.service === worker.name).length,
    };
  }
  return states;
}

async function collectFixtureStates(config: WorkersExpectedStateConfig, fixturesDir: string): Promise<Record<string, WorkerActualState>> {
  const absoluteFixturesDir = resolvePath(fixturesDir);

  const routesPayload = await readJsonFile<unknown>(path.join(absoluteFixturesDir, "routes.json"));
  const domainsPayload = await readJsonFile<unknown>(path.join(absoluteFixturesDir, "domains.json"));
  const routes = extractApiResult<Array<{ script?: string }>>(routesPayload) ?? [];
  const domains = extractApiResult<Array<{ service?: string }>>(domainsPayload) ?? [];

  const states: Record<string, WorkerActualState> = {};
  for (const worker of config.workers) {
    const subdomainPayload = await readJsonFile<unknown>(path.join(absoluteFixturesDir, `${worker.name}.subdomain.json`));
    const schedulesPayload = await readJsonFile<unknown>(path.join(absoluteFixturesDir, `${worker.name}.schedules.json`));

    const subdomain = extractApiResult<{ enabled: boolean; previews_enabled: boolean }>(subdomainPayload);
    const schedules = extractApiResult<{ schedules?: Array<{ cron: string }> }>(schedulesPayload);

    states[worker.name] = {
      subdomain: {
        enabled: Boolean(subdomain.enabled),
        previews_enabled: Boolean(subdomain.previews_enabled),
      },
      schedulesCount: (schedules.schedules ?? []).length,
      routesCount: routes.filter((item) => item.script === worker.name).length,
      domainsCount: domains.filter((item) => item.service === worker.name).length,
    };
  }
  return states;
}

function resolveWorkerSeverity(worker: WorkerExpectedState): SeverityLevel {
  if (worker.status === "ARCHIVED") return "BLOCKER";
  return worker.severity ?? "WARN";
}

function evaluateWorkersDrifts(config: WorkersExpectedStateConfig, actualStates: Record<string, WorkerActualState>): DriftReport {
  const violations: Violation[] = [];
  const workerReports: WorkerReport[] = [];

  for (const worker of config.workers) {
    const actual = actualStates[worker.name];
    if (!actual) {
      throw new Error(`Missing actual state for worker ${worker.name}`);
    }

    const checks: CheckResult[] = [];

    if (worker.expected.subdomain) {
      checks.push({
        checkName: "subdomain.enabled",
        expected: worker.expected.subdomain.enabled,
        actual: actual.subdomain?.enabled ?? null,
        status: actual.subdomain?.enabled === worker.expected.subdomain.enabled ? "PASS" : "FAIL",
      });
      checks.push({
        checkName: "subdomain.previews_enabled",
        expected: worker.expected.subdomain.previews_enabled,
        actual: actual.subdomain?.previews_enabled ?? null,
        status: actual.subdomain?.previews_enabled === worker.expected.subdomain.previews_enabled ? "PASS" : "FAIL",
      });
    }
    if (worker.expected.schedulesCount !== undefined) {
      checks.push({
        checkName: "schedulesCount",
        expected: worker.expected.schedulesCount,
        actual: actual.schedulesCount,
        status: actual.schedulesCount === worker.expected.schedulesCount ? "PASS" : "FAIL",
      });
    }
    if (worker.expected.domainsCount !== undefined) {
      checks.push({
        checkName: "domainsCount",
        expected: worker.expected.domainsCount,
        actual: actual.domainsCount,
        status: actual.domainsCount === worker.expected.domainsCount ? "PASS" : "FAIL",
      });
    }
    if (worker.expected.routesCount !== undefined) {
      checks.push({
        checkName: "routesCount",
        expected: worker.expected.routesCount,
        actual: actual.routesCount,
        status: actual.routesCount === worker.expected.routesCount ? "PASS" : "FAIL",
      });
    }

    const severity = resolveWorkerSeverity(worker);
    const hasFailures = checks.some((item) => item.status === "FAIL");
    if (hasFailures) {
      for (const failed of checks.filter((item) => item.status === "FAIL")) {
        violations.push({
          workerName: worker.name,
          workerStatus: worker.status,
          severity,
          checkName: failed.checkName,
          expected: failed.expected,
          actual: failed.actual,
        });
      }
    }

    workerReports.push({
      workerName: worker.name,
      workerStatus: worker.status,
      severity,
      expected: worker.expected,
      actual,
      checks,
      hasFailures,
    });
  }

  const checksTotal = workerReports.reduce((acc, worker) => acc + worker.checks.length, 0);
  const checksFailed = workerReports.reduce(
    (acc, worker) => acc + worker.checks.filter((item) => item.status === "FAIL").length,
    0,
  );
  const blockersTotal = violations.filter((item) => item.severity === "BLOCKER").length;
  const warningsTotal = violations.filter((item) => item.severity === "WARN").length;

  return {
    timestamp: new Date().toISOString(),
    mode: "real",
    sourceOfTruthPath: DEFAULT_SOURCE_OF_TRUTH_PATH,
    fixturesDir: null,
    autoRemediation: {
      enabled: false,
      attempted: false,
      actions: [],
      reranAfterRemediation: false,
    },
    summary: {
      workersTotal: workerReports.length,
      workersWithFailures: workerReports.filter((item) => item.hasFailures).length,
      checksTotal,
      checksFailed,
      violationsTotal: violations.length,
      blockersTotal,
      warningsTotal,
    },
    workers: workerReports,
    violations,
  };
}

async function remediateArchivedWorkers(config: WorkersExpectedStateConfig, actualStates: Record<string, WorkerActualState>): Promise<string[]> {
  const apiToken = readRequiredEnv("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const actions: string[] = [];

  for (const worker of config.workers) {
    if (worker.status !== "ARCHIVED") continue;
    const actual = actualStates[worker.name];
    if (!actual) continue;

    if (actual.subdomain?.enabled) {
      await requestCloudflareApi<{ enabled: boolean; previews_enabled: boolean }>({
        method: "POST",
        pathName: `/accounts/${accountId}/workers/scripts/${worker.name}/subdomain`,
        apiToken,
        body: { enabled: false },
      });
      actions.push(`${worker.name}:subdomain_disabled`);
    }

    if (actual.schedulesCount > 0) {
      await requestCloudflareApi<{ schedules: Array<{ cron: string }> }>({
        method: "PUT",
        pathName: `/accounts/${accountId}/workers/scripts/${worker.name}/schedules`,
        apiToken,
        body: [],
      });
      actions.push(`${worker.name}:schedules_cleared`);
    }
  }

  return actions;
}

function buildMarkdownReport(report: DriftReport): string {
  const lines: string[] = [];
  lines.push("# Workers Drift Report");
  lines.push("");
  lines.push(`- Timestamp: \`${report.timestamp}\``);
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Source of truth: \`${report.sourceOfTruthPath}\``);
  lines.push(`- Fixtures dir: \`${report.fixturesDir ?? "n/a"}\``);
  lines.push(`- Auto remediation enabled: \`${report.autoRemediation.enabled}\``);
  lines.push(`- Auto remediation attempted: \`${report.autoRemediation.attempted}\``);
  lines.push(`- Auto remediation actions: \`${report.autoRemediation.actions.join(", ") || "none"}\``);
  lines.push("");
  lines.push("## Workers Summary");
  lines.push("");
  lines.push("| Worker | Status | Severity | subdomain | schedulesCount | domainsCount | routesCount | Result |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const worker of report.workers) {
    const subdomainText = worker.actual.subdomain
      ? `enabled=${worker.actual.subdomain.enabled}, previews=${worker.actual.subdomain.previews_enabled}`
      : "n/a";
    lines.push(
      `| ${worker.workerName} | ${worker.workerStatus} | ${worker.severity} | ${subdomainText} | ${worker.actual.schedulesCount} | ${worker.actual.domainsCount} | ${worker.actual.routesCount} | ${worker.hasFailures ? "FAIL" : "PASS"} |`,
    );
  }
  lines.push("");
  lines.push("## Drift Matrix");
  lines.push("");
  lines.push("| Worker | subdomain.enabled | subdomain.previews_enabled | schedulesCount | domainsCount | routesCount |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const worker of report.workers) {
    const row: string[] = [worker.workerName];
    for (const checkName of MATRIX_CHECK_NAMES) {
      const match = worker.checks.find((item) => item.checkName === checkName);
      row.push(match ? match.status : "N/A");
    }
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Violations");
  lines.push("");
  if (report.violations.length === 0) {
    lines.push("- None");
  } else {
    for (const violation of report.violations) {
      lines.push(
        `- ${violation.workerName} [${violation.severity}] ${violation.checkName}: expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
      );
    }
  }
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- workersTotal: ${report.summary.workersTotal}`);
  lines.push(`- workersWithFailures: ${report.summary.workersWithFailures}`);
  lines.push(`- checksTotal: ${report.summary.checksTotal}`);
  lines.push(`- checksFailed: ${report.summary.checksFailed}`);
  lines.push(`- blockersTotal: ${report.summary.blockersTotal}`);
  lines.push(`- warningsTotal: ${report.summary.warningsTotal}`);
  return `${lines.join("\n")}\n`;
}

async function writeReports(params: {
  report: DriftReport;
  jsonPath: string;
  markdownPath: string;
}): Promise<void> {
  const jsonAbsolutePath = resolvePath(params.jsonPath);
  const markdownAbsolutePath = resolvePath(params.markdownPath);
  await writeFileSafe(jsonAbsolutePath, `${JSON.stringify(params.report, null, 2)}\n`);
  await writeFileSafe(markdownAbsolutePath, buildMarkdownReport(params.report));
}

function printViolations(report: DriftReport): void {
  const blockers = report.violations.filter((item) => item.severity === "BLOCKER");
  const warnings = report.violations.filter((item) => item.severity === "WARN");

  for (const violation of blockers) {
    const workerReport = report.workers.find((item) => item.workerName === violation.workerName);
    if (!workerReport) continue;
    console.error(`DRIFT DETECTED: ${violation.workerName} resurrected`);
    const expectedSnapshot = {
      subdomain: workerReport.expected.subdomain ?? "n/a",
      schedulesCount: workerReport.expected.schedulesCount ?? "n/a",
      domainsCount: workerReport.expected.domainsCount ?? "n/a",
      routesCount: workerReport.expected.routesCount ?? "n/a",
    };
    const actualSnapshot = {
      subdomain: workerReport.actual.subdomain ?? "n/a",
      schedulesCount: workerReport.actual.schedulesCount,
      domainsCount: workerReport.actual.domainsCount,
      routesCount: workerReport.actual.routesCount,
    };
    console.error(`EXPECTED: ${JSON.stringify(expectedSnapshot)}`);
    console.error(`ACTUAL: ${JSON.stringify(actualSnapshot)}`);
  }

  for (const warning of warnings) {
    console.warn(
      `WARN: ${warning.workerName} ${warning.checkName} expected=${JSON.stringify(warning.expected)} actual=${JSON.stringify(
        warning.actual,
      )}`,
    );
  }
}

export async function runWorkersDriftChecks(options: DriftRunOptions = {}): Promise<{ exitCode: number; report: DriftReport }> {
  const sourceOfTruthPath = options.sourceOfTruthPath ?? DEFAULT_SOURCE_OF_TRUTH_PATH;
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? "";
  const mode: "real" | "fixtures" = fixturesDir ? "fixtures" : "real";
  const autoRemediateArchived = options.autoRemediateArchived ?? readOptionalBooleanEnv("AUTO_REMEDIATE_ARCHIVED");
  const writeReportsEnabled = options.writeReports ?? true;
  const reportJsonPath = options.reportJsonPath ?? DEFAULT_REPORT_JSON_PATH;
  const reportMarkdownPath = options.reportMarkdownPath ?? DEFAULT_REPORT_MARKDOWN_PATH;

  const config = await readJsonFile<WorkersExpectedStateConfig>(resolvePath(sourceOfTruthPath));
  validateSourceOfTruth(config);

  let actualStates =
    mode === "fixtures" ? await collectFixtureStates(config, fixturesDir) : await collectRealStates(config);

  let report = evaluateWorkersDrifts(config, actualStates);
  report.mode = mode;
  report.fixturesDir = mode === "fixtures" ? fixturesDir : null;
  report.sourceOfTruthPath = sourceOfTruthPath;
  report.autoRemediation.enabled = autoRemediateArchived;

  if (autoRemediateArchived && mode === "real") {
    const archivedBlockers = report.violations.filter(
      (item) => item.workerStatus === "ARCHIVED" && item.severity === "BLOCKER",
    );
    if (archivedBlockers.length > 0) {
      report.autoRemediation.attempted = true;
      const actions = await remediateArchivedWorkers(config, actualStates);
      report.autoRemediation.actions = actions;
      if (actions.length > 0) {
        actualStates = await collectRealStates(config);
        report = evaluateWorkersDrifts(config, actualStates);
        report.mode = mode;
        report.fixturesDir = null;
        report.sourceOfTruthPath = sourceOfTruthPath;
        report.autoRemediation.enabled = autoRemediateArchived;
        report.autoRemediation.attempted = true;
        report.autoRemediation.actions = actions;
        report.autoRemediation.reranAfterRemediation = true;
      }
    }
  }

  if (writeReportsEnabled) {
    await writeReports({
      report,
      jsonPath: reportJsonPath,
      markdownPath: reportMarkdownPath,
    });
  }

  printViolations(report);

  const blockers = report.violations.filter((item) => item.severity === "BLOCKER");
  if (blockers.length > 0) {
    return { exitCode: 1, report };
  }

  console.log("Workers state consistent");
  return { exitCode: 0, report };
}

async function executeCli(): Promise<void> {
  try {
    const result = await runWorkersDriftChecks();
    process.exit(result.exitCode);
  } catch (error) {
    const fallbackReport: DriftReport = {
      timestamp: new Date().toISOString(),
      mode: process.env.FIXTURES_DIR ? "fixtures" : "real",
      sourceOfTruthPath: DEFAULT_SOURCE_OF_TRUTH_PATH,
      fixturesDir: process.env.FIXTURES_DIR ?? null,
      autoRemediation: {
        enabled: readOptionalBooleanEnv("AUTO_REMEDIATE_ARCHIVED"),
        attempted: false,
        actions: [],
        reranAfterRemediation: false,
      },
      summary: {
        workersTotal: 0,
        workersWithFailures: 0,
        checksTotal: 0,
        checksFailed: 0,
        violationsTotal: 0,
        blockersTotal: 1,
        warningsTotal: 0,
      },
      workers: [],
      violations: [
        {
          workerName: "global",
          workerStatus: "ARCHIVED",
          severity: "BLOCKER",
          checkName: "execution",
          expected: "successful drift evaluation",
          actual: error instanceof Error ? error.message : String(error),
        },
      ],
    };

    await writeReports({
      report: fallbackReport,
      jsonPath: DEFAULT_REPORT_JSON_PATH,
      markdownPath: DEFAULT_REPORT_MARKDOWN_PATH,
    });

    console.error("Workers drift check failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const directRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directRun) {
  executeCli();
}
