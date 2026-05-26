import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSocialflowNonprodCanaryConfig,
  type SocialflowNonprodCanaryConfigReport,
} from "./check-socialflow-nonprod-canary-config";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

const RUNTIME_SEED_SWITCH = "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH";

const OFF_SWITCHES = [
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;

const SOURCE_TABLES = [
  "saas",
  "tenant_strategic_dossiers",
  "agent_work_logs",
  "tenants",
  "saas_domains",
  "orchestrator_messages",
  "economic_events",
] as const;

const TARGET_TABLES = [
  "socialflow_seed_metadata",
  "socialflow_export_read_models",
  "socialflow_legacy_strategic_dossiers",
  "socialflow_legacy_tenant_progress",
  "socialflow_legacy_agent_work_logs",
  "socialflow_legacy_repository_context",
] as const;

const SOCIALFLOW_SLUGS = new Set(["socialflow", "socialflows"]);
const READ_ONLY_SQL_FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|UPSERT|MERGE|TRUNCATE|VACUUM|ATTACH|DETACH)\b/i;
const OAUTH_FORBIDDEN_TOKENS = [
  "socialflow_oauth_connections",
  "drako_integration_connections",
  "drako_integration_credentials",
  "authmeta",
  "auth_meta",
  "credential",
  "credentials",
  "encrypted_access_token",
  "encrypted_refresh_token",
  "encrypted_id_token",
  "access_token",
  "refresh_token",
  "id_token",
] as const;

export type ParityGroupName =
  | "runtimeSeed"
  | "exports"
  | "legacyDossiers"
  | "legacyProgress"
  | "legacyWorkLogs"
  | "legacyRepositoryContext";

export type SocialflowNonprodParityRemoteCommand = {
  databaseName: string;
  sql: string;
  displayCommand: string;
  args: string[];
  group: ParityGroupName | "safety" | "verify";
  touches: string;
};

type D1Binding = {
  binding: string;
  databaseName: string;
  databaseId: string;
};

type AnyRow = Record<string, unknown>;
type PreparedEntry = Record<string, unknown>;
type RemoteCommandRunner = (command: SocialflowNonprodParityRemoteCommand) => string;

type ParityOptions = {
  allowEmptySource?: boolean;
  allowDrift?: boolean;
  json?: boolean;
  configPaths?: string[];
  runner?: RemoteCommandRunner;
};

type Dataset = {
  sourceTables: Partial<Record<(typeof SOURCE_TABLES)[number], AnyRow[]>>;
  targetTables: Partial<Record<(typeof TARGET_TABLES)[number], AnyRow[]>>;
  sourceMissingTables: string[];
};

type ComparisonRow = {
  key: string;
  expected?: unknown;
  actual?: unknown;
};

type GroupReport = {
  sourceRows: number;
  expectedRows: number;
  targetRows: number;
  matched: number;
  missingInSocial: ComparisonRow[];
  missingInCore: ComparisonRow[];
  mismatched: ComparisonRow[];
  emptySources: string[];
  warnings: string[];
};

