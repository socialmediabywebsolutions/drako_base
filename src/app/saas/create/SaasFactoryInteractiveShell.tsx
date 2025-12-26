"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { createDefaultBlueprint } from "@/app/saas/create/blueprint";
import { normalizeCampamentoBaseProfileForBlueprint } from "@/lib/campamento-base/saas-factory-helpers";
import type { SaasFactoryProvisioningResult } from "@/app/saas/create/types";
import SaasFactoryChecklistPanel from "@/app/saas/create/components/SaasFactoryChecklistPanel";
import SaasFactoryChatPanel, { type SaasFactoryChatMessage } from "@/app/saas/create/components/SaasFactoryChatPanel";
import SaasFactoryPreviewPanel from "@/app/saas/create/components/SaasFactoryPreviewPanel";
import type { AgentPackTier, DepartmentId } from "@/lib/agents/agent-templates";

type CatalogItem = {
  id: string;
  vertical: string;
  label: string;
  shortTagline: string;
  idealFor: string[];
  startingFromText: string;
  highlightBullets: string[];
};

type PackTier = "BASIC" | "STANDARD" | "FULL";

type BlueprintUpdate = Partial<Omit<SaasBlueprintDraft, "packsByDepartment" | "initialPricing" | "aiProfile" | "provisioning">> & {
  packsByDepartment?: Partial<SaasBlueprintDraft["packsByDepartment"]>;
  initialPricing?: Partial<SaasBlueprintDraft["initialPricing"]>;
  aiProfile?: Partial<SaasBlueprintDraft["aiProfile"]>;
  provisioning?: {
    domains?: Partial<NonNullable<SaasBlueprintDraft["provisioning"]>["domains"]>;
    stripe?: Partial<NonNullable<SaasBlueprintDraft["provisioning"]>["stripe"]>;
    ai?: Partial<NonNullable<SaasBlueprintDraft["provisioning"]>["ai"]>;
  };
};

type SaasFactoryInteractiveShellProps = {
  initialBlueprintDraft: SaasBlueprintDraft | null;
  initialProvisioningState?: SaasFactoryProvisioningResult | null;
  packId?: string | null;
};

