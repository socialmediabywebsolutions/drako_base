import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSocialFlowExportCoreReadContract,
  type ExportCoreAgentWorkLog,
  type ExportCoreDomainRecord,
  type ExportCoreEconomicEvent,
  type ExportCoreOrchestratorMessage,
  type ExportCoreSaasRecord,
  type ExportCoreStrategicDossier,
} from "@/lib/socialflow/contracts/export-core-read";

type ParityMode = "d1-local" | "fixtures";

type CoreSaasRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string | null;
  blueprint_snapshot: string | null;
  plan_tier: string | null;
  mrr_eur: number | null;
  cost_eur: number | null;
  risk_level: string | null;
  created_at: string | null;
};

type ExportReadModelRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  status: string;
  dossier_json: string;
  blueprint_json: string;
  work_logs_csv: string;
  orchestrator_messages_csv: string;
  financials_csv: string;
  economic_events_csv: string;
  domains_json: string;
  meta_json: string;
  source_revision: string;
};

type PreparedExportReadModelEntry = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  status: "ready";
  dossier_json: string;
  blueprint_json: string;
  work_logs_csv: string;
  orchestrator_messages_csv: string;
  financials_csv: string;
  economic_events_csv: string;
  domains_json: string;
  meta_json: string;
  source_revision: string;
};

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
  saas: CoreSaasRow[];
  tenant_strategic_dossiers: ExportCoreStrategicDossierWithStatus[];
  agent_work_logs: ExportCoreAgentWorkLog[];
  orchestrator_messages: ExportCoreOrchestratorMessage[];
  economic_events: ExportCoreEconomicEvent[];
  saas_domains: ExportCoreDomainRecord[];
};

type ExportCoreStrategicDossierWithStatus = ExportCoreStrategicDossier & {
  status: string;
  created_at: string;
};

type ComparableField =
  | "id"
  | "slug"
  | "status"
  | "dossier_json"
  | "blueprint_json"
  | "work_logs_csv"
  | "orchestrator_messages_csv"
  | "financials_csv"
  | "economic_events_csv"
  | "domains_json"
  | "meta_json"
  | "source_revision";

type ComparableEntry = {
  tenant_id: string;
  saas_id: string;
  id: string;
  slug: string;
  status: string;
  dossier_json: string;
  blueprint_json: string;
  work_logs_csv: string;
  orchestrator_messages_csv: string;
  financials_csv: string;
  economic_events_csv: string;
  domains_json: string;
  meta_json: string;
  source_revision: string;
};

type Mismatch = {
  key: string;
  fields: ComparableField[];
  core: ComparableEntry;
  social: ComparableEntry;
};

export type SocialFlowExportReadModelsParityReport = {
  mode: ParityMode;
  totalCore: number;
  totalSocial: number;
  matched: number;
  missingInSocial: ComparableEntry[];
  missingInCore: ComparableEntry[];
  mismatched: Mismatch[];
};

type ParsedArgs = {
  allowDrift: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
};

