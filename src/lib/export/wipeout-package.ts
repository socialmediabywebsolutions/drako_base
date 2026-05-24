import JSZip from "jszip";
import {
  createGlobalSocialFlowExportCoreReadContract,
  type ExportCoreAgentWorkLog as AgentWorkLog,
  type ExportCoreDomainRecord as DomainRecord,
  type ExportCoreEconomicEvent as EconomicEvent,
  type ExportCoreOrchestratorMessage as OrchestratorMessage,
  type ExportCoreSaasInstance as SaasInstance,
  type ExportCoreStrategicDossier as StrategicDossier,
} from "@/lib/socialflow/contracts/export-core-read";

export type TenantScopedRow = {
  tenant_id?: string | null;
  saas_id?: string | null;
};

function assertScopeField(row: TenantScopedRow, field: "tenant_id" | "saas_id", entity: string) {
  if (!(field in row)) {
    throw new Error(`${entity} row missing ${field} verification field`);
  }
}

export function assertTenantScopedRows<T extends TenantScopedRow>(
  rows: T[],
  params: {
    entity: string;
    tenantId: string;
    saasId?: string;
    requireSaasId?: boolean;
  },
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

export async function generateWipeoutPackage(saasId: string, tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const coreReadContract = createGlobalSocialFlowExportCoreReadContract();
  const saas = await coreReadContract.getSaasInstanceById(saasId, tenantId);

  if (!saas) {
    throw new Error(`SaaS instance not found or acccess denied: ${saasId}`);
  }

  const zip = new JSZip();
  const warnings: string[] = [];
  const counts: Record<string, number> = {
    logs: 0,
    economic_events: 0,
    domains: 0,
  };

  const dossier = await coreReadContract.getStrategicDossier(tenantId);
  if (dossier) {
    assertTenantScopedRows([dossier], {
      entity: "tenant_strategic_dossiers",
      tenantId,
    });
  }

  if (dossier) {
    zip.folder("dossier")?.file("dossier.json", JSON.stringify(dossier, null, 2));
    warnings.push("dossier.pdf not found (storage not implemented)");
  } else {
    warnings.push("No active Strategic Dossier found for tenant");
  }

  if (saas.blueprint_snapshot) {
    try {
      const bpParsed = JSON.parse(saas.blueprint_snapshot);
      zip.folder("blueprint")?.file("blueprint.json", JSON.stringify(bpParsed, null, 2));
    } catch {
      zip.folder("blueprint")?.file("blueprint.json", saas.blueprint_snapshot);
      warnings.push("Blueprint snapshot was invalid JSON");
    }
  } else {
    zip.folder("blueprint")?.file("blueprint.json", "{}");
    warnings.push("No blueprint_snapshot found in saas_instances");
  }

  const workLogs = await coreReadContract.listAgentWorkLogs(tenantId, saasId);
  assertTenantScopedRows(workLogs, {
    entity: "agent_work_logs",
    tenantId,
    saasId,
    requireSaasId: true,
  });
  counts.logs = workLogs.length;

  if (workLogs.length > 0) {
    const csvHeader = "id,agent_name,action_type,status,cost_eur,created_at,output_snippet\n";
    const csvRows = workLogs
      .map((log) => {
        const validJson = log.output_json ? log.output_json.replace(/"/g, '""') : "";
        const snippet = validJson.slice(0, 1000);
        return `${log.id},${log.agent_name},${log.action_type},${log.status},${log.cost_eur},${log.created_at},"${snippet}"`;
      })
      .join("\n");

    zip.folder("execution")?.file("work_logs.csv", csvHeader + csvRows);
  } else {
    zip.folder("execution")?.file("work_logs.csv", "id,agent_name,action_type,status,cost_eur,created_at,output_snippet\n");
  }

  const msgs = await coreReadContract.listOrchestratorMessages(tenantId);
  assertTenantScopedRows(msgs, {
    entity: "orchestrator_messages",
    tenantId,
  });
  if (msgs.length > 0) {
    const msgHeader = "role,created_at,content\n";
    const msgRows = msgs
      .map((m) => {
        const content = m.content ? m.content.replace(/"/g, '""') : "";
        return `${m.role},${m.created_at},"${content}"`;
      })
      .join("\n");
    zip.folder("execution")?.file("orchestrator_messages.csv", msgHeader + msgRows);
  }

  const financialsHeader = "metric,value,unit\n";
  const financialsRows = [
    `mrr,${saas.mrr_eur},EUR`,
    `total_cost,${saas.cost_eur},EUR`,
    `risk_level,${saas.risk_level},ENUM`,
    `plan_tier,${saas.plan_tier},ENUM`,
  ].join("\n");
  zip.folder("economics")?.file("financials.csv", financialsHeader + financialsRows);

  const ecoEvents = await coreReadContract.listEconomicEvents(tenantId, saasId);
  assertTenantScopedRows(ecoEvents, {
    entity: "economic_events",
    tenantId,
    saasId,
    requireSaasId: true,
  });
  counts.economic_events = ecoEvents.length;

  if (ecoEvents.length > 0) {
    const ecoHeader = "id,type,severity,created_at,payload\n";
    const ecoRows = ecoEvents
      .map((event) => {
        const payload = event.payload_json ? event.payload_json.replace(/"/g, '""') : "";
        return `${event.id},${event.type},${event.severity},${event.created_at},"${payload}"`;
      })
      .join("\n");
    zip.folder("economics")?.file("economic_events.csv", ecoHeader + ecoRows);
  }

  const domains = await coreReadContract.listSaasDomains(tenantId, saasId);
  assertTenantScopedRows(domains, {
    entity: "saas_domains",
    tenantId,
    saasId,
    requireSaasId: true,
  });
  counts.domains = domains.length;
  if (domains.length > 0) {
    zip.folder("domains")?.file("domain_status.json", JSON.stringify(domains, null, 2));
  } else {
    zip.folder("domains")?.file("domain_status.json", "[]");
  }

  const meta = {
    saasId: saas.id,
    tenantId: saas.tenant_id,
    slug: saas.slug,
    generatedAt: new Date().toISOString(),
    planTag: saas.plan_tier,
    counts,
    warnings,
  };
  zip.file("meta.json", JSON.stringify(meta, null, 2));

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `drako-export-${saas.slug}-${dateStr}.zip`;

  return { buffer: content, filename };
}
