import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BackfillMode = "d1-local" | "fixtures";

type LegacyTableName =
  | "socialflow_legacy_strategic_dossiers"
  | "socialflow_legacy_tenant_progress"
  | "socialflow_legacy_agent_work_logs"
  | "socialflow_legacy_repository_context";

type CoreStrategicDossierRow = {
  id: string;
  tenant_id: string;
  status: string | null;
  version: number | null;
  form_data: string | null;
  analysis_data: string | null;
  plan_data: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CoreAgentWorkLogRow = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  agent_name: string | null;
  action_type: string | null;
  status: string | null;
  output_json: string | null;
  cost_eur: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type CoreTenantProgressRow = {
  tenant_id: string;
  materialization_step: number | null;
  updated_at: string | null;
};

type CoreSaasRow = {
  id: string;
  tenant_id: string;
  slug: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CoreSaasDomainRow = {
  tenant_id: string;
  saas_id: string;
  domain: string | null;
  is_primary: number | boolean | null;
  status: string | null;
};

type SocialLegacyStrategicDossierRow = {
  id: string;
  tenant_id: string;
  dossier_id: string;
  status: string;
  version: number;
  form_data_json: string;
  analysis_data_json: string | null;
  plan_data_json: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type SocialLegacyTenantProgressRow = {
  tenant_id: string;
  materialization_step: number;
  updated_at: string;
};

type SocialLegacyAgentWorkLogRow = {
  id: string;
  tenant_id: string;
  log_id: string;
  saas_id: string | null;
  agent_name: string;
  action_type: string;
  status: string;
  output_json: string;
  cost_eur: number;
  created_at: string;
  updated_at: string;
};

type SocialLegacyRepositoryContextRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string | null;
  status: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type PreparedStrategicDossierEntry = Omit<SocialLegacyStrategicDossierRow, "created_at" | "updated_at">;
type PreparedTenantProgressEntry = SocialLegacyTenantProgressRow;
type PreparedAgentWorkLogEntry = Omit<SocialLegacyAgentWorkLogRow, "updated_at">;
type PreparedRepositoryContextEntry = Omit<SocialLegacyRepositoryContextRow, "created_at" | "updated_at">;

type FixtureSchema = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
  };
  social: {
    tables: string[];
  };
};

type FixtureCoreSource = {
  tenant_strategic_dossiers: CoreStrategicDossierRow[];
  agent_work_logs: CoreAgentWorkLogRow[];
  tenants: CoreTenantProgressRow[];
  saas: CoreSaasRow[];
  saas_domains: CoreSaasDomainRow[];
};

type FixtureSocialTarget = {
  socialflow_legacy_strategic_dossiers: SocialLegacyStrategicDossierRow[];
  socialflow_legacy_tenant_progress: SocialLegacyTenantProgressRow[];
  socialflow_legacy_agent_work_logs: SocialLegacyAgentWorkLogRow[];
  socialflow_legacy_repository_context: SocialLegacyRepositoryContextRow[];
};

type RunOptions = {
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

type ParsedArgs = {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
};

type TableBackfillStats = {
  scanned: number;
  selected: number;
  inserts: number;
  updates: number;
  unchanged: number;
};

export type SocialFlowLegacyReadModelsBackfillReport = {
  mode: BackfillMode;
  dryRun: boolean;
  inserts: number;
  updates: number;
  unchanged: number;
  tables: Record<LegacyTableName, TableBackfillStats>;
};

type TableOperation<TEntry> = {
  key: string;
  type: "insert" | "update" | "unchanged";
  entry: TEntry;
};

const REQUIRED_DRACO_TABLES = [
  "tenant_strategic_dossiers",
  "agent_work_logs",
  "tenants",
  "saas",
  "saas_domains",
] as const;

const REQUIRED_SOCIAL_TABLES: readonly LegacyTableName[] = [
  "socialflow_legacy_strategic_dossiers",
  "socialflow_legacy_tenant_progress",
  "socialflow_legacy_agent_work_logs",
  "socialflow_legacy_repository_context",
] as const;

const FIXTURE_SCHEMA_FILE = "socialflow-legacy-backfill-schema.json";
const FIXTURE_SOURCE_FILE = "socialflow-legacy-core-source.json";
const FIXTURE_TARGET_FILE = "socialflow-legacy-read-models.json";

const SOCIALFLOW_SLUGS = new Set(["socialflow", "socialflows"]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeSlug(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeStatus(value: unknown, fallback: string): string {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
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
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  return parsed[0]?.results ?? [];
}

function runWranglerJson(
  binding: string,
  sql: string,
  options: { configPath: string },
): unknown[] {
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
        options.configPath,
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
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerCommand(
  binding: string,
  sql: string,
  options: { configPath: string },
): void {
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
        options.configPath,
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
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_WRANGLER_COMMAND_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_TABLE_MISSING:${tableName}`);
  }
}

function toKey(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => normalizeText(part)).join("::");
}

function toLegacyStrategicDossierId(dossierId: string, tenantId: string): string {
  const safe = `${tenantId}_${dossierId}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 48);
  return `sf_legacy_dossier_${safe}`;
}

function toLegacyAgentWorkLogId(logId: string, tenantId: string): string {
  const safe = `${tenantId}_${logId}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 48);
  return `sf_legacy_log_${safe}`;
}

function toLegacyRepositoryContextId(tenantId: string, saasId: string): string {
  const safe = `${tenantId}_${saasId}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 48);
  return `sf_legacy_repo_${safe}`;
}

function normalizeJsonText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return fallback;
}

function buildPreparedStrategicDossiers(rows: CoreStrategicDossierRow[]): PreparedStrategicDossierEntry[] {
  return rows
    .map((row) => {
      const tenantId = normalizeText(row.tenant_id);
      const dossierId = normalizeText(row.id);
      if (!tenantId || !dossierId) return null;
      return {
        id: toLegacyStrategicDossierId(dossierId, tenantId),
        tenant_id: tenantId,
        dossier_id: dossierId,
        status: normalizeStatus(row.status, "draft"),
        version: Math.max(1, Math.trunc(normalizeNumber(row.version, 1))),
        form_data_json: normalizeJsonText(row.form_data, "{}"),
        analysis_data_json: normalizeNullableString(row.analysis_data),
        plan_data_json: normalizeNullableString(row.plan_data),
        source_updated_at: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at),
      } satisfies PreparedStrategicDossierEntry;
    })
    .filter((entry): entry is PreparedStrategicDossierEntry => entry != null);
}

function buildPreparedTenantProgress(rows: CoreTenantProgressRow[]): PreparedTenantProgressEntry[] {
  return rows
    .map((row) => {
      const tenantId = normalizeText(row.tenant_id);
      if (!tenantId) return null;
      return {
        tenant_id: tenantId,
        materialization_step: Math.max(0, Math.trunc(normalizeNumber(row.materialization_step, 0))),
        updated_at: normalizeNullableString(row.updated_at) ?? "1970-01-01T00:00:00.000Z",
      } satisfies PreparedTenantProgressEntry;
    })
    .filter((entry): entry is PreparedTenantProgressEntry => entry != null);
}

function buildPreparedAgentWorkLogs(rows: CoreAgentWorkLogRow[]): PreparedAgentWorkLogEntry[] {
  return rows
    .map((row) => {
      const tenantId = normalizeText(row.tenant_id);
      const logId = normalizeText(row.id);
      if (!tenantId || !logId) return null;
      return {
        id: toLegacyAgentWorkLogId(logId, tenantId),
        tenant_id: tenantId,
        log_id: logId,
        saas_id: normalizeNullableString(row.saas_id),
        agent_name: normalizeText(row.agent_name) || "unknown",
        action_type: normalizeText(row.action_type) || "unknown",
        status: normalizeStatus(row.status, "unknown"),
        output_json: normalizeJsonText(row.output_json, "{}"),
        cost_eur: normalizeNumber(row.cost_eur, 0),
        created_at: normalizeNullableString(row.created_at) ?? "1970-01-01T00:00:00.000Z",
      } satisfies PreparedAgentWorkLogEntry;
    })
    .filter((entry): entry is PreparedAgentWorkLogEntry => entry != null);
}

function pickDomain(domains: CoreSaasDomainRow[]): string | null {
  const sorted = [...domains].sort((a, b) => {
    const aPrimary = a.is_primary === 1 || a.is_primary === true ? 1 : 0;
    const bPrimary = b.is_primary === 1 || b.is_primary === true ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;
    const aActive = normalizeStatus(a.status, "unknown") === "active" ? 1 : 0;
    const bActive = normalizeStatus(b.status, "unknown") === "active" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return normalizeText(a.domain).localeCompare(normalizeText(b.domain));
  });
  for (const row of sorted) {
    const domain = normalizeNullableString(row.domain);
    if (domain) return domain;
  }
  return null;
}

function buildPreparedRepositoryContext(
  saasRows: CoreSaasRow[],
  domainRows: CoreSaasDomainRow[],
): PreparedRepositoryContextEntry[] {
  const domainsByKey = new Map<string, CoreSaasDomainRow[]>();
  for (const domainRow of domainRows) {
    const key = toKey(domainRow.tenant_id, domainRow.saas_id);
    if (!domainsByKey.has(key)) {
      domainsByKey.set(key, []);
    }
    domainsByKey.get(key)!.push(domainRow);
  }

  return saasRows
    .filter((row) => SOCIALFLOW_SLUGS.has(normalizeSlug(row.slug)))
    .map((row) => {
      const tenantId = normalizeText(row.tenant_id);
      const saasId = normalizeText(row.id);
      const slug = normalizeSlug(row.slug);
      if (!tenantId || !saasId || !slug) return null;
      const domain = pickDomain(domainsByKey.get(toKey(tenantId, saasId)) ?? []);
      const metadataJson = JSON.stringify({
        source: "core_backfill",
        coreSlug: slug,
        coreStatus: normalizeStatus(row.status, "active"),
        sourceUpdatedAt: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at),
      });
      return {
        id: toLegacyRepositoryContextId(tenantId, saasId),
        tenant_id: tenantId,
        saas_id: saasId,
        slug,
        domain,
        status: normalizeStatus(row.status, "active"),
        metadata_json: metadataJson,
      } satisfies PreparedRepositoryContextEntry;
    })
    .filter((entry): entry is PreparedRepositoryContextEntry => entry != null);
}

