import JSZip from "jszip";
import { ensureDracoDb, queryAll, queryOne, run } from "../db/runtime-db";

type SaasRecord = {
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

type StrategicDossier = {
  id: string;
  tenant_id: string;
  form_data: string;
  analysis_data: string | null;
  plan_data: string | null;
};

type AgentWorkLog = {
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

type EconomicEvent = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  type: string;
  severity: string;
  payload_json: string;
  created_at: string;
};

type DomainRecord = {
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number | boolean;
  status: string;
};

type OrchestratorMessage = {
  tenant_id: string;
  role: string;
  content: string;
  created_at: string;
};

type TenantScopedRow = {
  tenant_id?: string | null;
  saas_id?: string | null;
};

function assertScopeField(row: TenantScopedRow, field: "tenant_id" | "saas_id", entity: string) {
  if (!(field in row)) {
    throw new Error(`${entity} row missing ${field} verification field`);
  }
}

function assertTenantScopedRows<T extends TenantScopedRow>(
  rows: T[],
  params: { entity: string; tenantId: string; saasId?: string; requireSaasId?: boolean },
): T[] {
  for (const row of rows) {
    assertScopeField(row, "tenant_id", params.entity);
    if (row.tenant_id !== params.tenantId) {
      throw new Error(`${params.entity} row escaped tenant isolation for tenant ${params.tenantId}`);
    }

    if (params.requireSaasId) {
      assertScopeField(row, "saas_id", params.entity);
      if (row.saas_id !== params.saasId) {
        throw new Error(`${params.entity} row escaped SaaS isolation for saas ${params.saasId}`);
      }
    }
  }

  return rows;
}

const SOCIALFLOW_EXPORT_SLUGS = ["socialflow", "socialflows"] as const;

async function getTableColumns(db: D1Database, tableName: string) {
  const rows = await queryAll<{ name: string }>(db, `PRAGMA table_info('${tableName}')`);
  return new Set(rows.map((row) => row.name));
}

function selectColumn(columns: Set<string>, name: string, fallbackSql: string) {
  return columns.has(name) ? name : `${fallbackSql} AS ${name}`;
}

function buildFallbackSaasRecord(tenantId: string): SaasRecord {
  return {
    id: "socialflow",
    tenant_id: tenantId,
    slug: "socialflow",
    name: "SocialFlow",
    blueprint_snapshot: null,
    plan_tier: null,
    mrr_eur: 0,
    cost_eur: 0,
    risk_level: "unknown",
  };
}

export async function generateRuntimeSocialFlowExportForTenant(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const dracoDb = ensureDracoDb();
  const saasColumns = await getTableColumns(dracoDb, "saas");
  const saas = await queryOne<SaasRecord>(
    dracoDb,
    `SELECT
       id,
       tenant_id,
       slug,
       name,
       ${selectColumn(saasColumns, "blueprint_snapshot", "NULL")},
       ${selectColumn(saasColumns, "plan_tier", "NULL")},
       ${selectColumn(saasColumns, "mrr_eur", "0")},
       ${selectColumn(saasColumns, "cost_eur", "0")},
       ${selectColumn(saasColumns, "risk_level", "'unknown'")}
     FROM saas
     WHERE tenant_id = ? AND lower(slug) IN (?, ?)
     ORDER BY created_at DESC
     LIMIT 1`,
    tenantId,
    SOCIALFLOW_EXPORT_SLUGS[0],
    SOCIALFLOW_EXPORT_SLUGS[1],
  );

  const zip = new JSZip();
  const warnings: string[] = [];
  const exportTarget = saas ?? buildFallbackSaasRecord(tenantId);
  if (!saas) {
    warnings.push("No SocialFlow SaaS seed found in DRACO_DB; generated tenant-scoped runtime export with fallback SocialFlow identity.");
  }
  for (const column of ["blueprint_snapshot", "plan_tier", "mrr_eur", "cost_eur", "risk_level"]) {
    if (!saasColumns.has(column)) {
      warnings.push(`DRACO_DB.saas column ${column} is missing; export used a safe default for this field.`);
    }
  }
  const counts: Record<string, number> = {
    logs: 0,
    economic_events: 0,
    domains: 0,
  };

  const dossier = await queryOne<StrategicDossier>(
    dracoDb,
    "SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status IN ('active', 'analyzed') ORDER BY created_at DESC LIMIT 1",
    tenantId,
  );
  if (dossier) {
    assertTenantScopedRows([dossier], { entity: "tenant_strategic_dossiers", tenantId });
    zip.folder("dossier")?.file("dossier.json", JSON.stringify(dossier, null, 2));
    warnings.push("dossier.pdf not found (storage not implemented)");
  } else {
    warnings.push("No active Strategic Dossier found for tenant");
  }

  if (exportTarget.blueprint_snapshot) {
    try {
      zip.folder("blueprint")?.file("blueprint.json", JSON.stringify(JSON.parse(exportTarget.blueprint_snapshot), null, 2));
    } catch {
      zip.folder("blueprint")?.file("blueprint.json", exportTarget.blueprint_snapshot);
      warnings.push("Blueprint snapshot was invalid JSON");
    }
  } else {
    zip.folder("blueprint")?.file("blueprint.json", "{}");
    warnings.push("No blueprint_snapshot found in saas");
  }

  const workLogs = await queryAll<AgentWorkLog>(
    dracoDb,
    "SELECT id, tenant_id, saas_id, agent_name, action_type, status, output_json, cost_eur, created_at FROM agent_work_logs WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC LIMIT 5000",
    tenantId,
    exportTarget.id,
  );
  assertTenantScopedRows(workLogs, {
    entity: "agent_work_logs",
    tenantId,
    saasId: exportTarget.id,
    requireSaasId: true,
  });
  counts.logs = workLogs.length;

  const workLogCsv = [
    "id,agent_name,action_type,status,cost_eur,created_at,output_snippet",
    ...workLogs.map((log) => {
      const snippet = (log.output_json ?? "").replace(/"/g, '""').slice(0, 1000);
      return `${log.id},${log.agent_name},${log.action_type},${log.status},${log.cost_eur},${log.created_at},"${snippet}"`;
    }),
  ].join("\n");
  zip.folder("execution")?.file("work_logs.csv", `${workLogCsv}\n`);

  const messages = await queryAll<OrchestratorMessage>(
    dracoDb,
    "SELECT tenant_id, role, content, created_at FROM orchestrator_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1000",
    tenantId,
  );
  assertTenantScopedRows(messages, { entity: "orchestrator_messages", tenantId });
  const messagesCsv = [
    "role,created_at,content",
    ...messages.map((message) => {
      const content = (message.content ?? "").replace(/"/g, '""');
      return `${message.role},${message.created_at},"${content}"`;
    }),
  ].join("\n");
  zip.folder("execution")?.file("orchestrator_messages.csv", `${messagesCsv}\n`);

  const financialsRows = [
    "metric,value,unit",
    `mrr,${exportTarget.mrr_eur},EUR`,
    `total_cost,${exportTarget.cost_eur},EUR`,
    `risk_level,${exportTarget.risk_level},ENUM`,
    `plan_tier,${exportTarget.plan_tier},ENUM`,
  ].join("\n");
  zip.folder("economics")?.file("financials.csv", `${financialsRows}\n`);

  const economicEvents = await queryAll<EconomicEvent>(
    dracoDb,
    "SELECT id, tenant_id, saas_id, type, severity, payload_json, created_at FROM economic_events WHERE tenant_id = ? AND saas_id = ? ORDER BY created_at DESC LIMIT 2000",
    tenantId,
    exportTarget.id,
  );
  assertTenantScopedRows(economicEvents, {
    entity: "economic_events",
    tenantId,
    saasId: exportTarget.id,
    requireSaasId: true,
  });
  counts.economic_events = economicEvents.length;
  const economicRows = [
    "id,type,severity,created_at,payload",
    ...economicEvents.map((event) => {
      const payload = (event.payload_json ?? "").replace(/"/g, '""');
      return `${event.id},${event.type},${event.severity},${event.created_at},"${payload}"`;
    }),
  ].join("\n");
  zip.folder("economics")?.file("economic_events.csv", `${economicRows}\n`);

  const domains = await queryAll<DomainRecord>(
    dracoDb,
    "SELECT tenant_id, saas_id, domain, is_primary, status FROM saas_domains WHERE tenant_id = ? AND saas_id = ?",
    tenantId,
    exportTarget.id,
  );
  assertTenantScopedRows(domains, {
    entity: "saas_domains",
    tenantId,
    saasId: exportTarget.id,
    requireSaasId: true,
  });
  counts.domains = domains.length;
  zip.folder("domains")?.file("domain_status.json", JSON.stringify(domains, null, 2));

  if (!saas) {
    warnings.push("EXPORT_GENERATED economic event was not recorded because no real SocialFlow SaaS seed exists for this tenant.");
  }

  const meta = {
    saasId: exportTarget.id,
    tenantId: exportTarget.tenant_id,
    slug: exportTarget.slug,
    generatedAt: new Date().toISOString(),
    planTag: exportTarget.plan_tier,
    counts,
    warnings,
  };
  zip.file("meta.json", JSON.stringify(meta, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `drako-export-${exportTarget.slug}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;

  if (saas) {
    await run(
      dracoDb,
      "INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, payload_json, created_at) VALUES (?, ?, ?, 'EXPORT_GENERATED', 'info', ?, datetime('now'))",
      crypto.randomUUID(),
      tenantId,
      exportTarget.id,
      JSON.stringify({
        filename,
        size_bytes: buffer.byteLength,
        source: "socialflow-runtime.exports.current",
      }),
    );
  }

  return { buffer, filename };
}
