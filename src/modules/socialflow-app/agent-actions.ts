'use server';

import { env } from '@/lib/cf';
import { runMarketingAgent } from '@/lib/agents/marketing';
import { runSEOAgent } from '@/lib/agents/seo';

async function getContext(tenantId: string) {
  const bindings = env();
  if (!bindings?.DRACO_DB) return null;

  const dossierRow = await bindings.DRACO_DB.prepare(
    `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
  ).bind(tenantId).first<any>();

  if (!dossierRow) return null;

  return {
    tenant_id: tenantId,
    saas_id: tenantId,
    dossier: {
      ...dossierRow,
      form_data: JSON.parse(dossierRow.form_data as string),
      analysis_data: JSON.parse(dossierRow.analysis_data as string),
    },
  };
}

export async function executeAgentCommand(command: string, tenantId: string) {
  const context = await getContext(tenantId);
  if (!context) return { error: "Context not found" };

  const cmdLower = command.toLowerCase();

  if (cmdLower.includes('post') || cmdLower.includes('redes') || cmdLower.includes('marketing')) {
    const result = await runMarketingAgent(context);
    return { success: true, type: 'MARKETING', data: result };
  }

  if (cmdLower.includes('seo') || cmdLower.includes('analiza') || cmdLower.includes('keywords')) {
    const result = await runSEOAgent(context);
    return { success: true, type: 'SEO', data: result };
  }

  return { error: "Comando no reconocido. Prueba: 'Genera posts' o 'Dame SEO'." };
}

export async function getAgentWorkLogs(tenantId: string) {
  const bindings = env();
  if (!bindings?.DRACO_DB) return [];

  const { results } = await bindings.DRACO_DB.prepare(
    `SELECT * FROM agent_work_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10`,
  ).bind(tenantId).all();

  return results.map((row: any) => ({
    ...row,
    output_json: JSON.parse(row.output_json),
  }));
}