function comparableStrategic(entry: PreparedStrategicDossierEntry | SocialLegacyStrategicDossierRow) {
  return {
    tenant_id: normalizeText(entry.tenant_id),
    dossier_id: normalizeText(entry.dossier_id),
    status: normalizeStatus(entry.status, "draft"),
    version: Math.max(1, Math.trunc(normalizeNumber(entry.version, 1))),
    form_data_json: normalizeText(entry.form_data_json),
    analysis_data_json: normalizeNullableString(entry.analysis_data_json),
    plan_data_json: normalizeNullableString(entry.plan_data_json),
    source_updated_at: normalizeNullableString(entry.source_updated_at),
  };
}

function comparableTenantProgress(entry: PreparedTenantProgressEntry | SocialLegacyTenantProgressRow) {
  return {
    tenant_id: normalizeText(entry.tenant_id),
    materialization_step: Math.max(0, Math.trunc(normalizeNumber(entry.materialization_step, 0))),
  };
}

function comparableAgentWorkLog(entry: PreparedAgentWorkLogEntry | SocialLegacyAgentWorkLogRow) {
  return {
    tenant_id: normalizeText(entry.tenant_id),
    log_id: normalizeText(entry.log_id),
    saas_id: normalizeNullableString(entry.saas_id),
    agent_name: normalizeText(entry.agent_name),
    action_type: normalizeText(entry.action_type),
    status: normalizeStatus(entry.status, "unknown"),
    output_json: normalizeText(entry.output_json),
    cost_eur: normalizeNumber(entry.cost_eur, 0),
    created_at: normalizeText(entry.created_at),
  };
}