type RunOptions = {
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

type CoreReadExecutor = {
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  run?: (sql: string, ...params: unknown[]) => Promise<boolean>;
};

const SOCIALFLOW_SLUGS = new Set(["socialflow", "socialflows"]);
const REQUIRED_CORE_TABLES = [
  "saas",
  "tenant_strategic_dossiers",
  "agent_work_logs",
  "orchestrator_messages",
  "economic_events",
  "saas_domains",
] as const;
const REQUIRED_SOCIAL_TABLE = "socialflow_export_read_models";

const FIXTURE_SOURCE_FILE = "socialflow-export-core-source.json";
const FIXTURE_TARGET_FILE = "socialflow-export-read-models.json";
const FIXTURE_SCHEMA_FILE = "socialflow-export-backfill-schema.json";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: string | null | undefined): string {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function slugAllowed(value: string): boolean {
  return SOCIALFLOW_SLUGS.has(normalizeSlug(value));
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

function materializeSql(sql: string, params: unknown[]): string {
  let offset = 0;
  const materialized = sql.replace(/\?/g, () => {
    if (offset >= params.length) {
      throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_PARAM_MISMATCH:missing");
    }
    const value = asSqlValue(params[offset]);
    offset += 1;
    return value;
  });

  if (offset !== params.length) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_PARAM_MISMATCH:extra");
  }

  return materialized;
}

function parseJsonRows<T>(jsonOutput: string): T[] {
  const parsed = JSON.parse(jsonOutput) as Array<{ results?: T[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
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
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:${tableName}`);
  }
}

function buildKey(tenantId: string, saasId: string): string {
  return `${tenantId}::${saasId}`;
}

function toCsv<T>(header: string, rows: T[], mapper: (row: T) => string): string {
  if (rows.length === 0) {
    return `${header}\n`;
  }
  return `${header}\n${rows.map(mapper).join("\n")}\n`;
}

function assertScopeField(row: { tenant_id?: string | null; saas_id?: string | null }, field: "tenant_id" | "saas_id", entity: string) {
  if (!(field in row)) {
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_SCOPE_FIELD_MISSING:${entity}:${field}`);
  }
}

function assertTenantScopedRows<T extends { tenant_id?: string | null; saas_id?: string | null }>(
  rows: T[],
  params: { entity: string; tenantId: string; saasId?: string; requireSaasId?: boolean },
): void {
  for (const row of rows) {
    assertScopeField(row, "tenant_id", params.entity);
    if (row.tenant_id !== params.tenantId) {
      throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_SCOPE_TENANT_ESCAPE:${params.entity}`);
    }
    if (params.requireSaasId) {
      assertScopeField(row, "saas_id", params.entity);
      if (row.saas_id !== params.saasId) {
        throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_SCOPE_SAAS_ESCAPE:${params.entity}`);
      }
    }
  }
}

function parseMaybeJsonSnapshot(value: string | null): string {
  if (!value || !value.trim()) {
    return "{}";
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function selectLatestSocialSaasPerTenant(rows: CoreSaasRow[]): CoreSaasRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.tenant_id !== b.tenant_id) return a.tenant_id.localeCompare(b.tenant_id);
    const left = a.created_at ?? "";
    const right = b.created_at ?? "";
    if (left === right) return b.id.localeCompare(a.id);
    return right.localeCompare(left);
  });

  const picked = new Set<string>();
  const selected: CoreSaasRow[] = [];

  for (const row of sorted) {
    const tenantId = normalizeText(row.tenant_id);
    if (!tenantId || !slugAllowed(row.slug)) continue;
    if (picked.has(tenantId)) continue;
    picked.add(tenantId);
    selected.push(row);
  }

  return selected;
}

function buildSourceRevision(input: {
  tenantId: string;
  saasId: string;
  slug: string;
  planTier: string | null;
  payload: {
    dossierJson: string;
    blueprintJson: string;
    workLogsCsv: string;
    orchestratorMessagesCsv: string;
    financialsCsv: string;
    economicEventsCsv: string;
    domainsJson: string;
    warnings: string[];
    counts: Record<string, number>;
  };
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        saasId: input.saasId,
        slug: input.slug,
        planTier: input.planTier,
        ...input.payload,
      }),
    )
    .digest("hex");
}

function createContractExecutorFromD1(options: { configPath: string; dracoBinding: string }) {
  return {
    queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      const rows = runWranglerJson(
        options.dracoBinding,
        materializeSql(sql, params),
        { configPath: options.configPath },
      ) as T[];
      return rows[0] ?? null;
    },
    queryAll: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      return runWranglerJson(
        options.dracoBinding,
        materializeSql(sql, params),
        { configPath: options.configPath },
      ) as T[];
    },
    run: async (_sql: string, ..._params: unknown[]): Promise<boolean> => {
      return false;
    },
  };
}

