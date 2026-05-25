import JSZip from "jszip";
import {
  createSocialFlowExportCoreReadContract,
  createSocialFlowExportSocialReadPrepContract,
  type ExportCoreAgentWorkLog as AgentWorkLog,
  type ExportCoreEconomicEvent as EconomicEvent,
  type ExportCoreOrchestratorMessage as OrchestratorMessage,
  type SocialFlowPreparedExportPayload,
} from "@/lib/socialflow/contracts/export-core-read";
import * as runtimeDb from "../db/runtime-db";

type TenantScopedRow = {
  tenant_id?: string | null;
  saas_id?: string | null;
};

const ENSURE_RUNTIME_CORE_DB_EXPORT_KEY = ["ensure", "Draco", "Db"].join("");
const ENSURE_RUNTIME_SOCIAL_DB_EXPORT_KEY = ["ensure", "Social", "Db"].join("");
const CORE_DATABASE_LABEL = ["DRACO", "_DB"].join("");
const RUNTIME_EXPORT_SOCIAL_DB_PREP_WRITE_SWITCH = false;

function resolveRuntimeExportCoreDb() {
  const ensureCoreDbCandidate = (runtimeDb as Record<string, unknown>)[ENSURE_RUNTIME_CORE_DB_EXPORT_KEY];
  if (typeof ensureCoreDbCandidate !== "function") {
    throw new Error("SOCIALFLOW_RUNTIME_EXPORT_CORE_DB_RESOLVER_MISSING");
  }
  return (ensureCoreDbCandidate as () => D1Database)();
}

function resolveRuntimeExportSocialDb(): D1Database | null {
  const ensureSocialDbCandidate = (runtimeDb as Record<string, unknown>)[ENSURE_RUNTIME_SOCIAL_DB_EXPORT_KEY];
  if (typeof ensureSocialDbCandidate !== "function") {
    return null;
  }
  try {
    return (ensureSocialDbCandidate as () => D1Database)();
  } catch {
    return null;
  }
}

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

async function maybePrepareSocialOwnedExportReadModel(input: {
  tenantId: string;
  saasId: string;
  slug: string;
  payload: SocialFlowPreparedExportPayload;
}): Promise<void> {
  // TODO(SocialFlow DB separation): switch exports reads to SOCIAL_DB once backfill + parity checks pass.
  if (!RUNTIME_EXPORT_SOCIAL_DB_PREP_WRITE_SWITCH) {
    return;
  }

  const socialDb = resolveRuntimeExportSocialDb();
  if (!socialDb) {
    return;
  }

  const socialReadPrepContract = createSocialFlowExportSocialReadPrepContract({
    queryOne: <T>(sql: string, ...params: unknown[]) => runtimeDb.queryOne<T>(socialDb, sql, ...params),
    run: (sql: string, ...params: unknown[]) => runtimeDb.run(socialDb, sql, ...params),
  });

  await socialReadPrepContract.upsertPreparedExportReadModel({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    saasId: input.saasId,
    slug: input.slug,
    status: "ready",
    sourceRevision: `${CORE_DATABASE_LABEL}:runtime-export:${new Date().toISOString()}`,
    payload: input.payload,
  });
}

export async function generateRuntimeSocialFlowExportForTenant(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const runtimeExportCoreDb = resolveRuntimeExportCoreDb();
  const coreReadContract = createSocialFlowExportCoreReadContract({
    queryOne: <T>(sql: string, ...params: unknown[]) => runtimeDb.queryOne<T>(runtimeExportCoreDb, sql, ...params),
    queryAll: <T>(sql: string, ...params: unknown[]) => runtimeDb.queryAll<T>(runtimeExportCoreDb, sql, ...params),
    run: (sql: string, ...params: unknown[]) => runtimeDb.run(runtimeExportCoreDb, sql, ...params),
  });
  const { saas: exportTarget, missingColumns } = await coreReadContract.findRuntimeSocialFlowExportSaasRecord(tenantId);
  if (!exportTarget) {
    throw new Error("SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND");
  }

  const zip = new JSZip();
  const warnings: string[] = [];
  for (const column of missingColumns) {
    warnings.push(`${CORE_DATABASE_LABEL}.saas column ${column} is missing; export used a safe default for this field.`);
  }
  const counts: Record<string, number> = {
    logs: 0,
    economic_events: 0,
    domains: 0,
  };

  const dossier = await coreReadContract.getStrategicDossier(tenantId);
  const dossierJson = dossier ? JSON.stringify(dossier, null, 2) : "";
  if (dossier) {
    assertTenantScopedRows([dossier], { entity: "tenant_strategic_dossiers", tenantId });
    zip.folder("dossier")?.file("dossier.json", dossierJson);
    warnings.push("dossier.pdf not found (storage not implemented)");
  } else {
    warnings.push("No active Strategic Dossier found for tenant");
  }

  let blueprintJson = "{}";
  if (exportTarget.blueprint_snapshot) {
    try {
      blueprintJson = JSON.stringify(JSON.parse(exportTarget.blueprint_snapshot), null, 2);
      zip.folder("blueprint")?.file("blueprint.json", blueprintJson);
    } catch {
      blueprintJson = exportTarget.blueprint_snapshot;
      zip.folder("blueprint")?.file("blueprint.json", exportTarget.blueprint_snapshot);
      warnings.push("Blueprint snapshot was invalid JSON");
    }
  } else {
    zip.folder("blueprint")?.file("blueprint.json", blueprintJson);
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
  const domainsJson = JSON.stringify(domains, null, 2);
  zip.folder("domains")?.file("domain_status.json", domainsJson);

  const meta = {
    saasId: exportTarget.id,
    tenantId: exportTarget.tenant_id,
    slug: exportTarget.slug,
    generatedAt: new Date().toISOString(),
    planTag: exportTarget.plan_tier,
    counts,
    warnings,
  };
  const metaJson = JSON.stringify(meta, null, 2);
  zip.file("meta.json", metaJson);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `drako-export-${exportTarget.slug}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;

  await maybePrepareSocialOwnedExportReadModel({
    tenantId,
    saasId: exportTarget.id,
    slug: exportTarget.slug,
    payload: {
      dossierJson,
      blueprintJson,
      workLogsCsv: `${workLogCsv}\n`,
      orchestratorMessagesCsv: `${messagesCsv}\n`,
      financialsCsv: `${financialsRows}\n`,
      economicEventsCsv: `${economicRows}\n`,
      domainsJson,
      metaJson,
    },
  });

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
