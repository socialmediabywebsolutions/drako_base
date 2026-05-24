'use server';

import { runMarketingAgent } from '@/lib/agents/marketing';
import { runSEOAgent } from '@/lib/agents/seo';
import { createSocialFlowLegacyActionsCoreAdapter, isLegacyActionsCoreDbAvailable } from '@/lib/socialflow/contracts/legacy-actions-core';

async function getContext(tenantId: string) {
  if (!isLegacyActionsCoreDbAvailable()) return null;
  const legacyCoreAdapter = createSocialFlowLegacyActionsCoreAdapter();
  const dossierRow = await legacyCoreAdapter.findLatestActiveStrategicDossier(tenantId);

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
  if (!isLegacyActionsCoreDbAvailable()) return [];
  const legacyCoreAdapter = createSocialFlowLegacyActionsCoreAdapter();
  const results = await legacyCoreAdapter.listLatestAgentWorkLogs(tenantId, 10);

  return results.map((row: any) => ({
    ...row,
    output_json: JSON.parse(row.output_json),
  }));
}
