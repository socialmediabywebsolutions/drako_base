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

const OFF_SWITCHES = [
  "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;

const SOCIALFLOW_SLUGS = new Set(["socialflow", "socialflows"]);
const OAUTH_FORBIDDEN_TOKENS = [
  "socialflow_oauth_connections",
  "drako_integration_credentials",
  "encrypted_access_token",
  "encrypted_refresh_token",
  "encrypted_id_token",
] as const;

const TARGET_TABLES = [
  "socialflow_seed_metadata",
  "socialflow_export_read_models",
  "socialflow_legacy_strategic_dossiers",
  "socialflow_legacy_tenant_progress",
  "socialflow_legacy_agent_work_logs",
  "socialflow_legacy_repository_context",
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

type BackfillMode = "dry-run" | "verify-only" | "apply";

export type BackfillGroupName =
  | "runtimeSeed"
  | "exports"
  | "legacyDossiers"
  | "legacyProgress"
  | "legacyWorkLogs"
  | "legacyRepositoryContext";

type RemoteCommandKind = "read" | "write";

export type SocialflowNonprodBackfillRemoteCommand = {
  kind: RemoteCommandKind;
  databaseName: string;
  sql: string;
  displayCommand: string;
  args: string[];
  group: BackfillGroupName | "safety" | "verify";
  touches: string;
};

type D1Binding = {
  binding: string;
  databaseName: string;
  databaseId: string;
};

type AnyRow = Record<string, unknown>;

type TableStats = {
  sourceRows: number;
  selected: number;
  targetRows: number;
  inserts: number;
  updates: number;
  unchanged: number;
  warnings: string[];
};

export type SocialflowNonprodOwnershipBackfillReport = {
  ok: boolean;
  mode: BackfillMode;
  status: "DRY_RUN_OK" | "VERIFY_OK" | "APPLY_OK";
  sourceDbName: string;
  sourceDbId: string;
  targetDbName: string;
  targetDbId: string;
  oauthExcluded: true;
  idempotent: boolean;
  remoteWrites: number;
  tables: Record<BackfillGroupName, TableStats>;
  targetCounts: Record<string, number>;
  warnings: string[];
};

type RunOptions = {
  mode?: BackfillMode;
  configPaths?: string[];
  runner?: RemoteCommandRunner;
};

type RemoteCommandRunner = (command: SocialflowNonprodBackfillRemoteCommand) => string;

type PreparedEntry = Record<string, unknown>;

type Operation<TEntry extends PreparedEntry> = {
  type: "insert" | "update" | "unchanged";
  key: string;
  entry: TEntry;
};

type Dataset = {
  sourceTables: Partial<Record<(typeof SOURCE_TABLES)[number], AnyRow[]>>;
  targetTables: Partial<Record<(typeof TARGET_TABLES)[number], AnyRow[]>>;
  sourceMissingTables: string[];
  targetCounts: Record<string, number>;
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
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function tableStats(): TableStats {
  return {
    sourceRows: 0,
    selected: 0,
    targetRows: 0,
    inserts: 0,
    updates: 0,
    unchanged: 0,
    warnings: [],
  };
}

function createEmptyStats(): Record<BackfillGroupName, TableStats> {
  return {
    runtimeSeed: tableStats(),
    exports: tableStats(),
    legacyDossiers: tableStats(),
    legacyProgress: tableStats(),
    legacyWorkLogs: tableStats(),
    legacyRepositoryContext: tableStats(),
  };
}

function assertSafeDatabase(label: string, binding: D1Binding): void {
  if (hasProductiveToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_PRODUCTIVE_DB:${label}:${binding.databaseName}`);
  }

  if (!hasCanaryOrNonprodToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_NOT_CANARY_OR_NONPROD:${label}:${binding.databaseName}`);
  }
}

function assertNoForbiddenOAuth(commandText: string): void {
  const lowered = commandText.toLowerCase();
  const forbidden = OAUTH_FORBIDDEN_TOKENS.find((token) => lowered.includes(token));
  if (forbidden) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_OAUTH_FORBIDDEN:${forbidden}`);
  }
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): D1Binding {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertSafeConfig(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }

  if (report.placeholders.length > 0) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_PLACEHOLDERS_BLOCKED:${report.configPath}:${report.placeholders.join(",")}`);
  }

  if (report.deployable) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }

  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_ROLLBACK_NOT_OFF:${report.configPath}`);
  }

  for (const switchName of OFF_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_SWITCH_NOT_OFF:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`);
    }
  }
}

