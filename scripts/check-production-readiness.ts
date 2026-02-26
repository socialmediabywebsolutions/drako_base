import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SeverityLevel = "BLOCKER" | "WARN";
type CheckStatus = "PASS" | "FAIL" | "N/A";
type WorkerStatus = "ACTIVE" | "ARCHIVED";

type ProductionAuditsExpectedState = {
  meta: {
    updatedAt: string;
    owner: string;
    notes?: string;
  };
  criticalWorkers: Array<{
    workerName: string;
    expectedStatus: WorkerStatus;
    expectedSubdomain?: {
      enabled: boolean;
      previewsEnabled: boolean;
    };
    expectedSchedulesCount?: number;
    expectedDomainsCount?: number;
    expectedRoutesCount?: number;
  }>;
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
  criticalDatastores: {
    d1DatabaseNames: string[];
    r2BucketNames: string[];
    kvNamespaceNames: string[];
    queueNames: string[];
    durableObjectClassNames: string[];
  };
  criticalTables: Array<{
    databaseName: string;
    tables: Array<{
      tableName: string;
      requiredColumns: string[];
    }>;
  }>;
  severities: {
    criticalWorkerMissing: SeverityLevel;
    criticalWorkerArchivedMismatch: SeverityLevel;
    criticalWorkerSubdomainMismatch: SeverityLevel;
    criticalWorkerSchedulesMismatch: SeverityLevel;
    criticalHostnameMissing: SeverityLevel;
    criticalHostnameMismatch: SeverityLevel;
    criticalRouteMissing: SeverityLevel;
    criticalRouteMismatch: SeverityLevel;
    blockedServiceHit: SeverityLevel;
    blockedScriptHit: SeverityLevel;
    criticalD1Missing: SeverityLevel;
    criticalR2Missing: SeverityLevel;
    criticalKvMissing: SeverityLevel;
    criticalQueueMissing: SeverityLevel;
    criticalDurableObjectMissing: SeverityLevel;
    criticalTableMissing: SeverityLevel;
    criticalColumnMissing: SeverityLevel;
    onboardingColumnsMismatch: SeverityLevel;
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

type WorkersStateRecord = {
  workerName: string;
  scriptExists: boolean;
  subdomain: {
    enabled: boolean;
    previewsEnabled: boolean;
  } | null;
  schedulesCount: number;
  domainsCount: number;
  routesCount: number;
};

type D1TablesRecord = {
  databaseName: string;
  tables: string[];
  columnsByTables: Record<string, string[]>;
};

type CheckCode =
  | "criticalWorkerMissing"
  | "criticalWorkerArchivedMismatch"
  | "criticalWorkerSubdomainMismatch"
  | "criticalWorkerSchedulesMismatch"
  | "criticalHostnameMissing"
  | "criticalHostnameMismatch"
  | "criticalRouteMissing"
  | "criticalRouteMismatch"
  | "blockedServiceHit"
  | "blockedScriptHit"
  | "criticalD1Missing"
  | "criticalR2Missing"
  | "criticalKvMissing"
  | "criticalQueueMissing"
  | "criticalDurableObjectMissing"
  | "criticalTableMissing"
  | "criticalColumnMissing"
  | "onboardingColumnsMismatch";

type CheckRecord = {
  checkCode: CheckCode;
  severity: SeverityLevel;
  status: CheckStatus;
  targetType:
    | "worker"
    | "hostname"
    | "route"
    | "domain"
    | "route_global"
    | "datastore_d1"
    | "datastore_r2"
    | "datastore_kv"
    | "datastore_queue"
    | "durable_object"
    | "d1_table"
    | "d1_column";
  targetName: string;
  expected: unknown;
  actual: unknown;
  details: string;
};

type ViolationRecord = Omit<CheckRecord, "status">;

type ProductionReadinessReport = {
  timestamp: string;
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  productionReady: boolean;
  summary: {
    checksTotal: number;
    checksPass: number;
    checksFail: number;
    checksNa: number;
    violationsTotal: number;
    blockersTotal: number;
    warningsTotal: number;
  };
  checks: CheckRecord[];
  violations: ViolationRecord[];
  snapshots: {
    workers: WorkersStateRecord[];
    domains: WorkersDomainRecord[];
    routes: WorkersRouteRecord[];
    d1DatabaseNames: string[];
    r2BucketNames: string[];
    kvNamespaceNames: string[];
    queueNames: string[];
    durableObjectClassNames: string[];
    d1TablesByDatabases: D1TablesRecord[];
  };
};

type CloudflareApiResponse<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code: number; message: string }>;
};

type ProductionAuditsRunOptions = {
  sourceOfTruthPath?: string;
  fixturesDir?: string;
  writeReports?: boolean;
  reportJsonPath?: string;
  reportMarkdownPath?: string;
};

const DEFAULT_SOURCE_OF_TRUTH_PATH = "docs/config/production-audits-expected-state.json";
const DEFAULT_REPORT_JSON_PATH = "docs/audits/production-readiness-latest.json";
const DEFAULT_REPORT_MARKDOWN_PATH = "docs/audits/production-readiness-latest.md";

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

