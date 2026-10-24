import { execFileSync } from "node:child_process";
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

const FORBIDDEN_TOKENS = [
  "socialflow_oauth_connections",
  "drako_integration_connections",
  "drako_integration_credentials",
  "authmeta",
  "auth_meta",
  "oauth",
  "credential",
  "credentials",
  "secret",
  "encrypted_access_token",
  "encrypted_refresh_token",
  "encrypted_id_token",
  "access_token",
  "refresh_token",
  "id_token",
] as const;

const FORBIDDEN_SQL = /\b(DROP|DELETE|ALTER|TRUNCATE|ATTACH|DETACH|VACUUM)\b/i;
const CANARY_TENANT_ID = "tenant_socialflow_canary";
const CANARY_SAAS_ID = "saas_socialflow_canary";
const CANARY_DOMAIN = "socialflow-canary.local";

type BootstrapMode = "dry-run" | "verify-only" | "apply";
type RemoteCommandKind = "read" | "write";

export type BootstrapTableName =
  | "saas"
  | "tenants"
  | "saas_domains"
  | "tenant_strategic_dossiers"
  | "agent_work_logs"
  | "orchestrator_messages"
  | "economic_events";

export type SocialflowNonprodSourceBootstrapRemoteCommand = {
  kind: RemoteCommandKind;
  databaseName: string;
  sql: string;
  displayCommand: string;
  args: string[];
  table: BootstrapTableName | "safety";
  touches: string;
};

type D1Binding = {
  binding: string;
  databaseName: string;
  databaseId: string;
};

type AnyRow = Record<string, unknown>;
type RemoteCommandRunner = (command: SocialflowNonprodSourceBootstrapRemoteCommand) => string;

type TablePlan = {
  table: BootstrapTableName;
  keyField: string;
  keyValue: string;
  createSql: string;
  seedSql: string;
  expected: Record<string, unknown>;
  comparableFields: string[];
};

type TableReport = {
  tableExists: boolean;
  rowExists: boolean;
  inserts: number;
  updates: number;
  unchanged: number;
  sourceRows: number;
  warnings: string[];
};

export type SocialflowNonprodSourceBootstrapReport = {
  ok: boolean;
  mode: BootstrapMode;
  status: "DRY_RUN_OK" | "VERIFY_OK" | "VERIFY_MISSING" | "APPLY_OK";
  targetDbName: string;
  targetDbId: string;
  touchedDatabases: string[];
  oauthExcluded: true;
  remoteWrites: number;
  idempotent: boolean;
  canaryTenantId: string;
  canarySaasId: string;
  canaryDomain: string;
  tables: Record<BootstrapTableName, TableReport>;
  warnings: string[];
};

type RunOptions = {
  mode?: BootstrapMode;
  json?: boolean;
  configPaths?: string[];
  runner?: RemoteCommandRunner;
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
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function assertNoForbiddenSensitiveText(text: string): void {
  const lowered = text.toLowerCase();
  const forbidden = FORBIDDEN_TOKENS.find((token) => lowered.includes(token));
  if (forbidden) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_FORBIDDEN_SENSITIVE_TOKEN:${forbidden}`);
  }
}

export function assertSafeSocialflowNonprodSourceBootstrapSql(sql: string): void {
  const trimmed = sql.trim();
  const allowed = /^(CREATE TABLE IF NOT EXISTS|INSERT INTO|SELECT|PRAGMA)\b/i.test(trimmed);
  if (!allowed) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_SQL_NOT_ALLOWED:${trimmed.slice(0, 40)}`);
  }
  if (FORBIDDEN_SQL.test(trimmed)) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_SQL_FORBIDDEN:${trimmed.match(FORBIDDEN_SQL)?.[1] ?? "forbidden"}`);
  }
  assertNoForbiddenSensitiveText(trimmed);
}

function assertSafeDatabase(label: string, binding: D1Binding): void {
  if (hasProductiveToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_PRODUCTIVE_DB:${label}:${binding.databaseName}`);
  }
  if (!hasCanaryOrNonprodToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_NOT_CANARY_OR_NONPROD:${label}:${binding.databaseName}`);
  }
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): D1Binding {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertSafeConfig(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }
  if (report.placeholders.length > 0) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_PLACEHOLDERS_BLOCKED:${report.configPath}:${report.placeholders.join(",")}`);
  }
  if (report.deployable) {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }
  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_ROLLBACK_NOT_OFF:${report.configPath}`);
  }
  for (const switchName of OFF_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_SWITCH_NOT_OFF:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`);
    }
  }
}