function comparableRepositoryContext(entry: PreparedRepositoryContextEntry | SocialLegacyRepositoryContextRow) {
  return {
    tenant_id: normalizeText(entry.tenant_id),
    saas_id: normalizeText(entry.saas_id),
    slug: normalizeSlug(entry.slug),
    domain: normalizeNullableString(entry.domain),
    status: normalizeStatus(entry.status, "active"),
    metadata_json: normalizeText(entry.metadata_json),
  };
}

function planOperations<TEntry, TRow>(
  entries: TEntry[],
  existingRows: TRow[],
  keyFromEntry: (entry: TEntry) => string,
  keyFromRow: (row: TRow) => string,
  equivalent: (entry: TEntry, row: TRow) => boolean,
): Array<TableOperation<TEntry>> {
  const byKey = new Map<string, TRow>();
  for (const row of existingRows) {
    byKey.set(keyFromRow(row), row);
  }

  return entries.map((entry) => {
    const key = keyFromEntry(entry);
    const current = byKey.get(key);
    if (!current) {
      return { key, type: "insert", entry };
    }
    if (!equivalent(entry, current)) {
      return { key, type: "update", entry };
    }
    return { key, type: "unchanged", entry };
  });
}

function tableStatsFromOperations(
  scanned: number,
  selected: number,
  operations: Array<TableOperation<unknown>>,
): TableBackfillStats {
  return {
    scanned,
    selected,
    inserts: operations.filter((entry) => entry.type === "insert").length,
    updates: operations.filter((entry) => entry.type === "update").length,
    unchanged: operations.filter((entry) => entry.type === "unchanged").length,
  };
}