function resolveAbsolutePath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeFileSafe(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

function validateConfig(config: ProductionAuditsExpectedState): void {
  if (!Array.isArray(config.criticalWorkers) || config.criticalWorkers.length === 0) {
    throw new Error("production-audits-expected-state.json must include criticalWorkers.");
  }
  if (!Array.isArray(config.criticalHostnames) || config.criticalHostnames.length === 0) {
    throw new Error("production-audits-expected-state.json must include criticalHostnames.");
  }
  if (!Array.isArray(config.criticalRoutes)) {
    throw new Error("production-audits-expected-state.json must include criticalRoutes.");
  }
  if (!config.criticalDatastores) {
    throw new Error("production-audits-expected-state.json must include criticalDatastores.");
  }
  if (!Array.isArray(config.criticalTables)) {
    throw new Error("production-audits-expected-state.json must include criticalTables.");
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
  const payload = (await response.json()) as CloudflareApiResponse<T>;
  if (!response.ok || payload.success === false) {
    const details = payload.errors?.map((item) => `${item.code}:${item.message}`).join(", ") || response.statusText;
    throw new Error(`Cloudflare API error for ${params.pathName}: ${details}`);
  }
  return payload.result as T;
}

function extractWrappedArrays<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "result" in value) {
    const wrapped = value as { success?: boolean; result?: unknown };
    if (wrapped.success === false) {
      throw new Error("Fixture payload has success=false.");
    }
    if (Array.isArray(wrapped.result)) {
      return wrapped.result as T[];
    }
    if (wrapped.result && typeof wrapped.result === "object") {
      const objectResult = wrapped.result as Record<string, unknown>;
      if (Array.isArray(objectResult.buckets)) {
        return objectResult.buckets as T[];
      }
    }
  }
  return [];
}

function normalizeDomains(records: unknown[]): WorkersDomainRecord[] {
  return records
    .map((record) => record as Partial<WorkersDomainRecord>)
    .filter((record) => typeof record.hostname === "string" && typeof record.service === "string")
    .map((record) => ({
      hostname: record.hostname!.toLowerCase(),
      service: record.service!,
    }));
}

function normalizeRoutes(records: unknown[]): WorkersRouteRecord[] {
  return records
    .map((record) => record as Partial<WorkersRouteRecord>)
    .filter((record) => typeof record.pattern === "string" && typeof record.script === "string")
    .map((record) => ({
      pattern: record.pattern!,
      script: record.script!,
    }));
}

function normalizeNames(records: unknown[], keys: string[]): string[] {
  return records
    .map((record) => {
      if (!record || typeof record !== "object") return "";
      const objectRecord = record as Record<string, unknown>;
      for (const key of keys) {
        if (typeof objectRecord[key] === "string") return objectRecord[key] as string;
      }
      return "";
    })
    .filter((item) => item.length > 0);
}

function parseWorkersScriptNames(records: unknown[]): string[] {
  return records
    .map((record) => {
      if (!record || typeof record !== "object") return "";
      const item = record as Record<string, unknown>;
      if (typeof item.id === "string") return item.id;
      if (typeof item.name === "string") return item.name;
      if (typeof item.script === "string") return item.script;
      return "";
    })
    .filter((item) => item.length > 0);
}

function safeWorkerName(workerName: string): string {
  if (!/^[a-z0-9_-]+$/i.test(workerName)) {
    throw new Error(`Unsafe worker name for command execution: ${workerName}`);
  }
  return workerName;
}

function safeDatabaseName(databaseName: string): string {
  if (!/^[a-z0-9_-]+$/i.test(databaseName)) {
    throw new Error(`Unsafe database name for command execution: ${databaseName}`);
  }
  return databaseName;
}

