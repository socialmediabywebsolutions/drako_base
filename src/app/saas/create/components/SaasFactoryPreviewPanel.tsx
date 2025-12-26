"use client";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { getMarketingPacksForVertical } from "@/lib/saas/marketing-packs";
import type { SaasFactoryProvisioningResult } from "@/app/saas/create/types";
import { AGENT_PACKS_BY_DEPARTMENT, type DepartmentId } from "@/lib/agents/agent-templates";

const VERTICAL_LABELS: Record<string, string> = {
  SALON: "Salon",
  CLINIC: "Clinica",
  PET_GROOMING: "Grooming",
  LAUNDRY: "Lavanderia",
  EDUCATION: "Educacion",
  CRYPTO: "Cripto",
  OTHER: "Other",
};

function formatCurrency(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(0)} €`;
}

function resolvePricingStatus(params: {
  current: number;
  estimatedCost?: number | null;
  recommendedMin?: number | null;
}): "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER" {
  const current = params.current;
  const estimatedCost = params.estimatedCost ?? 0;
  const recommendedMin = params.recommendedMin ?? 0;
  if (current <= 0 || current < estimatedCost) return "UNDERWATER";
  if (recommendedMin > 0 && current < recommendedMin) return "AT_RISK";
  return "ABOVE_TARGET";
}

function formatDepartmentLabel(departmentId: DepartmentId): string {
  switch (departmentId) {
    case "MARKETING":
      return "Marketing";
    case "ACCOUNTING":
      return "Accounting";
    case "SUPPORT":
      return "Support";
    case "EMAIL_INTAKE":
      return "Email intake";
    case "OPS":
      return "Ops";
    case "TAX":
      return "Tax";
    default:
      return departmentId;
  }
}

function resolvePackAgents(departmentId: DepartmentId, tier: string | null | undefined) {
  if (!tier) return null;
  return AGENT_PACKS_BY_DEPARTMENT.find((pack) => pack.departmentId === departmentId && pack.tier === tier) ?? null;
}

export default function SaasFactoryPreviewPanel({
  blueprint,
  provisioning,
  onCreate,
  onReset,
  creating,
  canCreate,
  error,
  createdSaasId,
}: {
  blueprint: SaasBlueprintDraft | null;
  provisioning: SaasFactoryProvisioningResult | null;
  onCreate: () => void;
  onReset: () => void;
  creating: boolean;
  canCreate: boolean;
  error?: string | null;
  createdSaasId?: string | null;
}) {
  const packs = blueprint?.packsByDepartment ?? {};
  const marketingPack = blueprint ? getMarketingPacksForVertical(blueprint.verticalId).find((pack) => pack.tier === packs.marketing) : null;
  const subdomain = blueprint?.proposedSubdomain ?? "nuevo-saas";
  const pricingStatus = resolvePricingStatus({
    current: blueprint?.initialPricing.currentMonthlyPrice ?? 0,
    estimatedCost: blueprint?.initialPricing.estimatedVendorCostMonthly ?? null,
    recommendedMin: blueprint?.initialPricing.recommendedMinPriceMonthly ?? null,
  });
  const campProfile = blueprint?.campamentoBaseProfile;
  const enabledDepartments = campProfile?.departmentsEnabled ?? [];
  const coverageGap = {
    accounting: !enabledDepartments.includes("ACCOUNTING"),
    support: !enabledDepartments.includes("SUPPORT"),
  };
  const coverageSummary = enabledDepartments
    .map((departmentId) => {
      const tier = campProfile?.packsByDepartment?.[departmentId] ?? "BASIC";
      return `${departmentId} (${tier})`;
    })
    .join(", ");

  return (
    <Card tone="glass" title="Preview SaaS" subtitle="Estado actual del blueprint">
      <div className="space-y-4 text-sm text-[var(--muted)]">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em]">Nombre</p>
            <p className="mt-1 text-base font-semibold text-[var(--text)]">{blueprint?.saasName ?? "Nuevo SaaS"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em]">Vertical</p>
            <p className="mt-1 text-base font-semibold text-[var(--text)]">
              {VERTICAL_LABELS[blueprint?.verticalId ?? "OTHER"]}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em]">Dominio esperado</p>
            <p className="mt-1 text-sm text-[var(--text)]">{subdomain}.drako.systems</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em]">IA</p>
            <p className="mt-1 text-sm text-[var(--text)]">{blueprint?.aiProfile.tier ?? "—"}</p>
            {blueprint?.aiProfile.notes ? (
              <p className="text-xs">{blueprint.aiProfile.notes}</p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em]">Resumen</p>
          <p className="mt-1 text-[var(--text)]">{blueprint?.summary ?? "Define el resumen desde el chat."}</p>
          <p className="mt-2">Audiencia: {blueprint?.targetAudience ?? "—"}</p>
          <p>Problema: {blueprint?.mainProblem ?? "—"}</p>
          <p>Objetivo: {blueprint?.mainGoal ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em]">Packs por departamento</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>Marketing: {packs.marketing ?? "—"}</div>
            <div>Contabilidad: {packs.accounting ?? "—"}</div>
            <div>Soporte: {packs.support ?? "—"}</div>
            <div>Email intake: {packs.emailIntake ?? "—"}</div>
            <div>Ops: {packs.ops ?? "—"}</div>
            <div>Tax: {packs.tax ?? "—"}</div>
          </div>
          {marketingPack ? (
            <div className="mt-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3 text-xs">
              <p className="font-semibold text-[var(--text)]">{marketingPack.label}</p>
              <p>{marketingPack.description}</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em]">Pricing</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>Precio actual: {formatCurrency(blueprint?.initialPricing.currentMonthlyPrice ?? null)}</div>
            <div>Coste vendor: {formatCurrency(blueprint?.initialPricing.estimatedVendorCostMonthly ?? null)}</div>
            <div>Min recomendado: {formatCurrency(blueprint?.initialPricing.recommendedMinPriceMonthly ?? null)}</div>
            <div>Target recomendado: {formatCurrency(blueprint?.initialPricing.recommendedTargetPriceMonthly ?? null)}</div>
            <div>Stretch recomendado: {formatCurrency(blueprint?.initialPricing.recommendedStretchPriceMonthly ?? null)}</div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em]">Provisioning</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs">
            <div>Cloudflare: {provisioning?.cloudflare?.status ?? "PENDING"}</div>
            <div>Stripe: {provisioning?.stripe?.status ?? "PENDING"}</div>
            <div>IA: {provisioning?.ai?.profile?.tier ?? blueprint?.aiProfile.tier ?? "—"}</div>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em]">Vista Campamento Base</p>
          <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
            <div>Vertical: {VERTICAL_LABELS[blueprint?.verticalId ?? "OTHER"]}</div>
            <div>Packs activos: {packs.marketing ?? "—"} / {packs.accounting ?? "—"} / {packs.support ?? "—"}</div>
            <div>Precio vs coste: {formatCurrency(blueprint?.initialPricing.currentMonthlyPrice ?? null)} vs {formatCurrency(blueprint?.initialPricing.estimatedVendorCostMonthly ?? null)}</div>
            <div>Estado pricing: {pricingStatus}</div>
            <div>Intento pricing owner: {blueprint?.campamentoBaseProfile?.ownerPricingIntent ?? "BALANCED"}</div>
            <div>IA strategy: {blueprint?.campamentoBaseProfile?.aiProfile.strategy ?? "BALANCED"}</div>
          </div>
          {marketingPack ? (
            <div className="mt-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3 text-xs">
              <p className="font-semibold text-[var(--text)]">Marketing {marketingPack.tier}</p>
              <p>{marketingPack.includedPostsPerMonth} posts / {marketingPack.includedCampaignsPerMonth} campanas</p>
              <p>Recomendado: {marketingPack.recommendedMonthlyPrice} €/mes</p>
            </div>
          ) : null}
          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.25em]">Agents overview</p>
            {enabledDepartments.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Sin departamentos activos.</p>
            ) : (
              <div className="mt-2 space-y-2 text-xs text-[var(--muted)]">
                <p>Departments enabled: {coverageSummary}.</p>
                {coverageGap.accounting || coverageGap.support ? (
                  <p className="text-amber-200">
                    Coverage gap:
                    {coverageGap.accounting ? " no Accounting" : ""}
                    {coverageGap.support ? `${coverageGap.accounting ? "," : ""} no Support` : ""}
                  </p>
                ) : null}
                {enabledDepartments.map((departmentId) => {
                  const tier = campProfile?.packsByDepartment?.[departmentId] ?? null;
                  const pack = resolvePackAgents(departmentId, tier);
                  const roles = pack?.agents.map((agent) => agent.roleName).slice(0, 3).join(", ") ?? "—";
                  return (
                    <div key={departmentId} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                      <p className="font-semibold text-[var(--text)]">
                        {formatDepartmentLabel(departmentId)} {tier ?? ""}
                      </p>
                      <p>{pack ? `${pack.agents.length} agents` : "0 agents"}</p>
                      <p>{roles}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreate} loading={creating} disabled={!canCreate}>Crear SaaS desde Campamento Base</Button>
          <Button variant="outline" onClick={onReset} disabled={creating}>Limpiar</Button>
          {createdSaasId ? (
            <span className="text-xs text-[var(--muted)]">SaaS creado: {createdSaasId}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
