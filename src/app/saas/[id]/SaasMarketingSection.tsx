"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { TextInput } from "@/components/ui/input";
import type { SaasMarketingSnapshot } from "@/lib/saas/marketing-types";

type Props = {
  saasId: string | null;
};

type PlanForm = {
  includedPostsPerMonth: number;
  includedCampaignsPerMonth: number;
  extraPostPrice: number;
  extraCampaignPrice: number;
  notes: string;
};

function resolveUsageVariant(value: number): "ok" | "warn" | "err" {
  if (value >= 1) return "err";
  if (value >= 0.8) return "warn";
  return "ok";
}

function formatPack(definition: SaasMarketingSnapshot["currentPackDefinition"]): string {
  if (!definition) return "—";
  return `${definition.tier} (${definition.includedPostsPerMonth} posts / ${definition.includedCampaignsPerMonth} campañas / ${definition.recommendedMonthlyPrice} €/mes)`;
}

export default function SaasMarketingSection({ saasId }: Props) {
  const [snapshot, setSnapshot] = useState<SaasMarketingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>({
    includedPostsPerMonth: 8,
    includedCampaignsPerMonth: 0,
    extraPostPrice: 0,
    extraCampaignPrice: 0,
    notes: "",
  });

  const loadSnapshot = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/saas/${encodeURIComponent(saasId)}/marketing`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { marketing?: SaasMarketingSnapshot } | null;
      const marketing = data?.marketing ?? null;
      setSnapshot(marketing);
      if (marketing) {
        setPlanForm((prev) => ({
          ...prev,
          includedPostsPerMonth: marketing.includedPostsPerMonth,
          includedCampaignsPerMonth: marketing.includedCampaignsPerMonth,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el marketing.");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const usagePostsPercent = snapshot?.usagePostsPercent ?? 0;
  const usageCampaignsPercent = snapshot?.usageCampaignsPercent ?? 0;
  const usagePostsLabel = `${(usagePostsPercent * 100).toFixed(0)}%`;
  const usageCampaignsLabel = `${(usageCampaignsPercent * 100).toFixed(0)}%`;

  const paidAdsLine = useMemo(() => {
    if (!snapshot) return "—";
    if (snapshot.paidAdsTotalThisMonth <= 0) return "Sin gasto de Ads registrado.";
    const byChannel = snapshot.paidAdsByChannel
      .map((entry) => `${entry.channel.replace("_", " ")} ${entry.amount.toFixed(0)} ${entry.currency}`)
      .join(", ");
    return `Gasto Ads este mes: ${snapshot.paidAdsTotalThisMonth.toFixed(0)} € (${byChannel})`;
  }, [snapshot]);

  const handleSave = useCallback(async () => {
    if (!saasId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        includedPostsPerMonth: Math.max(0, Number(planForm.includedPostsPerMonth)),
        includedCampaignsPerMonth: Math.max(0, Number(planForm.includedCampaignsPerMonth)),
        extraPostPrice: Math.max(0, Number(planForm.extraPostPrice)),
        extraCampaignPrice: Math.max(0, Number(planForm.extraCampaignPrice)),
        notes: planForm.notes || null,
      };
      const res = await fetch(`/api/saas/${encodeURIComponent(saasId)}/marketing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo guardar el plan.");
      const data = (await res.json().catch(() => null)) as { marketing?: SaasMarketingSnapshot } | null;
      setSnapshot(data?.marketing ?? snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el plan.");
    } finally {
      setSaving(false);
    }
  }, [planForm, saasId, snapshot]);

  return (
    <Card tone="glass" title="Marketing & Redes" subtitle="Cuotas mensuales, uso y Ads pagados por el cliente">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando marketing...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !snapshot ? (
        <EmptyState title="Sin marketing" subtitle="No hay datos de marketing para este SaaS." />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)]/60 p-3 text-sm">
            <p className="text-xs text-[var(--muted)]">Pack actual</p>
            <p className="font-semibold">{formatPack(snapshot.currentPackDefinition)}</p>
            {snapshot.recommendedPackTier &&
            snapshot.currentPackTier &&
            snapshot.recommendedPackTier !== snapshot.currentPackTier ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Sugerencia: subir a {formatPack(snapshot.recommendedPackDefinition)} si quieres más margen de publicaciones.
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Posts incluidos</p>
                  <TextInput
                    type="number"
                    value={planForm.includedPostsPerMonth}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, includedPostsPerMonth: Number(event.target.value) }))
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Campañas incluidas</p>
                  <TextInput
                    type="number"
                    value={planForm.includedCampaignsPerMonth}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, includedCampaignsPerMonth: Number(event.target.value) }))
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Precio extra por post</p>
                  <TextInput
                    type="number"
                    value={planForm.extraPostPrice}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, extraPostPrice: Number(event.target.value) }))
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Precio extra por campaña</p>
                  <TextInput
                    type="number"
                    value={planForm.extraCampaignPrice}
                    onChange={(event) =>
                      setPlanForm((prev) => ({ ...prev, extraCampaignPrice: Number(event.target.value) }))
                    }
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Notas</p>
                <TextInput
                  value={planForm.notes}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {saving ? "Guardando..." : "Guardar plan"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--border)]/60 p-3">
                <p className="text-xs text-[var(--muted)]">Publicaciones este mes</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    {snapshot.postsPublishedThisMonth} / {snapshot.includedPostsPerMonth}
                  </span>
                  <Badge variant={resolveUsageVariant(usagePostsPercent)}>{usagePostsLabel}</Badge>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[var(--border)]/60">
                  <div
                    className="h-2 rounded-full bg-[var(--brand)]"
                    style={{ width: `${Math.min(100, usagePostsPercent * 100).toFixed(0)}%` }}
                  />
                </div>
              </div>

              {snapshot.includedCampaignsPerMonth > 0 ? (
                <div className="rounded-xl border border-[var(--border)]/60 p-3">
                  <p className="text-xs text-[var(--muted)]">Campañas este mes</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-lg font-semibold">
                      {snapshot.campaignsLaunchedThisMonth} / {snapshot.includedCampaignsPerMonth}
                    </span>
                    <Badge variant={resolveUsageVariant(usageCampaignsPercent)}>{usageCampaignsLabel}</Badge>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[var(--border)]/60">
                    <div
                      className="h-2 rounded-full bg-[var(--brand)]"
                      style={{ width: `${Math.min(100, usageCampaignsPercent * 100).toFixed(0)}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-[var(--border)]/60 p-3">
                <p className="text-xs text-[var(--muted)]">Ads de pago (cliente)</p>
                <p className="text-sm">{paidAdsLine}</p>
                <p className="text-xs text-[var(--muted)]">
                  Este gasto NO se cuenta como coste vendor de Drako; es coste directo del cliente.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span>Incluye publicaciones organicas dentro del alquiler del SaaS.</span>
            <span>Los packs extra se facturan aparte.</span>
            <span>Ads pagados se registran solo como referencia.</span>
          </div>
        </div>
      )}
    </Card>
  );
}