function executeD1QueryRemote(databaseName: string, sqlCommand: string): Array<Record<string, unknown>> {
  const command = `npx wrangler d1 execute ${safeDatabaseName(
    databaseName,
  )} --remote --json --command ${JSON.stringify(sqlCommand)}`;
  const stdout = execSync(command, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const payload = JSON.parse(stdout) as Array<{ results?: Array<Record<string, unknown>> }>;
  return payload[0]?.results ?? [];
}

async function collectRealSnapshots(config: ProductionAuditsExpectedState): Promise<ProductionReadinessReport["snapshots"]> {
  const apiToken = readRequiredEnv("CLOUDFLARE_API_TOKEN");
  const accountId = readRequiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const zoneId = readRequiredEnv("CLOUDFLARE_ZONE_ID");

  const domainsPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/workers/domains`,
  });
  const routesPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/zones/${zoneId}/workers/routes`,
  });
  const scriptsPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/workers/scripts`,
  });
  const d1Payload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/d1/database`,
  });
  const r2Payload = await requestCloudflareApi<{ buckets?: unknown[] } | unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/r2/buckets`,
  });
  const kvPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/storage/kv/namespaces?per_page=100`,
  });
  const queuesPayload = await requestCloudflareApi<unknown[]>({
    apiToken,
    pathName: `/accounts/${accountId}/queues`,
  });

  const domains = normalizeDomains(domainsPayload);
  const routes = normalizeRoutes(routesPayload);
  const workersScriptNames = new Set(parseWorkersScriptNames(scriptsPayload));
  const d1DatabaseNames = normalizeNames(d1Payload, ["name"]);
  const r2BucketsRaw = Array.isArray(r2Payload) ? r2Payload : r2Payload.buckets ?? [];
  const r2BucketNames = normalizeNames(r2BucketsRaw, ["name"]);
  const kvNamespaceNames = normalizeNames(kvPayload, ["title", "name"]);
  const queueNames = normalizeNames(queuesPayload, ["queue_name", "name"]);

  const workers: WorkersStateRecord[] = [];
  const durableObjectClassNamesSet = new Set<string>();
  for (const worker of config.criticalWorkers) {
    const workerName = safeWorkerName(worker.workerName);
    const scriptExists = workersScriptNames.has(workerName);

    let subdomain: WorkersStateRecord["subdomain"] = null;
    let schedulesCount = 0;

    if (scriptExists) {
      try {
        const subdomainPayload = await requestCloudflareApi<{ enabled: boolean; previews_enabled: boolean }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
        });
        subdomain = {
          enabled: Boolean(subdomainPayload.enabled),
          previewsEnabled: Boolean(subdomainPayload.previews_enabled),
        };
      } catch {
        subdomain = null;
      }

      try {
        const schedulesPayload = await requestCloudflareApi<{ schedules?: Array<{ cron: string }> }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/schedules`,
        });
        schedulesCount = (schedulesPayload.schedules ?? []).length;
      } catch {
        schedulesCount = 0;
      }

      try {
        const settingsPayload = await requestCloudflareApi<{ bindings?: Array<Record<string, unknown>> }>({
          apiToken,
          pathName: `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
        });
        for (const binding of settingsPayload.bindings ?? []) {
          if (binding.type === "durable_object_namespace" && typeof binding.class_name === "string") {
            durableObjectClassNamesSet.add(binding.class_name);
          }
        }
      } catch {
        // Keep audit read-only and non-fatal for optional durable object inventory.
      }
    }

    workers.push({
      workerName,
      scriptExists,
      subdomain,
      schedulesCount,
      domainsCount: domains.filter((item) => item.service === workerName).length,
      routesCount: routes.filter((item) => item.script === workerName).length,
    });
  }

  const d1TablesByDatabases: D1TablesRecord[] = [];
  for (const database of config.criticalTables) {
    const databaseName = safeDatabaseName(database.databaseName);
    if (!d1DatabaseNames.includes(databaseName)) {
      d1TablesByDatabases.push({
        databaseName,
        tables: [],
        columnsByTables: {},
      });
      continue;
    }

    const tableRows = executeD1QueryRemote(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
    );
    const tableNames = tableRows
      .map((item) => item.name)
      .filter((item): item is string => typeof item === "string" && !item.startsWith("_cf_"));
    const columnsByTables: Record<string, string[]> = {};
    const requiredTableNames = new Set(database.tables.map((item) => item.tableName));

    for (const tableName of tableNames) {
      if (!requiredTableNames.has(tableName)) {
        continue;
      }
      const pragmaRows = executeD1QueryRemote(databaseName, `PRAGMA table_info('${tableName.replace(/'/g, "''")}');`);
      columnsByTables[tableName] = pragmaRows
        .map((item) => item.name)
        .filter((item): item is string => typeof item === "string");
    }

    d1TablesByDatabases.push({
      databaseName,
      tables: tableNames,
      columnsByTables,
    });
  }

  return {
    workers,
    domains,
    routes,
    d1DatabaseNames,
    r2BucketNames,
    kvNamespaceNames,
    queueNames,
    durableObjectClassNames: Array.from(durableObjectClassNamesSet).sort(),
    d1TablesByDatabases,
  };
}