export default function SaasFactoryInteractiveShell({
  initialBlueprintDraft,
  initialProvisioningState,
  packId,
}: SaasFactoryInteractiveShellProps) {
  const fallbackTenantId = initialBlueprintDraft?.ownerTenantId ?? "demo-tenant";
  const [blueprint, setBlueprint] = useState<SaasBlueprintDraft | null>(
    initialBlueprintDraft
      ? normalizeCampamentoBaseProfileForBlueprint(initialBlueprintDraft, { applyDefaults: true })
      : createDefaultBlueprint(fallbackTenantId),
  );
  const [provisioningResult, setProvisioningResult] = useState<SaasFactoryProvisioningResult | null>(
    initialProvisioningState ?? null,
  );
  const [createdSaasId, setCreatedSaasId] = useState<string | null>(initialProvisioningState?.saasId ?? null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [messages, setMessages] = useState<SaasFactoryChatMessage[]>([
    { role: "campamento-base", content: "Dime el nicho, packs y objetivo. Yo ajusto el blueprint." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        const res = await fetch("/api/catalog/saas", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { items?: CatalogItem[] } | null;
        if (mounted) setCatalog(data?.items ?? []);
      } catch {
        if (mounted) setCatalog([]);
      }
    }
    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPack = useMemo(() => catalog.find((item) => item.id === packId) ?? null, [catalog, packId]);

  const updateBlueprint = useCallback((patch: BlueprintUpdate) => {
    setBlueprint((prev) => {
      const base = prev ?? createDefaultBlueprint(fallbackTenantId);
      const baseProvisioning = base.provisioning ?? createDefaultBlueprint(fallbackTenantId).provisioning!;
      const baseProfile = base.campamentoBaseProfile;
      const patchProfile = patch.campamentoBaseProfile;
      const mergedProfile = patchProfile
        ? {
            ...baseProfile,
            ...patchProfile,
            departmentsEnabled: patchProfile.departmentsEnabled ?? baseProfile?.departmentsEnabled ?? [],
            packsByDepartment: {
              ...(baseProfile?.packsByDepartment ?? {}),
              ...(patchProfile.packsByDepartment ?? {}),
            },
            aiProfile: {
              ...baseProfile?.aiProfile,
              ...patchProfile.aiProfile,
            },
          }
        : baseProfile;

      return normalizeCampamentoBaseProfileForBlueprint({
        ...base,
        ...patch,
        packsByDepartment: {
          ...base.packsByDepartment,
          ...patch.packsByDepartment,
        },
        initialPricing: {
          ...base.initialPricing,
          ...patch.initialPricing,
        },
        aiProfile: {
          ...base.aiProfile,
          ...patch.aiProfile,
        },
        provisioning: {
          ...baseProvisioning,
          ...patch.provisioning,
          domains: {
            ...baseProvisioning.domains,
            ...patch.provisioning?.domains,
          },
          stripe: {
            ...baseProvisioning.stripe,
            ...patch.provisioning?.stripe,
          },
          ai: {
            ...baseProvisioning.ai,
            ...patch.provisioning?.ai,
          },
        },
        campamentoBaseProfile: mergedProfile,
      }, { applyDefaults: false });
    });
  }, [fallbackTenantId]);

  useEffect(() => {
    if (selectedPack?.vertical) {
      updateBlueprint({ verticalId: selectedPack.vertical as SaasBlueprintDraft["verticalId"] });
    }
  }, [selectedPack, updateBlueprint]);

  const canCreate = useMemo(() => {
    if (!blueprint) return false;
    const enabledDepartments = blueprint.campamentoBaseProfile?.departmentsEnabled ?? [];
    const hasPack = enabledDepartments.some((dept) => blueprint.campamentoBaseProfile?.packsByDepartment?.[dept]);
    return Boolean(blueprint.saasName && blueprint.proposedSubdomain && blueprint.verticalId && hasPack);
  }, [blueprint]);

  const handleCreate = async () => {
    if (!blueprint) return;
    if (!blueprint.saasName || !blueprint.proposedSlug) {
      setError("Nombre y slug son obligatorios");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/saas", {
        method: "POST",
        body: JSON.stringify({
          name: blueprint.saasName,
          slug: blueprint.proposedSlug,
          domain: blueprint.provisioning?.domains.customDomainRequested ?? null,
          packId: packId || null,
          blueprintDraft: blueprint,
        }),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "No se pudo crear el SaaS");
      }
      const data = (await res.json().catch(() => null)) as
        | { id?: string; provisioningStatus?: SaasFactoryProvisioningResult }
        | null;
      const saasId = data?.id ?? null;
      setCreatedSaasId(saasId);
      setProvisioningResult({
        saasId,
        cloudflare: data?.provisioningStatus?.cloudflare ?? null,
        stripe: data?.provisioningStatus?.stripe ?? null,
        ai: data?.provisioningStatus?.ai ?? null,
      });
      if (saasId && packId) {
        await fetch("/api/packs/apply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ saasId, packId }),
        });
        await fetch("/api/features/sync-from-blueprint", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ saasId }),
        });
        await fetch("/api/billing/features/sync-from-plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ saasId }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setBlueprint(createDefaultBlueprint(fallbackTenantId));
    setCreatedSaasId(null);
    setProvisioningResult(null);
    setError(null);
  };

  const departments: DepartmentId[] = ["MARKETING", "ACCOUNTING", "SUPPORT", "EMAIL_INTAKE", "OPS", "TAX"];
  const departmentLabels: Record<DepartmentId, string> = {
    MARKETING: "Marketing",
    ACCOUNTING: "Accounting",
    SUPPORT: "Support",
    EMAIL_INTAKE: "Email intake",
    OPS: "Ops",
    TAX: "Tax",
  };

  const normalizedProfile = blueprint
    ? normalizeCampamentoBaseProfileForBlueprint(blueprint, { applyDefaults: false }).campamentoBaseProfile
    : null;
  const campamentoBaseProfile = normalizedProfile ?? null;
  const enabledDepartments = campamentoBaseProfile?.departmentsEnabled ?? [];
  const packsByDepartment = campamentoBaseProfile?.packsByDepartment ?? {};

  const setDepartmentEnabled = (departmentId: DepartmentId, enabled: boolean) => {
    const nextDepartments = enabled
      ? Array.from(new Set([...enabledDepartments, departmentId]))
      : enabledDepartments.filter((dept) => dept !== departmentId);
    const nextPacks = { ...packsByDepartment };
    if (enabled && !nextPacks[departmentId]) {
      nextPacks[departmentId] = "BASIC";
    }
    if (!campamentoBaseProfile) return;
    updateBlueprint({
      campamentoBaseProfile: {
        ...campamentoBaseProfile,
        departmentsEnabled: nextDepartments,
        packsByDepartment: nextPacks,
      },
    });
  };

  const setDepartmentPack = (departmentId: DepartmentId, tier: AgentPackTier) => {
    if (!campamentoBaseProfile) return;
    updateBlueprint({
      campamentoBaseProfile: {
        ...campamentoBaseProfile,
        departmentsEnabled: enabledDepartments,
        packsByDepartment: {
          ...packsByDepartment,
          [departmentId]: tier,
        },
      },
    });
  };

  const handleSendChat = async () => {
    const content = chatInput.trim();
    if (!content || chatLoading) return;
    setChatLoading(true);
    setMessages((prev) => [...prev, { role: "user", content }]);
    setChatInput("");
    try {
      const res = await fetch("/api/campamento-base/saas-factory/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content, blueprint }),
      });
      const data = (await res.json().catch(() => null)) as { reply?: string; blueprint?: SaasBlueprintDraft; error?: string } | null;
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "No se pudo procesar el mensaje");
      }
      if (data?.blueprint) {
        setBlueprint(data.blueprint);
      }
      setMessages((prev) => [...prev, { role: "campamento-base", content: data?.reply ?? "Blueprint actualizado." }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "campamento-base", content: error instanceof Error ? error.message : "Error al responder." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[270px] space-y-4">
          <Card tone="glass" title="Departamentos & Packs" subtitle="Activacion del ejercito IA">
            <div className="space-y-3 text-xs text-[var(--muted)]">
              {departments.map((departmentId) => {
                const enabled = enabledDepartments.includes(departmentId);
                const tier = packsByDepartment[departmentId] ?? "BASIC";
                return (
                  <div key={departmentId} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => setDepartmentEnabled(departmentId, event.target.checked)}
                        />
                        <span className="font-semibold">{departmentLabels[departmentId]}</span>
                      </label>
                      <select
                        className="rounded-2xl border border-[var(--border)]/60 bg-transparent px-2 py-1 text-xs text-[var(--text)] disabled:opacity-50"
                        value={tier}
                        onChange={(event) => setDepartmentPack(departmentId, event.target.value as AgentPackTier)}
                        disabled={!enabled}
                      >
                        <option value="BASIC">BASIC</option>
                        <option value="STANDARD">STANDARD</option>
                        <option value="FULL">FULL</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <SaasFactoryChecklistPanel
            blueprint={blueprint}
            provisioning={provisioningResult}
            messageCount={messages.length}
          />
        </div>

        <div className="flex-1 space-y-6">
          <Card
            tone="glass"
            title="Campamento Base — SaaS Factory"
            subtitle="Checklist operativo + wiring"
            right={
              <Link href="/saas">
                <Button variant="outline">Volver</Button>
              </Link>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <TextInput
                  placeholder="Nombre comercial"
                  value={blueprint?.saasName ?? ""}
                  onChange={(e) => updateBlueprint({ saasName: e.target.value })}
                />
                <TextInput
                  placeholder="Slug (sin espacios)"
                  value={blueprint?.proposedSlug ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    updateBlueprint({
                      proposedSlug: next,
                      proposedSubdomain: next,
                      provisioning: {
                        domains: { primarySubdomain: next },
                      },
                    });
                  }}
                />
                <TextInput
                  placeholder="Dominio (opcional)"
                  value={blueprint?.provisioning?.domains.customDomainRequested ?? ""}
                  onChange={(e) =>
                    updateBlueprint({
                      provisioning: {
                        domains: { customDomainRequested: e.target.value || null },
                      },
                    })
                  }
                />
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Vertical
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                    value={blueprint?.verticalId ?? "OTHER"}
                    onChange={(e) => updateBlueprint({ verticalId: e.target.value as SaasBlueprintDraft["verticalId"] })}
                  >
                    <option value="SALON">Salon</option>
                    <option value="CLINIC">Clinic</option>
                    <option value="PET_GROOMING">Grooming</option>
                    <option value="LAUNDRY">Laundry</option>
                    <option value="EDUCATION">Education</option>
                    <option value="CRYPTO">Crypto</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              </div>

              <div className="space-y-3 text-sm text-[var(--muted)]">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Marketing
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.marketing ?? "STANDARD"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { marketing: e.target.value as PackTier } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="STANDARD">STANDARD</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Accounting
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.accounting ?? "BASIC"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { accounting: e.target.value as "BASIC" | "FULL" } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Support
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.support ?? "BASIC"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { support: e.target.value as PackTier } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="STANDARD">STANDARD</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Email Intake
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.emailIntake ?? "BASIC"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { emailIntake: e.target.value as "BASIC" | "FULL" } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Ops
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.ops ?? "BASIC"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { ops: e.target.value as PackTier } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="STANDARD">STANDARD</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                  <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Tax
                    <select
                      className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                      value={blueprint?.packsByDepartment.tax ?? "BASIC"}
                      onChange={(e) => updateBlueprint({ packsByDepartment: { tax: e.target.value as "BASIC" | "FULL" } })}
                    >
                      <option value="BASIC">BASIC</option>
                      <option value="FULL">FULL</option>
                    </select>
                  </label>
                </div>

                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Perfil IA
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                    value={blueprint?.aiProfile.tier ?? "BALANCED"}
                    onChange={(e) => updateBlueprint({ aiProfile: { tier: e.target.value as "COST_SAVER" | "BALANCED" | "PREMIUM" } })}
                  >
                    <option value="COST_SAVER">COST_SAVER</option>
                    <option value="BALANCED">BALANCED</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </label>
              </div>
            </div>
          </Card>

          <SaasFactoryPreviewPanel
            blueprint={blueprint}
            provisioning={provisioningResult}
            onCreate={handleCreate}
            onReset={handleReset}
            creating={creating}
            canCreate={canCreate}
            error={error}
            createdSaasId={createdSaasId}
          />
        </div>

        <div className="w-full shrink-0 lg:w-[320px]">
          <SaasFactoryChatPanel
            messages={messages}
            input={chatInput}
            loading={chatLoading}
            onInputChange={setChatInput}
            onSend={handleSendChat}
          />
        </div>
      </div>
    </div>
  );
}