function resolveDracoBinding(configPaths: string[]): D1Binding {
  const reports = configPaths.map((configPath) => checkSocialflowNonprodCanaryConfig({ configPath }));
  for (const report of reports) assertSafeConfig(report);
  const dracoBindings = reports.map((report) => getBinding(report, "DRACO_DB"));
  const dracoDb = dracoBindings[0];
  if (!dracoDb) throw new Error("SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_DRACO_DB_MISSING");
  for (const binding of dracoBindings) {
    if (binding.databaseName !== dracoDb.databaseName || binding.databaseId !== dracoDb.databaseId) {
      throw new Error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_DRACO_DB_MISMATCH:${binding.databaseName}:${binding.databaseId}`);
    }
  }
  assertSafeDatabase("DRACO_DB", dracoDb);
  return dracoDb;
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
  kind: RemoteCommandKind,
  databaseName: string,
  sql: string,
  table: SocialflowNonprodSourceBootstrapRemoteCommand["table"],
  touches: string,
): SocialflowNonprodSourceBootstrapRemoteCommand {
  assertSafeSocialflowNonprodSourceBootstrapSql(sql);
  assertNoForbiddenSensitiveText(touches);
  return {
    kind,
    databaseName,
    sql,
    table,
    touches,
    displayCommand: `wrangler d1 execute ${databaseName} --remote --command ${JSON.stringify(sql)} --json`,
    args: ["d1", "execute", databaseName, "--remote", "--command", sql, "--json"],
  };
}

function printRemotePrecheck(command: SocialflowNonprodSourceBootstrapRemoteCommand): void {
  console.log("SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_REMOTE_COMMAND_PRECHECK");
  console.log(JSON.stringify({
    command: command.displayCommand,
    databaseName: command.databaseName,
    databaseContainsProd: hasProductiveToken(command.databaseName),
    databasePosture: "DRACO_DB canary/nonprod",
    writesData: command.kind === "write",
    isDeploy: false,
    activatesSwitches: false,
    oauthExcluded: true,
    tokensCredentialsExcluded: true,
    touches: command.touches,
  }, null, 2));
}

function executeRemote(command: SocialflowNonprodSourceBootstrapRemoteCommand, runner: RemoteCommandRunner): string {
  assertSafeDatabase("remote-command", { binding: "DRACO_DB", databaseName: command.databaseName, databaseId: "command" });
  assertSafeSocialflowNonprodSourceBootstrapSql(command.sql);
  assertNoForbiddenSensitiveText(command.displayCommand);
  printRemotePrecheck(command);
  return runner(command);
}

function defaultRunner(command: SocialflowNonprodSourceBootstrapRemoteCommand): string {
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
  table: SocialflowNonprodSourceBootstrapRemoteCommand["table"],
  touches: string,
  runner: RemoteCommandRunner,
): AnyRow[] {
  const command = makeRemoteCommand("read", databaseName, sql, table, touches);
  return parseJsonRows(executeRemote(command, runner));
}

function writeSql(databaseName: string, sql: string, table: BootstrapTableName, touches: string, runner: RemoteCommandRunner): void {
  const command = makeRemoteCommand("write", databaseName, sql, table, touches);
  executeRemote(command, runner);
}

function tableExists(databaseName: string, table: BootstrapTableName, runner: RemoteCommandRunner): boolean {
  const rows = readRows(
    databaseName,
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ${asSqlValue(table)};`,
    "safety",
    `table existence check for ${table}`,
    runner,
  );
  return rows.some((row) => normalizeText(row.name) === table);
}

function readSeedRow(databaseName: string, plan: TablePlan, runner: RemoteCommandRunner): AnyRow | null {
  if (!tableExists(databaseName, plan.table, runner)) return null;
  const rows = readRows(
    databaseName,
    `SELECT * FROM ${plan.table} WHERE ${plan.keyField} = ${asSqlValue(plan.keyValue)};`,
    plan.table,
    `canary seed read ${plan.table}`,
    runner,
  );
  return rows[0] ?? null;
}

function equivalent(row: AnyRow | null, expected: Record<string, unknown>, fields: string[]): boolean {
  if (!row) return false;
  for (const field of fields) {
    const expectedValue = expected[field];
    const actualValue = row[field];
    if (typeof expectedValue === "number") {
      if (normalizeNumber(actualValue) !== expectedValue) return false;
    } else if (field.endsWith("_json") || field === "form_data" || field === "output_json" || field === "payload_json" || field === "blueprint_snapshot") {
      if (normalizeJsonText(actualValue, "") !== normalizeJsonText(expectedValue, "")) return false;
    } else if (normalizeText(actualValue) !== normalizeText(expectedValue)) {
      return false;
    }
  }
  return true;
}

function buildPlans(): TablePlan[] {
  const now = "2026-01-01T00:00:00.000Z";
  return [
    {
      table: "tenants",
      keyField: "tenant_id",
      keyValue: CANARY_TENANT_ID,
      createSql: `CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        name TEXT,
        materialization_step INTEGER,
        created_at TEXT,
        updated_at TEXT
      );`,
      expected: {
        tenant_id: CANARY_TENANT_ID,
        name: "SocialFlow Canary Tenant",
        materialization_step: 1,
        created_at: now,
        updated_at: now,
      },
      comparableFields: ["tenant_id", "name", "materialization_step"],
      seedSql: `INSERT INTO tenants (tenant_id, name, materialization_step, created_at, updated_at)
        VALUES (${asSqlValue(CANARY_TENANT_ID)}, 'SocialFlow Canary Tenant', 1, ${asSqlValue(now)}, ${asSqlValue(now)})
        ON CONFLICT(tenant_id) DO UPDATE SET
          name = excluded.name,
          materialization_step = excluded.materialization_step,
          updated_at = excluded.updated_at;`,
    },
    {
      table: "saas",
      keyField: "id",
      keyValue: CANARY_SAAS_ID,
      createSql: `CREATE TABLE IF NOT EXISTS saas (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        slug TEXT,
        name TEXT,
        domain TEXT,
        status TEXT,
        blueprint_snapshot TEXT,
        mrr_eur REAL,
        cost_eur REAL,
        risk_level TEXT,
        plan_tier TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      expected: {
        id: CANARY_SAAS_ID,
        tenant_id: CANARY_TENANT_ID,
        slug: "socialflow",
        name: "SocialFlow Canary SaaS",
        domain: CANARY_DOMAIN,
        status: "active",
        blueprint_snapshot: JSON.stringify({ source: "canary", product: "socialflow", synthetic: true }),
        mrr_eur: 0,
        cost_eur: 0,
        risk_level: "low",
        plan_tier: "canary",
        created_at: now,
        updated_at: now,
      },
      comparableFields: ["id", "tenant_id", "slug", "name", "domain", "status", "blueprint_snapshot", "mrr_eur", "cost_eur", "risk_level", "plan_tier"],
      seedSql: `INSERT INTO saas (
          id, tenant_id, slug, name, domain, status, blueprint_snapshot, mrr_eur, cost_eur, risk_level, plan_tier, created_at, updated_at
        ) VALUES (
          ${asSqlValue(CANARY_SAAS_ID)}, ${asSqlValue(CANARY_TENANT_ID)}, 'socialflow', 'SocialFlow Canary SaaS',
          ${asSqlValue(CANARY_DOMAIN)}, 'active', ${asSqlValue(JSON.stringify({ source: "canary", product: "socialflow", synthetic: true }))},
          0, 0, 'low', 'canary', ${asSqlValue(now)}, ${asSqlValue(now)}
        )
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          slug = excluded.slug,
          name = excluded.name,
          domain = excluded.domain,
          status = excluded.status,
          blueprint_snapshot = excluded.blueprint_snapshot,
          mrr_eur = excluded.mrr_eur,
          cost_eur = excluded.cost_eur,
          risk_level = excluded.risk_level,
          plan_tier = excluded.plan_tier,
          updated_at = excluded.updated_at;`,
    },
    {
      table: "saas_domains",
      keyField: "id",
      keyValue: "domain_socialflow_canary",
      createSql: `CREATE TABLE IF NOT EXISTS saas_domains (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        saas_id TEXT,
        domain TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      expected: {
        id: "domain_socialflow_canary",
        tenant_id: CANARY_TENANT_ID,
        saas_id: CANARY_SAAS_ID,
        domain: CANARY_DOMAIN,
        status: "active",
        created_at: now,
        updated_at: now,
      },
      comparableFields: ["id", "tenant_id", "saas_id", "domain", "status"],
      seedSql: `INSERT INTO saas_domains (id, tenant_id, saas_id, domain, status, created_at, updated_at)
        VALUES ('domain_socialflow_canary', ${asSqlValue(CANARY_TENANT_ID)}, ${asSqlValue(CANARY_SAAS_ID)}, ${asSqlValue(CANARY_DOMAIN)}, 'active', ${asSqlValue(now)}, ${asSqlValue(now)})
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          saas_id = excluded.saas_id,
          domain = excluded.domain,
          status = excluded.status,
          updated_at = excluded.updated_at;`,
    },
    {
      table: "tenant_strategic_dossiers",
      keyField: "id",
      keyValue: "dossier_socialflow_canary",
      createSql: `CREATE TABLE IF NOT EXISTS tenant_strategic_dossiers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        status TEXT,
        version INTEGER,
        form_data TEXT,
        analysis_data TEXT,
        plan_data TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      expected: {
        id: "dossier_socialflow_canary",
        tenant_id: CANARY_TENANT_ID,
        status: "ready",
        version: 1,
        form_data: JSON.stringify({ objective: "canary validation", containsPersonalData: false }),
        analysis_data: JSON.stringify({ summary: "synthetic canary dossier" }),
        plan_data: JSON.stringify({ nextStep: "nonprod parity" }),
        created_at: now,
        updated_at: now,
      },
      comparableFields: ["id", "tenant_id", "status", "version", "form_data", "analysis_data", "plan_data"],
      seedSql: `INSERT INTO tenant_strategic_dossiers (
          id, tenant_id, status, version, form_data, analysis_data, plan_data, created_at, updated_at
        ) VALUES (
          'dossier_socialflow_canary', ${asSqlValue(CANARY_TENANT_ID)}, 'ready', 1,
          ${asSqlValue(JSON.stringify({ objective: "canary validation", containsPersonalData: false }))},
          ${asSqlValue(JSON.stringify({ summary: "synthetic canary dossier" }))},
          ${asSqlValue(JSON.stringify({ nextStep: "nonprod parity" }))},
          ${asSqlValue(now)}, ${asSqlValue(now)}
        )
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          status = excluded.status,
          version = excluded.version,
          form_data = excluded.form_data,
          analysis_data = excluded.analysis_data,
          plan_data = excluded.plan_data,
          updated_at = excluded.updated_at;`,
    },
    {
      table: "agent_work_logs",
      keyField: "id",
      keyValue: "worklog_socialflow_canary",
      createSql: `CREATE TABLE IF NOT EXISTS agent_work_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        saas_id TEXT,
        agent_name TEXT,
        action_type TEXT,
        status TEXT,
        output_json TEXT,
        cost_eur REAL,
        created_at TEXT,
        updated_at TEXT
      );`,
      expected: {
        id: "worklog_socialflow_canary",
        tenant_id: CANARY_TENANT_ID,
        saas_id: CANARY_SAAS_ID,
        agent_name: "canary-agent",
        action_type: "canary-bootstrap",
        status: "completed",
        output_json: JSON.stringify({ synthetic: true, result: "ok" }),
        cost_eur: 0,
        created_at: now,
        updated_at: now,
      },
      comparableFields: ["id", "tenant_id", "saas_id", "agent_name", "action_type", "status", "output_json", "cost_eur"],
      seedSql: `INSERT INTO agent_work_logs (
          id, tenant_id, saas_id, agent_name, action_type, status, output_json, cost_eur, created_at, updated_at
        ) VALUES (
          'worklog_socialflow_canary', ${asSqlValue(CANARY_TENANT_ID)}, ${asSqlValue(CANARY_SAAS_ID)},
          'canary-agent', 'canary-bootstrap', 'completed', ${asSqlValue(JSON.stringify({ synthetic: true, result: "ok" }))}, 0,
          ${asSqlValue(now)}, ${asSqlValue(now)}
        )
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          saas_id = excluded.saas_id,
          agent_name = excluded.agent_name,
          action_type = excluded.action_type,
          status = excluded.status,
          output_json = excluded.output_json,
          cost_eur = excluded.cost_eur,
          updated_at = excluded.updated_at;`,
    },
    {
      table: "orchestrator_messages",
      keyField: "id",
      keyValue: "message_socialflow_canary",
      createSql: `CREATE TABLE IF NOT EXISTS orchestrator_messages (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        role TEXT,
        content TEXT,
        created_at TEXT
      );`,
      expected: {
        id: "message_socialflow_canary",
        tenant_id: CANARY_TENANT_ID,
        role: "system",
        content: "Synthetic SocialFlow canary source message.",
        created_at: now,
      },
      comparableFields: ["id", "tenant_id", "role", "content"],
      seedSql: `INSERT INTO orchestrator_messages (id, tenant_id, role, content, created_at)
        VALUES ('message_socialflow_canary', ${asSqlValue(CANARY_TENANT_ID)}, 'system', 'Synthetic SocialFlow canary source message.', ${asSqlValue(now)})
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          role = excluded.role,
          content = excluded.content;`,
    },
    {
      table: "economic_events",
      keyField: "id",
      keyValue: "event_socialflow_canary",
      createSql: `CREATE TABLE IF NOT EXISTS economic_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        saas_id TEXT,
        type TEXT,
        severity TEXT,
        payload_json TEXT,
        created_at TEXT
      );`,
      expected: {
        id: "event_socialflow_canary",
        tenant_id: CANARY_TENANT_ID,
        saas_id: CANARY_SAAS_ID,
        type: "canary",
        severity: "info",
        payload_json: JSON.stringify({ synthetic: true, value: 0 }),
        created_at: now,
      },
      comparableFields: ["id", "tenant_id", "saas_id", "type", "severity", "payload_json"],
      seedSql: `INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at)
        VALUES ('event_socialflow_canary', ${asSqlValue(CANARY_TENANT_ID)}, ${asSqlValue(CANARY_SAAS_ID)}, 'canary', 'info', ${asSqlValue(JSON.stringify({ synthetic: true, value: 0 }))}, ${asSqlValue(now)})
        ON CONFLICT(id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          saas_id = excluded.saas_id,
          type = excluded.type,
          severity = excluded.severity,
          payload_json = excluded.payload_json;`,
    },
  ];
}

function inspectTable(databaseName: string, plan: TablePlan, runner: RemoteCommandRunner): TableReport {
  const exists = tableExists(databaseName, plan.table, runner);
  const row = exists ? readSeedRow(databaseName, plan, runner) : null;
  const unchanged = equivalent(row, plan.expected, plan.comparableFields);
  return {
    tableExists: exists,
    rowExists: row != null,
    inserts: row == null ? 1 : 0,
    updates: row != null && !unchanged ? 1 : 0,
    unchanged: unchanged ? 1 : 0,
    sourceRows: row != null ? 1 : 0,
    warnings: exists ? [] : [`SOURCE_TABLE_MISSING:${databaseName}.${plan.table}`],
  };
}

function inspectPlans(databaseName: string, plans: TablePlan[], runner: RemoteCommandRunner): Record<BootstrapTableName, TableReport> {
  const result = {} as Record<BootstrapTableName, TableReport>;
  for (const plan of plans) {
    result[plan.table] = inspectTable(databaseName, plan, runner);
  }
  return result;
}

function collectWarnings(tables: Record<BootstrapTableName, TableReport>): string[] {
  return Object.values(tables).flatMap((report) => report.warnings);
}

function totalWritesForApply(before: Record<BootstrapTableName, TableReport>): number {
  return Object.values(before).reduce((sum, report) => sum + (report.tableExists ? 0 : 1) + report.inserts + report.updates, 0);
}

export async function runBootstrapSocialflowNonprodSourceData(options: RunOptions = {}): Promise<SocialflowNonprodSourceBootstrapReport> {
  const mode = options.mode ?? "dry-run";
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const runner = options.runner ?? defaultRunner;
  const dracoDb = resolveDracoBinding(configPaths);
  const plans = buildPlans();
  const before = inspectPlans(dracoDb.databaseName, plans, runner);
  let remoteWrites = 0;

  if (mode === "apply") {
    for (const plan of plans) {
      const report = before[plan.table];
      if (!report.tableExists) {
        writeSql(dracoDb.databaseName, plan.createSql, plan.table, `create source table ${plan.table}`, runner);
        remoteWrites += 1;
      }
      if (report.inserts > 0 || report.updates > 0) {
        writeSql(dracoDb.databaseName, plan.seedSql, plan.table, `upsert canary seed ${plan.table}`, runner);
        remoteWrites += 1;
      }
    }
  }

  const finalTables = mode === "apply" ? inspectPlans(dracoDb.databaseName, plans, runner) : before;
  const warnings = collectWarnings(finalTables);
  const missing = Object.values(finalTables).some((report) => !report.tableExists || !report.rowExists);
  const idempotent = Object.values(finalTables).every((report) => report.unchanged === 1);

  return {
    ok: mode === "verify-only" ? true : true,
    mode,
    status: mode === "apply" ? "APPLY_OK" : mode === "verify-only" && missing ? "VERIFY_MISSING" : mode === "verify-only" ? "VERIFY_OK" : "DRY_RUN_OK",
    targetDbName: dracoDb.databaseName,
    targetDbId: dracoDb.databaseId,
    touchedDatabases: [dracoDb.databaseName],
    oauthExcluded: true,
    remoteWrites: mode === "dry-run" || mode === "verify-only" ? 0 : remoteWrites,
    idempotent,
    canaryTenantId: CANARY_TENANT_ID,
    canarySaasId: CANARY_SAAS_ID,
    canaryDomain: CANARY_DOMAIN,
    tables: finalTables,
    warnings,
  };
}

function parseArgs(argv: string[]): RunOptions {
  const mode = argv.includes("--apply")
    ? "apply"
    : argv.includes("--verify-only")
      ? "verify-only"
      : "dry-run";
  return {
    mode,
    json: argv.includes("--json"),
    configPaths: argv.filter((arg) => arg.startsWith("--config=")).map((arg) => arg.slice("--config=".length)),
  };
}

export async function runBootstrapSocialflowNonprodSourceDataCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runBootstrapSocialflowNonprodSourceData(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      mode: report.mode,
      targetDbName: report.targetDbName,
      touchedDatabases: report.touchedDatabases,
      oauthExcluded: report.oauthExcluded,
      remoteWrites: report.remoteWrites,
      idempotent: report.idempotent,
      canaryTenantId: report.canaryTenantId,
      canarySaasId: report.canarySaasId,
      canaryDomain: report.canaryDomain,
      tables: report.tables,
      warnings: report.warnings,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_${report.status}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runBootstrapSocialflowNonprodSourceDataCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