function createContractExecutorFromFixtures(
  source: FixtureCoreSource,
  schema: FixtureSchemaState,
) {
  const hasTable = (table: string) => schema.draco.tables.includes(table);

  return {
    queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      if (sql.includes("FROM saas") && sql.includes("ORDER BY created_at DESC")) {
        if (!hasTable("saas")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:saas");
        }
        const tenantId = normalizeText(params[0] as string);
        const slugA = normalizeSlug(String(params[1] ?? ""));
        const slugB = normalizeSlug(String(params[2] ?? ""));
        const rows = source.saas
          .filter((row) =>
            normalizeText(row.tenant_id) === tenantId
            && (normalizeSlug(row.slug) === slugA || normalizeSlug(row.slug) === slugB),
          )
          .sort((a, b) => {
            const left = a.created_at ?? "";
            const right = b.created_at ?? "";
            if (left === right) return b.id.localeCompare(a.id);
            return right.localeCompare(left);
          });
        const row = rows[0];
        if (!row) return null;
        const columns = new Set(schema.draco.saasColumns);
        return {
          id: row.id,
          tenant_id: row.tenant_id,
          slug: row.slug,
          name: row.name ?? row.slug,
          blueprint_snapshot: columns.has("blueprint_snapshot") ? row.blueprint_snapshot : null,
          plan_tier: columns.has("plan_tier") ? row.plan_tier : null,
          mrr_eur: columns.has("mrr_eur") ? normalizeNumber(row.mrr_eur) : 0,
          cost_eur: columns.has("cost_eur") ? normalizeNumber(row.cost_eur) : 0,
          risk_level: columns.has("risk_level") ? normalizeText(row.risk_level) || "unknown" : "unknown",
        } as T;
      }

      if (sql.includes("tenant_strategic_dossiers")) {
        if (!hasTable("tenant_strategic_dossiers")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:tenant_strategic_dossiers");
        }
        const tenantId = normalizeText(params[0] as string);
        const row = source.tenant_strategic_dossiers
          .filter((entry) => normalizeText(entry.tenant_id) === tenantId && ["active", "analyzed"].includes(normalizeSlug(entry.status)))
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
        if (!row) return null;
        return {
          id: row.id,
          tenant_id: row.tenant_id,
          form_data: row.form_data,
          analysis_data: row.analysis_data,
          plan_data: row.plan_data,
        } as T;
      }

      return null;
    },
    queryAll: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      if (sql.startsWith("PRAGMA table_info('saas')")) {
        if (!hasTable("saas")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:saas");
        }
        return schema.draco.saasColumns.map((name) => ({ name })) as T[];
      }

      if (sql.includes("agent_work_logs")) {
        if (!hasTable("agent_work_logs")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:agent_work_logs");
        }
        const tenantId = normalizeText(params[0] as string);
        const saasId = normalizeText(params[1] as string);
        return source.agent_work_logs
          .filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId)
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")) as T[];
      }

      if (sql.includes("orchestrator_messages")) {
        if (!hasTable("orchestrator_messages")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:orchestrator_messages");
        }
        const tenantId = normalizeText(params[0] as string);
        return source.orchestrator_messages
          .filter((row) => normalizeText(row.tenant_id) === tenantId)
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")) as T[];
      }

      if (sql.includes("economic_events")) {
        if (!hasTable("economic_events")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:economic_events");
        }
        const tenantId = normalizeText(params[0] as string);
        const saasId = normalizeText(params[1] as string);
        return source.economic_events
          .filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId)
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")) as T[];
      }

      if (sql.includes("saas_domains")) {
        if (!hasTable("saas_domains")) {
          throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:saas_domains");
        }
        const tenantId = normalizeText(params[0] as string);
        const saasId = normalizeText(params[1] as string);
        return source.saas_domains
          .filter((row) => normalizeText(row.tenant_id) === tenantId && normalizeText(row.saas_id) === saasId) as T[];
      }

      return [];
    },
    run: async (_sql: string, ..._params: unknown[]): Promise<boolean> => {
      return false;
    },
  };
}

