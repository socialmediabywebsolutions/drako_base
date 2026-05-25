import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ParityMode = "d1-local" | "fixtures";

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
};

type CoreTenantProgressRow = {
  tenant_id: string;
  materialization_step: number | null;
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
  tenant_id: string;
  dossier_id: string;
  status: string;
  version: number;
  form_data_json: string;
  analysis_data_json: string | null;
  plan_data_json: string | null;
  source_updated_at: string | null;
};

type SocialLegacyTenantProgressRow = {
  tenant_id: string;
  materialization_step: number;
};

type SocialLegacyAgentWorkLogRow = {
  tenant_id: string;
  log_id: string;
  saas_id: string | null;
  agent_name: string;
  action_type: string;
  status: string;
  output_json: string;
  cost_eur: number;
  created_at: string;
};

type SocialLegacyRepositoryContextRow = {
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string | null;
  status: string;
  metadata_json: string;
};

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

type ParityEntry = {
  table: LegacyTableName;
  key: string;
  fields: Record<string, string>;
};

type ParityMismatch = {
  table: LegacyTableName;
  key: string;
  fields: string[];
  core: ParityEntry;
  social: ParityEntry;
};

type ParitySummaryEntry = {
  table: LegacyTableName;
  key: string;
};

export type SocialFlowLegacyReadModelsParityReport = {
  mode: ParityMode;
  totalCore: number;
  totalSocial: number;
  matched: number;
  missingInSocial: ParitySummaryEntry[];
  missingInCore: ParitySummaryEntry[];
  mismatched: ParityMismatch[];
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

function stableJsonStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJsonStringify(record[key])}`).join(",")}}`;
}