function resolveBindings(configPaths: string[]): {
  reports: SocialflowNonprodCanaryConfigReport[];
  dracoDb: D1Binding;
  socialDb: D1Binding;
} {
  const reports = configPaths.map((configPath) => checkSocialflowNonprodCanaryConfig({ configPath }));
  for (const report of reports) {
    assertSafeConfig(report);
  }

  const dracoBindings = reports.map((report) => getBinding(report, "DRACO_DB"));
  const socialBindings = reports.map((report) => getBinding(report, "SOCIAL_DB"));
  const dracoDb = dracoBindings[0];
  const socialDb = socialBindings[0];

  if (!dracoDb || !socialDb) {
    throw new Error("SOCIALFLOW_NONPROD_BACKFILL_REQUIRED_BINDINGS_MISSING");
  }

  for (const binding of dracoBindings) {
    if (binding.databaseName !== dracoDb.databaseName || binding.databaseId !== dracoDb.databaseId) {
      throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_DRACO_DB_MISMATCH:${binding.databaseName}:${binding.databaseId}`);
    }
  }

  for (const binding of socialBindings) {
    if (binding.databaseName !== socialDb.databaseName || binding.databaseId !== socialDb.databaseId) {
      throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_SOCIAL_DB_MISMATCH:${binding.databaseName}:${binding.databaseId}`);
    }
  }

  assertSafeDatabase("DRACO_DB", dracoDb);
  assertSafeDatabase("SOCIAL_DB", socialDb);

  return { reports, dracoDb, socialDb };
}

function resolveWranglerInvocation(): { command: string; prefixArgs: string[] } {
  const wranglerJs = path.resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
  return {
    command: process.execPath,
    prefixArgs: [wranglerJs],
  };
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
    if (Array.isArray(result.result) && Array.isArray(result.result[0]?.results)) {
      return result.result[0].results;
    }
  }
  return [];
}

function makeRemoteCommand(
  kind: RemoteCommandKind,
  databaseName: string,
  sql: string,
  group: SocialflowNonprodBackfillRemoteCommand["group"],
  touches: string,
): SocialflowNonprodBackfillRemoteCommand {
  assertNoForbiddenOAuth(sql);
  assertNoForbiddenOAuth(touches);
  return {
    kind,
    databaseName,
    sql,
    group,
    touches,
    displayCommand: `wrangler d1 execute ${databaseName} --remote --command ${JSON.stringify(sql)} --json`,
    args: ["d1", "execute", databaseName, "--remote", "--command", sql, "--json"],
  };
}

function printRemotePrecheck(command: SocialflowNonprodBackfillRemoteCommand): void {
  console.log("SOCIALFLOW_NONPROD_BACKFILL_REMOTE_COMMAND_PRECHECK");
  console.log(JSON.stringify({
    command: command.displayCommand,
    databaseName: command.databaseName,
    databaseContainsProd: hasProductiveToken(command.databaseName),
    databasePosture: "canary/nonprod",
    isDeploy: false,
    activatesSwitches: false,
    oauthExcluded: true,
    touches: command.touches,
  }, null, 2));
}