async function buildPreparedEntryForTenant(
  tenantId: string,
  contract: ReturnType<typeof createSocialFlowExportCoreReadContract>,
): Promise<PreparedExportReadModelEntry | null> {
  const projection = await contract.findRuntimeSocialFlowExportSaasRecord(tenantId);
  const saas = projection.saas as ExportCoreSaasRecord | null;
  if (!saas) {
    return null;
  }

  const warnings: string[] = [];
  for (const column of projection.missingColumns) {
    warnings.push(`DRACO_DB.saas column ${column} is missing; export used a safe default for this field.`);
  }

  const dossier = await contract.getStrategicDossier(tenantId);
  if (dossier) {
    assertTenantScopedRows([dossier], { entity: "tenant_strategic_dossiers", tenantId });
    warnings.push("dossier.pdf not found (storage not implemented)");
  } else {
    warnings.push("No active Strategic Dossier found for tenant");
  }

  const dossierJson = dossier ? JSON.stringify(dossier, null, 2) : "";

  let blueprintJson = "{}";
  if (saas.blueprint_snapshot) {
    blueprintJson = parseMaybeJsonSnapshot(saas.blueprint_snapshot);
    if (blueprintJson === saas.blueprint_snapshot && saas.blueprint_snapshot.trim() !== "{}") {
      try {
        JSON.parse(saas.blueprint_snapshot);
      } catch {
        warnings.push("Blueprint snapshot was invalid JSON");
      }
    }
  } else {
    warnings.push("No blueprint_snapshot found in saas");
  }

  const workLogs = await contract.listAgentWorkLogs(tenantId, saas.id);
  assertTenantScopedRows(workLogs, {
    entity: "agent_work_logs",
    tenantId,
    saasId: saas.id,
    requireSaasId: true,
  });
  const workLogsCsv = toCsv(
    "id,agent_name,action_type,status,cost_eur,created_at,output_snippet",
    workLogs,
    (log) => {
      const snippet = (log.output_json ?? "").replace(/"/g, '""').slice(0, 1000);
      return `${log.id},${log.agent_name},${log.action_type},${log.status},${log.cost_eur},${log.created_at},"${snippet}"`;
    },
  );

  const messages = await contract.listOrchestratorMessages(tenantId);
  assertTenantScopedRows(messages, { entity: "orchestrator_messages", tenantId });
  const orchestratorMessagesCsv = toCsv(
    "role,created_at,content",
    messages,
    (message) => {
      const content = (message.content ?? "").replace(/"/g, '""');
      return `${message.role},${message.created_at},"${content}"`;
    },
  );

  const financialsCsv = [
    "metric,value,unit",
    `mrr,${normalizeNumber(saas.mrr_eur)},EUR`,
    `total_cost,${normalizeNumber(saas.cost_eur)},EUR`,
    `risk_level,${normalizeText(saas.risk_level) || "unknown"},ENUM`,
    `plan_tier,${normalizeText(saas.plan_tier)},ENUM`,
  ].join("\n") + "\n";

  const economicEvents = await contract.listEconomicEvents(tenantId, saas.id);
  assertTenantScopedRows(economicEvents, {
    entity: "economic_events",
    tenantId,
    saasId: saas.id,
    requireSaasId: true,
  });
  const economicEventsCsv = toCsv(
    "id,type,severity,created_at,payload",
    economicEvents,
    (event) => {
      const payload = (event.payload_json ?? "").replace(/"/g, '""');
      return `${event.id},${event.type},${event.severity},${event.created_at},"${payload}"`;
    },
  );

  const domains = await contract.listSaasDomains(tenantId, saas.id);
  assertTenantScopedRows(domains, {
    entity: "saas_domains",
    tenantId,
    saasId: saas.id,
    requireSaasId: true,
  });
  const domainsJson = JSON.stringify(domains, null, 2);

  const counts = {
    logs: workLogs.length,
    economic_events: economicEvents.length,
    domains: domains.length,
  };

  const sourceRevision = buildSourceRevision({
    tenantId,
    saasId: saas.id,
    slug: saas.slug,
    planTier: saas.plan_tier,
    payload: {
      dossierJson,
      blueprintJson,
      workLogsCsv,
      orchestratorMessagesCsv,
      financialsCsv,
      economicEventsCsv,
      domainsJson,
      warnings,
      counts,
    },
  });

  const metaJson = JSON.stringify(
    {
      saasId: saas.id,
      tenantId: saas.tenant_id,
      slug: saas.slug,
      generatedAt: "socialflow_export_read_model_backfill",
      planTag: saas.plan_tier,
      counts,
      warnings,
      sourceRevision,
    },
    null,
    2,
  );

  return {
    id: `sf_export_model_${`${tenantId}_${saas.id}`.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 48)}`,
    tenant_id: tenantId,
    saas_id: saas.id,
    slug: saas.slug,
    status: "ready",
    dossier_json: dossierJson,
    blueprint_json: blueprintJson,
    work_logs_csv: workLogsCsv,
    orchestrator_messages_csv: orchestratorMessagesCsv,
    financials_csv: financialsCsv,
    economic_events_csv: economicEventsCsv,
    domains_json: domainsJson,
    meta_json: metaJson,
    source_revision: sourceRevision,
  };
}

function toComparableEntry(entry: PreparedExportReadModelEntry | ExportReadModelRow): ComparableEntry {
  return {
    tenant_id: normalizeText(entry.tenant_id),
    saas_id: normalizeText(entry.saas_id),
    id: normalizeText(entry.id),
    slug: normalizeSlug(entry.slug),
    status: normalizeStatus(entry.status),
    dossier_json: normalizeText(entry.dossier_json),
    blueprint_json: normalizeText(entry.blueprint_json),
    work_logs_csv: normalizeText(entry.work_logs_csv),
    orchestrator_messages_csv: normalizeText(entry.orchestrator_messages_csv),
    financials_csv: normalizeText(entry.financials_csv),
    economic_events_csv: normalizeText(entry.economic_events_csv),
    domains_json: normalizeText(entry.domains_json),
    meta_json: normalizeText(entry.meta_json),
    source_revision: normalizeText(entry.source_revision),
  };
}

function buildComparableMap(rows: ComparableEntry[]): Map<string, ComparableEntry> {
  const map = new Map<string, ComparableEntry>();
  for (const row of rows) {
    if (!row.tenant_id || !row.saas_id) continue;
    map.set(buildKey(row.tenant_id, row.saas_id), row);
  }
  return map;
}

function buildMismatch(core: ComparableEntry, social: ComparableEntry, key: string): Mismatch | null {
  const fields: ComparableField[] = [];
  if (core.id !== social.id) fields.push("id");
  if (core.slug !== social.slug) fields.push("slug");
  if (core.status !== social.status) fields.push("status");
  if (core.dossier_json !== social.dossier_json) fields.push("dossier_json");
  if (core.blueprint_json !== social.blueprint_json) fields.push("blueprint_json");
  if (core.work_logs_csv !== social.work_logs_csv) fields.push("work_logs_csv");
  if (core.orchestrator_messages_csv !== social.orchestrator_messages_csv) fields.push("orchestrator_messages_csv");
  if (core.financials_csv !== social.financials_csv) fields.push("financials_csv");
  if (core.economic_events_csv !== social.economic_events_csv) fields.push("economic_events_csv");
  if (core.domains_json !== social.domains_json) fields.push("domains_json");
  if (core.meta_json !== social.meta_json) fields.push("meta_json");
  if (core.source_revision !== social.source_revision) fields.push("source_revision");
  if (fields.length === 0) return null;
  return { key, fields, core, social };
}

function buildParityReport(
  coreRows: ComparableEntry[],
  socialRows: ComparableEntry[],
  mode: ParityMode,
): SocialFlowExportReadModelsParityReport {
  const coreMap = buildComparableMap(coreRows);
  const socialMap = buildComparableMap(socialRows);

  const missingInSocial: ComparableEntry[] = [];
  const missingInCore: ComparableEntry[] = [];
  const mismatched: Mismatch[] = [];
  let matched = 0;

  for (const [key, core] of coreMap.entries()) {
    const social = socialMap.get(key);
    if (!social) {
      missingInSocial.push(core);
      continue;
    }

    const mismatch = buildMismatch(core, social, key);
    if (mismatch) {
      mismatched.push(mismatch);
    } else {
      matched += 1;
    }
  }

  for (const [key, social] of socialMap.entries()) {
    if (!coreMap.has(key)) {
      missingInCore.push(social);
    }
  }

  return {
    mode,
    totalCore: coreMap.size,
    totalSocial: socialMap.size,
    matched,
    missingInSocial,
    missingInCore,
    mismatched,
  };
}

function hasDrift(report: SocialFlowExportReadModelsParityReport): boolean {
  return report.missingInSocial.length > 0 || report.missingInCore.length > 0 || report.mismatched.length > 0;
}

function summarizeEntries(rows: ComparableEntry[]): string {
  return rows
    .map((row) => `${row.tenant_id}/${row.saas_id} slug=${row.slug} status=${row.status} revision=${row.source_revision.slice(0, 12)}`)
    .join(" | ");
}

function summarizeMismatches(rows: Mismatch[]): string {
  return rows
    .map((row) => `${row.key} fields=${row.fields.join(",")}`)
    .join(" | ");
}

function reportToConsole(report: SocialFlowExportReadModelsParityReport, log: (line: string) => void): void {
  log(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY mode=${report.mode}`);
  log(
    `core=${report.totalCore} social=${report.totalSocial} matched=${report.matched} missingInSocial=${report.missingInSocial.length} missingInCore=${report.missingInCore.length} mismatched=${report.mismatched.length}`,
  );
  if (report.missingInSocial.length > 0) {
    log(`missingInSocial=${summarizeEntries(report.missingInSocial)}`);
  }
  if (report.missingInCore.length > 0) {
    log(`missingInCore=${summarizeEntries(report.missingInCore)}`);
  }
  if (report.mismatched.length > 0) {
    log(`mismatched=${summarizeMismatches(report.mismatched)}`);
  }
}

async function loadFixturesState(fixturesDir: string): Promise<{
  schema: FixtureSchemaState;
  source: FixtureCoreSource;
  targetRows: ExportReadModelRow[];
}> {
  const schemaPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);
  const [schemaRaw, sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  return {
    schema: JSON.parse(schemaRaw) as FixtureSchemaState,
    source: JSON.parse(sourceRaw) as FixtureCoreSource,
    targetRows: JSON.parse(targetRaw) as ExportReadModelRow[],
  };
}

function assertFixturesReady(schema: FixtureSchemaState): void {
  if (!schema.bindings.draco) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_BINDING_MISSING:SOCIAL_DB");
  }
  for (const tableName of REQUIRED_CORE_TABLES) {
    if (!schema.draco.tables.includes(tableName)) {
      throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:${tableName}`);
    }
  }
  if (!schema.social.tables.includes(REQUIRED_SOCIAL_TABLE)) {
    throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_TABLE_MISSING:${REQUIRED_SOCIAL_TABLE}`);
  }
}

async function collectCoreExpectedRows(
  saasRows: CoreSaasRow[],
  contract: ReturnType<typeof createSocialFlowExportCoreReadContract>,
): Promise<ComparableEntry[]> {
  const selectedRows = selectLatestSocialSaasPerTenant(saasRows);
  const entries: ComparableEntry[] = [];
  for (const row of selectedRows) {
    const tenantId = normalizeText(row.tenant_id);
    if (!tenantId) continue;
    const built = await buildPreparedEntryForTenant(tenantId, contract);
    if (!built) continue;
    entries.push(toComparableEntry(built));
  }
  return entries;
}

async function loadFromFixtures(fixturesDir: string): Promise<SocialFlowExportReadModelsParityReport> {
  const state = await loadFixturesState(fixturesDir);
  assertFixturesReady(state.schema);
  const contract = createSocialFlowExportCoreReadContract(createContractExecutorFromFixtures(state.source, state.schema));
  const coreRows = await collectCoreExpectedRows(state.source.saas, contract);
  const socialRows = state.targetRows.map((row) => toComparableEntry(row));
  return buildParityReport(coreRows, socialRows, "fixtures");
}

function assertLocalD1Ready(options: { configPath: string; dracoBinding: string; socialBinding: string }): void {
  const dracoTables = runWranglerJson(
    options.dracoBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('saas','tenant_strategic_dossiers','agent_work_logs','orchestrator_messages','economic_events','saas_domains');",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  for (const tableName of REQUIRED_CORE_TABLES) {
    assertTableExists(dracoTables, tableName);
  }

  const socialTables = runWranglerJson(
    options.socialBinding,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${asSqlValue(REQUIRED_SOCIAL_TABLE)};`,
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertTableExists(socialTables, REQUIRED_SOCIAL_TABLE);
}

function loadSourceSaasRows(options: { configPath: string; dracoBinding: string }): CoreSaasRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT id, tenant_id, slug, name, blueprint_snapshot, plan_tier, mrr_eur, cost_eur, risk_level, created_at
     FROM saas
     WHERE tenant_id IS NOT NULL
       AND lower(slug) IN ('socialflow', 'socialflows')
     ORDER BY tenant_id ASC, datetime(created_at) DESC`,
    { configPath: options.configPath },
  ) as CoreSaasRow[];
}

function loadSocialRows(options: { configPath: string; socialBinding: string }): ComparableEntry[] {
  const rows = runWranglerJson(
    options.socialBinding,
    `SELECT id, tenant_id, saas_id, slug, status, dossier_json, blueprint_json, work_logs_csv, orchestrator_messages_csv, financials_csv, economic_events_csv, domains_json, meta_json, source_revision
     FROM socialflow_export_read_models`,
    { configPath: options.configPath },
  ) as ExportReadModelRow[];
  return rows.map((row) => toComparableEntry(row));
}

async function loadFromLocalD1(options: { configPath: string; dracoBinding: string; socialBinding: string }): Promise<SocialFlowExportReadModelsParityReport> {
  assertLocalD1Ready(options);
  const sourceRows = loadSourceSaasRows(options);
  const contract = createSocialFlowExportCoreReadContract(createContractExecutorFromD1(options));
  const coreRows = await collectCoreExpectedRows(sourceRows, contract);
  const socialRows = loadSocialRows({ configPath: options.configPath, socialBinding: options.socialBinding });
  return buildParityReport(coreRows, socialRows, "d1-local");
}

function parseArgs(argv: string[]): ParsedArgs {
  const allowDrift = argv.includes("--allow-drift");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  return {
    allowDrift,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

export async function runCheckSocialflowExportReadModelsParity(options: RunOptions = {}): Promise<SocialFlowExportReadModelsParityReport> {
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await loadFromFixtures(fixturesDir)
    : await loadFromLocalD1({ configPath, dracoBinding, socialBinding });

  reportToConsole(report, log);
  return report;
}

export function resolveExportParityExitCode(
  report: SocialFlowExportReadModelsParityReport,
  allowDrift: boolean,
): number {
  if (!hasDrift(report)) {
    return 0;
  }
  return allowDrift ? 0 : 2;
}

export async function runCheckSocialflowExportReadModelsParityCli(
  argv: string[],
  io: { log: (line: string) => void; error: (line: string) => void } = {
    log: console.log,
    error: console.error,
  },
): Promise<number> {
  const args = parseArgs(argv);
  try {
    const report = await runCheckSocialflowExportReadModelsParity({
      configPath: args.configPath,
      dracoBinding: args.dracoBinding,
      socialBinding: args.socialBinding,
      fixturesDir: args.fixturesDir,
      log: io.log,
    });
    const code = resolveExportParityExitCode(report, args.allowDrift);
    if (code !== 0) {
      io.error("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_DRIFT_DETECTED");
    }
    if (hasDrift(report) && args.allowDrift) {
      io.log("SOCIALFLOW_EXPORT_READ_MODELS_PARITY_ALLOW_DRIFT=true");
    }
    return code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(`SOCIALFLOW_EXPORT_READ_MODELS_PARITY_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runCheckSocialflowExportReadModelsParityCli(process.argv.slice(2));
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