export type SocialflowNonprodOwnershipParityReport = {
  ok: boolean;
  status: "PARITY_OK" | "EMPTY_SOURCE_ACCEPTED" | "DRIFT_ALLOWED" | "DRIFT_DETECTED" | "EMPTY_SOURCE_REJECTED";
  exitCode: 0 | 2 | 3;
  sourceDbName: string;
  sourceDbId: string;
  targetDbName: string;
  targetDbId: string;
  readOnly: true;
  remoteWrites: 0;
  oauthExcluded: true;
  skippedOAuth: string[];
  totals: {
    matched: number;
    missingInSocial: number;
    missingInCore: number;
    mismatched: number;
    emptySources: number;
  };
  groups: Record<ParityGroupName, GroupReport>;
  warnings: string[];
};

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function hasCanaryOrNonprodToken(value: string): boolean {
  return /(canary|nonprod|staging|preview)/i.test(value);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeNullableString(value: unknown): string | null {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function normalizeSlug(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value: unknown, fallback: string): string {
  const status = normalizeText(value).toLowerCase();
  return status.length > 0 ? status : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeJsonText(value: unknown, fallback: string): string {
  const text = normalizeText(value);
  if (!text) return fallback;
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return fallback;
  }
}

function asSqlValue(value: unknown): string {
  if (value == null) return "NULL";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function csvFromRows(columns: string[], rows: AnyRow[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => {
      const value = normalizeText(row[column]).replace(/"/g, '""');
      return value.includes(",") || value.includes("\n") ? `"${value}"` : value;
    }).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function rowKey(row: AnyRow, fields: string[]): string {
  return fields.map((field) => normalizeText(row[field]).toLowerCase()).join("::");
}

function equivalent(entry: PreparedEntry | AnyRow, fields: string[]): unknown {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.endsWith("_json")) {
      result[field] = normalizeJsonText(entry[field], normalizeText(entry[field]));
    } else if (field === "cost_eur" || field === "materialization_step" || field === "version") {
      result[field] = normalizeNumber(entry[field], 0);
    } else {
      result[field] = normalizeNullableString(entry[field]);
    }
  }
  return result;
}

function createGroupReport(): GroupReport {
  return {
    sourceRows: 0,
    expectedRows: 0,
    targetRows: 0,
    matched: 0,
    missingInSocial: [],
    missingInCore: [],
    mismatched: [],
    emptySources: [],
    warnings: [],
  };
}

function createEmptyGroups(): Record<ParityGroupName, GroupReport> {
  return {
    runtimeSeed: createGroupReport(),
    exports: createGroupReport(),
    legacyDossiers: createGroupReport(),
    legacyProgress: createGroupReport(),
    legacyWorkLogs: createGroupReport(),
    legacyRepositoryContext: createGroupReport(),
  };
}

function assertSafeDatabase(label: string, binding: D1Binding): void {
  if (hasProductiveToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_PRODUCTIVE_DB:${label}:${binding.databaseName}`);
  }
  if (!hasCanaryOrNonprodToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_NOT_CANARY_OR_NONPROD:${label}:${binding.databaseName}`);
  }
}

function assertNoForbiddenOAuth(commandText: string): void {
  const lowered = commandText.toLowerCase();
  const forbidden = OAUTH_FORBIDDEN_TOKENS.find((token) => lowered.includes(token));
  if (forbidden) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_OAUTH_FORBIDDEN:${forbidden}`);
  }
}

export function assertReadOnlySocialflowNonprodParitySql(sql: string): void {
  const trimmed = sql.trim();
  if (!/^(SELECT|PRAGMA)\b/i.test(trimmed)) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_SQL_NOT_READ_ONLY:${trimmed.slice(0, 32)}`);
  }
  if (READ_ONLY_SQL_FORBIDDEN.test(trimmed)) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_SQL_WRITE_FORBIDDEN:${trimmed.match(READ_ONLY_SQL_FORBIDDEN)?.[1] ?? "write"}`);
  }
  assertNoForbiddenOAuth(trimmed);
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): D1Binding {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertSafeConfig(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }
  if (report.placeholders.length > 0) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_PLACEHOLDERS_BLOCKED:${report.configPath}:${report.placeholders.join(",")}`);
  }
  if (report.deployable) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }
  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_ROLLBACK_NOT_OFF:${report.configPath}`);
  }
  const runtimeSeedSwitchValue = report.switches[RUNTIME_SEED_SWITCH];
  if (runtimeSeedSwitchValue !== "0" && runtimeSeedSwitchValue !== "1") {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_RUNTIME_SEED_SWITCH_INVALID:${report.configPath}:${runtimeSeedSwitchValue ?? "missing"}`);
  }
  for (const switchName of OFF_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(`SOCIALFLOW_NONPROD_PARITY_SWITCH_NOT_OFF:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`);
    }
  }
}

function resolveBindings(configPaths: string[]): { dracoDb: D1Binding; socialDb: D1Binding } {
  const reports = configPaths.map((configPath) => checkSocialflowNonprodCanaryConfig({ configPath }));
  for (const report of reports) assertSafeConfig(report);

  const dracoBindings = reports.map((report) => getBinding(report, "DRACO_DB"));
  const socialBindings = reports.map((report) => getBinding(report, "SOCIAL_DB"));
  const dracoDb = dracoBindings[0];
  const socialDb = socialBindings[0];
  if (!dracoDb || !socialDb) throw new Error("SOCIALFLOW_NONPROD_PARITY_REQUIRED_BINDINGS_MISSING");

  for (const binding of dracoBindings) {
    if (binding.databaseName !== dracoDb.databaseName || binding.databaseId !== dracoDb.databaseId) {
      throw new Error(`SOCIALFLOW_NONPROD_PARITY_DRACO_DB_MISMATCH:${binding.databaseName}:${binding.databaseId}`);
    }
  }
  for (const binding of socialBindings) {
    if (binding.databaseName !== socialDb.databaseName || binding.databaseId !== socialDb.databaseId) {
      throw new Error(`SOCIALFLOW_NONPROD_PARITY_SOCIAL_DB_MISMATCH:${binding.databaseName}:${binding.databaseId}`);
    }
  }

  assertSafeDatabase("DRACO_DB", dracoDb);
  assertSafeDatabase("SOCIAL_DB", socialDb);
  return { dracoDb, socialDb };
}

