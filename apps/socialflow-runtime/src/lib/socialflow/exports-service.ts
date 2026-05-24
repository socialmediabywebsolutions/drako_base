import JSZip from "jszip";
import {
  createSocialFlowExportCoreReadContract,
  type ExportCoreAgentWorkLog as AgentWorkLog,
  type ExportCoreEconomicEvent as EconomicEvent,
  type ExportCoreOrchestratorMessage as OrchestratorMessage,
} from "@/lib/socialflow/contracts/export-core-read";
import { ensureDracoDb, queryAll as queryAllOnCoreDb, queryOne as queryOneOnCoreDb, run as runOnCoreDb } from "../db/runtime-db";

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

export async function generateRuntimeSocialFlowExportForTenant(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const dracoDb = ensureDracoDb();
  const coreReadContract = createSocialFlowExportCoreReadContract({
    queryOne: <T>(sql: string, ...params: unknown[]) => queryOneOnCoreDb<T>(dracoDb, sql, ...params),
    queryAll: <T>(sql: string, ...params: unknown[]) => queryAllOnCoreDb<T>(dracoDb, sql, ...params),
    run: (sql: string, ...params: unknown[]) => runOnCoreDb(dracoDb, sql, ...params),
  });
  const { saas: exportTarget, missingColumns } = await coreReadContract.findRuntimeSocialFlowExportSaasRecord(tenantId);
  if (!exportTarget) {
    throw new Error("SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND");
  }

  const zip = new JSZip();
  const warnings: string[] = [];
  for (const column of missingColumns) {
    warnings.push(`DRACO_DB.saas column ${column} is missing; export used a safe default for this field.`);
  }
  const counts: Record<string, number> = {
    logs: 0,
    economic_events: 0,
    domains: 0,
  };

  const dossier = await coreReadContract.getStrategicDossier(tenantId);
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

  const workLogs = await coreReadContract.listAgentWorkLogs(tenantId, exportTarget.id);
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

  const messages = await coreReadContract.listOrchestratorMessages(tenantId);
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

  const economicEvents = await coreReadContract.listEconomicEvents(tenantId, exportTarget.id);
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

  const domains = await coreReadContract.listSaasDomains(tenantId, exportTarget.id);
  assertTenantScopedRows(domains, {
    entity: "saas_domains",
    tenantId,
    saasId: exportTarget.id,
    requireSaasId: true,
  });
  counts.domains = domains.length;
  zip.folder("domains")?.file("domain_status.json", JSON.stringify(domains, null, 2));

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

  await coreReadContract.recordExportGeneratedEvent({
    tenantId,
    saasId: exportTarget.id,
    payloadJson: JSON.stringify({
      filename,
      size_bytes: buffer.byteLength,
      source: "socialflow-runtime.exports.current",
    }),
  });

  return { buffer, filename };
}