function executeRemote(command: SocialflowNonprodBackfillRemoteCommand, runner: RemoteCommandRunner): string {
  assertSafeDatabase("remote-command", {
    binding: command.databaseName,
    databaseName: command.databaseName,
    databaseId: "command",
  });
  assertNoForbiddenOAuth(command.displayCommand);
  printRemotePrecheck(command);
  return runner(command);
}

function defaultRunner(command: SocialflowNonprodBackfillRemoteCommand): string {
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
  group: SocialflowNonprodBackfillRemoteCommand["group"],
  touches: string,
  runner: RemoteCommandRunner,
): AnyRow[] {
  const command = makeRemoteCommand("read", databaseName, sql, group, touches);
  return parseJsonRows(executeRemote(command, runner));
}

function writeSql(
  databaseName: string,
  sql: string,
  group: BackfillGroupName,
  touches: string,
  runner: RemoteCommandRunner,
): void {
  const command = makeRemoteCommand("write", databaseName, sql, group, touches);
  executeRemote(command, runner);
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

function loadSourceTable(
  databaseName: string,
  tableName: (typeof SOURCE_TABLES)[number],
  runner: RemoteCommandRunner,
  warnings: string[],
): AnyRow[] {
  if (!tableExists(databaseName, tableName, runner)) {
    warnings.push(`SOURCE_TABLE_MISSING:${databaseName}.${tableName}`);
    return [];
  }

  return readRows(databaseName, `SELECT * FROM ${tableName};`, "safety", `source read ${tableName}`, runner);
}

function loadTargetTable(
  databaseName: string,
  tableName: (typeof TARGET_TABLES)[number],
  runner: RemoteCommandRunner,
): AnyRow[] {
  if (!tableExists(databaseName, tableName, runner)) {
    throw new Error(`SOCIALFLOW_NONPROD_BACKFILL_TARGET_TABLE_MISSING:${databaseName}.${tableName}`);
  }

  return readRows(databaseName, `SELECT * FROM ${tableName};`, "verify", `target read ${tableName}`, runner);
}

function countTargetTable(databaseName: string, tableName: (typeof TARGET_TABLES)[number], runner: RemoteCommandRunner): number {
  const rows = readRows(databaseName, `SELECT COUNT(*) AS count FROM ${tableName};`, "verify", `target count ${tableName}`, runner);
  return Math.trunc(normalizeNumber(rows[0]?.count, 0));
}

function loadDataset(dracoDbName: string, socialDbName: string, runner: RemoteCommandRunner): Dataset {
  const warnings: string[] = [];
  const sourceTables: Dataset["sourceTables"] = {};
  const targetTables: Dataset["targetTables"] = {};
  const targetCounts: Record<string, number> = {};

  for (const tableName of SOURCE_TABLES) {
    sourceTables[tableName] = loadSourceTable(dracoDbName, tableName, runner, warnings);
  }

  for (const tableName of TARGET_TABLES) {
    targetTables[tableName] = loadTargetTable(socialDbName, tableName, runner);
    targetCounts[tableName] = countTargetTable(socialDbName, tableName, runner);
  }

  return {
    sourceTables,
    targetTables,
    sourceMissingTables: warnings,
    targetCounts,
  };
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function stableId(prefix: string, parts: unknown[]): string {
  const source = parts.map((part) => normalizeText(part)).join("_").toLowerCase();
  const safe = source.replace(/[^a-z0-9_]/g, "_").slice(0, 48);
  return `${prefix}_${safe || stableHash(parts)}`;
}

function rowKey(row: AnyRow, fields: string[]): string {
  return fields.map((field) => normalizeText(row[field]).toLowerCase()).join("::");
}

function planOperations<TEntry extends PreparedEntry>(
  entries: TEntry[],
  existingRows: AnyRow[],
  keyFields: string[],
  comparable: (entry: TEntry | AnyRow) => unknown,
): Operation<TEntry>[] {
  const existing = new Map<string, AnyRow>();
  for (const row of existingRows) {
    existing.set(rowKey(row, keyFields), row);
  }

  return entries.map((entry) => {
    const key = rowKey(entry, keyFields);
    const current = existing.get(key);
    if (!current) return { type: "insert", key, entry };
    if (JSON.stringify(comparable(entry)) !== JSON.stringify(comparable(current))) {
      return { type: "update", key, entry };
    }
    return { type: "unchanged", key, entry };
  });
}

function summarize<TEntry extends PreparedEntry>(
  stats: TableStats,
  sourceRows: number,
  targetRows: number,
  entries: TEntry[],
  operations: Operation<TEntry>[],
): void {
  stats.sourceRows = sourceRows;
  stats.selected = entries.length;
  stats.targetRows = targetRows;
  stats.inserts = operations.filter((operation) => operation.type === "insert").length;
  stats.updates = operations.filter((operation) => operation.type === "update").length;
  stats.unchanged = operations.filter((operation) => operation.type === "unchanged").length;
}

function selectLatestSeedPerTenant(rows: AnyRow[]): PreparedEntry[] {
  const sorted = [...rows]
    .filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)))
    .sort((a, b) => {
      const tenantCompare = normalizeText(a.tenant_id).localeCompare(normalizeText(b.tenant_id));
      if (tenantCompare !== 0) return tenantCompare;
      return normalizeText(b.created_at).localeCompare(normalizeText(a.created_at));
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
      id: stableId("sf_seed", [tenantId, saasId, slug]),
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

function buildRuntimeSeedSql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_seed_metadata (
      id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
    ) VALUES (
      ${asSqlValue(entry.id)}, ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.slug)}, ${asSqlValue(entry.domain)}, ${asSqlValue(entry.status)},
      ${asSqlValue(entry.metadata_json)}, datetime('now'), datetime('now')
    )
    ON CONFLICT(tenant_id, saas_id, slug) DO UPDATE SET
      domain = excluded.domain,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at;
  `;
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
      id: stableId("sf_export_rm", [tenantId, saasId]),
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
      meta_json: JSON.stringify({
        saasId,
        tenantId,
        generatedAt: "socialflow_nonprod_ownership_backfill",
        sourceRevision,
      }),
      source_revision: sourceRevision,
    };
  }).filter((entry) => normalizeText(entry.tenant_id) && normalizeText(entry.saas_id));
}

function csvFromRows(columns: string[], rows: AnyRow[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => {
      const value = normalizeText(row[column]).replace(/"/g, '""');
      return value.includes(",") || value.includes("\n") ? `"${value}"` : value;
    }).join(","));
  }
  return lines.join("\n") + "\n";
}

function buildExportSql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_export_read_models (
      id, tenant_id, saas_id, slug, status, dossier_json, blueprint_json,
      work_logs_csv, orchestrator_messages_csv, financials_csv, economic_events_csv,
      domains_json, meta_json, source_revision, created_at, updated_at
    ) VALUES (
      ${asSqlValue(entry.id)}, ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.slug)}, ${asSqlValue(entry.status)}, ${asSqlValue(entry.dossier_json)},
      ${asSqlValue(entry.blueprint_json)}, ${asSqlValue(entry.work_logs_csv)},
      ${asSqlValue(entry.orchestrator_messages_csv)}, ${asSqlValue(entry.financials_csv)},
      ${asSqlValue(entry.economic_events_csv)}, ${asSqlValue(entry.domains_json)},
      ${asSqlValue(entry.meta_json)}, ${asSqlValue(entry.source_revision)}, datetime('now'), datetime('now')
    )
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      slug = excluded.slug,
      status = excluded.status,
      dossier_json = excluded.dossier_json,
      blueprint_json = excluded.blueprint_json,
      work_logs_csv = excluded.work_logs_csv,
      orchestrator_messages_csv = excluded.orchestrator_messages_csv,
      financials_csv = excluded.financials_csv,
      economic_events_csv = excluded.economic_events_csv,
      domains_json = excluded.domains_json,
      meta_json = excluded.meta_json,
      source_revision = excluded.source_revision,
      updated_at = excluded.updated_at;
  `;
}