function emptyTargetState(): FixtureSocialTarget {
  return {
    socialflow_legacy_strategic_dossiers: [],
    socialflow_legacy_tenant_progress: [],
    socialflow_legacy_agent_work_logs: [],
    socialflow_legacy_repository_context: [],
  };
}

function assertFixturesReady(schema: FixtureSchema): void {
  if (!schema.bindings.draco) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_BINDING_MISSING:SOCIAL_DB");
  }
  for (const tableName of REQUIRED_DRACO_TABLES) {
    if (!schema.draco.tables.includes(tableName)) {
      throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_TABLE_MISSING:${tableName}`);
    }
  }
  for (const tableName of REQUIRED_SOCIAL_TABLES) {
    if (!schema.social.tables.includes(tableName)) {
      throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_TABLE_MISSING:${tableName}`);
    }
  }
}

async function loadFixturesState(fixturesDir: string): Promise<{
  schema: FixtureSchema;
  source: FixtureCoreSource;
  target: FixtureSocialTarget;
  targetPath: string;
}> {
  const schemaPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);

  const [schemaRaw, sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  const targetParsed = JSON.parse(targetRaw) as Partial<FixtureSocialTarget>;
  return {
    schema: JSON.parse(schemaRaw) as FixtureSchema,
    source: JSON.parse(sourceRaw) as FixtureCoreSource,
    target: {
      ...emptyTargetState(),
      ...targetParsed,
    },
    targetPath,
  };
}

function aggregateTotals(
  tables: Record<LegacyTableName, TableBackfillStats>,
): Pick<SocialFlowLegacyReadModelsBackfillReport, "inserts" | "updates" | "unchanged"> {
  return {
    inserts: Object.values(tables).reduce((acc, value) => acc + value.inserts, 0),
    updates: Object.values(tables).reduce((acc, value) => acc + value.updates, 0),
    unchanged: Object.values(tables).reduce((acc, value) => acc + value.unchanged, 0),
  };
}

