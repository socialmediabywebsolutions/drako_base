import { env } from "@/lib/cf";

type LegacyStrategicDossierRow = any;

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
  };
}
