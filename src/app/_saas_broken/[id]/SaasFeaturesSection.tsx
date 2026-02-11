"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";
import type { SaasFeature, SaasFeatureStatus } from "@/lib/features/types";

type Props = {
  saasId: string | null;
};

const STATUS_LABELS: Record<SaasFeatureStatus, string> = {
  ENABLED: "Activo",
  DISABLED: "Desactivado",
  PLANNED: "Planificado",
  DEPRECATED: "Deprecado",
};

export default function SaasFeaturesSection({ saasId }: Props) {
  const [features, setFeatures] = useState<SaasFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingPlan, setSyncingPlan] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const loadFeatures = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/features?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: SaasFeature[] } | null;
      setFeatures(data?.items ?? []);
    } catch {
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadFeatures();
  }, [loadFeatures]);

  useEffect(() => {
    function handleRefresh() {
      void loadFeatures();
    }
    window.addEventListener("features:refresh", handleRefresh);
    return () => window.removeEventListener("features:refresh", handleRefresh);
  }, [loadFeatures]);

  const grouped = useMemo(() => {
    return features.reduce((acc, feature) => {
      acc.set(feature.category, [...(acc.get(feature.category) ?? []), feature]);
      return acc;
    }, new Map<string, SaasFeature[]>());
  }, [features]);

  const handleToggle = async (feature: SaasFeature) => {
    if (!saasId) return;
    setUpdatingKey(feature.featureKey);
    const nextStatus: SaasFeatureStatus = feature.status === "ENABLED" ? "DISABLED" : "ENABLED";
    try {
      await fetch(`/api/features/${encodeURIComponent(feature.featureKey)}?saasId=${encodeURIComponent(saasId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, source: "MANUAL" }),
      });
      void loadFeatures();
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleSync = async () => {
    if (!saasId) return;
    setSyncing(true);
    try {
      await fetch("/api/features/sync-from-blueprint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId }),
      });
      void loadFeatures();
    } finally {
      setSyncing(false);
    }
  };

  const handlePlanSync = async () => {
    if (!saasId) return;
    setSyncingPlan(true);
    try {
      await fetch("/api/billing/features/sync-from-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId }),
      });
      void loadFeatures();
    } finally {
      setSyncingPlan(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Features">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Features</p>
          <h2 className="text-xl font-semibold">Módulos activos</h2>
          <p className="text-sm text-[var(--muted)]">
            Las features marcadas como “Plan” vienen incluidas en la suscripción. Puedes activar módulos extra manualmente o por blueprint/autopilot.
          </p>
          <p className="text-xs text-[var(--muted)]">Cuando el plan de Stripe cambia, Drako sincroniza automáticamente estas características. Si algo falla, fuerza la sync manual.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePlanSync} disabled={syncingPlan || !saasId}>
            {syncingPlan ? "Sincronizando..." : "Sincronizar con plan"}
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || !saasId}>
            {syncing ? "Sincronizando..." : "Sincronizar con Blueprint"}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card title="Cargando" subtitle="Leyendo módulos">
          <p className="text-sm text-[var(--muted)]">Un momento…</p>
        </Card>
      ) : features.length === 0 ? (
        <EmptyState title="Sin módulos" subtitle="Sincroniza con el blueprint o añade módulos manualmente." />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <Card key={category} tone="glass" title={category}>
              <div className="overflow-x-auto">
                <table className="modern text-sm" aria-label={`Features ${category}`}>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Estado</th>
                      <th>Source</th>
                      <th>Fase</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((feature) => (
                      <tr key={feature.id}>
                        <td className="font-semibold">{feature.label}</td>
                        <td>
                          <Badge
                            variant={
                              feature.status === "ENABLED"
                                ? "ok"
                                : feature.status === "DISABLED"
                                  ? "neutral"
                                  : feature.status === "PLANNED"
                                    ? "warn"
                                    : "outline"
                            }
                          >
                            {STATUS_LABELS[feature.status]}
                          </Badge>
                        </td>
                        <td>
                          <Badge variant={feature.source === "PLAN" ? "ok" : "outline"}>
                            {feature.source === "PLAN" ? "Plan" : feature.source}
                          </Badge>
                        </td>
                        <td>
                          <Select value={String(feature.phaseOrder)} disabled>
                            <option value={String(feature.phaseOrder)}>Fase {feature.phaseOrder}</option>
                          </Select>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggle(feature)}
                            disabled={updatingKey === feature.featureKey}
                          >
                            {feature.status === "ENABLED" ? "Desactivar" : "Activar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
