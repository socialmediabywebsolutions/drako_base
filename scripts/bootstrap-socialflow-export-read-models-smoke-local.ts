import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BootstrapMode = "d1-local" | "fixtures";

type FixtureSchemaState = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
    saasColumns: string[];
  };
  social: {
    tables: string[];
  };
};

type FixtureCoreSource = {
  saas: Array<Record<string, unknown>>;
  tenant_strategic_dossiers: Array<Record<string, unknown>>;
  agent_work_logs: Array<Record<string, unknown>>;
  orchestrator_messages: Array<Record<string, unknown>>;
  economic_events: Array<Record<string, unknown>>;
  saas_domains: Array<Record<string, unknown>>;
  saas_instances?: Array<Record<string, unknown>>;
};

type ParsedArgs = {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  tenantId: string;
  saasId: string;
  slug: "socialflow" | "socialflows";
  domain: string;
  fixturesDir: string | null;
};

type BootstrapOptions = {
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  tenantId?: string;
  saasId?: string;
  slug?: "socialflow" | "socialflows";
  domain?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

export type BootstrapSocialflowExportReadModelsSmokeReport = {
  mode: BootstrapMode;
  dryRun: boolean;
  createdTables: string[];
  addedColumns: string[];
  insertedSeeds: number;
  unchangedSeeds: number;
  tenantId: string;
  saasId: string;
};

const FIXTURE_SCHEMA_FILE = "socialflow-export-backfill-schema.json";
const FIXTURE_SOURCE_FILE = "socialflow-export-core-source.json";
const FIXTURE_TARGET_FILE = "socialflow-export-read-models.json";

const REQUIRED_SAAS_COLUMNS = [
  "id",
  "tenant_id",
  "slug",
  "name",
  "blueprint_snapshot",
  "plan_tier",
  "mrr_eur",
  "cost_eur",
  "risk_level",
  "created_at",
] as const;

const REQUIRED_DRACO_TABLES = [
  "tenants",
  "saas",
  "saas_instances",
  "tenant_strategic_dossiers",
  "agent_work_logs",
  "orchestrator_messages",
  "economic_events",
  "saas_domains",
] as const;

const REQUIRED_SOCIAL_TABLE = "socialflow_export_read_models";

const DEFAULTS = {
  configPath: "wrangler.workers.toml",
  dracoBinding: "DRACO_DB",
  socialBinding: "SOCIAL_DB",
  tenantId: "tenant_socialflow_export_smoke_local",
  saasId: "saas_socialflow_export_smoke_local",
  slug: "socialflow" as const,
  domain: "socialflow-export-smoke.local",
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function asSqlValue(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function parseJsonRows<T>(jsonOutput: string): T[] {
  const parsed = JSON.parse(jsonOutput) as Array<{ results?: T[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  return parsed[0]?.results ?? [];
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const tenantArg = argv.find((value) => value.startsWith("--tenant-id="));
  const saasArg = argv.find((value) => value.startsWith("--saas-id="));
  const slugArg = argv.find((value) => value.startsWith("--slug="));
  const domainArg = argv.find((value) => value.startsWith("--domain="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  const parsedSlug = normalizeSlug(slugArg ? slugArg.slice("--slug=".length) : DEFAULTS.slug);
  if (parsedSlug !== "socialflow" && parsedSlug !== "socialflows") {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_INVALID_SLUG");
  }

  return {
    dryRun,
    configPath: configArg ? configArg.slice("--config=".length) : DEFAULTS.configPath,
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : DEFAULTS.dracoBinding,
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : DEFAULTS.socialBinding,
    tenantId: tenantArg ? tenantArg.slice("--tenant-id=".length) : DEFAULTS.tenantId,
    saasId: saasArg ? saasArg.slice("--saas-id=".length) : DEFAULTS.saasId,
    slug: parsedSlug,
    domain: domainArg ? domainArg.slice("--domain=".length) : DEFAULTS.domain,
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

function runWranglerJson(binding: string, configPath: string, sql: string): unknown[] {
  try {
    const output = execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
        "--command",
        sql,
        "--json",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    return parseJsonRows(output);
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerCommand(binding: string, configPath: string, sql: string): void {
  try {
    execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
        "--command",
        sql,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_WRANGLER_COMMAND_FAILED:${stderr.trim()}`);
  }
}

function tableExists(binding: string, configPath: string, tableName: string): boolean {
  const rows = runWranglerJson(
    binding,
    configPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name=${asSqlValue(tableName)};`,
  ) as Array<{ name?: string }>;

  return rows.some((row) => row.name === tableName);
}

function readTableColumns(binding: string, configPath: string, tableName: string): string[] {
  const rows = runWranglerJson(
    binding,
    configPath,
    `PRAGMA table_info(${asSqlValue(tableName)});`,
  ) as Array<{ name?: string }>;

  return rows
    .map((row) => normalizeText(row.name))
    .filter((value) => value.length > 0);
}

function ensureLocalBinding(binding: string, configPath: string, bindingName: string): void {
  try {
    runWranglerJson(binding, configPath, "SELECT 1 AS ok;");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:${bindingName}:${message}`);
  }
}

function ensureLocalTable(params: {
  binding: string;
  bindingName: string;
  configPath: string;
  tableName: string;
  createSql: string;
  requiredColumns: Record<string, string>;
  dryRun: boolean;
  report: BootstrapSocialflowExportReadModelsSmokeReport;
}) {
  const prefix = `${params.bindingName}.${params.tableName}`;
  const exists = tableExists(params.binding, params.configPath, params.tableName);

  if (!exists) {
    params.report.createdTables.push(prefix);
    if (!params.dryRun) {
      runWranglerCommand(params.binding, params.configPath, params.createSql);
    }
  }

  const columns = exists
    ? readTableColumns(params.binding, params.configPath, params.tableName)
    : Object.keys(params.requiredColumns);

  const present = new Set(columns);
  for (const [columnName, columnDef] of Object.entries(params.requiredColumns)) {
    if (present.has(columnName)) continue;
    params.report.addedColumns.push(`${prefix}.${columnName}`);
    if (!params.dryRun) {
      runWranglerCommand(
        params.binding,
        params.configPath,
        `ALTER TABLE ${params.tableName} ADD COLUMN ${columnName} ${columnDef};`,
      );
    }
  }
}

async function loadFixtureState(fixturesDir: string): Promise<{
  schema: FixtureSchemaState;
  source: FixtureCoreSource;
  schemaPath: string;
  sourcePath: string;
}> {
  const schemaPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);

  const [schemaRaw, sourceRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
  ]);

  await fs.access(targetPath);

  return {
    schema: JSON.parse(schemaRaw) as FixtureSchemaState,
    source: JSON.parse(sourceRaw) as FixtureCoreSource,
    schemaPath,
    sourcePath,
  };
}

function ensureFixtureTable(schema: FixtureSchemaState, table: string, report: BootstrapSocialflowExportReadModelsSmokeReport, dryRun: boolean, binding: "DRACO_DB" | "SOCIAL_DB") {
  if (binding === "DRACO_DB") {
    if (schema.draco.tables.includes(table)) return;
    report.createdTables.push(`${binding}.${table}`);
    if (!dryRun) {
      schema.draco.tables.push(table);
    }
    return;
  }

  if (schema.social.tables.includes(table)) return;
  report.createdTables.push(`${binding}.${table}`);
  if (!dryRun) {
    schema.social.tables.push(table);
  }
}

function ensureFixtureSaasColumns(schema: FixtureSchemaState, report: BootstrapSocialflowExportReadModelsSmokeReport, dryRun: boolean) {
  const current = new Set(schema.draco.saasColumns.map((entry) => normalizeText(entry)).filter(Boolean));
  for (const column of REQUIRED_SAAS_COLUMNS) {
    if (current.has(column)) continue;
    report.addedColumns.push(`DRACO_DB.saas.${column}`);
    if (!dryRun) {
      schema.draco.saasColumns.push(column);
      current.add(column);
    }
  }
}

function upsertSeed(
  rows: Array<Record<string, unknown>>,
  match: (row: Record<string, unknown>) => boolean,
  seed: Record<string, unknown>,
  report: BootstrapSocialflowExportReadModelsSmokeReport,
  dryRun: boolean,
) {
  const existing = rows.find(match);
  if (existing) {
    report.unchangedSeeds += 1;
    return;
  }

  report.insertedSeeds += 1;
  if (!dryRun) {
    rows.push(seed);
  }
}

async function runFixturesBootstrap(options: Required<Omit<BootstrapOptions, "log" | "fixturesDir">> & { fixturesDir: string; log: (line: string) => void }): Promise<BootstrapSocialflowExportReadModelsSmokeReport> {
  const state = await loadFixtureState(options.fixturesDir);
  const report: BootstrapSocialflowExportReadModelsSmokeReport = {
    mode: "fixtures",
    dryRun: options.dryRun,
    createdTables: [],
    addedColumns: [],
    insertedSeeds: 0,
    unchangedSeeds: 0,
    tenantId: options.tenantId,
    saasId: options.saasId,
  };

  if (!state.schema.bindings.draco) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:DRACO_DB");
  }
  if (!state.schema.bindings.social) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:SOCIAL_DB");
  }

  for (const table of REQUIRED_DRACO_TABLES) {
    ensureFixtureTable(state.schema, table, report, options.dryRun, "DRACO_DB");
  }
  ensureFixtureTable(state.schema, REQUIRED_SOCIAL_TABLE, report, options.dryRun, "SOCIAL_DB");
  ensureFixtureSaasColumns(state.schema, report, options.dryRun);

  const createdAt = nowIso();
  if (!Array.isArray(state.source.saas_instances)) {
    state.source.saas_instances = [];
  }

  upsertSeed(
    state.source.saas,
    (row) => normalizeText(row.id) === options.saasId,
    {
      id: options.saasId,
      tenant_id: options.tenantId,
      slug: options.slug,
      name: "SocialFlow Export Smoke Local",
      blueprint_snapshot: JSON.stringify({ source: "bootstrap_socialflow_export_local" }),
      plan_tier: "growth",
      mrr_eur: 129,
      cost_eur: 49,
      risk_level: "low",
      created_at: createdAt,
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.saas_instances,
    (row) => normalizeText(row.id) === `${options.saasId}_instance`,
    {
      id: `${options.saasId}_instance`,
      tenant_id: options.tenantId,
      name: "SocialFlow Export Smoke Instance",
      slug: options.slug,
      status: "active",
      blueprint_snapshot: JSON.stringify({ source: "bootstrap_socialflow_export_local" }),
      plan_tier: "growth",
      created_at: createdAt,
      mrr_eur: 129,
      cost_eur: 49,
      risk_level: "low",
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.tenant_strategic_dossiers,
    (row) => normalizeText(row.id) === `dossier_${options.saasId}`,
    {
      id: `dossier_${options.saasId}`,
      tenant_id: options.tenantId,
      form_data: JSON.stringify({ company: "SocialFlow Export Smoke" }),
      analysis_data: JSON.stringify({ status: "ok" }),
      plan_data: JSON.stringify({ plan: "stabilize" }),
      status: "active",
      created_at: createdAt,
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.agent_work_logs,
    (row) => normalizeText(row.id) === `worklog_${options.saasId}`,
    {
      id: `worklog_${options.saasId}`,
      tenant_id: options.tenantId,
      saas_id: options.saasId,
      agent_name: "ExportAgent",
      action_type: "publish",
      status: "ok",
      output_json: JSON.stringify({ exported: true }),
      cost_eur: 1.75,
      created_at: createdAt,
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.orchestrator_messages,
    (row) =>
      normalizeText(row.tenant_id) === options.tenantId
      && normalizeText(row.role) === "assistant"
      && normalizeText(row.content) === "bootstrap-socialflow-export-smoke",
    {
      tenant_id: options.tenantId,
      role: "assistant",
      content: "bootstrap-socialflow-export-smoke",
      created_at: createdAt,
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.economic_events,
    (row) => normalizeText(row.id) === `event_${options.saasId}`,
    {
      id: `event_${options.saasId}`,
      tenant_id: options.tenantId,
      saas_id: options.saasId,
      type: "EXPORT_BOOTSTRAP",
      severity: "info",
      payload_json: JSON.stringify({ source: "bootstrap_socialflow_export_local" }),
      created_at: createdAt,
    },
    report,
    options.dryRun,
  );

  upsertSeed(
    state.source.saas_domains,
    (row) =>
      normalizeText(row.tenant_id) === options.tenantId
      && normalizeText(row.saas_id) === options.saasId
      && normalizeText(row.domain) === options.domain,
    {
      tenant_id: options.tenantId,
      saas_id: options.saasId,
      domain: options.domain,
      is_primary: 1,
      status: "active",
    },
    report,
    options.dryRun,
  );

  if (!options.dryRun) {
    await Promise.all([
      fs.writeFile(state.schemaPath, `${JSON.stringify(state.schema, null, 2)}\n`, "utf8"),
      fs.writeFile(state.sourcePath, `${JSON.stringify(state.source, null, 2)}\n`, "utf8"),
    ]);
  }

  options.log(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP mode=fixtures dryRun=${report.dryRun}`);
  options.log(
    `createdTables=${report.createdTables.length} addedColumns=${report.addedColumns.length} insertedSeeds=${report.insertedSeeds} unchangedSeeds=${report.unchangedSeeds}`,
  );

  return report;
}

function ensureLocalCoreTables(params: {
  configPath: string;
  dracoBinding: string;
  dryRun: boolean;
  report: BootstrapSocialflowExportReadModelsSmokeReport;
}) {
  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "tenants",
    createSql: `CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT,
      name TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      slug: "TEXT",
      name: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "saas",
    createSql: `CREATE TABLE IF NOT EXISTS saas (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      slug TEXT,
      name TEXT,
      blueprint_snapshot TEXT,
      plan_tier TEXT,
      mrr_eur REAL,
      cost_eur REAL,
      risk_level TEXT,
      created_at TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      slug: "TEXT",
      name: "TEXT",
      blueprint_snapshot: "TEXT",
      plan_tier: "TEXT",
      mrr_eur: "REAL",
      cost_eur: "REAL",
      risk_level: "TEXT",
      created_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "saas_instances",
    createSql: `CREATE TABLE IF NOT EXISTS saas_instances (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      name TEXT,
      slug TEXT,
      status TEXT,
      blueprint_snapshot TEXT,
      plan_tier TEXT,
      created_at TEXT,
      mrr_eur REAL,
      cost_eur REAL,
      risk_level TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      name: "TEXT",
      slug: "TEXT",
      status: "TEXT",
      blueprint_snapshot: "TEXT",
      plan_tier: "TEXT",
      created_at: "TEXT",
      mrr_eur: "REAL",
      cost_eur: "REAL",
      risk_level: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "tenant_strategic_dossiers",
    createSql: `CREATE TABLE IF NOT EXISTS tenant_strategic_dossiers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      form_data TEXT,
      analysis_data TEXT,
      plan_data TEXT,
      status TEXT,
      created_at TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      form_data: "TEXT",
      analysis_data: "TEXT",
      plan_data: "TEXT",
      status: "TEXT",
      created_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "agent_work_logs",
    createSql: `CREATE TABLE IF NOT EXISTS agent_work_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      saas_id TEXT,
      agent_name TEXT,
      action_type TEXT,
      status TEXT,
      output_json TEXT,
      cost_eur REAL,
      created_at TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      saas_id: "TEXT",
      agent_name: "TEXT",
      action_type: "TEXT",
      status: "TEXT",
      output_json: "TEXT",
      cost_eur: "REAL",
      created_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "orchestrator_messages",
    createSql: `CREATE TABLE IF NOT EXISTS orchestrator_messages (
      tenant_id TEXT,
      role TEXT,
      content TEXT,
      created_at TEXT
    );`,
    requiredColumns: {
      tenant_id: "TEXT",
      role: "TEXT",
      content: "TEXT",
      created_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "economic_events",
    createSql: `CREATE TABLE IF NOT EXISTS economic_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      saas_id TEXT,
      type TEXT,
      severity TEXT,
      payload_json TEXT,
      created_at TEXT
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      saas_id: "TEXT",
      type: "TEXT",
      severity: "TEXT",
      payload_json: "TEXT",
      created_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  ensureLocalTable({
    binding: params.dracoBinding,
    bindingName: "DRACO_DB",
    configPath: params.configPath,
    tableName: "saas_domains",
    createSql: `CREATE TABLE IF NOT EXISTS saas_domains (
      tenant_id TEXT,
      saas_id TEXT,
      domain TEXT,
      is_primary INTEGER,
      status TEXT
    );`,
    requiredColumns: {
      tenant_id: "TEXT",
      saas_id: "TEXT",
      domain: "TEXT",
      is_primary: "INTEGER",
      status: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });
}

function ensureLocalSocialTable(params: {
  configPath: string;
  socialBinding: string;
  dryRun: boolean;
  report: BootstrapSocialflowExportReadModelsSmokeReport;
}) {
  ensureLocalTable({
    binding: params.socialBinding,
    bindingName: "SOCIAL_DB",
    configPath: params.configPath,
    tableName: REQUIRED_SOCIAL_TABLE,
    createSql: `CREATE TABLE IF NOT EXISTS socialflow_export_read_models (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      dossier_json TEXT NOT NULL DEFAULT '{}',
      blueprint_json TEXT NOT NULL DEFAULT '{}',
      work_logs_csv TEXT NOT NULL DEFAULT '',
      orchestrator_messages_csv TEXT NOT NULL DEFAULT '',
      financials_csv TEXT NOT NULL DEFAULT '',
      economic_events_csv TEXT NOT NULL DEFAULT '',
      domains_json TEXT NOT NULL DEFAULT '[]',
      meta_json TEXT NOT NULL DEFAULT '{}',
      source_revision TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (tenant_id, saas_id)
    );`,
    requiredColumns: {
      id: "TEXT",
      tenant_id: "TEXT",
      saas_id: "TEXT",
      slug: "TEXT",
      status: "TEXT",
      dossier_json: "TEXT",
      blueprint_json: "TEXT",
      work_logs_csv: "TEXT",
      orchestrator_messages_csv: "TEXT",
      financials_csv: "TEXT",
      economic_events_csv: "TEXT",
      domains_json: "TEXT",
      meta_json: "TEXT",
      source_revision: "TEXT",
      created_at: "TEXT",
      updated_at: "TEXT",
    },
    dryRun: params.dryRun,
    report: params.report,
  });

  if (!params.dryRun) {
    runWranglerCommand(
      params.socialBinding,
      params.configPath,
      "CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_tenant ON socialflow_export_read_models (tenant_id);",
    );
    runWranglerCommand(
      params.socialBinding,
      params.configPath,
      "CREATE INDEX IF NOT EXISTS idx_socialflow_export_read_models_saas ON socialflow_export_read_models (saas_id);",
    );
  }
}

function seedExists(binding: string, configPath: string, sql: string): boolean {
  const rows = runWranglerJson(binding, configPath, sql) as Array<{ present?: number; count?: number }>;
  if (!rows[0]) return false;
  const present = rows[0].present;
  const count = rows[0].count;
  if (typeof present === "number") return present > 0;
  if (typeof count === "number") return count > 0;
  return false;
}

function seedLocalCoreData(params: {
  configPath: string;
  dracoBinding: string;
  tenantId: string;
  saasId: string;
  slug: "socialflow" | "socialflows";
  domain: string;
  dryRun: boolean;
  report: BootstrapSocialflowExportReadModelsSmokeReport;
}) {
  const createdAt = nowIso();
  const tenantSlug = `${params.slug}-${params.tenantId}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 58) || params.slug;
  const orchestratorColumns = new Set(readTableColumns(
    params.dracoBinding,
    params.configPath,
    "orchestrator_messages",
  ));
  const saasDomainColumns = new Set(readTableColumns(
    params.dracoBinding,
    params.configPath,
    "saas_domains",
  ));
  const orchestratorMessageId = `msg_${params.saasId}`;
  const orchestratorThreadId = `thread_${params.saasId}`;
  const domainSeedId = `domain_${params.saasId}`;
  const orchestratorInsertColumns: string[] = [];
  const orchestratorInsertValues: string[] = [];
  const domainInsertColumns: string[] = [];
  const domainInsertValues: string[] = [];

  if (orchestratorColumns.has("id")) {
    orchestratorInsertColumns.push("id");
    orchestratorInsertValues.push(asSqlValue(orchestratorMessageId));
  }
  if (orchestratorColumns.has("thread_id")) {
    orchestratorInsertColumns.push("thread_id");
    orchestratorInsertValues.push(asSqlValue(orchestratorThreadId));
  }
  if (orchestratorColumns.has("tenant_id")) {
    orchestratorInsertColumns.push("tenant_id");
    orchestratorInsertValues.push(asSqlValue(params.tenantId));
  }
  if (orchestratorColumns.has("role")) {
    orchestratorInsertColumns.push("role");
    orchestratorInsertValues.push(asSqlValue("assistant"));
  }
  if (orchestratorColumns.has("content")) {
    orchestratorInsertColumns.push("content");
    orchestratorInsertValues.push(asSqlValue("bootstrap-socialflow-export-smoke"));
  }
  if (orchestratorColumns.has("metadata")) {
    orchestratorInsertColumns.push("metadata");
    orchestratorInsertValues.push(asSqlValue(JSON.stringify({ source: "bootstrap_socialflow_export_local" })));
  }
  if (orchestratorColumns.has("created_at")) {
    orchestratorInsertColumns.push("created_at");
    orchestratorInsertValues.push(asSqlValue(createdAt));
  }

  const orchestratorExistsSql = orchestratorColumns.has("id")
    ? `SELECT COUNT(*) AS count FROM orchestrator_messages WHERE id = ${asSqlValue(orchestratorMessageId)};`
    : `SELECT COUNT(*) AS count FROM orchestrator_messages WHERE tenant_id = ${asSqlValue(params.tenantId)} AND role = 'assistant' AND content = 'bootstrap-socialflow-export-smoke';`;
  const orchestratorInsertSql = `INSERT INTO orchestrator_messages (${orchestratorInsertColumns.join(", ")}) VALUES (${orchestratorInsertValues.join(", ")});`;

  if (saasDomainColumns.has("id")) {
    domainInsertColumns.push("id");
    domainInsertValues.push(asSqlValue(domainSeedId));
  }
  if (saasDomainColumns.has("tenant_id")) {
    domainInsertColumns.push("tenant_id");
    domainInsertValues.push(asSqlValue(params.tenantId));
  }
  if (saasDomainColumns.has("saas_id")) {
    domainInsertColumns.push("saas_id");
    domainInsertValues.push(asSqlValue(params.saasId));
  }
  if (saasDomainColumns.has("domain")) {
    domainInsertColumns.push("domain");
    domainInsertValues.push(asSqlValue(params.domain));
  }
  if (saasDomainColumns.has("is_primary")) {
    domainInsertColumns.push("is_primary");
    domainInsertValues.push("1");
  }
  if (saasDomainColumns.has("status")) {
    domainInsertColumns.push("status");
    domainInsertValues.push(asSqlValue("active"));
  }
  if (saasDomainColumns.has("created_at")) {
    domainInsertColumns.push("created_at");
    domainInsertValues.push(asSqlValue(createdAt));
  }
  if (saasDomainColumns.has("updated_at")) {
    domainInsertColumns.push("updated_at");
    domainInsertValues.push(asSqlValue(createdAt));
  }
  const saasDomainExistsSql = saasDomainColumns.has("id")
    ? `SELECT COUNT(*) AS count FROM saas_domains WHERE id = ${asSqlValue(domainSeedId)};`
    : `SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ${asSqlValue(params.tenantId)} AND saas_id = ${asSqlValue(params.saasId)} AND domain = ${asSqlValue(params.domain)};`;
  const saasDomainInsertSql = `INSERT INTO saas_domains (${domainInsertColumns.join(", ")}) VALUES (${domainInsertValues.join(", ")});`;

  const seeds = [
    {
      existsSql: `SELECT COUNT(*) AS count FROM tenants WHERE id = ${asSqlValue(params.tenantId)};`,
      insertSql: `INSERT INTO tenants (id, slug, name)
        VALUES (${asSqlValue(params.tenantId)}, ${asSqlValue(tenantSlug)}, ${asSqlValue("SocialFlow Export Smoke Tenant")});`,
    },
    {
      existsSql: `SELECT COUNT(*) AS count FROM saas WHERE id = ${asSqlValue(params.saasId)};`,
      insertSql: `INSERT INTO saas (id, tenant_id, slug, name, blueprint_snapshot, plan_tier, mrr_eur, cost_eur, risk_level, created_at)
        VALUES (${asSqlValue(params.saasId)}, ${asSqlValue(params.tenantId)}, ${asSqlValue(params.slug)}, ${asSqlValue("SocialFlow Export Smoke Local")}, ${asSqlValue(JSON.stringify({ source: "bootstrap_socialflow_export_local" }))}, ${asSqlValue("growth")}, 129, 49, ${asSqlValue("low")}, ${asSqlValue(createdAt)});`,
    },
    {
      existsSql: `SELECT COUNT(*) AS count FROM saas_instances WHERE id = ${asSqlValue(`${params.saasId}_instance`)};`,
      insertSql: `INSERT INTO saas_instances (id, tenant_id, name, slug, status, blueprint_snapshot, plan_tier, created_at, mrr_eur, cost_eur, risk_level)
        VALUES (${asSqlValue(`${params.saasId}_instance`)}, ${asSqlValue(params.tenantId)}, ${asSqlValue("SocialFlow Export Smoke Instance")}, ${asSqlValue(params.slug)}, ${asSqlValue("active")}, ${asSqlValue(JSON.stringify({ source: "bootstrap_socialflow_export_local" }))}, ${asSqlValue("growth")}, ${asSqlValue(createdAt)}, 129, 49, ${asSqlValue("low")});`,
    },
    {
      existsSql: `SELECT COUNT(*) AS count FROM tenant_strategic_dossiers WHERE id = ${asSqlValue(`dossier_${params.saasId}`)};`,
      insertSql: `INSERT INTO tenant_strategic_dossiers (id, tenant_id, form_data, analysis_data, plan_data, status, created_at)
        VALUES (${asSqlValue(`dossier_${params.saasId}`)}, ${asSqlValue(params.tenantId)}, ${asSqlValue(JSON.stringify({ company: "SocialFlow Export Smoke" }))}, ${asSqlValue(JSON.stringify({ status: "ok" }))}, ${asSqlValue(JSON.stringify({ plan: "stabilize" }))}, ${asSqlValue("active")}, ${asSqlValue(createdAt)});`,
    },
    {
      existsSql: `SELECT COUNT(*) AS count FROM agent_work_logs WHERE id = ${asSqlValue(`worklog_${params.saasId}`)};`,
      insertSql: `INSERT INTO agent_work_logs (id, tenant_id, saas_id, agent_name, action_type, status, output_json, cost_eur, created_at)
        VALUES (${asSqlValue(`worklog_${params.saasId}`)}, ${asSqlValue(params.tenantId)}, ${asSqlValue(params.saasId)}, ${asSqlValue("ExportAgent")}, ${asSqlValue("publish")}, ${asSqlValue("ok")}, ${asSqlValue(JSON.stringify({ exported: true }))}, 1.75, ${asSqlValue(createdAt)});`,
    },
    {
      existsSql: orchestratorExistsSql,
      insertSql: orchestratorInsertSql,
    },
    {
      existsSql: `SELECT COUNT(*) AS count FROM economic_events WHERE id = ${asSqlValue(`event_${params.saasId}`)};`,
      insertSql: `INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at)
        VALUES (${asSqlValue(`event_${params.saasId}`)}, ${asSqlValue(params.tenantId)}, ${asSqlValue(params.saasId)}, ${asSqlValue("EXPORT_BOOTSTRAP")}, ${asSqlValue("info")}, ${asSqlValue(JSON.stringify({ source: "bootstrap_socialflow_export_local" }))}, ${asSqlValue(createdAt)});`,
    },
    {
      existsSql: saasDomainExistsSql,
      insertSql: saasDomainInsertSql,
    },
  ] as const;

  for (const seed of seeds) {
    const exists = seedExists(params.dracoBinding, params.configPath, seed.existsSql);
    if (exists) {
      params.report.unchangedSeeds += 1;
      continue;
    }

    params.report.insertedSeeds += 1;
    if (!params.dryRun) {
      runWranglerCommand(params.dracoBinding, params.configPath, seed.insertSql);
    }
  }
}

async function runLocalBootstrap(options: Required<Omit<BootstrapOptions, "log" | "fixturesDir">> & { log: (line: string) => void }): Promise<BootstrapSocialflowExportReadModelsSmokeReport> {
  const report: BootstrapSocialflowExportReadModelsSmokeReport = {
    mode: "d1-local",
    dryRun: options.dryRun,
    createdTables: [],
    addedColumns: [],
    insertedSeeds: 0,
    unchangedSeeds: 0,
    tenantId: options.tenantId,
    saasId: options.saasId,
  };

  ensureLocalBinding(options.dracoBinding, options.configPath, "DRACO_DB");
  ensureLocalBinding(options.socialBinding, options.configPath, "SOCIAL_DB");

  ensureLocalCoreTables({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    dryRun: options.dryRun,
    report,
  });

  ensureLocalSocialTable({
    configPath: options.configPath,
    socialBinding: options.socialBinding,
    dryRun: options.dryRun,
    report,
  });

  seedLocalCoreData({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    tenantId: options.tenantId,
    saasId: options.saasId,
    slug: options.slug,
    domain: options.domain,
    dryRun: options.dryRun,
    report,
  });

  options.log(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP mode=d1-local dryRun=${report.dryRun}`);
  options.log(
    `createdTables=${report.createdTables.length} addedColumns=${report.addedColumns.length} insertedSeeds=${report.insertedSeeds} unchangedSeeds=${report.unchangedSeeds}`,
  );

  return report;
}

export async function runBootstrapSocialflowExportReadModelsSmokeLocal(options: BootstrapOptions = {}): Promise<BootstrapSocialflowExportReadModelsSmokeReport> {
  const resolved = {
    dryRun: options.dryRun ?? false,
    configPath: options.configPath ?? DEFAULTS.configPath,
    dracoBinding: options.dracoBinding ?? DEFAULTS.dracoBinding,
    socialBinding: options.socialBinding ?? DEFAULTS.socialBinding,
    tenantId: options.tenantId ?? DEFAULTS.tenantId,
    saasId: options.saasId ?? DEFAULTS.saasId,
    slug: options.slug ?? DEFAULTS.slug,
    domain: options.domain ?? DEFAULTS.domain,
    fixturesDir: options.fixturesDir ?? process.env.FIXTURES_DIR ?? null,
    log: options.log ?? console.log,
  };

  const report = resolved.fixturesDir
    ? await runFixturesBootstrap({
      dryRun: resolved.dryRun,
      configPath: resolved.configPath,
      dracoBinding: resolved.dracoBinding,
      socialBinding: resolved.socialBinding,
      tenantId: resolved.tenantId,
      saasId: resolved.saasId,
      slug: resolved.slug,
      domain: resolved.domain,
      fixturesDir: resolved.fixturesDir,
      log: resolved.log,
    })
    : await runLocalBootstrap({
      dryRun: resolved.dryRun,
      configPath: resolved.configPath,
      dracoBinding: resolved.dracoBinding,
      socialBinding: resolved.socialBinding,
      tenantId: resolved.tenantId,
      saasId: resolved.saasId,
      slug: resolved.slug,
      domain: resolved.domain,
      log: resolved.log,
    });

  return report;
}

export async function runBootstrapSocialflowExportReadModelsSmokeLocalCli(argv: string[]): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const report = await runBootstrapSocialflowExportReadModelsSmokeLocal({
      dryRun: parsed.dryRun,
      configPath: parsed.configPath,
      dracoBinding: parsed.dracoBinding,
      socialBinding: parsed.socialBinding,
      tenantId: parsed.tenantId,
      saasId: parsed.saasId,
      slug: parsed.slug,
      domain: parsed.domain,
      fixturesDir: parsed.fixturesDir,
    });
    console.log(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_REPORT ${JSON.stringify(report)}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runBootstrapSocialflowExportReadModelsSmokeLocalCli(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