async function collectFixturesSnapshots(fixturesDir: string): Promise<ProductionReadinessReport["snapshots"]> {
  const absoluteDir = resolveAbsolutePath(fixturesDir);

  const domainsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "domains.json"));
  const routesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "routes.json"));
  const scriptsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "scripts.json"));
  const workersPayload = await readJsonFile<unknown>(path.join(absoluteDir, "workers-states.json"));
  const d1Payload = await readJsonFile<unknown>(path.join(absoluteDir, "d1-databases.json"));
  const r2Payload = await readJsonFile<unknown>(path.join(absoluteDir, "r2-buckets.json"));
  const kvPayload = await readJsonFile<unknown>(path.join(absoluteDir, "kv-namespaces.json"));
  const queuesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "queues.json"));
  const durableObjectsPayload = await readJsonFile<unknown>(path.join(absoluteDir, "durable-objects.json"));
  const d1TablesPayload = await readJsonFile<unknown>(path.join(absoluteDir, "d1-tables.json"));

  const domains = normalizeDomains(extractWrappedArrays<unknown>(domainsPayload));
  const routes = normalizeRoutes(extractWrappedArrays<unknown>(routesPayload));
  const scriptNames = parseWorkersScriptNames(extractWrappedArrays<unknown>(scriptsPayload));
  const workersStatesRaw =
    workersPayload && typeof workersPayload === "object" && "result" in (workersPayload as Record<string, unknown>)
      ? ((workersPayload as { result?: unknown }).result as unknown)
      : workersPayload;
  const workers = Array.isArray(workersStatesRaw) ? workersStatesRaw : [];
  const d1DatabaseNames = normalizeNames(extractWrappedArrays<unknown>(d1Payload), ["name"]);
  const r2BucketNames = normalizeNames(extractWrappedArrays<unknown>(r2Payload), ["name"]);
  const kvNamespaceNames = normalizeNames(extractWrappedArrays<unknown>(kvPayload), ["title", "name"]);
  const queueNames = normalizeNames(extractWrappedArrays<unknown>(queuesPayload), ["queue_name", "name"]);
  const durableObjectClassNames = normalizeNames(extractWrappedArrays<unknown>(durableObjectsPayload), [
    "class_name",
    "className",
    "name",
  ]);

  const d1TablesRaw =
    d1TablesPayload && typeof d1TablesPayload === "object" && "result" in (d1TablesPayload as Record<string, unknown>)
      ? ((d1TablesPayload as { result?: unknown }).result as unknown)
      : d1TablesPayload;
  const d1TablesByDatabases = Array.isArray(d1TablesRaw) ? (d1TablesRaw as D1TablesRecord[]) : [];

  const workersByNames = new Map<string, WorkersStateRecord>();
  for (const worker of workers as Array<Record<string, unknown>>) {
    if (typeof worker.workerName !== "string") continue;
    workersByNames.set(worker.workerName, {
      workerName: worker.workerName,
      scriptExists:
        typeof worker.scriptExists === "boolean" ? worker.scriptExists : scriptNames.includes(worker.workerName),
      subdomain:
        worker.subdomain && typeof worker.subdomain === "object"
          ? {
              enabled: Boolean((worker.subdomain as Record<string, unknown>).enabled),
              previewsEnabled: Boolean((worker.subdomain as Record<string, unknown>).previewsEnabled),
            }
          : null,
      schedulesCount: typeof worker.schedulesCount === "number" ? worker.schedulesCount : 0,
      domainsCount: typeof worker.domainsCount === "number" ? worker.domainsCount : domains.filter((item) => item.service === worker.workerName).length,
      routesCount: typeof worker.routesCount === "number" ? worker.routesCount : routes.filter((item) => item.script === worker.workerName).length,
    });
  }

  const mergedWorkers: WorkersStateRecord[] = scriptNames.map((scriptName) => {
    const existing = workersByNames.get(scriptName);
    if (existing) return existing;
    return {
      workerName: scriptName,
      scriptExists: true,
      subdomain: null,
      schedulesCount: 0,
      domainsCount: domains.filter((item) => item.service === scriptName).length,
      routesCount: routes.filter((item) => item.script === scriptName).length,
    };
  });

  return {
    workers: mergedWorkers,
    domains,
    routes,
    d1DatabaseNames,
    r2BucketNames,
    kvNamespaceNames,
    queueNames,
    durableObjectClassNames,
    d1TablesByDatabases,
  };
}

function pushCheck(checks: CheckRecord[], check: CheckRecord): void {
  checks.push(check);
}

