import { env } from "@/lib/cf";

type LegacyStrategicDossierRow = any;
type LegacyAgentWorkLogRow = any;

export const SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH =
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH";

export type SocialFlowLegacyStrategicDossierReadModel = {
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

export type SocialFlowLegacyTenantProgressReadModel = {
  tenant_id: string;
  materialization_step: number;
  updated_at: string;
};

export type SocialFlowLegacyAgentWorkLogReadModel = {
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

export type UpsertSocialFlowLegacyStrategicDossierInput = {
  id: string;
  tenantId: string;
  dossierId: string;
  status: string;
  version: number;
  formDataJson: string;
  analysisDataJson: string | null;
  planDataJson: string | null;
  sourceUpdatedAt: string | null;
};

export type UpsertSocialFlowLegacyAgentWorkLogInput = {
  id: string;
  tenantId: string;
  logId: string;
  saasId: string | null;
  agentName: string;
  actionType: string;
  status: string;
  outputJson: string;
  costEur: number;
  createdAt: string;
};

type SocialFlowLegacyActionsSocialOwnershipPrepExecutor = {
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
};

type LegacyActionsBindings = {
  DRACO_DB?: D1Database;
  SOCIAL_DB?: D1Database;
} & Record<string, unknown>;

type LegacyActionsCoreAdapterOptions = {
  runtimeEnv?: LegacyActionsBindings | null;
  legacyCoreDatabase?: D1Database | null;
  legacySocialDatabase?: D1Database | null;
  switchEnabled?: boolean;
};

function isTruthySwitchValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }
  return false;
}

export function isSocialFlowLegacyReadModelsSocialDbReadSwitchEnabled(
  runtimeEnv?: LegacyActionsBindings | null,
): boolean {
  const runtimeValue = runtimeEnv?.[SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH];
  if (runtimeValue != null) {
    return isTruthySwitchValue(runtimeValue);
  }
  if (typeof process !== "undefined" && process.env) {
    return isTruthySwitchValue(process.env[SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH]);
  }
  return false;
}

function createD1Executor(db: D1Database): SocialFlowLegacyActionsSocialOwnershipPrepExecutor {
  return {
    async queryOne<T>(sql: string, ...params: unknown[]) {
      const statement = db.prepare(sql);
      const bound = params.length > 0 ? statement.bind(...params) : statement;
      return bound.first<T>();
    },
    async queryAll<T>(sql: string, ...params: unknown[]) {
      const statement = db.prepare(sql);
      const bound = params.length > 0 ? statement.bind(...params) : statement;
      const result = await bound.all<T>();
      return result.results ?? [];
    },
    async run(sql: string, ...params: unknown[]) {
      const statement = db.prepare(sql);
      const bound = params.length > 0 ? statement.bind(...params) : statement;
      const result = await bound.run();
      return Boolean(result.success);
    },
  };
}

function resolveLegacyActionsBindings(runtimeEnv?: LegacyActionsBindings | null) {
  const bindings = runtimeEnv ?? env();
  return (bindings as LegacyActionsBindings | null) ?? null;
}

function resolveLegacyActionsCoreDb(runtimeEnv?: LegacyActionsBindings | null) {
  const bindings = resolveLegacyActionsBindings(runtimeEnv);
  return bindings?.DRACO_DB ?? null;
}

function resolveLegacyActionsSocialDb(runtimeEnv?: LegacyActionsBindings | null) {
  const bindings = resolveLegacyActionsBindings(runtimeEnv);
  return bindings?.SOCIAL_DB ?? null;
}

function requireLegacyActionsCoreDb(runtimeEnv?: LegacyActionsBindings | null) {
  const db = resolveLegacyActionsCoreDb(runtimeEnv);
  if (!db) {
    throw new Error("LEGACY_ACTIONS_CORE_DB_MISSING");
  }
  return db;
}

export function isLegacyActionsCoreDbAvailable(runtimeEnv?: LegacyActionsBindings | null) {
  return Boolean(resolveLegacyActionsCoreDb(runtimeEnv));
}