function buildLegacyDossierEntries(rows: AnyRow[]): PreparedEntry[] {
  const entries: PreparedEntry[] = [];
  for (const row of rows) {
    const tenantId = normalizeText(row.tenant_id);
    const dossierId = normalizeText(row.id);
    if (!tenantId || !dossierId) continue;
    entries.push({
      id: stableId("sf_legacy_dossier", [tenantId, dossierId]),
      tenant_id: tenantId,
      dossier_id: dossierId,
      status: normalizeStatus(row.status, "draft"),
      version: Math.max(1, Math.trunc(normalizeNumber(row.version, 1))),
      form_data_json: normalizeJsonText(row.form_data, "{}"),
      analysis_data_json: normalizeNullableString(row.analysis_data),
      plan_data_json: normalizeNullableString(row.plan_data),
      source_updated_at: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at),
    });
  }
  return entries;
}

function buildLegacyProgressEntries(rows: AnyRow[]): PreparedEntry[] {
  const entries: PreparedEntry[] = [];
  for (const row of rows) {
    const tenantId = normalizeText(row.tenant_id);
    if (!tenantId) continue;
    entries.push({
      tenant_id: tenantId,
      materialization_step: Math.max(0, Math.trunc(normalizeNumber(row.materialization_step, 0))),
    });
  }
  return entries;
}