function buildChecks(config: ProductionAuditsExpectedState, snapshots: ProductionReadinessReport["snapshots"]): CheckRecord[] {
  const checks: CheckRecord[] = [];
  const workersByNames = new Map(snapshots.workers.map((item) => [item.workerName, item]));
  const domainsByHostnames = new Map(snapshots.domains.map((item) => [item.hostname.toLowerCase(), item]));
  const routesByPatterns = new Map(snapshots.routes.map((item) => [item.pattern, item]));
  const tablesByDatabases = new Map(snapshots.d1TablesByDatabases.map((item) => [item.databaseName, item]));

  for (const criticalWorker of config.criticalWorkers) {
    const actual = workersByNames.get(criticalWorker.workerName);
    const existsStatus: CheckStatus = actual?.scriptExists ? "PASS" : "FAIL";
    pushCheck(checks, {
      checkCode: "criticalWorkerMissing",
      severity: config.severities.criticalWorkerMissing,
      status:
        criticalWorker.expectedStatus === "ACTIVE"
          ? existsStatus
          : actual?.scriptExists
            ? "PASS"
            : "N/A",
      targetType: "worker",
      targetName: criticalWorker.workerName,
      expected: criticalWorker.expectedStatus === "ACTIVE" ? "script exists" : "archived script optional",
      actual: actual?.scriptExists ? "script exists" : "script missing",
      details: actual?.scriptExists
        ? `Worker ${criticalWorker.workerName} exists in scripts inventory.`
        : `Worker ${criticalWorker.workerName} is missing in scripts inventory.`,
    });

    if (!actual?.scriptExists) {
      continue;
    }

    if (criticalWorker.expectedStatus === "ARCHIVED") {
      const archivedPass =
        actual.domainsCount === (criticalWorker.expectedDomainsCount ?? 0) &&
        actual.routesCount === (criticalWorker.expectedRoutesCount ?? 0) &&
        actual.schedulesCount === (criticalWorker.expectedSchedulesCount ?? 0) &&
        (!criticalWorker.expectedSubdomain ||
          (actual.subdomain !== null &&
            actual.subdomain.enabled === criticalWorker.expectedSubdomain.enabled &&
            actual.subdomain.previewsEnabled === criticalWorker.expectedSubdomain.previewsEnabled));

      pushCheck(checks, {
        checkCode: "criticalWorkerArchivedMismatch",
        severity: config.severities.criticalWorkerArchivedMismatch,
        status: archivedPass ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: {
          domainsCount: criticalWorker.expectedDomainsCount ?? 0,
          routesCount: criticalWorker.expectedRoutesCount ?? 0,
          schedulesCount: criticalWorker.expectedSchedulesCount ?? 0,
          subdomain: criticalWorker.expectedSubdomain ?? null,
        },
        actual: {
          domainsCount: actual.domainsCount,
          routesCount: actual.routesCount,
          schedulesCount: actual.schedulesCount,
          subdomain: actual.subdomain,
        },
        details: archivedPass
          ? `Archived worker ${criticalWorker.workerName} remains fenced.`
          : `Archived worker ${criticalWorker.workerName} has unexpected ingress exposure.`,
      });
    }

    if (criticalWorker.expectedSubdomain) {
      const matchesSubdomain =
        actual.subdomain !== null &&
        actual.subdomain.enabled === criticalWorker.expectedSubdomain.enabled &&
        actual.subdomain.previewsEnabled === criticalWorker.expectedSubdomain.previewsEnabled;
      pushCheck(checks, {
        checkCode: "criticalWorkerSubdomainMismatch",
        severity: config.severities.criticalWorkerSubdomainMismatch,
        status: matchesSubdomain ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: criticalWorker.expectedSubdomain,
        actual: actual.subdomain,
        details: matchesSubdomain
          ? `Worker ${criticalWorker.workerName} subdomain matches expected state.`
          : `Worker ${criticalWorker.workerName} subdomain does not match expected state.`,
      });
    }

    if (typeof criticalWorker.expectedSchedulesCount === "number") {
      const matchesSchedules = actual.schedulesCount === criticalWorker.expectedSchedulesCount;
      pushCheck(checks, {
        checkCode: "criticalWorkerSchedulesMismatch",
        severity: config.severities.criticalWorkerSchedulesMismatch,
        status: matchesSchedules ? "PASS" : "FAIL",
        targetType: "worker",
        targetName: criticalWorker.workerName,
        expected: criticalWorker.expectedSchedulesCount,
        actual: actual.schedulesCount,
        details: matchesSchedules
          ? `Worker ${criticalWorker.workerName} schedules count matches expected.`
          : `Worker ${criticalWorker.workerName} schedules count does not match expected.`,
      });
    }
  }

  for (const hostnameMapping of config.criticalHostnames) {
    const domain = domainsByHostnames.get(hostnameMapping.hostname.toLowerCase());
    const isMissing = !domain;
    pushCheck(checks, {
      checkCode: "criticalHostnameMissing",
      severity: config.severities.criticalHostnameMissing,
      status: isMissing ? "FAIL" : "PASS",
      targetType: "hostname",
      targetName: hostnameMapping.hostname,
      expected: "present",
      actual: isMissing ? "missing" : "present",
      details: isMissing
        ? `Critical hostname ${hostnameMapping.hostname} is missing from workers domains.`
        : `Critical hostname ${hostnameMapping.hostname} exists.`,
    });

    if (!domain) {
      pushCheck(checks, {
        checkCode: "criticalHostnameMismatch",
        severity: config.severities.criticalHostnameMismatch,
        status: "N/A",
        targetType: "hostname",
        targetName: hostnameMapping.hostname,
        expected: hostnameMapping.expectedService,
        actual: null,
        details: `Ownership check skipped because hostname ${hostnameMapping.hostname} is missing.`,
      });
    } else {
      const matchesService = domain.service === hostnameMapping.expectedService;
      pushCheck(checks, {
        checkCode: "criticalHostnameMismatch",
        severity: config.severities.criticalHostnameMismatch,
        status: matchesService ? "PASS" : "FAIL",
        targetType: "hostname",
        targetName: hostnameMapping.hostname,
        expected: hostnameMapping.expectedService,
        actual: domain.service,
        details: matchesService
          ? `Hostname ${hostnameMapping.hostname} points to expected service.`
          : `Hostname ${hostnameMapping.hostname} points to unexpected service.`,
      });
    }
  }

  for (const routeMapping of config.criticalRoutes) {
    const route = routesByPatterns.get(routeMapping.pattern);
    if (!route) {
      pushCheck(checks, {
        checkCode: "criticalRouteMissing",
        severity: config.severities.criticalRouteMissing,
        status: "FAIL",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: "present",
        actual: "missing",
        details: `Critical route ${routeMapping.pattern} is missing.`,
      });
      pushCheck(checks, {
        checkCode: "criticalRouteMismatch",
        severity: config.severities.criticalRouteMismatch,
        status: "N/A",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: routeMapping.expectedScript,
        actual: null,
        details: `Route ownership check skipped because ${routeMapping.pattern} is missing.`,
      });
    } else {
      pushCheck(checks, {
        checkCode: "criticalRouteMissing",
        severity: config.severities.criticalRouteMissing,
        status: "PASS",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: "present",
        actual: "present",
        details: `Critical route ${routeMapping.pattern} exists.`,
      });
      const matchesScript = route.script === routeMapping.expectedScript;
      pushCheck(checks, {
        checkCode: "criticalRouteMismatch",
        severity: config.severities.criticalRouteMismatch,
        status: matchesScript ? "PASS" : "FAIL",
        targetType: "route",
        targetName: routeMapping.pattern,
        expected: routeMapping.expectedScript,
        actual: route.script,
        details: matchesScript
          ? `Critical route ${routeMapping.pattern} points to expected script.`
          : `Critical route ${routeMapping.pattern} points to unexpected script.`,
      });
    }
  }

  for (const domain of snapshots.domains) {
    const blocked = config.blockedMappings.services.includes(domain.service);
    pushCheck(checks, {
      checkCode: "blockedServiceHit",
      severity: config.severities.blockedServiceHit,
      status: blocked ? "FAIL" : "PASS",
      targetType: "domain",
      targetName: domain.hostname,
      expected: `service NOT IN [${config.blockedMappings.services.join(", ")}]`,
      actual: domain.service,
      details: blocked
        ? `Blocked service ${domain.service} is attached to ${domain.hostname}.`
        : `Domain ${domain.hostname} is not attached to blocked services.`,
    });
  }

  for (const route of snapshots.routes) {
    const blocked = config.blockedMappings.scripts.includes(route.script);
    pushCheck(checks, {
      checkCode: "blockedScriptHit",
      severity: config.severities.blockedScriptHit,
      status: blocked ? "FAIL" : "PASS",
      targetType: "route_global",
      targetName: route.pattern,
      expected: `script NOT IN [${config.blockedMappings.scripts.join(", ")}]`,
      actual: route.script,
      details: blocked
        ? `Blocked script ${route.script} is attached to ${route.pattern}.`
        : `Route ${route.pattern} is not attached to blocked scripts.`,
    });
  }

  for (const databaseName of config.criticalDatastores.d1DatabaseNames) {
    const present = snapshots.d1DatabaseNames.includes(databaseName);
    pushCheck(checks, {
      checkCode: "criticalD1Missing",
      severity: config.severities.criticalD1Missing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_d1",
      targetName: databaseName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `D1 database ${databaseName} exists.` : `D1 database ${databaseName} is missing.`,
    });
  }

  for (const bucketName of config.criticalDatastores.r2BucketNames) {
    const present = snapshots.r2BucketNames.includes(bucketName);
    pushCheck(checks, {
      checkCode: "criticalR2Missing",
      severity: config.severities.criticalR2Missing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_r2",
      targetName: bucketName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `R2 bucket ${bucketName} exists.` : `R2 bucket ${bucketName} is missing.`,
    });
  }

  for (const namespaceName of config.criticalDatastores.kvNamespaceNames) {
    const present = snapshots.kvNamespaceNames.includes(namespaceName);
    pushCheck(checks, {
      checkCode: "criticalKvMissing",
      severity: config.severities.criticalKvMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_kv",
      targetName: namespaceName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `KV namespace ${namespaceName} exists.` : `KV namespace ${namespaceName} is missing.`,
    });
  }

  for (const queueName of config.criticalDatastores.queueNames) {
    const present = snapshots.queueNames.includes(queueName);
    pushCheck(checks, {
      checkCode: "criticalQueueMissing",
      severity: config.severities.criticalQueueMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "datastore_queue",
      targetName: queueName,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `Queue ${queueName} exists.` : `Queue ${queueName} is missing.`,
    });
  }

  for (const className of config.criticalDatastores.durableObjectClassNames) {
    const present = snapshots.durableObjectClassNames.includes(className);
    pushCheck(checks, {
      checkCode: "criticalDurableObjectMissing",
      severity: config.severities.criticalDurableObjectMissing,
      status: present ? "PASS" : "FAIL",
      targetType: "durable_object",
      targetName: className,
      expected: "present",
      actual: present ? "present" : "missing",
      details: present ? `Durable object class ${className} exists.` : `Durable object class ${className} is missing.`,
    });
  }

  for (const tableRequirement of config.criticalTables) {
    const databaseSnapshot = tablesByDatabases.get(tableRequirement.databaseName);
    const databasePresent = snapshots.d1DatabaseNames.includes(tableRequirement.databaseName);
    if (!databasePresent || !databaseSnapshot) {
      for (const table of tableRequirement.tables) {
        pushCheck(checks, {
          checkCode: "criticalTableMissing",
          severity: config.severities.criticalTableMissing,
          status: "FAIL",
          targetType: "d1_table",
          targetName: `${tableRequirement.databaseName}.${table.tableName}`,
          expected: "present",
          actual: "database missing",
          details: `Table check skipped because database ${tableRequirement.databaseName} is missing.`,
        });
      }
      continue;
    }

    for (const table of tableRequirement.tables) {
      const tableExists = databaseSnapshot.tables.includes(table.tableName);
      pushCheck(checks, {
        checkCode: "criticalTableMissing",
        severity: config.severities.criticalTableMissing,
        status: tableExists ? "PASS" : "FAIL",
        targetType: "d1_table",
        targetName: `${tableRequirement.databaseName}.${table.tableName}`,
        expected: "present",
        actual: tableExists ? "present" : "missing",
        details: tableExists
          ? `Table ${tableRequirement.databaseName}.${table.tableName} exists.`
          : `Table ${tableRequirement.databaseName}.${table.tableName} is missing.`,
      });

      if (!tableExists) {
        continue;
      }

      const columns = databaseSnapshot.columnsByTables[table.tableName] ?? [];
      for (const columnName of table.requiredColumns) {
        const columnExists = columns.includes(columnName);
        pushCheck(checks, {
          checkCode: "criticalColumnMissing",
          severity: config.severities.criticalColumnMissing,
          status: columnExists ? "PASS" : "FAIL",
          targetType: "d1_column",
          targetName: `${tableRequirement.databaseName}.${table.tableName}.${columnName}`,
          expected: "present",
          actual: columnExists ? "present" : "missing",
          details: columnExists
            ? `Column ${tableRequirement.databaseName}.${table.tableName}.${columnName} exists.`
            : `Column ${tableRequirement.databaseName}.${table.tableName}.${columnName} is missing.`,
        });
      }
    }

    const usersColumns = databaseSnapshot.columnsByTables.users ?? [];
    if (databaseSnapshot.tables.includes("users")) {
      const onboardingExists = usersColumns.includes("onboarding_completed");
      pushCheck(checks, {
        checkCode: "onboardingColumnsMismatch",
        severity: config.severities.onboardingColumnsMismatch,
        status: onboardingExists ? "PASS" : "FAIL",
        targetType: "d1_column",
        targetName: `${tableRequirement.databaseName}.users.onboarding_completed`,
        expected: "present",
        actual: onboardingExists ? "present" : "missing",
        details: onboardingExists
          ? `Onboarding column exists in ${tableRequirement.databaseName}.users.`
          : `Onboarding column is missing in ${tableRequirement.databaseName}.users.`,
      });
    } else {
      pushCheck(checks, {
        checkCode: "onboardingColumnsMismatch",
        severity: config.severities.onboardingColumnsMismatch,
        status: "N/A",
        targetType: "d1_column",
        targetName: `${tableRequirement.databaseName}.users.onboarding_completed`,
        expected: "present",
        actual: "table missing",
        details: `Onboarding column check skipped because users table is missing in ${tableRequirement.databaseName}.`,
      });
    }
  }

  return checks;
}