async function runFixturesBackfill(
  fixturesDir: string,
  dryRun: boolean,
): Promise<SocialFlowLegacyReadModelsBackfillReport> {
  const state = await loadFixturesState(fixturesDir);
  assertFixturesReady(state.schema);

  const preparedStrategic = buildPreparedStrategicDossiers(state.source.tenant_strategic_dossiers ?? []);
  const preparedTenantProgress = buildPreparedTenantProgress(state.source.tenants ?? []);
  const preparedWorkLogs = buildPreparedAgentWorkLogs(state.source.agent_work_logs ?? []);
  const preparedRepositoryContext = buildPreparedRepositoryContext(
    state.source.saas ?? [],
    state.source.saas_domains ?? [],
  );

  const strategicOps = planOperations(
    preparedStrategic,
    state.target.socialflow_legacy_strategic_dossiers,
    (entry) => toKey(entry.tenant_id, entry.dossier_id),
    (row) => toKey(row.tenant_id, row.dossier_id),
    (entry, row) => JSON.stringify(comparableStrategic(entry)) === JSON.stringify(comparableStrategic(row)),
  );
  const tenantOps = planOperations(
    preparedTenantProgress,
    state.target.socialflow_legacy_tenant_progress,
    (entry) => toKey(entry.tenant_id),
    (row) => toKey(row.tenant_id),
    (entry, row) => JSON.stringify(comparableTenantProgress(entry)) === JSON.stringify(comparableTenantProgress(row)),
  );
  const logOps = planOperations(
    preparedWorkLogs,
    state.target.socialflow_legacy_agent_work_logs,
    (entry) => toKey(entry.tenant_id, entry.log_id),
    (row) => toKey(row.tenant_id, row.log_id),
    (entry, row) => JSON.stringify(comparableAgentWorkLog(entry)) === JSON.stringify(comparableAgentWorkLog(row)),
  );
  const repositoryOps = planOperations(
    preparedRepositoryContext,
    state.target.socialflow_legacy_repository_context,
    (entry) => toKey(entry.tenant_id, entry.saas_id),
    (row) => toKey(row.tenant_id, row.saas_id),
    (entry, row) => JSON.stringify(comparableRepositoryContext(entry)) === JSON.stringify(comparableRepositoryContext(row)),
  );

  if (!dryRun) {
    const now = new Date().toISOString();

    const strategicMap = new Map<string, SocialLegacyStrategicDossierRow>();
    for (const row of state.target.socialflow_legacy_strategic_dossiers) {
      strategicMap.set(toKey(row.tenant_id, row.dossier_id), row);
    }
    for (const operation of strategicOps) {
      if (operation.type === "unchanged") continue;
      const key = operation.key;
      const current = strategicMap.get(key);
      if (current) {
        strategicMap.set(key, {
          ...current,
          ...operation.entry,
          updated_at: now,
        });
      } else {
        strategicMap.set(key, {
          ...operation.entry,
          created_at: now,
          updated_at: now,
        });
      }
    }

    const tenantMap = new Map<string, SocialLegacyTenantProgressRow>();
    for (const row of state.target.socialflow_legacy_tenant_progress) {
      tenantMap.set(toKey(row.tenant_id), row);
    }
    for (const operation of tenantOps) {
      if (operation.type === "unchanged") continue;
      tenantMap.set(operation.key, {
        ...operation.entry,
        updated_at: now,
      });
    }

    const logMap = new Map<string, SocialLegacyAgentWorkLogRow>();
    for (const row of state.target.socialflow_legacy_agent_work_logs) {
      logMap.set(toKey(row.tenant_id, row.log_id), row);
    }
    for (const operation of logOps) {
      if (operation.type === "unchanged") continue;
      const current = logMap.get(operation.key);
      if (current) {
        logMap.set(operation.key, {
          ...current,
          ...operation.entry,
          updated_at: now,
        });
      } else {
        logMap.set(operation.key, {
          ...operation.entry,
          updated_at: now,
        });
      }
    }

    const repositoryMap = new Map<string, SocialLegacyRepositoryContextRow>();
    for (const row of state.target.socialflow_legacy_repository_context) {
      repositoryMap.set(toKey(row.tenant_id, row.saas_id), row);
    }
    for (const operation of repositoryOps) {
      if (operation.type === "unchanged") continue;
      const current = repositoryMap.get(operation.key);
      if (current) {
        repositoryMap.set(operation.key, {
          ...current,
          ...operation.entry,
          updated_at: now,
        });
      } else {
        repositoryMap.set(operation.key, {
          ...operation.entry,
          created_at: now,
          updated_at: now,
        });
      }
    }

    const nextTarget: FixtureSocialTarget = {
      socialflow_legacy_strategic_dossiers: [...strategicMap.values()].sort((a, b) =>
        toKey(a.tenant_id, a.dossier_id).localeCompare(toKey(b.tenant_id, b.dossier_id)),
      ),
      socialflow_legacy_tenant_progress: [...tenantMap.values()].sort((a, b) =>
        toKey(a.tenant_id).localeCompare(toKey(b.tenant_id)),
      ),
      socialflow_legacy_agent_work_logs: [...logMap.values()].sort((a, b) =>
        toKey(a.tenant_id, a.log_id).localeCompare(toKey(b.tenant_id, b.log_id)),
      ),
      socialflow_legacy_repository_context: [...repositoryMap.values()].sort((a, b) =>
        toKey(a.tenant_id, a.saas_id).localeCompare(toKey(b.tenant_id, b.saas_id)),
      ),
    };
    await fs.writeFile(state.targetPath, `${JSON.stringify(nextTarget, null, 2)}\n`, "utf8");
  }

  const tables: Record<LegacyTableName, TableBackfillStats> = {
    socialflow_legacy_strategic_dossiers: tableStatsFromOperations(
      state.source.tenant_strategic_dossiers.length,
      preparedStrategic.length,
      strategicOps,
    ),
    socialflow_legacy_tenant_progress: tableStatsFromOperations(
      state.source.tenants.length,
      preparedTenantProgress.length,
      tenantOps,
    ),
    socialflow_legacy_agent_work_logs: tableStatsFromOperations(
      state.source.agent_work_logs.length,
      preparedWorkLogs.length,
      logOps,
    ),
    socialflow_legacy_repository_context: tableStatsFromOperations(
      state.source.saas.length,
      preparedRepositoryContext.length,
      repositoryOps,
    ),
  };

  return {
    mode: "fixtures",
    dryRun,
    ...aggregateTotals(tables),
    tables,
  };
}