function canonicalizeJson(value: string | null | undefined): string {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    return stableJsonStringify(JSON.parse(raw));
  } catch {
    return raw;
  }
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
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY_TABLE_MISSING:${tableName}`);
  }
}

function toKey(...parts: Array<string | null | undefined>): string {
  return parts.map((part) => normalizeText(part)).join("::");
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

function buildCoreEntries(source: FixtureCoreSource): ParityEntry[] {
  const entries: ParityEntry[] = [];

  for (const row of source.tenant_strategic_dossiers ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const dossierId = normalizeText(row.id);
    if (!tenantId || !dossierId) continue;
    entries.push({
      table: "socialflow_legacy_strategic_dossiers",
      key: toKey(tenantId, dossierId),
      fields: {
        tenant_id: tenantId,
        dossier_id: dossierId,
        status: normalizeStatus(row.status, "draft"),
        version: String(Math.max(1, Math.trunc(normalizeNumber(row.version, 1)))),
        form_data_json: canonicalizeJson(normalizeJsonText(row.form_data, "{}")),
        analysis_data_json: canonicalizeJson(normalizeNullableString(row.analysis_data) ?? ""),
        plan_data_json: canonicalizeJson(normalizeNullableString(row.plan_data) ?? ""),
        source_updated_at: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at) ?? "",
      },
    });
  }

  for (const row of source.tenants ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    if (!tenantId) continue;
    entries.push({
      table: "socialflow_legacy_tenant_progress",
      key: toKey(tenantId),
      fields: {
        tenant_id: tenantId,
        materialization_step: String(Math.max(0, Math.trunc(normalizeNumber(row.materialization_step, 0)))),
      },
    });
  }

  for (const row of source.agent_work_logs ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const logId = normalizeText(row.id);
    if (!tenantId || !logId) continue;
    entries.push({
      table: "socialflow_legacy_agent_work_logs",
      key: toKey(tenantId, logId),
      fields: {
        tenant_id: tenantId,
        log_id: logId,
        saas_id: normalizeNullableString(row.saas_id) ?? "",
        agent_name: normalizeText(row.agent_name) || "unknown",
        action_type: normalizeText(row.action_type) || "unknown",
        status: normalizeStatus(row.status, "unknown"),
        output_json: canonicalizeJson(normalizeJsonText(row.output_json, "{}")),
        cost_eur: String(normalizeNumber(row.cost_eur, 0)),
        created_at: normalizeNullableString(row.created_at) ?? "1970-01-01T00:00:00.000Z",
      },
    });
  }

  const domainsByKey = new Map<string, CoreSaasDomainRow[]>();
  for (const row of source.saas_domains ?? []) {
    const key = toKey(row.tenant_id, row.saas_id);
    if (!domainsByKey.has(key)) {
      domainsByKey.set(key, []);
    }
    domainsByKey.get(key)!.push(row);
  }

  for (const row of source.saas ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.id);
    const slug = normalizeSlug(row.slug);
    if (!tenantId || !saasId || !SOCIALFLOW_SLUGS.has(slug)) continue;
    const domain = pickDomain(domainsByKey.get(toKey(tenantId, saasId)) ?? []);
    const metadataJson = JSON.stringify({
      source: "core_backfill",
      coreSlug: slug,
      coreStatus: normalizeStatus(row.status, "active"),
      sourceUpdatedAt: normalizeNullableString(row.updated_at) ?? normalizeNullableString(row.created_at),
    });
    entries.push({
      table: "socialflow_legacy_repository_context",
      key: toKey(tenantId, saasId),
      fields: {
        tenant_id: tenantId,
        saas_id: saasId,
        slug,
        domain: domain ?? "",
        status: normalizeStatus(row.status, "active"),
        metadata_json: canonicalizeJson(metadataJson),
      },
    });
  }

  return entries.sort((a, b) => `${a.table}:${a.key}`.localeCompare(`${b.table}:${b.key}`));
}

function buildSocialEntries(target: FixtureSocialTarget): ParityEntry[] {
  const entries: ParityEntry[] = [];

  for (const row of target.socialflow_legacy_strategic_dossiers ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const dossierId = normalizeText(row.dossier_id);
    if (!tenantId || !dossierId) continue;
    entries.push({
      table: "socialflow_legacy_strategic_dossiers",
      key: toKey(tenantId, dossierId),
      fields: {
        tenant_id: tenantId,
        dossier_id: dossierId,
        status: normalizeStatus(row.status, "draft"),
        version: String(Math.max(1, Math.trunc(normalizeNumber(row.version, 1)))),
        form_data_json: canonicalizeJson(normalizeText(row.form_data_json)),
        analysis_data_json: canonicalizeJson(normalizeNullableString(row.analysis_data_json) ?? ""),
        plan_data_json: canonicalizeJson(normalizeNullableString(row.plan_data_json) ?? ""),
        source_updated_at: normalizeNullableString(row.source_updated_at) ?? "",
      },
    });
  }

  for (const row of target.socialflow_legacy_tenant_progress ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    if (!tenantId) continue;
    entries.push({
      table: "socialflow_legacy_tenant_progress",
      key: toKey(tenantId),
      fields: {
        tenant_id: tenantId,
        materialization_step: String(Math.max(0, Math.trunc(normalizeNumber(row.materialization_step, 0)))),
      },
    });
  }

  for (const row of target.socialflow_legacy_agent_work_logs ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const logId = normalizeText(row.log_id);
    if (!tenantId || !logId) continue;
    entries.push({
      table: "socialflow_legacy_agent_work_logs",
      key: toKey(tenantId, logId),
      fields: {
        tenant_id: tenantId,
        log_id: logId,
        saas_id: normalizeNullableString(row.saas_id) ?? "",
        agent_name: normalizeText(row.agent_name) || "unknown",
        action_type: normalizeText(row.action_type) || "unknown",
        status: normalizeStatus(row.status, "unknown"),
        output_json: canonicalizeJson(normalizeText(row.output_json)),
        cost_eur: String(normalizeNumber(row.cost_eur, 0)),
        created_at: normalizeText(row.created_at),
      },
    });
  }

  for (const row of target.socialflow_legacy_repository_context ?? []) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.saas_id);
    if (!tenantId || !saasId) continue;
    entries.push({
      table: "socialflow_legacy_repository_context",
      key: toKey(tenantId, saasId),
      fields: {
        tenant_id: tenantId,
        saas_id: saasId,
        slug: normalizeSlug(row.slug),
        domain: normalizeNullableString(row.domain) ?? "",
        status: normalizeStatus(row.status, "active"),
        metadata_json: canonicalizeJson(normalizeText(row.metadata_json)),
      },
    });
  }

  return entries.sort((a, b) => `${a.table}:${a.key}`.localeCompare(`${b.table}:${b.key}`));
}

function compareEntries(core: ParityEntry, social: ParityEntry): string[] {
  const fields = new Set<string>([
    ...Object.keys(core.fields),
    ...Object.keys(social.fields),
  ]);
  const mismatched: string[] = [];
  for (const field of [...fields].sort()) {
    const left = core.fields[field] ?? "";
    const right = social.fields[field] ?? "";
    if (left !== right) {
      mismatched.push(field);
    }
  }
  return mismatched;
}

function buildParityReport(
  coreRows: ParityEntry[],
  socialRows: ParityEntry[],
  mode: ParityMode,
): SocialFlowLegacyReadModelsParityReport {
  const coreByKey = new Map<string, ParityEntry>();
  const socialByKey = new Map<string, ParityEntry>();

  for (const row of coreRows) {
    coreByKey.set(`${row.table}::${row.key}`, row);
  }
  for (const row of socialRows) {
    socialByKey.set(`${row.table}::${row.key}`, row);
  }

  const missingInSocial: ParitySummaryEntry[] = [];
  const missingInCore: ParitySummaryEntry[] = [];
  const mismatched: ParityMismatch[] = [];
  let matched = 0;

  for (const [mapKey, core] of coreByKey.entries()) {
    const social = socialByKey.get(mapKey);
    if (!social) {
      missingInSocial.push({ table: core.table, key: core.key });
      continue;
    }
    const fields = compareEntries(core, social);
    if (fields.length > 0) {
      mismatched.push({
        table: core.table,
        key: core.key,
        fields,
        core,
        social,
      });
      continue;
    }
    matched += 1;
  }

  for (const [mapKey, social] of socialByKey.entries()) {
    if (coreByKey.has(mapKey)) continue;
    missingInCore.push({ table: social.table, key: social.key });
  }

  return {
    mode,
    totalCore: coreRows.length,
    totalSocial: socialRows.length,
    matched,
    missingInSocial: missingInSocial.sort((a, b) => `${a.table}:${a.key}`.localeCompare(`${b.table}:${b.key}`)),
    missingInCore: missingInCore.sort((a, b) => `${a.table}:${a.key}`.localeCompare(`${b.table}:${b.key}`)),
    mismatched: mismatched.sort((a, b) => `${a.table}:${a.key}`.localeCompare(`${b.table}:${b.key}`)),
  };
}

function hasDrift(report: SocialFlowLegacyReadModelsParityReport): boolean {
  return (
    report.missingInSocial.length > 0
    || report.missingInCore.length > 0
    || report.mismatched.length > 0
  );
}

function summarizeSummaryEntries(rows: ParitySummaryEntry[]): string {
  return rows.map((row) => `${row.table}:${row.key}`).join(" | ");
}

function summarizeMismatches(rows: ParityMismatch[]): string {
  return rows.map((row) => `${row.table}:${row.key} fields=${row.fields.join(",")}`).join(" | ");
}

function reportToConsole(
  report: SocialFlowLegacyReadModelsParityReport,
  log: (line: string) => void,
): void {
  log(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY mode=${report.mode}`);
  log(
    `core=${report.totalCore} social=${report.totalSocial} matched=${report.matched} missingInSocial=${report.missingInSocial.length} missingInCore=${report.missingInCore.length} mismatched=${report.mismatched.length}`,
  );
  if (report.missingInSocial.length > 0) {
    log(`missingInSocial=${summarizeSummaryEntries(report.missingInSocial)}`);
  }
  if (report.missingInCore.length > 0) {
    log(`missingInCore=${summarizeSummaryEntries(report.missingInCore)}`);
  }
  if (report.mismatched.length > 0) {
    log(`mismatched=${summarizeMismatches(report.mismatched)}`);
  }
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
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_PARITY_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_PARITY_BINDING_MISSING:SOCIAL_DB");
  }
  for (const tableName of REQUIRED_DRACO_TABLES) {
    if (!schema.draco.tables.includes(tableName)) {
      throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY_TABLE_MISSING:${tableName}`);
    }
  }
  for (const tableName of REQUIRED_SOCIAL_TABLES) {
    if (!schema.social.tables.includes(tableName)) {
      throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY_TABLE_MISSING:${tableName}`);
    }
  }
}

