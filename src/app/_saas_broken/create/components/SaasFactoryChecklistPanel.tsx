"use client";

import Card from "@/components/ui/card";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { AGENT_PACKS_BY_DEPARTMENT, BASE_AGENT_TEMPLATES, type AgentTemplate } from "@/lib/agents/agent-templates";
import type { SaasFactoryProvisioningResult } from "@/app/saas/create/types";

type ChecklistStatus = "TODO" | "IN_PROGRESS" | "DONE";

const STATUS_STYLES: Record<ChecklistStatus, { label: string; dot: string }> = {
  TODO: { label: "TODO", dot: "bg-zinc-400" },
  IN_PROGRESS: { label: "IN_PROGRESS", dot: "bg-amber-400" },
  DONE: { label: "DONE", dot: "bg-emerald-400" },
};

function normalizeStatus(status?: string | null): "SUCCESS" | "ERROR" | "PENDING" {
  const normalized = status?.toUpperCase() ?? "PENDING";
  if (normalized === "SUCCESS" || normalized === "COMPLETED") return "SUCCESS";
  if (normalized === "ERROR" || normalized === "FAILED") return "ERROR";
  return "PENDING";
}

function resolveChecklistStatus(value: boolean, fallback?: ChecklistStatus): ChecklistStatus {
  if (value) return "DONE";
  return fallback ?? "TODO";
}

function tierIncluded(requested: string | undefined, template: AgentTemplate): boolean {
  if (!requested) return false;
  if (!template.packs || template.packs.length === 0) return true;
  return template.packs.includes(requested);
}

function countAgents(blueprint: SaasBlueprintDraft | null): number {
  if (!blueprint) return 0;
  const campProfile = blueprint.campamentoBaseProfile;
  if (campProfile) {
    return campProfile.departmentsEnabled.reduce((total, departmentId) => {
      const tier = campProfile.packsByDepartment?.[departmentId];
      const pack = AGENT_PACKS_BY_DEPARTMENT.find((item) => item.departmentId === departmentId && item.tier === tier);
      return total + (pack?.agents.length ?? 0);
    }, 0);
  }
  const marketingTier = blueprint.packsByDepartment.marketing;
  const accountingTier = blueprint.packsByDepartment.accounting;
  const supportTier = blueprint.packsByDepartment.support;
  const opsTier = blueprint.packsByDepartment.ops;

  return BASE_AGENT_TEMPLATES.filter((template) => {
    switch (template.department) {
      case "MARKETING":
        return tierIncluded(marketingTier, template);
      case "ACCOUNTING":
      case "TAX":
        return tierIncluded(accountingTier, template);
      case "SUPPORT":
        return tierIncluded(supportTier, template);
      case "OPS":
        return tierIncluded(opsTier ?? supportTier, template);
      default:
        return false;
    }
  }).length;
}

export default function SaasFactoryChecklistPanel({
  blueprint,
  provisioning,
  messageCount,
}: {
  blueprint: SaasBlueprintDraft | null;
  provisioning: SaasFactoryProvisioningResult | null;
  messageCount?: number;
}) {
  const vertical = blueprint?.verticalId?.trim() ?? "";
  const subdomain = blueprint?.proposedSubdomain?.trim() ?? "";
  const aiTier = blueprint?.aiProfile?.tier ?? "";
  const campamentoBaseProfile = blueprint?.campamentoBaseProfile;
  const created = Boolean(provisioning?.saasId);
  const agentCount = countAgents(blueprint);
  const enabledDepartments = campamentoBaseProfile?.departmentsEnabled ?? [];
  const packsByDepartment = campamentoBaseProfile?.packsByDepartment ?? {};
  const messageTotal = messageCount ?? 0;
  const interviewDone = messageTotal >= 2 || Boolean(blueprint?.interviewSummary || blueprint?.summary || blueprint?.mainGoal?.trim());
  const interviewStatus: ChecklistStatus = interviewDone ? "DONE" : messageTotal > 0 ? "IN_PROGRESS" : "TODO";
  const hasDepartments = enabledDepartments.length > 0;
  const missingPack = enabledDepartments.some((dept) => !packsByDepartment[dept]);
  const departmentsStatus: ChecklistStatus = !hasDepartments ? "TODO" : missingPack ? "IN_PROGRESS" : "DONE";
  const blueprintReady = Boolean(vertical && hasDepartments);
  const blueprintStatus: ChecklistStatus = blueprintReady
    ? "DONE"
    : vertical || hasDepartments
      ? "IN_PROGRESS"
      : "TODO";
  const campamentoBaseReady = Boolean(
    campamentoBaseProfile?.ownerPricingIntent &&
      campamentoBaseProfile?.aiProfile?.strategy &&
      campamentoBaseProfile?.aiProfile?.preferredTier,
  );
  const campamentoBaseStatus: ChecklistStatus = campamentoBaseReady
    ? "DONE"
    : campamentoBaseProfile
      ? "IN_PROGRESS"
      : "TODO";

  const cloudflareStatus = normalizeStatus(provisioning?.cloudflare?.status ?? null);
  const stripeStatus = normalizeStatus(provisioning?.stripe?.status ?? null);
  const aiStatus = normalizeStatus(provisioning?.ai?.status ?? null);

  const provisioningStatus = (status: "SUCCESS" | "ERROR" | "PENDING"): ChecklistStatus => {
    if (status === "SUCCESS") return "DONE";
    if (status === "ERROR") return "IN_PROGRESS";
    return created ? "IN_PROGRESS" : "TODO";
  };

  const agentsStatus: ChecklistStatus =
    agentCount > 0 && aiTier ? "DONE" : agentCount > 0 || aiTier ? "IN_PROGRESS" : "TODO";
  const aiAndAgentsStatus: ChecklistStatus =
    aiStatus === "SUCCESS"
      ? "DONE"
      : aiStatus === "ERROR"
        ? "IN_PROGRESS"
        : agentsStatus;

  const checklistItems: Array<{ label: string; status: ChecklistStatus; note?: string }> = [
    { label: "Entrevista & idea", status: interviewStatus },
    { label: "Blueprint", status: blueprintStatus },
    { label: "Departamentos & packs", status: departmentsStatus },
    { label: "Perfil Campamento Base", status: campamentoBaseStatus },
    {
      label: "Cloudflare planificado",
      status: provisioningStatus(cloudflareStatus),
      note: cloudflareStatus === "ERROR" ? "ERROR" : undefined,
    },
    {
      label: "Stripe planificado",
      status: provisioningStatus(stripeStatus),
      note: stripeStatus === "ERROR" ? "ERROR" : undefined,
    },
    {
      label: "Perfil IA & agentes",
      status: aiAndAgentsStatus,
      note: agentCount > 0 ? `${agentCount} agentes` : aiTier ? `Tier ${aiTier}` : undefined,
    },
    { label: "SaaS creado", status: resolveChecklistStatus(created) },
    { label: "Subdominio", status: resolveChecklistStatus(Boolean(subdomain)) },
  ];

  return (
    <Card tone="glass" title="Checklist" subtitle="Estado del blueprint y wiring">
      <div className="space-y-3 text-xs text-[var(--muted)]">
        {checklistItems.map((item) => {
          const style = STATUS_STYLES[item.status];
          return (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span className="text-[var(--text)]">{item.label}</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em]">{item.note ?? style.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