function resolveWranglerInvocation(): { command: string; prefixArgs: string[] } {
  const wranglerJs = path.resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
  return { command: process.execPath, prefixArgs: [wranglerJs] };
}

function parseJsonRows(output: string): AnyRow[] {
  const parsed = JSON.parse(output) as unknown;
  if (Array.isArray(parsed)) {
    const first = parsed[0] as { results?: AnyRow[] } | undefined;
    return Array.isArray(first?.results) ? first.results : [];
  }
  if (typeof parsed === "object" && parsed != null) {
    const result = parsed as { results?: AnyRow[]; result?: { results?: AnyRow[] }[] };
    if (Array.isArray(result.results)) return result.results;
    if (Array.isArray(result.result) && Array.isArray(result.result[0]?.results)) return result.result[0].results;
  }
  return [];
}

function makeRemoteCommand(
  databaseName: string,
  sql: string,
  group: SocialflowNonprodParityRemoteCommand["group"],
  touches: string,
): SocialflowNonprodParityRemoteCommand {
  assertReadOnlySocialflowNonprodParitySql(sql);
  assertNoForbiddenOAuth(touches);
  return {
    databaseName,
    sql,
    group,
    touches,
    displayCommand: `wrangler d1 execute ${databaseName} --remote --command ${JSON.stringify(sql)} --json`,
    args: ["d1", "execute", databaseName, "--remote", "--command", sql, "--json"],
  };
}

function printRemotePrecheck(command: SocialflowNonprodParityRemoteCommand): void {
  console.log("SOCIALFLOW_NONPROD_PARITY_REMOTE_COMMAND_PRECHECK");
  console.log(JSON.stringify({
    command: command.displayCommand,
    databaseName: command.databaseName,
    databaseContainsProd: hasProductiveToken(command.databaseName),
    databasePosture: "canary/nonprod",
    isDeploy: false,
    writesData: false,
    activatesSwitches: false,
    oauthExcluded: true,
    touches: command.touches,
  }, null, 2));
}

function executeRemote(command: SocialflowNonprodParityRemoteCommand, runner: RemoteCommandRunner): string {
  assertSafeDatabase("remote-command", { binding: command.databaseName, databaseName: command.databaseName, databaseId: "command" });
  assertReadOnlySocialflowNonprodParitySql(command.sql);
  assertNoForbiddenOAuth(command.displayCommand);
  printRemotePrecheck(command);
  return runner(command);
}