function buildReport(params: {
  mode: "real" | "fixtures";
  sourceOfTruthPath: string;
  fixturesDir: string | null;
  snapshots: ProductionReadinessReport["snapshots"];
  checks: CheckRecord[];
}): ProductionReadinessReport {
  const violations: ViolationRecord[] = params.checks
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

  const blockersTotal = violations.filter((item) => item.severity === "BLOCKER").length;
  const warningsTotal = violations.filter((item) => item.severity === "WARN").length;
  const checksPass = params.checks.filter((item) => item.status === "PASS").length;
  const checksFail = params.checks.filter((item) => item.status === "FAIL").length;
  const checksNa = params.checks.filter((item) => item.status === "N/A").length;

  return {
    timestamp: new Date().toISOString(),
    mode: params.mode,
    sourceOfTruthPath: params.sourceOfTruthPath,
    fixturesDir: params.fixturesDir,
    productionReady: blockersTotal === 0,
    summary: {
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
    snapshots: params.snapshots,
  };
}

function buildMarkdownReport(report: ProductionReadinessReport): string {
  const lines: string[] = [];
  lines.push("# Production Readiness Audit Report");
  lines.push("");
  lines.push(`- Timestamp: \`${report.timestamp}\``);
  lines.push(`- Mode: \`${report.mode}\``);
  lines.push(`- Source of truth: \`${report.sourceOfTruthPath}\``);
  lines.push(`- Fixtures dir: \`${report.fixturesDir ?? "n/a"}\``);
  lines.push(`- Production ready: \`${report.productionReady}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Checks total: ${report.summary.checksTotal}`);
  lines.push(`- Checks pass: ${report.summary.checksPass}`);
  lines.push(`- Checks fail: ${report.summary.checksFail}`);
  lines.push(`- Checks N/A: ${report.summary.checksNa}`);
  lines.push(`- Blockers: ${report.summary.blockersTotal}`);
  lines.push(`- Warnings: ${report.summary.warningsTotal}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| Check | Severity | Target | Status | Expected | Actual |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(
      `| ${check.checkCode} | ${check.severity} | ${check.targetName} | ${check.status} | ${JSON.stringify(check.expected)} | ${JSON.stringify(check.actual)} |`,
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

async function writeReports(report: ProductionReadinessReport, reportJsonPath: string, reportMarkdownPath: string): Promise<void> {
  await writeFileSafe(resolveAbsolutePath(reportJsonPath), `${JSON.stringify(report, null, 2)}\n`);
  await writeFileSafe(resolveAbsolutePath(reportMarkdownPath), buildMarkdownReport(report));
}

function printViolations(report: ProductionReadinessReport): void {
  for (const violation of report.violations.filter((item) => item.severity === "BLOCKER")) {
    console.error(`PRODUCTION BLOCKER DETECTED: ${violation.checkCode}`);
    console.error(`TARGET: ${violation.targetName}`);
    console.error(`EXPECTED: ${JSON.stringify(violation.expected)}`);
    console.error(`ACTUAL: ${JSON.stringify(violation.actual)}`);
  }
  for (const violation of report.violations.filter((item) => item.severity === "WARN")) {
    console.warn(
      `PRODUCTION WARNING: ${violation.checkCode} @ ${violation.targetName} expected=${JSON.stringify(violation.expected)} actual=${JSON.stringify(violation.actual)}`,
    );
  }
}

export async function runProductionReadinessAudits(
  options: ProductionAuditsRunOptions = {},
): Promise<{ exitCode: number; report: ProductionReadinessReport }> {
  const sourceOfTruthPath = options.sourceOfTruthPath ?? DEFAULT_SOURCE_OF_TRUTH_PATH;
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? "";
  const mode: "real" | "fixtures" = fixturesDir ? "fixtures" : "real";
  const writeReportsEnabled = options.writeReports ?? true;
  const reportJsonPath = options.reportJsonPath ?? DEFAULT_REPORT_JSON_PATH;
  const reportMarkdownPath = options.reportMarkdownPath ?? DEFAULT_REPORT_MARKDOWN_PATH;

  const config = await readJsonFile<ProductionAuditsExpectedState>(resolveAbsolutePath(sourceOfTruthPath));
  validateConfig(config);

  const snapshots =
    mode === "fixtures" ? await collectFixturesSnapshots(fixturesDir) : await collectRealSnapshots(config);
  const checks = buildChecks(config, snapshots);
  const report = buildReport({
    mode,
    sourceOfTruthPath,
    fixturesDir: mode === "fixtures" ? fixturesDir : null,
    snapshots,
    checks,
  });

  if (writeReportsEnabled) {
    await writeReports(report, reportJsonPath, reportMarkdownPath);
  }

  printViolations(report);
  if (!report.productionReady) {
    return { exitCode: 1, report };
  }

  console.log("Production readiness state consistent");
  return { exitCode: 0, report };
}

async function executeCli(): Promise<void> {
  try {
    const result = await runProductionReadinessAudits();
    process.exit(result.exitCode);
  } catch (error) {
    const report: ProductionReadinessReport = {
      timestamp: new Date().toISOString(),
      mode: process.env.FIXTURES_DIR ? "fixtures" : "real",
      sourceOfTruthPath: DEFAULT_SOURCE_OF_TRUTH_PATH,
      fixturesDir: process.env.FIXTURES_DIR ?? null,
      productionReady: false,
      summary: {
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
          checkCode: "criticalWorkerMissing",
          severity: "BLOCKER",
          status: "FAIL",
          targetType: "worker",
          targetName: "global",
          expected: "successful production readiness execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in production readiness checker execution.",
        },
      ],
      violations: [
        {
          checkCode: "criticalWorkerMissing",
          severity: "BLOCKER",
          targetType: "worker",
          targetName: "global",
          expected: "successful production readiness execution",
          actual: error instanceof Error ? error.message : String(error),
          details: "Fatal error in production readiness checker execution.",
        },
      ],
      snapshots: {
        workers: [],
        domains: [],
        routes: [],
        d1DatabaseNames: [],
        r2BucketNames: [],
        kvNamespaceNames: [],
        queueNames: [],
        durableObjectClassNames: [],
        d1TablesByDatabases: [],
      },
    };
    await writeReports(report, DEFAULT_REPORT_JSON_PATH, DEFAULT_REPORT_MARKDOWN_PATH);
    console.error("Production readiness check failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  executeCli();
}