function buildLegacyWorkLogEntries(rows: AnyRow[]): PreparedEntry[] {
  const entries: PreparedEntry[] = [];
  for (const row of rows) {
    const tenantId = normalizeText(row.tenant_id);
    const logId = normalizeText(row.id);
    if (!tenantId || !logId) continue;
    entries.push({
      id: stableId("sf_legacy_log", [tenantId, logId]),
      tenant_id: tenantId,
      log_id: logId,
      saas_id: normalizeNullableString(row.saas_id),
      agent_name: normalizeText(row.agent_name) || "unknown",
      action_type: normalizeText(row.action_type) || "unknown",
      status: normalizeStatus(row.status, "unknown"),
      output_json: normalizeJsonText(row.output_json, "{}"),
      cost_eur: normalizeNumber(row.cost_eur, 0),
      created_at: normalizeNullableString(row.created_at) ?? "1970-01-01T00:00:00.000Z",
    });
  }
  return entries;
}

function buildLegacyRepositoryEntries(dataset: Dataset): PreparedEntry[] {
  const saasRows = (dataset.sourceTables.saas ?? []).filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)));
  const domains = dataset.sourceTables.saas_domains ?? [];
  const entries: PreparedEntry[] = [];
  for (const saas of saasRows) {
    const tenantId = normalizeText(saas.tenant_id);
    const saasId = normalizeText(saas.id);
    if (!tenantId || !saasId) continue;
    const domain = domains.find((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId);
    entries.push({
      id: stableId("sf_legacy_repo", [tenantId, saasId]),
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
    });
  }
  return entries;
}

function buildLegacyDossierSql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_legacy_strategic_dossiers (
      id, tenant_id, dossier_id, status, version, form_data_json, analysis_data_json,
      plan_data_json, source_updated_at, created_at, updated_at
    ) VALUES (
      ${asSqlValue(entry.id)}, ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.dossier_id)},
      ${asSqlValue(entry.status)}, ${asSqlValue(entry.version)}, ${asSqlValue(entry.form_data_json)},
      ${asSqlValue(entry.analysis_data_json)}, ${asSqlValue(entry.plan_data_json)},
      ${asSqlValue(entry.source_updated_at)}, datetime('now'), datetime('now')
    )
    ON CONFLICT(tenant_id, dossier_id) DO UPDATE SET
      status = excluded.status,
      version = excluded.version,
      form_data_json = excluded.form_data_json,
      analysis_data_json = excluded.analysis_data_json,
      plan_data_json = excluded.plan_data_json,
      source_updated_at = excluded.source_updated_at,
      updated_at = excluded.updated_at;
  `;
}

function buildLegacyProgressSql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_legacy_tenant_progress (
      tenant_id, materialization_step, updated_at
    ) VALUES (
      ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.materialization_step)}, datetime('now')
    )
    ON CONFLICT(tenant_id) DO UPDATE SET
      materialization_step = excluded.materialization_step,
      updated_at = excluded.updated_at;
  `;
}