function defaultRunner(command: SocialflowNonprodParityRemoteCommand): string {
  const wrangler = resolveWranglerInvocation();
  return execFileSync(wrangler.command, [...wrangler.prefixArgs, ...command.args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readRows(
  databaseName: string,
  sql: string,
  group: SocialflowNonprodParityRemoteCommand["group"],
  touches: string,
  runner: RemoteCommandRunner,
): AnyRow[] {
  const command = makeRemoteCommand(databaseName, sql, group, touches);
  return parseJsonRows(executeRemote(command, runner));
}

function tableExists(databaseName: string, tableName: string, runner: RemoteCommandRunner): boolean {
  const rows = readRows(
    databaseName,
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ${asSqlValue(tableName)};`,
    "safety",
    `table existence check for ${tableName}`,
    runner,
  );
  return rows.some((row) => normalizeText(row.name) === tableName);
}

function loadSourceTable(databaseName: string, tableName: (typeof SOURCE_TABLES)[number], runner: RemoteCommandRunner, warnings: string[]): AnyRow[] {
  if (!tableExists(databaseName, tableName, runner)) {
    warnings.push(`SOURCE_TABLE_MISSING:${databaseName}.${tableName}`);
    return [];
  }
  return readRows(databaseName, `SELECT * FROM ${tableName};`, "safety", `source read ${tableName}`, runner);
}

function loadTargetTable(databaseName: string, tableName: (typeof TARGET_TABLES)[number], runner: RemoteCommandRunner): AnyRow[] {
  if (!tableExists(databaseName, tableName, runner)) {
    throw new Error(`SOCIALFLOW_NONPROD_PARITY_TARGET_TABLE_MISSING:${databaseName}.${tableName}`);
  }
  return readRows(databaseName, `SELECT * FROM ${tableName};`, "verify", `target read ${tableName}`, runner);
}

function loadDataset(dracoDbName: string, socialDbName: string, runner: RemoteCommandRunner): Dataset {
  const sourceMissingTables: string[] = [];
  const sourceTables: Dataset["sourceTables"] = {};
  const targetTables: Dataset["targetTables"] = {};

  for (const tableName of SOURCE_TABLES) sourceTables[tableName] = loadSourceTable(dracoDbName, tableName, runner, sourceMissingTables);
  for (const tableName of TARGET_TABLES) targetTables[tableName] = loadTargetTable(socialDbName, tableName, runner);
  return { sourceTables, targetTables, sourceMissingTables };
}

function selectLatestSeedPerTenant(rows: AnyRow[]): PreparedEntry[] {
  const sorted = [...rows]
    .filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)))
    .sort((a, b) => {
      const tenantCompare = normalizeText(a.tenant_id).localeCompare(normalizeText(b.tenant_id));
      return tenantCompare !== 0 ? tenantCompare : normalizeText(b.created_at).localeCompare(normalizeText(a.created_at));
    });
  const picked = new Set<string>();
  const entries: PreparedEntry[] = [];
  for (const row of sorted) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.id);
    const slug = normalizeSlug(row.slug) === "socialflows" ? "socialflow" : normalizeSlug(row.slug);
    if (!tenantId || !saasId || picked.has(tenantId)) continue;
    picked.add(tenantId);
    entries.push({
      tenant_id: tenantId,
      saas_id: saasId,
      slug,
      domain: normalizeText(row.domain),
      status: normalizeStatus(row.status, "active"),
      metadata_json: JSON.stringify({
        source: "nonprod_core_backfill",
        name: normalizeNullableString(row.name),
        createdAt: normalizeNullableString(row.created_at),
      }),
    });
  }
  return entries;
}

function buildExportEntries(dataset: Dataset): PreparedEntry[] {
  const saasRows = (dataset.sourceTables.saas ?? []).filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)));
  const dossiers = dataset.sourceTables.tenant_strategic_dossiers ?? [];
  const workLogs = dataset.sourceTables.agent_work_logs ?? [];
  const messages = dataset.sourceTables.orchestrator_messages ?? [];
  const events = dataset.sourceTables.economic_events ?? [];
  const domains = dataset.sourceTables.saas_domains ?? [];

  return saasRows.map((saas) => {
    const tenantId = normalizeText(saas.tenant_id);
    const saasId = normalizeText(saas.id);
    const dossier = dossiers.find((row) => normalizeText(row.tenant_id) === tenantId) ?? null;
    const scopedLogs = workLogs.filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId);
    const scopedMessages = messages.filter((row) => normalizeText(row.tenant_id) === tenantId);
    const scopedEvents = events.filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId);
    const scopedDomains = domains.filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId);
    const payload = {
      dossier,
      blueprint: normalizeJsonText(saas.blueprint_snapshot, "{}"),
      scopedLogs,
      scopedMessages,
      scopedEvents,
      scopedDomains,
    };
    const sourceRevision = stableHash({ tenantId, saasId, payload });
    return {
      tenant_id: tenantId,
      saas_id: saasId,
      slug: normalizeSlug(saas.slug),
      status: "ready",
      dossier_json: dossier ? JSON.stringify(dossier) : "",
      blueprint_json: payload.blueprint,
      work_logs_csv: csvFromRows(["id", "agent_name", "action_type", "status", "cost_eur", "created_at"], scopedLogs),
      orchestrator_messages_csv: csvFromRows(["role", "created_at", "content"], scopedMessages),
      financials_csv: [
        "metric,value,unit",
        `mrr,${normalizeNumber(saas.mrr_eur)},EUR`,
        `total_cost,${normalizeNumber(saas.cost_eur)},EUR`,
        `risk_level,${normalizeText(saas.risk_level) || "unknown"},ENUM`,
        `plan_tier,${normalizeText(saas.plan_tier)},ENUM`,
      ].join("\n") + "\n",
      economic_events_csv: csvFromRows(["id", "type", "severity", "created_at", "payload_json"], scopedEvents),
      domains_json: JSON.stringify(scopedDomains),
      meta_json: JSON.stringify({ saasId, tenantId, generatedAt: "socialflow_nonprod_ownership_backfill", sourceRevision }),
      source_revision: sourceRevision,
    };
  }).filter((entry) => normalizeText(entry.tenant_id) && normalizeText(entry.saas_id));
}

function buildLegacyDossierEntries(rows: AnyRow[]): PreparedEntry[] {
  return rows.map((row) => ({
    tenant_id: normalizeText(row.tenant_id),
    dossier_id: normalizeText(row.id),
    status: normalizeStatus(row.status, "draft"),
    version: Math.max(1, Math.trunc(normalizeNumber(row.version, 1))),
    form_data_json: normalizeJsonText(row.form_data, "{}"),
    analysis_data_json: normalizeNullableString(row.analysis_data),
    plan_data_json: normalizeNullableString(row.plan_data),
    source_updated_at: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at),
  })).filter((entry) => normalizeText(entry.tenant_id) && normalizeText(entry.dossier_id));
}

function buildLegacyProgressEntries(rows: AnyRow[]): PreparedEntry[] {
  return rows.map((row) => ({
    tenant_id: normalizeText(row.tenant_id),
    materialization_step: Math.max(0, Math.trunc(normalizeNumber(row.materialization_step, 0))),
  })).filter((entry) => normalizeText(entry.tenant_id));
}

function buildLegacyWorkLogEntries(rows: AnyRow[]): PreparedEntry[] {
  return rows.map((row) => ({
    tenant_id: normalizeText(row.tenant_id),
    log_id: normalizeText(row.id),
    saas_id: normalizeNullableString(row.saas_id),
    agent_name: normalizeText(row.agent_name) || "unknown",
    action_type: normalizeText(row.action_type) || "unknown",
    status: normalizeStatus(row.status, "unknown"),
    output_json: normalizeJsonText(row.output_json, "{}"),
    cost_eur: normalizeNumber(row.cost_eur, 0),
    created_at: normalizeNullableString(row.created_at) ?? "1970-01-01T00:00:00.000Z",
  })).filter((entry) => normalizeText(entry.tenant_id) && normalizeText(entry.log_id));
}

function buildLegacyRepositoryEntries(dataset: Dataset): PreparedEntry[] {
  const saasRows = (dataset.sourceTables.saas ?? []).filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)));
  const domains = dataset.sourceTables.saas_domains ?? [];
  return saasRows.map((saas) => {
    const tenantId = normalizeText(saas.tenant_id);
    const saasId = normalizeText(saas.id);
    const domain = domains.find((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId);
    return {
      tenant_id: tenantId,
      saas_id: saasId,
      slug: normalizeSlug(saas.slug),
      domain: normalizeNullableString(domain?.domain),
      status: normalizeStatus(saas.status, "active"),
      metadata_json: JSON.stringify({
        source: "nonprod_core_backfill",
        coreSlug: normalizeSlug(saas.slug),
        sourceUpdatedAt: normalizeNullableString(saas.updated_at) ?? normalizeNullableString(saas.created_at),
      }),
    };
  }).filter((entry) => normalizeText(entry.tenant_id) && normalizeText(entry.saas_id));
}

function compareEntries(
  group: GroupReport,
  expectedEntries: PreparedEntry[],
  targetRows: AnyRow[],
  keyFields: string[],
  fields: string[],
): void {
  const expectedByKey = new Map<string, PreparedEntry>();
  const targetByKey = new Map<string, AnyRow>();
  for (const entry of expectedEntries) expectedByKey.set(rowKey(entry, keyFields), entry);
  for (const row of targetRows) targetByKey.set(rowKey(row, keyFields), row);

  for (const [key, expected] of expectedByKey) {
    const actual = targetByKey.get(key);
    if (!actual) {
      group.missingInSocial.push({ key, expected: equivalent(expected, fields) });
      continue;
    }
    const expectedComparable = equivalent(expected, fields);
    const actualComparable = equivalent(actual, fields);
    if (JSON.stringify(expectedComparable) !== JSON.stringify(actualComparable)) {
      group.mismatched.push({ key, expected: expectedComparable, actual: actualComparable });
      continue;
    }
    group.matched += 1;
  }

  for (const [key, actual] of targetByKey) {
    if (!expectedByKey.has(key)) group.missingInCore.push({ key, actual: equivalent(actual, fields) });
  }
}

function fillGroup(group: GroupReport, sourceRows: number, expectedEntries: PreparedEntry[], targetRows: AnyRow[], keyFields: string[], fields: string[]): void {
  group.sourceRows = sourceRows;
  group.expectedRows = expectedEntries.length;
  group.targetRows = targetRows.length;
  compareEntries(group, expectedEntries, targetRows, keyFields, fields);
}

function calculateGroups(dataset: Dataset): Record<ParityGroupName, GroupReport> {
  const groups = createEmptyGroups();
  fillGroup(groups.runtimeSeed, dataset.sourceTables.saas?.length ?? 0, selectLatestSeedPerTenant(dataset.sourceTables.saas ?? []), dataset.targetTables.socialflow_seed_metadata ?? [], ["tenant_id", "saas_id", "slug"], ["tenant_id", "saas_id", "slug", "domain", "status", "metadata_json"]);
  fillGroup(groups.exports, dataset.sourceTables.saas?.length ?? 0, buildExportEntries(dataset), dataset.targetTables.socialflow_export_read_models ?? [], ["tenant_id", "saas_id"], ["tenant_id", "saas_id", "slug", "status", "dossier_json", "blueprint_json", "work_logs_csv", "orchestrator_messages_csv", "financials_csv", "economic_events_csv", "domains_json", "meta_json", "source_revision"]);
  fillGroup(groups.legacyDossiers, dataset.sourceTables.tenant_strategic_dossiers?.length ?? 0, buildLegacyDossierEntries(dataset.sourceTables.tenant_strategic_dossiers ?? []), dataset.targetTables.socialflow_legacy_strategic_dossiers ?? [], ["tenant_id", "dossier_id"], ["tenant_id", "dossier_id", "status", "version", "form_data_json", "analysis_data_json", "plan_data_json", "source_updated_at"]);
  fillGroup(groups.legacyProgress, dataset.sourceTables.tenants?.length ?? 0, buildLegacyProgressEntries(dataset.sourceTables.tenants ?? []), dataset.targetTables.socialflow_legacy_tenant_progress ?? [], ["tenant_id"], ["tenant_id", "materialization_step"]);
  fillGroup(groups.legacyWorkLogs, dataset.sourceTables.agent_work_logs?.length ?? 0, buildLegacyWorkLogEntries(dataset.sourceTables.agent_work_logs ?? []), dataset.targetTables.socialflow_legacy_agent_work_logs ?? [], ["tenant_id", "log_id"], ["tenant_id", "log_id", "saas_id", "agent_name", "action_type", "status", "output_json", "cost_eur", "created_at"]);
  fillGroup(groups.legacyRepositoryContext, dataset.sourceTables.saas?.length ?? 0, buildLegacyRepositoryEntries(dataset), dataset.targetTables.socialflow_legacy_repository_context ?? [], ["tenant_id", "saas_id"], ["tenant_id", "saas_id", "slug", "domain", "status", "metadata_json"]);

  for (const warning of dataset.sourceMissingTables) {
    const tableName = warning.split(".").pop() ?? warning;
    for (const group of Object.values(groups)) group.warnings.push(warning);
    if (tableName === "saas") {
      groups.runtimeSeed.emptySources.push(tableName);
      groups.exports.emptySources.push(tableName);
      groups.legacyRepositoryContext.emptySources.push(tableName);
    } else if (tableName === "tenant_strategic_dossiers") {
      groups.legacyDossiers.emptySources.push(tableName);
    } else if (tableName === "agent_work_logs") {
      groups.legacyWorkLogs.emptySources.push(tableName);
    } else if (tableName === "tenants") {
      groups.legacyProgress.emptySources.push(tableName);
    }
  }
  return groups;
}

function calculateTotals(groups: Record<ParityGroupName, GroupReport>): SocialflowNonprodOwnershipParityReport["totals"] {
  return Object.values(groups).reduce((totals, group) => ({
    matched: totals.matched + group.matched,
    missingInSocial: totals.missingInSocial + group.missingInSocial.length,
    missingInCore: totals.missingInCore + group.missingInCore.length,
    mismatched: totals.mismatched + group.mismatched.length,
    emptySources: totals.emptySources + group.emptySources.length,
  }), { matched: 0, missingInSocial: 0, missingInCore: 0, mismatched: 0, emptySources: 0 });
}

function collectWarnings(dataset: Dataset, totals: SocialflowNonprodOwnershipParityReport["totals"]): string[] {
  const warnings = [...dataset.sourceMissingTables];
  const allSourceRows = Object.values(dataset.sourceTables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  if (allSourceRows === 0) warnings.push("NONPROD_SOURCE_EMPTY_OR_NOT_BOOTSTRAPPED:no source rows found in DRACO_DB canary");
  if (totals.missingInSocial + totals.missingInCore + totals.mismatched > 0) warnings.push("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_DRIFT_DETECTED");
  return warnings;
}

export async function runCheckSocialflowNonprodOwnershipParity(options: ParityOptions = {}): Promise<SocialflowNonprodOwnershipParityReport> {
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const runner = options.runner ?? defaultRunner;
  const { dracoDb, socialDb } = resolveBindings(configPaths);
  const dataset = loadDataset(dracoDb.databaseName, socialDb.databaseName, runner);
  const groups = calculateGroups(dataset);
  const totals = calculateTotals(groups);
  const warnings = collectWarnings(dataset, totals);
  const sourceRowCount = Object.values(dataset.sourceTables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  const emptySource = sourceRowCount === 0;
  const hasDrift = totals.missingInSocial + totals.missingInCore + totals.mismatched > 0;

  let status: SocialflowNonprodOwnershipParityReport["status"] = "PARITY_OK";
  let exitCode: SocialflowNonprodOwnershipParityReport["exitCode"] = 0;
  if (emptySource && !options.allowEmptySource) {
    status = "EMPTY_SOURCE_REJECTED";
    exitCode = 3;
  } else if (hasDrift && options.allowDrift) {
    status = "DRIFT_ALLOWED";
  } else if (hasDrift) {
    status = "DRIFT_DETECTED";
    exitCode = 2;
  } else if (emptySource && options.allowEmptySource) {
    status = "EMPTY_SOURCE_ACCEPTED";
    warnings.push("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_EMPTY_SOURCE_ACCEPTED");
  }

  return {
    ok: exitCode === 0,
    status,
    exitCode,
    sourceDbName: dracoDb.databaseName,
    sourceDbId: dracoDb.databaseId,
    targetDbName: socialDb.databaseName,
    targetDbId: socialDb.databaseId,
    readOnly: true,
    remoteWrites: 0,
    oauthExcluded: true,
    skippedOAuth: ["socialflow_oauth_connections", "drako_integration_connections", "drako_integration_credentials", "tokens", "credentials", "authMeta"],
    totals,
    groups,
    warnings,
  };
}

function parseArgs(argv: string[]): ParityOptions {
  return {
    allowEmptySource: argv.includes("--allow-empty-source"),
    allowDrift: argv.includes("--allow-drift"),
    json: argv.includes("--json"),
    configPaths: argv.filter((arg) => arg.startsWith("--config=")).map((arg) => arg.slice("--config=".length)),
  };
}

export async function runCheckSocialflowNonprodOwnershipParityCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runCheckSocialflowNonprodOwnershipParity(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      sourceDbName: report.sourceDbName,
      targetDbName: report.targetDbName,
      readOnly: report.readOnly,
      remoteWrites: report.remoteWrites,
      oauthExcluded: report.oauthExcluded,
      skippedOAuth: report.skippedOAuth,
      totals: report.totals,
      warnings: report.warnings,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (report.status === "EMPTY_SOURCE_ACCEPTED") console.log("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_EMPTY_SOURCE_ACCEPTED");
    if (report.exitCode === 0) console.log("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_CHECK_SUCCESS");
    if (report.exitCode === 2) console.error("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_DRIFT_DETECTED");
    if (report.exitCode === 3) console.error("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_EMPTY_SOURCE_REJECTED");
    return report.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runCheckSocialflowNonprodOwnershipParityCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
