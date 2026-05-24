import { queryAll as queryAllFromCoreDb, queryOne as queryOneFromCoreDb, run as runFromCoreDb } from "@/lib/db";

export const SOCIALFLOW_EXPORT_SLUGS = ["socialflow", "socialflows"] as const;

export type ExportCoreSaasSeed = {
  id: string;
  slug: string;
};

export type ExportCoreSaasRecord = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
  plan_tier: string | null;
  mrr_eur: number;
  cost_eur: number;
  risk_level: string;
};

export type ExportCoreSaasInstance = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  blueprint_snapshot: string | null;
  plan_tier: string | null;
  created_at: string;
  mrr_eur: number;
  cost_eur: number;
  risk_level: string;
};

export type ExportCoreStrategicDossier = {
  id: string;
  tenant_id: string;
  form_data: string;
  analysis_data: string | null;
  plan_data: string | null;
};

export type ExportCoreAgentWorkLog = {
  id: string;
  tenant_id: string;
  saas_id: string;
  agent_name: string;
  action_type: string;
  status: string;
  output_json: string;
  cost_eur: number;
  created_at: string;
};

export type ExportCoreOrchestratorMessage = {
  tenant_id: string;
  role: string;
  content: string;
  created_at: string;
};

export type ExportCoreEconomicEvent = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  type: string;
  severity: string;
  payload_json: string;
  created_at: string;
};

export type ExportCoreDomainRecord = {
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number | boolean;
  status: string;
};

type CoreReadExecutor = {
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
  run?: (sql: string, ...params: unknown[]) => Promise<boolean>;
};

type RuntimeColumnProjectionResult = {
  saas: ExportCoreSaasRecord | null;
  missingColumns: string[];
};

function selectColumn(columns: Set<string>, name: string, fallbackSql: string) {
  return columns.has(name) ? name : `${fallbackSql} AS ${name}`;
}

export function createSocialFlowExportCoreReadContract(executor: CoreReadExecutor) {
  // TODO(SocialFlow DB separation): replace this core-read contract with SOCIAL_DB-owned export data or Campamento Base internal API.
  return {
    async findSocialFlowExportSaasSeed(tenantId: string): Promise<ExportCoreSaasSeed | null> {
      return executor.queryOne<ExportCoreSaasSeed>(
        `SELECT id, slug
         FROM saas
         WHERE tenant_id = ? AND lower(slug) IN (?, ?)
         ORDER BY created_at DESC
         LIMIT 1`,
        tenantId,
        SOCIALFLOW_EXPORT_SLUGS[0],
        SOCIALFLOW_EXPORT_SLUGS[1],
      );
    },

    async findRuntimeSocialFlowExportSaasRecord(tenantId: string): Promise<RuntimeColumnProjectionResult> {
      const saasColumns = await executor.queryAll<{ name: string }>("PRAGMA table_info('saas')");
      const columns = new Set(saasColumns.map((row) => row.name));
      const saas = await executor.queryOne<ExportCoreSaasRecord>(
        `SELECT
           id,
           tenant_id,
           slug,
           name,
           ${selectColumn(columns, "blueprint_snapshot", "NULL")},
           ${selectColumn(columns, "plan_tier", "NULL")},
           ${selectColumn(columns, "mrr_eur", "0")},
           ${selectColumn(columns, "cost_eur", "0")},
           ${selectColumn(columns, "risk_level", "'unknown'")}
         FROM saas
         WHERE tenant_id = ? AND lower(slug) IN (?, ?)
         ORDER BY created_at DESC
         LIMIT 1`,
        tenantId,
        SOCIALFLOW_EXPORT_SLUGS[0],
        SOCIALFLOW_EXPORT_SLUGS[1],
      );

      const requiredColumns = ["blueprint_snapshot", "plan_tier", "mrr_eur", "cost_eur", "risk_level"];
      const missingColumns = requiredColumns.filter((column) => !columns.has(column));
      return { saas, missingColumns };
    },

    async getSaasInstanceById(saasId: string, tenantId: string): Promise<ExportCoreSaasInstance | null> {
      return executor.queryOne<ExportCoreSaasInstance>(
        "SELECT * FROM saas_instances WHERE id = ? AND tenant_id = ?",
        saasId,
        tenantId,
      );
    },

    async getStrategicDossier(tenantId: string): Promise<ExportCoreStrategicDossier | null> {
      return executor.queryOne<ExportCoreStrategicDossier>(
        "SELECT id, tenant_id, form_data, analysis_data, plan_data FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status IN ('active', 'analyzed') ORDER BY created_at DESC LIMIT 1",
        tenantId,
      );
    },

    async listAgentWorkLogs(tenantId: string, saasId: string): Promise<ExportCoreAgentWorkLog[]> {
      return executor.queryAll<ExportCoreAgentWorkLog>(
        "SELECT id, tenant_id, saas_id, agent_name, action_type, status, output_json, cost_eur, created_at FROM agent_work_logs WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC LIMIT 5000",
        tenantId,
        saasId,
      );
    },

    async listOrchestratorMessages(tenantId: string): Promise<ExportCoreOrchestratorMessage[]> {
      return executor.queryAll<ExportCoreOrchestratorMessage>(
        "SELECT tenant_id, role, content, created_at FROM orchestrator_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000",
        tenantId,
      );
    },

    async listEconomicEvents(tenantId: string, saasId: string): Promise<ExportCoreEconomicEvent[]> {
      return executor.queryAll<ExportCoreEconomicEvent>(
        "SELECT id, tenant_id, saas_id, type, severity, payload_json, created_at FROM economic_events WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC LIMIT 2000",
        tenantId,
        saasId,
      );
    },

    async listSaasDomains(tenantId: string, saasId: string): Promise<ExportCoreDomainRecord[]> {
      return executor.queryAll<ExportCoreDomainRecord>(
        "SELECT tenant_id, saas_id, domain, is_primary, status FROM saas_domains WHERE tenant_id = ? AND saas_id = ?",
        tenantId,
        saasId,
      );
    },

    async recordExportGeneratedEvent(input: {
      tenantId: string;
      saasId: string | null;
      payloadJson: string;
    }): Promise<void> {
      if (!executor.run) {
        throw new Error("SOCIALFLOW_EXPORT_CORE_READ_CONTRACT_MISSING_RUN_EXECUTOR");
      }
      await executor.run(
        "INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at) VALUES (?, ?, ?, 'EXPORT_GENERATED', 'info', ?, datetime('now'))",
        crypto.randomUUID(),
        input.tenantId,
        input.saasId,
        input.payloadJson,
      );
    },
  };
}

export function createGlobalSocialFlowExportCoreReadContract() {
  return createSocialFlowExportCoreReadContract({
    queryOne: queryOneFromCoreDb,
    queryAll: queryAllFromCoreDb,
    run: runFromCoreDb,
  });
}