function assertLocalD1Ready(options: { configPath: string; dracoBinding: string; socialBinding: string }): void {
  const dracoTables = runWranglerJson(
    options.dracoBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('tenant_strategic_dossiers','agent_work_logs','tenants','saas','saas_domains');",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  for (const tableName of REQUIRED_DRACO_TABLES) {
    assertTableExists(dracoTables, tableName);
  }

  const socialTables = runWranglerJson(
    options.socialBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('socialflow_legacy_strategic_dossiers','socialflow_legacy_tenant_progress','socialflow_legacy_agent_work_logs','socialflow_legacy_repository_context');",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  for (const tableName of REQUIRED_SOCIAL_TABLES) {
    assertTableExists(socialTables, tableName);
  }
}

function loadCoreStrategicDossiers(options: { configPath: string; dracoBinding: string }): CoreStrategicDossierRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       id,
       tenant_id,
       status,
       version,
       form_data,
       analysis_data,
       plan_data,
       created_at,
       updated_at
     FROM tenant_strategic_dossiers
     WHERE tenant_id IS NOT NULL`,
    { configPath: options.configPath },
  ) as CoreStrategicDossierRow[];
}

function loadCoreAgentWorkLogs(options: { configPath: string; dracoBinding: string }): CoreAgentWorkLogRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       id,
       tenant_id,
       saas_id,
       agent_name,
       action_type,
       status,
       output_json,
       cost_eur,
       created_at,
       updated_at
     FROM agent_work_logs
     WHERE tenant_id IS NOT NULL`,
    { configPath: options.configPath },
  ) as CoreAgentWorkLogRow[];
}

function loadCoreTenantProgress(options: { configPath: string; dracoBinding: string }): CoreTenantProgressRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       id AS tenant_id,
       materialization_step,
       updated_at
     FROM tenants
     WHERE id IS NOT NULL`,
    { configPath: options.configPath },
  ) as CoreTenantProgressRow[];
}

function loadCoreSaasRows(options: { configPath: string; dracoBinding: string }): CoreSaasRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       id,
       tenant_id,
       slug,
       status,
       created_at,
       updated_at
     FROM saas
     WHERE tenant_id IS NOT NULL
       AND lower(slug) IN ('socialflow', 'socialflows')`,
    { configPath: options.configPath },
  ) as CoreSaasRow[];
}

function loadCoreSaasDomains(options: { configPath: string; dracoBinding: string }): CoreSaasDomainRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       tenant_id,
       saas_id,
       domain,
       is_primary,
       status
     FROM saas_domains`,
    { configPath: options.configPath },
  ) as CoreSaasDomainRow[];
}

function loadSocialStrategicDossiers(options: { configPath: string; socialBinding: string }): SocialLegacyStrategicDossierRow[] {
  return runWranglerJson(
    options.socialBinding,
    `SELECT
       id,
       tenant_id,
       dossier_id,
       status,
       version,
       form_data_json,
       analysis_data_json,
       plan_data_json,
       source_updated_at,
       created_at,
       updated_at
     FROM socialflow_legacy_strategic_dossiers`,
    { configPath: options.configPath },
  ) as SocialLegacyStrategicDossierRow[];
}

function loadSocialTenantProgress(options: { configPath: string; socialBinding: string }): SocialLegacyTenantProgressRow[] {
  return runWranglerJson(
    options.socialBinding,
    `SELECT
       tenant_id,
       materialization_step,
       updated_at
     FROM socialflow_legacy_tenant_progress`,
    { configPath: options.configPath },
  ) as SocialLegacyTenantProgressRow[];
}

function loadSocialAgentWorkLogs(options: { configPath: string; socialBinding: string }): SocialLegacyAgentWorkLogRow[] {
  return runWranglerJson(
    options.socialBinding,
    `SELECT
       id,
       tenant_id,
       log_id,
       saas_id,
       agent_name,
       action_type,
       status,
       output_json,
       cost_eur,
       created_at,
       updated_at
     FROM socialflow_legacy_agent_work_logs`,
    { configPath: options.configPath },
  ) as SocialLegacyAgentWorkLogRow[];
}

function loadSocialRepositoryContext(options: { configPath: string; socialBinding: string }): SocialLegacyRepositoryContextRow[] {
  return runWranglerJson(
    options.socialBinding,
    `SELECT
       id,
       tenant_id,
       saas_id,
       slug,
       domain,
       status,
       metadata_json,
       created_at,
       updated_at
     FROM socialflow_legacy_repository_context`,
    { configPath: options.configPath },
  ) as SocialLegacyRepositoryContextRow[];
}

function applyStrategicOperation(
  operation: TableOperation<PreparedStrategicDossierEntry>,
  options: { configPath: string; socialBinding: string },
): void {
  const entry = operation.entry;
  const sql = `
    INSERT INTO socialflow_legacy_strategic_dossiers (
      id,
      tenant_id,
      dossier_id,
      status,
      version,
      form_data_json,
      analysis_data_json,
      plan_data_json,
      source_updated_at,
      created_at,
      updated_at
    ) VALUES (
      ${asSqlValue(entry.id)},
      ${asSqlValue(entry.tenant_id)},
      ${asSqlValue(entry.dossier_id)},
      ${asSqlValue(entry.status)},
      ${asSqlValue(entry.version)},
      ${asSqlValue(entry.form_data_json)},
      ${asSqlValue(entry.analysis_data_json)},
      ${asSqlValue(entry.plan_data_json)},
      ${asSqlValue(entry.source_updated_at)},
      datetime('now'),
      datetime('now')
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
  runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
}

