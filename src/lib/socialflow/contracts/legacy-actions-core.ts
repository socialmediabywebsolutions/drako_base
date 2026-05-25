import { env } from "@/lib/cf";

type LegacyStrategicDossierRow = any;
type LegacyAgentWorkLogRow = any;

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

function resolveLegacyActionsCoreDb() {
  const bindings = env();
  return bindings?.DRACO_DB ?? null;
}

function requireLegacyActionsCoreDb() {
  const db = resolveLegacyActionsCoreDb();
  if (!db) {
    throw new Error("LEGACY_ACTIONS_CORE_DB_MISSING");
  }
  return db;
}

export function isLegacyActionsCoreDbAvailable() {
  return Boolean(resolveLegacyActionsCoreDb());
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

export function createSocialFlowLegacyActionsCoreAdapter() {
  // TODO(SocialFlow DB separation): replace this legacy core-backed adapter with SOCIAL_DB-owned data or Campamento Base internal API.
  return {
    async createStrategicDraft(input: { dossierId: string; tenantId: string; formDataJson: string }) {
      const db = requireLegacyActionsCoreDb();
      await db.prepare(
        `INSERT INTO tenant_strategic_dossiers (id, tenant_id, version, status, form_data) 
         VALUES (?, ?, 1, 'draft', ?)`,
      ).bind(input.dossierId, input.tenantId, input.formDataJson).run();

      await db.prepare(
        `UPDATE tenants SET materialization_step = 1 WHERE id = ?`,
      ).bind(input.tenantId).run();
    },

    async findLatestDraftStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      const db = requireLegacyActionsCoreDb();
      return db.prepare(
        `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
      ).bind(tenantId).first<LegacyStrategicDossierRow>();
    },

    async updateStrategicDossierAnalysis(input: { dossierId: string; analysisJson: string; updatedAtIso: string }) {
      const db = requireLegacyActionsCoreDb();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers 
         SET analysis_data = ?, status = 'analyzed', updated_at = ? 
         WHERE id = ?`,
      ).bind(input.analysisJson, input.updatedAtIso, input.dossierId).run();
    },

    async findLatestAnalyzedStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      const db = requireLegacyActionsCoreDb();
      return db.prepare(
        `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'analyzed' ORDER BY created_at DESC LIMIT 1`,
      ).bind(tenantId).first<LegacyStrategicDossierRow>();
    },

    async updateStrategicDossierPlan(input: { dossierId: string; planJson: string; updatedAtIso: string }) {
      const db = requireLegacyActionsCoreDb();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers 
         SET plan_data = ?, status = 'analyzed', updated_at = ? 
         WHERE id = ?`,
      ).bind(input.planJson, input.updatedAtIso, input.dossierId).run();
    },

    async findAnalyzedStrategicDossierForApproval(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      const db = requireLegacyActionsCoreDb();
      return db.prepare(
        `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'analyzed'`,
      ).bind(tenantId).first<LegacyStrategicDossierRow>();
    },

    async findLatestActiveStrategicDossier(tenantId: string): Promise<LegacyStrategicDossierRow | null> {
      const db = requireLegacyActionsCoreDb();
      return db.prepare(
        `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      ).bind(tenantId).first<LegacyStrategicDossierRow>();
    },

    async activateStrategicDossiersForTenant(input: { tenantId: string; updatedAtIso: string }) {
      const db = requireLegacyActionsCoreDb();
      await db.prepare(
        `UPDATE tenant_strategic_dossiers SET status = 'active', updated_at = ? WHERE tenant_id = ?`,
      ).bind(input.updatedAtIso, input.tenantId).run();
    },

    async setTenantMaterializationStep(input: { tenantId: string; step: number }) {
      const db = requireLegacyActionsCoreDb();
      await db.prepare(
        `UPDATE tenants SET materialization_step = ? WHERE id = ?`,
      ).bind(input.step, input.tenantId).run();
    },

    async listLatestAgentWorkLogs(tenantId: string, limit = 10): Promise<LegacyAgentWorkLogRow[]> {
      const db = requireLegacyActionsCoreDb();
      const { results } = await db.prepare(
        `SELECT * FROM agent_work_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(tenantId, limit).all<LegacyAgentWorkLogRow>();

      return results ?? [];
    },
  };
}