async function loadFromFixtures(
  fixturesDir: string,
): Promise<SocialFlowLegacyReadModelsParityReport> {
  const schemaPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);
  const [schemaRaw, sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  const schema = JSON.parse(schemaRaw) as FixtureSchema;
  assertFixturesReady(schema);
  const source = JSON.parse(sourceRaw) as FixtureCoreSource;
  const targetParsed = JSON.parse(targetRaw) as Partial<FixtureSocialTarget>;
  const target: FixtureSocialTarget = {
    ...emptyTargetState(),
    ...targetParsed,
  };

  const coreRows = buildCoreEntries(source);
  const socialRows = buildSocialEntries(target);
  return buildParityReport(coreRows, socialRows, "fixtures");
}

function assertLocalD1Ready(options: {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
}): void {
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

function loadCoreSourceFromLocalD1(options: {
  configPath: string;
  dracoBinding: string;
}): FixtureCoreSource {
  const tenant_strategic_dossiers = runWranglerJson(
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

  const agent_work_logs = runWranglerJson(
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
       created_at
     FROM agent_work_logs
     WHERE tenant_id IS NOT NULL`,
    { configPath: options.configPath },
  ) as CoreAgentWorkLogRow[];

  const tenants = runWranglerJson(
    options.dracoBinding,
    `SELECT
       id AS tenant_id,
       materialization_step
     FROM tenants
     WHERE id IS NOT NULL`,
    { configPath: options.configPath },
  ) as CoreTenantProgressRow[];

  const saas = runWranglerJson(
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

  const saas_domains = runWranglerJson(
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

  return {
    tenant_strategic_dossiers,
    agent_work_logs,
    tenants,
    saas,
    saas_domains,
  };
}

function loadSocialTargetFromLocalD1(options: {
  configPath: string;
  socialBinding: string;
}): FixtureSocialTarget {
  return {
    socialflow_legacy_strategic_dossiers: runWranglerJson(
      options.socialBinding,
      `SELECT
         tenant_id,
         dossier_id,
         status,
         version,
         form_data_json,
         analysis_data_json,
         plan_data_json,
         source_updated_at
       FROM socialflow_legacy_strategic_dossiers`,
      { configPath: options.configPath },
    ) as SocialLegacyStrategicDossierRow[],
    socialflow_legacy_tenant_progress: runWranglerJson(
      options.socialBinding,
      `SELECT
         tenant_id,
         materialization_step
       FROM socialflow_legacy_tenant_progress`,
      { configPath: options.configPath },
    ) as SocialLegacyTenantProgressRow[],
    socialflow_legacy_agent_work_logs: runWranglerJson(
      options.socialBinding,
      `SELECT
         tenant_id,
         log_id,
         saas_id,
         agent_name,
         action_type,
         status,
         output_json,
         cost_eur,
         created_at
       FROM socialflow_legacy_agent_work_logs`,
      { configPath: options.configPath },
    ) as SocialLegacyAgentWorkLogRow[],
    socialflow_legacy_repository_context: runWranglerJson(
      options.socialBinding,
      `SELECT
         tenant_id,
         saas_id,
         slug,
         domain,
         status,
         metadata_json
       FROM socialflow_legacy_repository_context`,
      { configPath: options.configPath },
    ) as SocialLegacyRepositoryContextRow[],
  };
}

async function loadFromLocalD1(options: {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
}): Promise<SocialFlowLegacyReadModelsParityReport> {
  assertLocalD1Ready(options);
  const source = loadCoreSourceFromLocalD1(options);
  const target = loadSocialTargetFromLocalD1({
    configPath: options.configPath,
    socialBinding: options.socialBinding,
  });
  const coreRows = buildCoreEntries(source);
  const socialRows = buildSocialEntries(target);
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

export async function runCheckSocialflowLegacyReadModelsParity(
  options: RunOptions = {},
): Promise<SocialFlowLegacyReadModelsParityReport> {
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await loadFromFixtures(fixturesDir)
    : await loadFromLocalD1({
      configPath,
      dracoBinding,
      socialBinding,
    });

  reportToConsole(report, log);
  return report;
}

export function resolveLegacyParityExitCode(
  report: SocialFlowLegacyReadModelsParityReport,
  allowDrift: boolean,
): number {
  if (!hasDrift(report)) return 0;
  return allowDrift ? 0 : 2;
}

export async function runCheckSocialflowLegacyReadModelsParityCli(
  argv: string[],
  io: { log: (line: string) => void; error: (line: string) => void } = {
    log: console.log,
    error: console.error,
  },
): Promise<number> {
  const args = parseArgs(argv);
  try {
    const report = await runCheckSocialflowLegacyReadModelsParity({
      configPath: args.configPath,
      dracoBinding: args.dracoBinding,
      socialBinding: args.socialBinding,
      fixturesDir: args.fixturesDir,
      log: io.log,
    });
    const code = resolveLegacyParityExitCode(report, args.allowDrift);
    if (code !== 0) {
      io.error("SOCIALFLOW_LEGACY_READ_MODELS_PARITY_DRIFT_DETECTED");
    }
    if (hasDrift(report) && args.allowDrift) {
      io.log("SOCIALFLOW_LEGACY_READ_MODELS_PARITY_ALLOW_DRIFT=true");
    }
    return code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(`SOCIALFLOW_LEGACY_READ_MODELS_PARITY_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runCheckSocialflowLegacyReadModelsParityCli(process.argv.slice(2));
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