function applyTenantProgressOperation(
  operation: TableOperation<PreparedTenantProgressEntry>,
  options: { configPath: string; socialBinding: string },
): void {
  const entry = operation.entry;
  const sql = `
    INSERT INTO socialflow_legacy_tenant_progress (
      tenant_id,
      materialization_step,
      updated_at
    ) VALUES (
      ${asSqlValue(entry.tenant_id)},
      ${asSqlValue(entry.materialization_step)},
      datetime('now')
    )
    ON CONFLICT(tenant_id) DO UPDATE SET
      materialization_step = excluded.materialization_step,
      updated_at = excluded.updated_at;
  `;
  runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
}

function applyAgentWorkLogOperation(
  operation: TableOperation<PreparedAgentWorkLogEntry>,
  options: { configPath: string; socialBinding: string },
): void {
  const entry = operation.entry;
  const sql = `
    INSERT INTO socialflow_legacy_agent_work_logs (
      id,
      tenant_id,
      log_id,
      saas_id,
      agent_name,
      action_type,
      status,
      output_json,
      cost_eur,
      created_at,
      updated_at
    ) VALUES (
      ${asSqlValue(entry.id)},
      ${asSqlValue(entry.tenant_id)},
      ${asSqlValue(entry.log_id)},
      ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.agent_name)},
      ${asSqlValue(entry.action_type)},
      ${asSqlValue(entry.status)},
      ${asSqlValue(entry.output_json)},
      ${asSqlValue(entry.cost_eur)},
      ${asSqlValue(entry.created_at)},
      datetime('now')
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
  runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
}

function applyRepositoryContextOperation(
  operation: TableOperation<PreparedRepositoryContextEntry>,
  options: { configPath: string; socialBinding: string },
): void {
  const entry = operation.entry;
  const sql = `
    INSERT INTO socialflow_legacy_repository_context (
      id,
      tenant_id,
      saas_id,
      slug,
      domain,
      status,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      ${asSqlValue(entry.id)},
      ${asSqlValue(entry.tenant_id)},
      ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.slug)},
      ${asSqlValue(entry.domain)},
      ${asSqlValue(entry.status)},
      ${asSqlValue(entry.metadata_json)},
      datetime('now'),
      datetime('now')
    )
    ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
      slug = excluded.slug,
      domain = excluded.domain,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at;
  `;
  runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
}

async function runLocalD1Backfill(
  dryRun: boolean,
  options: { configPath: string; dracoBinding: string; socialBinding: string },
): Promise<SocialFlowLegacyReadModelsBackfillReport> {
  assertLocalD1Ready(options);

  const coreStrategic = loadCoreStrategicDossiers(options);
  const coreLogs = loadCoreAgentWorkLogs(options);
  const coreTenants = loadCoreTenantProgress(options);
  const coreSaas = loadCoreSaasRows(options);
  const coreDomains = loadCoreSaasDomains(options);

  const preparedStrategic = buildPreparedStrategicDossiers(coreStrategic);
  const preparedTenantProgress = buildPreparedTenantProgress(coreTenants);
  const preparedWorkLogs = buildPreparedAgentWorkLogs(coreLogs);
  const preparedRepositoryContext = buildPreparedRepositoryContext(coreSaas, coreDomains);

  const socialStrategic = loadSocialStrategicDossiers(options);
  const socialTenantProgress = loadSocialTenantProgress(options);
  const socialWorkLogs = loadSocialAgentWorkLogs(options);
  const socialRepositoryContext = loadSocialRepositoryContext(options);

  const strategicOps = planOperations(
    preparedStrategic,
    socialStrategic,
    (entry) => toKey(entry.tenant_id, entry.dossier_id),
    (row) => toKey(row.tenant_id, row.dossier_id),
    (entry, row) => JSON.stringify(comparableStrategic(entry)) === JSON.stringify(comparableStrategic(row)),
  );
  const tenantOps = planOperations(
    preparedTenantProgress,
    socialTenantProgress,
    (entry) => toKey(entry.tenant_id),
    (row) => toKey(row.tenant_id),
    (entry, row) => JSON.stringify(comparableTenantProgress(entry)) === JSON.stringify(comparableTenantProgress(row)),
  );
  const logOps = planOperations(
    preparedWorkLogs,
    socialWorkLogs,
    (entry) => toKey(entry.tenant_id, entry.log_id),
    (row) => toKey(row.tenant_id, row.log_id),
    (entry, row) => JSON.stringify(comparableAgentWorkLog(entry)) === JSON.stringify(comparableAgentWorkLog(row)),
  );
  const repositoryOps = planOperations(
    preparedRepositoryContext,
    socialRepositoryContext,
    (entry) => toKey(entry.tenant_id, entry.saas_id),
    (row) => toKey(row.tenant_id, row.saas_id),
    (entry, row) => JSON.stringify(comparableRepositoryContext(entry)) === JSON.stringify(comparableRepositoryContext(row)),
  );

  if (!dryRun) {
    for (const operation of strategicOps) {
      if (operation.type !== "unchanged") {
        applyStrategicOperation(operation, options);
      }
    }
    for (const operation of tenantOps) {
      if (operation.type !== "unchanged") {
        applyTenantProgressOperation(operation, options);
      }
    }
    for (const operation of logOps) {
      if (operation.type !== "unchanged") {
        applyAgentWorkLogOperation(operation, options);
      }
    }
    for (const operation of repositoryOps) {
      if (operation.type !== "unchanged") {
        applyRepositoryContextOperation(operation, options);
      }
    }
  }

  const tables: Record<LegacyTableName, TableBackfillStats> = {
    socialflow_legacy_strategic_dossiers: tableStatsFromOperations(coreStrategic.length, preparedStrategic.length, strategicOps),
    socialflow_legacy_tenant_progress: tableStatsFromOperations(coreTenants.length, preparedTenantProgress.length, tenantOps),
    socialflow_legacy_agent_work_logs: tableStatsFromOperations(coreLogs.length, preparedWorkLogs.length, logOps),
    socialflow_legacy_repository_context: tableStatsFromOperations(coreSaas.length, preparedRepositoryContext.length, repositoryOps),
  };

  return {
    mode: "d1-local",
    dryRun,
    ...aggregateTotals(tables),
    tables,
  };
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  return {
    dryRun,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

function logReportByTable(
  report: SocialFlowLegacyReadModelsBackfillReport,
  log: (line: string) => void,
) {
  for (const tableName of REQUIRED_SOCIAL_TABLES) {
    const stats = report.tables[tableName];
    log(
      `table=${tableName} scanned=${stats.scanned} selected=${stats.selected} inserts=${stats.inserts} updates=${stats.updates} unchanged=${stats.unchanged}`,
    );
  }
}

export async function runBackfillSocialflowLegacyReadModels(
  options: RunOptions = {},
): Promise<SocialFlowLegacyReadModelsBackfillReport> {
  const dryRun = options.dryRun ?? false;
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await runFixturesBackfill(fixturesDir, dryRun)
    : await runLocalD1Backfill(dryRun, { configPath, dracoBinding, socialBinding });

  log(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL mode=${report.mode} dryRun=${report.dryRun}`);
  logReportByTable(report, log);
  log(`totals inserts=${report.inserts} updates=${report.updates} unchanged=${report.unchanged}`);
  return report;
}

async function runCli(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const report = await runBackfillSocialflowLegacyReadModels({
      dryRun: parsed.dryRun,
      configPath: parsed.configPath,
      dracoBinding: parsed.dracoBinding,
      socialBinding: parsed.socialBinding,
      fixturesDir: parsed.fixturesDir,
    });
    console.log(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_REPORT ${JSON.stringify(report)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_ERROR ${message}`);
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