export function createSocialFlowLegacyActionsSocialOwnershipPrepContract(
  executor: SocialFlowLegacyActionsSocialOwnershipPrepExecutor,
) {
  // TODO(SocialFlow DB separation): switch legacy actions/repository reads to SOCIAL_DB once backfill + parity checks pass.
  return {
    async getPreparedLatestStrategicDossier(
      tenantId: string,
      statuses: string[] = ["draft", "analyzed", "active"],
    ): Promise<SocialFlowLegacyStrategicDossierReadModel | null> {
      const normalizedStatuses = statuses.length > 0 ? statuses : ["draft", "analyzed", "active"];
      const placeholders = normalizedStatuses.map(() => "?").join(", ");
      return executor.queryOne<SocialFlowLegacyStrategicDossierReadModel>(
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
         FROM socialflow_legacy_strategic_dossiers
         WHERE tenant_id = ? AND status IN (${placeholders})
         ORDER BY datetime(updated_at) DESC, rowid DESC
         LIMIT 1`,
        tenantId,
        ...normalizedStatuses,
      );
    },

    async upsertPreparedStrategicDossier(input: UpsertSocialFlowLegacyStrategicDossierInput): Promise<void> {
      const success = await executor.run(
        `INSERT INTO socialflow_legacy_strategic_dossiers (
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
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(tenant_id, dossier_id) DO UPDATE SET
           status = excluded.status,
           version = excluded.version,
           form_data_json = excluded.form_data_json,
           analysis_data_json = excluded.analysis_data_json,
           plan_data_json = excluded.plan_data_json,
           source_updated_at = excluded.source_updated_at,
           updated_at = excluded.updated_at`,
        input.id,
        input.tenantId,
        input.dossierId,
        input.status,
        input.version,
        input.formDataJson,
        input.analysisDataJson,
        input.planDataJson,
        input.sourceUpdatedAt,
      );
      if (!success) {
        throw new Error("SOCIALFLOW_LEGACY_STRATEGIC_DOSSIER_PREP_UPSERT_FAILED");
      }
    },

    async setPreparedTenantMaterializationStep(input: {
      tenantId: string;
      materializationStep: number;
    }): Promise<void> {
      const success = await executor.run(
        `INSERT INTO socialflow_legacy_tenant_progress (
           tenant_id,
           materialization_step,
           updated_at
         ) VALUES (?, ?, datetime('now'))
         ON CONFLICT(tenant_id) DO UPDATE SET
           materialization_step = excluded.materialization_step,
           updated_at = excluded.updated_at`,
        input.tenantId,
        input.materializationStep,
      );
      if (!success) {
        throw new Error("SOCIALFLOW_LEGACY_TENANT_PROGRESS_PREP_UPSERT_FAILED");
      }
    },

    async getPreparedTenantProgress(tenantId: string): Promise<SocialFlowLegacyTenantProgressReadModel | null> {
      return executor.queryOne<SocialFlowLegacyTenantProgressReadModel>(
        `SELECT
           tenant_id,
           materialization_step,
           updated_at
         FROM socialflow_legacy_tenant_progress
         WHERE tenant_id = ?
         LIMIT 1`,
        tenantId,
      );
    },

    async listPreparedAgentWorkLogs(
      tenantId: string,
      limit = 10,
    ): Promise<SocialFlowLegacyAgentWorkLogReadModel[]> {
      return executor.queryAll<SocialFlowLegacyAgentWorkLogReadModel>(
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
         FROM socialflow_legacy_agent_work_logs
         WHERE tenant_id = ?
         ORDER BY datetime(created_at) DESC, rowid DESC
         LIMIT ?`,
        tenantId,
        limit,
      );
    },

    async upsertPreparedAgentWorkLog(input: UpsertSocialFlowLegacyAgentWorkLogInput): Promise<void> {
      const success = await executor.run(
        `INSERT INTO socialflow_legacy_agent_work_logs (
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
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(tenant_id, log_id) DO UPDATE SET
           saas_id = excluded.saas_id,
           agent_name = excluded.agent_name,
           action_type = excluded.action_type,
           status = excluded.status,
           output_json = excluded.output_json,
           cost_eur = excluded.cost_eur,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
        input.id,
        input.tenantId,
        input.logId,
        input.saasId,
        input.agentName,
        input.actionType,
        input.status,
        input.outputJson,
        input.costEur,
        input.createdAt,
      );
      if (!success) {
        throw new Error("SOCIALFLOW_LEGACY_AGENT_WORK_LOG_PREP_UPSERT_FAILED");
      }
    },
  };
}

function mapPreparedStrategicDossierRowToCoreShape(
  row: SocialFlowLegacyStrategicDossierReadModel,
): LegacyStrategicDossierRow | null {
  const id = row.dossier_id?.trim();
  if (!id) return null;
  return {
    id,
    tenant_id: row.tenant_id,
    status: row.status,
    version: row.version,
    form_data: row.form_data_json,
    analysis_data: row.analysis_data_json,
    plan_data: row.plan_data_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapPreparedAgentWorkLogRowToCoreShape(
  row: SocialFlowLegacyAgentWorkLogReadModel,
): LegacyAgentWorkLogRow | null {
  const id = row.log_id?.trim();
  if (!id) return null;
  return {
    id,
    tenant_id: row.tenant_id,
    saas_id: row.saas_id,
    agent_name: row.agent_name,
    action_type: row.action_type,
    status: row.status,
    output_json: row.output_json,
    cost_eur: row.cost_eur,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function readStrategicDossierFromSocialReadModels(
  contract: ReturnType<typeof createSocialFlowLegacyActionsSocialOwnershipPrepContract>,
  tenantId: string,
  statuses: string[],
): Promise<LegacyStrategicDossierRow | null> {
  try {
    const row = await contract.getPreparedLatestStrategicDossier(tenantId, statuses);
    if (!row) return null;
    return mapPreparedStrategicDossierRowToCoreShape(row);
  } catch {
    return null;
  }
}

async function readTenantProgressFromSocialReadModels(
  contract: ReturnType<typeof createSocialFlowLegacyActionsSocialOwnershipPrepContract>,
  tenantId: string,
): Promise<number | null> {
  try {
    const row = await contract.getPreparedTenantProgress(tenantId);
    if (!row) return null;
    const step = Number(row.materialization_step);
    return Number.isFinite(step) ? step : null;
  } catch {
    return null;
  }
}

async function readAgentWorkLogsFromSocialReadModels(
  contract: ReturnType<typeof createSocialFlowLegacyActionsSocialOwnershipPrepContract>,
  tenantId: string,
  limit: number,
): Promise<LegacyAgentWorkLogRow[] | null> {
  try {
    const rows = await contract.listPreparedAgentWorkLogs(tenantId, limit);
    const mapped = rows
      .map((row) => mapPreparedAgentWorkLogRowToCoreShape(row))
      .filter((row): row is LegacyAgentWorkLogRow => row != null);
    return mapped;
  } catch {
    return null;
  }
}

export function createSocialFlowLegacyActionsCoreAdapter(options: LegacyActionsCoreAdapterOptions = {}) {
  // TODO(SocialFlow DB separation): replace this legacy core-backed adapter with SOCIAL_DB-owned data or Campamento Base internal API.
  const runtimeEnv = resolveLegacyActionsBindings(options.runtimeEnv);
  const socialDatabase = options.legacySocialDatabase ?? resolveLegacyActionsSocialDb(runtimeEnv);
  const socialReadContract = socialDatabase
    ? createSocialFlowLegacyActionsSocialOwnershipPrepContract(createD1Executor(socialDatabase))
    : null;

  const getLegacyCoreDatabase = () => options.legacyCoreDatabase ?? requireLegacyActionsCoreDb(runtimeEnv);

  return {
    async createStrategicDraft(input: { dossierId: string; tenantId: string; formDataJson: string }) {
      const db = getLegacyCoreDatabase();
      await db.prepare(
        `INSERT INTO tenant_strategic_dossiers (id, tenant_id, version, status, form_data) 
         VALUES (?, ?, 1, 'draft', ?)`,
      ).bind(input.dossierId, input.tenantId, input.formDataJson).run();

      await db.prepare(
        `UPDATE tenants SET materialization_step = 1 WHERE id = ?`,
      ).bind(input.tenantId).run();
    },

    async findLatestDraftStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      if (!socialReadContract) return null;
      return readStrategicDossierFromSocialReadModels(socialReadContract, tenantId, ["draft"]);
    },

    async updateStrategicDossierAnalysis(input: { dossierId: string; analysisJson: string; updatedAtIso: string }) {
      const db = getLegacyCoreDatabase();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers 
         SET analysis_data = ?, status = 'analyzed', updated_at = ? 
         WHERE id = ?`,
      ).bind(input.analysisJson, input.updatedAtIso, input.dossierId).run();
    },

    async findLatestAnalyzedStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      if (!socialReadContract) return null;
      return readStrategicDossierFromSocialReadModels(socialReadContract, tenantId, ["analyzed"]);
    },

    async updateStrategicDossierPlan(input: { dossierId: string; planJson: string; updatedAtIso: string }) {
      const db = getLegacyCoreDatabase();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers 
         SET plan_data = ?, status = 'analyzed', updated_at = ? 
         WHERE id = ?`,
      ).bind(input.planJson, input.updatedAtIso, input.dossierId).run();
    },

    async findAnalyzedStrategicDossierForApproval(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      if (!socialReadContract) return null;
      return readStrategicDossierFromSocialReadModels(socialReadContract, tenantId, ["analyzed"]);
    },

    async findLatestActiveStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      if (!socialReadContract) return null;
      return readStrategicDossierFromSocialReadModels(socialReadContract, tenantId, ["active"]);
    },

    async activateStrategicDossiersForTenant(input: { tenantId: string; updatedAtIso: string }) {
      const db = getLegacyCoreDatabase();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers SET status = 'active', updated_at = ? WHERE tenant_id = ?`,
      ).bind(input.updatedAtIso, input.tenantId).run();
    },

    async setTenantMaterializationStep(input: { tenantId: string; step: number }) {
      const db = getLegacyCoreDatabase();
      await db.prepare(
        `UPDATE tenants SET materialization_step = ? WHERE id = ?`,
      ).bind(input.step, input.tenantId).run();
    },

    async getTenantMaterializationStep(tenantId: string): Promise<number | null> {
      if (!socialReadContract) return null;
      return readTenantProgressFromSocialReadModels(socialReadContract, tenantId);
    },

    async listLatestAgentWorkLogs(tenantId: string, limit = 10): Promise<LegacyAgentWorkLogRow[]> {
      if (!socialReadContract) return [];
      return await readAgentWorkLogsFromSocialReadModels(socialReadContract, tenantId, limit) ?? [];
    },
  };
}
