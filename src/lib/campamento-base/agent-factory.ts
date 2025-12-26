import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import {
  AGENT_PACKS_BY_DEPARTMENT,
  BASE_AGENT_TEMPLATES,
  type AgentPackTier,
  type AgentTemplate,
  type AgentTemplateDefinition,
  type DepartmentId,
} from "@/lib/agents/agent-templates";
import { queryAll, run } from "@/lib/db";
import type { DracoEnv } from "@/lib/cf";

const TEMPLATE_TO_CORE_AGENT: Record<string, string> = {
  "marketing.organic.manager": "core_agent_mkt",
  "marketing.paid.manager": "core_agent_mkt",
  "accounting.controller": "core_agent_acc",
  "tax.compliance": "core_agent_tax",
  "support.customer.success": "core_agent_sales",
  "ops.agenda.manager": "core_agent_support",
};

function tierIncluded(requested: string | undefined, template: AgentTemplate): boolean {
  if (!requested) return false;
  if (!template.packs || template.packs.length === 0) return true;
  return template.packs.includes(requested);
}

export function getAgentTemplatesForSaasBlueprint(blueprint: SaasBlueprintDraft): AgentTemplate[] {
  const marketingTier = blueprint.packsByDepartment.marketing;
  const accountingTier = blueprint.packsByDepartment.accounting;
  const supportTier = blueprint.packsByDepartment.support;
  const opsTier = blueprint.packsByDepartment.ops;
  const enabled = blueprint.campamentoBaseProfile?.departmentsEnabled ?? null;
  const enabledSet = enabled ? new Set(enabled) : null;

  return BASE_AGENT_TEMPLATES.filter((template) => {
    switch (template.department) {
      case "MARKETING":
        if (enabledSet && !enabledSet.has("MARKETING")) return false;
        return tierIncluded(marketingTier, template);
      case "ACCOUNTING":
        if (enabledSet && !enabledSet.has("ACCOUNTING")) return false;
        return tierIncluded(accountingTier, template);
      case "TAX":
        if (enabledSet && !enabledSet.has("TAX")) return false;
        return tierIncluded(accountingTier, template);
      case "SUPPORT":
        if (enabledSet && !enabledSet.has("SUPPORT")) return false;
        return tierIncluded(supportTier, template);
      case "OPS":
        if (enabledSet && !enabledSet.has("OPS")) return false;
        return tierIncluded(opsTier ?? supportTier, template);
      default:
        return false;
    }
  });
}

function normalizeTier(tier?: AgentPackTier | null): AgentPackTier {
  return tier ?? "BASIC";
}

function resolvePackDefinition(departmentId: DepartmentId, tier: AgentPackTier) {
  return AGENT_PACKS_BY_DEPARTMENT.find((pack) => pack.departmentId === departmentId && pack.tier === tier) ?? null;
}

function resolveTemplateAiTier(template: AgentTemplateDefinition, fallback: AgentPackTier): string {
  if (template.aiProfile?.tier === "PREMIUM") return "PREMIUM";
  if (template.aiProfile?.tier === "LOW_COST") return "COST_SAVER";
  if (template.aiProfile?.tier === "BALANCED") return "BALANCED";
  return fallback === "FULL" ? "PREMIUM" : fallback === "STANDARD" ? "BALANCED" : "COST_SAVER";
}

export async function createAgentsForSaasFromPacks(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<void> {
  const profile = params.blueprint.campamentoBaseProfile;
  if (!profile) return;
  const departments = profile.departmentsEnabled ?? [];
  if (!departments.length) return;

  const coreAgents = await queryAll<{ id: string }>("SELECT id FROM core_agents");
  const coreAgentIds = new Set(coreAgents.map((agent) => agent.id));

  for (const departmentId of departments) {
    const tier = normalizeTier(profile.packsByDepartment?.[departmentId]);
    const pack = resolvePackDefinition(departmentId, tier);
    if (!pack) continue;
    for (const template of pack.agents) {
      const coreAgentId = template.coreAgentId;
      if (!coreAgentId || !coreAgentIds.has(coreAgentId)) continue;
      const linkId = `link_${params.saasId}_${coreAgentId}`;
      const aiTier = resolveTemplateAiTier(template, tier);
      await run(
        "INSERT OR IGNORE INTO saas_agents (id, saas_id, tenant_id, core_agent_id, estado, config) VALUES (?, ?, ?, ?, 'activo', ?)",
        linkId,
        params.saasId,
        params.tenantId,
        coreAgentId,
        JSON.stringify({
          templateKey: template.key,
          roleName: template.roleName,
          departmentId,
          packTier: tier,
          aiTier,
          preferredProviders: template.aiProfile?.preferredProviders ?? [],
        }),
      );
    }
  }
}

export async function materializeAgentsForSaas(params: {
  env?: DracoEnv | null;
  tenantId: string;
  saasId: string;
  blueprint: SaasBlueprintDraft;
}): Promise<void> {
  const templates = getAgentTemplatesForSaasBlueprint(params.blueprint);
  if (!templates.length) return;

  const coreAgents = await queryAll<{ id: string }>("SELECT id FROM core_agents");
  const coreAgentIds = new Set(coreAgents.map((agent) => agent.id));

  for (const template of templates) {
    const coreAgentId = TEMPLATE_TO_CORE_AGENT[template.id];
    if (!coreAgentId || !coreAgentIds.has(coreAgentId)) continue;
    const linkId = `link_${params.saasId}_${coreAgentId}`;
    await run(
      "INSERT OR IGNORE INTO saas_agents (id, saas_id, tenant_id, core_agent_id, estado, config) VALUES (?, ?, ?, ?, 'activo', ?)",
      linkId,
      params.saasId,
      params.tenantId,
      coreAgentId,
      JSON.stringify({ templateId: template.id, roleName: template.roleName, aiTier: params.blueprint.aiProfile.tier }),
    );
  }
}