function buildLegacyWorkLogSql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_legacy_agent_work_logs (
      id, tenant_id, log_id, saas_id, agent_name, action_type, status, output_json,
      cost_eur, created_at, updated_at
    ) VALUES (
      ${asSqlValue(entry.id)}, ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.log_id)},
      ${asSqlValue(entry.saas_id)}, ${asSqlValue(entry.agent_name)}, ${asSqlValue(entry.action_type)},
      ${asSqlValue(entry.status)}, ${asSqlValue(entry.output_json)}, ${asSqlValue(entry.cost_eur)},
      ${asSqlValue(entry.created_at)}, datetime('now')
    )
    ON CONFLICT(tenant_id, log_id) DO UPDATE SET
      saas_id = excluded.saas_id,
      agent_name = excluded.agent_name,
      action_type = excluded.action_type,
      status = excluded.status,
      output_json = excluded.output_json,
      cost_eur = excluded.cost_eur,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `;
}

function buildLegacyRepositorySql(entry: PreparedEntry): string {
  return `
    INSERT INTO socialflow_legacy_repository_context (
      id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
    ) VALUES (
      ${asSqlValue(entry.id)}, ${asSqlValue(entry.tenant_id)}, ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.slug)}, ${asSqlValue(entry.domain)}, ${asSqlValue(entry.status)},
      ${asSqlValue(entry.metadata_json)}, datetime('now'), datetime('now')
    )
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      slug = excluded.slug,
      domain = excluded.domain,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at;
  `;
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

function applyOperations(
  databaseName: string,
  group: BackfillGroupName,
  operations: Operation<PreparedEntry>[],
  sqlBuilder: (entry: PreparedEntry) => string,
  runner: RemoteCommandRunner,
): number {
  let writes = 0;
  for (const operation of operations) {
    if (operation.type === "unchanged") continue;
    const sql = sqlBuilder(operation.entry);
    writeSql(databaseName, sql, group, `${group} ${operation.type} ${operation.key}`, runner);
    writes += 1;
  }
  return writes;
}

function calculateOperations(dataset: Dataset, stats: Record<BackfillGroupName, TableStats>) {
  const runtimeEntries = selectLatestSeedPerTenant(dataset.sourceTables.saas ?? []);
  const runtimeOps = planOperations(
    runtimeEntries,
    dataset.targetTables.socialflow_seed_metadata ?? [],
    ["tenant_id", "saas_id", "slug"],
    (entry) => equivalent(entry, ["tenant_id", "saas_id", "slug", "domain", "status", "metadata_json"]),
  );
  summarize(stats.runtimeSeed, dataset.sourceTables.saas?.length ?? 0, dataset.targetTables.socialflow_seed_metadata?.length ?? 0, runtimeEntries, runtimeOps);

  const exportEntries = buildExportEntries(dataset);
  const exportOps = planOperations(
    exportEntries,
    dataset.targetTables.socialflow_export_read_models ?? [],
    ["tenant_id", "saas_id"],
    (entry) => equivalent(entry, [
      "tenant_id",
      "saas_id",
      "slug",
      "status",
      "dossier_json",
      "blueprint_json",
      "work_logs_csv",
      "orchestrator_messages_csv",
      "financials_csv",
      "economic_events_csv",
      "domains_json",
      "meta_json",
      "source_revision",
    ]),
  );
  summarize(stats.exports, dataset.sourceTables.saas?.length ?? 0, dataset.targetTables.socialflow_export_read_models?.length ?? 0, exportEntries, exportOps);

  const dossierEntries = buildLegacyDossierEntries(dataset.sourceTables.tenant_strategic_dossiers ?? []);
  const dossierOps = planOperations(
    dossierEntries,
    dataset.targetTables.socialflow_legacy_strategic_dossiers ?? [],
    ["tenant_id", "dossier_id"],
    (entry) => equivalent(entry, ["tenant_id", "dossier_id", "status", "version", "form_data_json", "analysis_data_json", "plan_data_json", "source_updated_at"]),
  );
  summarize(stats.legacyDossiers, dataset.sourceTables.tenant_strategic_dossiers?.length ?? 0, dataset.targetTables.socialflow_legacy_strategic_dossiers?.length ?? 0, dossierEntries, dossierOps);

  const progressEntries = buildLegacyProgressEntries(dataset.sourceTables.tenants ?? []);
  const progressOps = planOperations(
    progressEntries,
    dataset.targetTables.socialflow_legacy_tenant_progress ?? [],
    ["tenant_id"],
    (entry) => equivalent(entry, ["tenant_id", "materialization_step"]),
  );
  summarize(stats.legacyProgress, dataset.sourceTables.tenants?.length ?? 0, dataset.targetTables.socialflow_legacy_tenant_progress?.length ?? 0, progressEntries, progressOps);

  const workLogEntries = buildLegacyWorkLogEntries(dataset.sourceTables.agent_work_logs ?? []);
  const workLogOps = planOperations(
    workLogEntries,
    dataset.targetTables.socialflow_legacy_agent_work_logs ?? [],
    ["tenant_id", "log_id"],
    (entry) => equivalent(entry, ["tenant_id", "log_id", "saas_id", "agent_name", "action_type", "status", "output_json", "cost_eur", "created_at"]),
  );
  summarize(stats.legacyWorkLogs, dataset.sourceTables.agent_work_logs?.length ?? 0, dataset.targetTables.socialflow_legacy_agent_work_logs?.length ?? 0, workLogEntries, workLogOps);

  const repoEntries = buildLegacyRepositoryEntries(dataset);
  const repoOps = planOperations(
    repoEntries,
    dataset.targetTables.socialflow_legacy_repository_context ?? [],
    ["tenant_id", "saas_id"],
    (entry) => equivalent(entry, ["tenant_id", "saas_id", "slug", "domain", "status", "metadata_json"]),
  );
  summarize(stats.legacyRepositoryContext, dataset.sourceTables.saas?.length ?? 0, dataset.targetTables.socialflow_legacy_repository_context?.length ?? 0, repoEntries, repoOps);

  return {
    runtimeOps,
    exportOps,
    dossierOps,
    progressOps,
    workLogOps,
    repoOps,
  };
}

function collectWarnings(stats: Record<BackfillGroupName, TableStats>, dataset: Dataset): string[] {
  const warnings = [...dataset.sourceMissingTables];
  const allSourceRows = Object.values(dataset.sourceTables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  if (allSourceRows === 0) {
    warnings.push("NONPROD_SOURCE_EMPTY_OR_NOT_BOOTSTRAPPED:no source rows found in DRACO_DB canary");
  }
  for (const warning of warnings) {
    for (const tableStatsEntry of Object.values(stats)) {
      tableStatsEntry.warnings.push(warning);
    }
  }
  return warnings;
}

export async function runBackfillSocialflowNonprodOwnershipReadModels(
  options: RunOptions = {},
): Promise<SocialflowNonprodOwnershipBackfillReport> {
  const mode = options.mode ?? "dry-run";
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const runner = options.runner ?? defaultRunner;
  const { dracoDb, socialDb } = resolveBindings(configPaths);
  const dataset = loadDataset(dracoDb.databaseName, socialDb.databaseName, runner);
  const stats = createEmptyStats();
  const operations = calculateOperations(dataset, stats);
  const warnings = collectWarnings(stats, dataset);
  let remoteWrites = 0;

  if (mode === "apply") {
    remoteWrites += applyOperations(socialDb.databaseName, "runtimeSeed", operations.runtimeOps, buildRuntimeSeedSql, runner);
    remoteWrites += applyOperations(socialDb.databaseName, "exports", operations.exportOps, buildExportSql, runner);
    remoteWrites += applyOperations(socialDb.databaseName, "legacyDossiers", operations.dossierOps, buildLegacyDossierSql, runner);
    remoteWrites += applyOperations(socialDb.databaseName, "legacyProgress", operations.progressOps, buildLegacyProgressSql, runner);
    remoteWrites += applyOperations(socialDb.databaseName, "legacyWorkLogs", operations.workLogOps, buildLegacyWorkLogSql, runner);
    remoteWrites += applyOperations(socialDb.databaseName, "legacyRepositoryContext", operations.repoOps, buildLegacyRepositorySql, runner);
  }

  const verifyDataset = mode === "apply"
    ? loadDataset(dracoDb.databaseName, socialDb.databaseName, runner)
    : dataset;
  const verifyStats = createEmptyStats();
  const verifyOperations = calculateOperations(verifyDataset, verifyStats);
  const idempotent = [
    ...verifyOperations.runtimeOps,
    ...verifyOperations.exportOps,
    ...verifyOperations.dossierOps,
    ...verifyOperations.progressOps,
    ...verifyOperations.workLogOps,
    ...verifyOperations.repoOps,
  ].every((operation) => operation.type === "unchanged");

  return {
    ok: true,
    mode,
    status: mode === "apply" ? "APPLY_OK" : mode === "verify-only" ? "VERIFY_OK" : "DRY_RUN_OK",
    sourceDbName: dracoDb.databaseName,
    sourceDbId: dracoDb.databaseId,
    targetDbName: socialDb.databaseName,
    targetDbId: socialDb.databaseId,
    oauthExcluded: true,
    idempotent: mode === "apply" ? idempotent : remoteWrites === 0,
    remoteWrites,
    tables: mode === "apply" ? verifyStats : stats,
    targetCounts: verifyDataset.targetCounts,
    warnings,
  };
}

function parseArgs(argv: string[]): { mode: BackfillMode; configPaths: string[] } {
  const apply = argv.includes("--apply");
  const verifyOnly = argv.includes("--verify-only");
  const dryRun = argv.includes("--dry-run");
  const selected = [apply, verifyOnly, dryRun].filter(Boolean).length;
  if (selected > 1) {
    throw new Error("SOCIALFLOW_NONPROD_BACKFILL_MODE_CONFLICT");
  }

  const mode: BackfillMode = apply ? "apply" : verifyOnly ? "verify-only" : "dry-run";
  const configPaths = argv
    .filter((arg) => arg.startsWith("--config="))
    .map((arg) => arg.slice("--config=".length));

  return {
    mode,
    configPaths: configPaths.length > 0 ? configPaths : [...DEFAULT_CONFIG_PATHS],
  };
}

export async function runBackfillSocialflowNonprodOwnershipReadModelsCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    const report = await runBackfillSocialflowNonprodOwnershipReadModels(options);
    console.log(JSON.stringify({ ok: true, report }, null, 2));
    console.log(`SOCIALFLOW_NONPROD_OWNERSHIP_BACKFILL_${report.status}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_OWNERSHIP_BACKFILL_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runBackfillSocialflowNonprodOwnershipReadModelsCli(process.argv.slice(2)).then((exitCode) => {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  });
}
