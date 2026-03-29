"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import type { OwnerMarketingSnapshot } from "@/lib/owner/accounting";

type Status = "OK" | "NEAR_LIMIT" | "OVER_LIMIT";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function resolveStatusVariant(status: Status): "ok" | "warn" | "err" {
  if (status === "OVER_LIMIT") return "err";
  if (status === "NEAR_LIMIT") return "warn";
  return "ok";
}

function formatPackDefinition(definition: OwnerMarketingSnapshot["items"][number]["currentPackDefinition"]): string {
  if (!definition) return "-";
  return `${definition.tier} (${definition.includedPostsPerMonth} posts / ${definition.includedCampaignsPerMonth} campañas / ${definition.recommendedMonthlyPrice} €/mes)`;
}

export default function OwnerMarketingSection() {
  const [snapshot, setSnapshot] = useState<OwnerMarketingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/marketing", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: OwnerMarketingSnapshot } | null;
      setSnapshot(data?.snapshot ?? null);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el marketing del owner.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const summaryText = useMemo(() => {
    if (!snapshot) return "";
    if (snapshot.saasNearLimitCount > 0) {
      const upsellCandidate = snapshot.items.find(
        (item) =>
          item.status !== "OK" &&
          item.currentPackTier &&
          item.recommendedPackTier &&
          item.currentPackTier !== item.recommendedPackTier,
      );
      if (upsellCandidate?.recommendedPackDefinition && upsellCandidate.currentPackDefinition) {
        const delta =
          upsellCandidate.recommendedPackDefinition.recommendedMonthlyPrice -
          upsellCandidate.currentPackDefinition.recommendedMonthlyPrice;
        const deltaLabel = delta > 0 ? ` (+${delta} €/mes)` : "";
        return `Este SaaS esta exprimiendo su pack ${upsellCandidate.currentPackTier}. Valora subir a ${upsellCandidate.recommendedPackTier}${deltaLabel}.`;
      }
      return "Tienes SaaS que están exprimiendo al máximo sus publicaciones incluidas. Son buenos candidatos para ofrecer un pack extra.";
    }
    return "Las cuotas de marketing están bajo control este mes.";
  }, [snapshot]);

  return (
    <Card tone="glass" title="Marketing por SaaS" subtitle="Cuotas incluidas, uso y oportunidades de upsell">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando marketing...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !snapshot || snapshot.items.length === 0 ? (
        <EmptyState title="Sin marketing" subtitle="No hay datos de marketing configurados para este owner." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Plan activo</Badge>
              <span>{snapshot.totalSaasWithMarketingPlan}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warn">Near limit</Badge>
              <span>{snapshot.saasNearLimitCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="err">Over limit</Badge>
              <span>{snapshot.saasOverLimitCount}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Owner marketing usage">
              <thead>
                <tr>
                  <th>SaaS</th>
                  <th>Vertical</th>
                  <th>Posts este mes</th>
                  <th>Cuota</th>
                  <th>Uso</th>
                  <th>Pack actual</th>
                  <th>Pack recomendado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.items.map((item) => (
                  <tr key={item.saasId}>
                    <td className="font-semibold">{item.saasName}</td>
                    <td>{item.verticalId ?? "OTHER"}</td>
                    <td>
                      {item.postsPublishedThisMonth} / {item.includedPostsPerMonth}
                    </td>
                    <td>{item.includedPostsPerMonth}</td>
                    <td>{formatPercent(item.usagePostsPercent)}</td>
                    <td>{formatPackDefinition(item.currentPackDefinition)}</td>
                    <td>
                      {item.recommendedPackTier && item.recommendedPackTier !== item.currentPackTier
                        ? formatPackDefinition(item.recommendedPackDefinition)
                        : "-"}
                    </td>
                    <td>
                      <Badge variant={resolveStatusVariant(item.status)}>{item.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-[var(--muted)]">{summaryText}</p>
        </div>
      )}
    </Card>
  );
}
