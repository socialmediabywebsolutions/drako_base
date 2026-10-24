"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";

type CatalogItem = {
  id: string;
  vertical: string;
  label: string;
  shortTagline: string;
  idealFor: string[];
  startingFromText: string;
  highlightBullets: string[];
  recommendedPlanId?: string;
};

type PricingRecommendation = {
  saasId: string;
  currentMonthlyPrice: number;
  recommendedTargetPriceMonthly: number;
  status: "ABOVE_TARGET" | "AT_RISK" | "UNDERWATER";
};

type AccountingSnapshot = {
  rows: Array<{
    saasId: string;
    packId?: string;
  }>;
};

export default function OwnerCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [verticalFilter, setVerticalFilter] = useState("ALL");
  const [pricingItems, setPricingItems] = useState<PricingRecommendation[]>([]);
  const [accountingSnapshot, setAccountingSnapshot] = useState<AccountingSnapshot | null>(null);

  const filteredItems =
    verticalFilter === "ALL" ? items : items.filter((item) => item.vertical === verticalFilter);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [catalogRes, pricingRes, accountingRes] = await Promise.all([
          fetch("/api/catalog/saas", { cache: "no-store" }),
          fetch("/api/operator/saas-pricing/recommendations", { cache: "no-store" }),
          fetch("/api/operator/accounting", { cache: "no-store" }),
        ]);
        const catalogData = (await catalogRes.json().catch(() => null)) as { items?: CatalogItem[] } | null;
        const pricingData = (await pricingRes.json().catch(() => null)) as { items?: PricingRecommendation[] } | null;
        const accountingData = (await accountingRes.json().catch(() => null)) as { snapshot?: AccountingSnapshot } | null;
        if (mounted) {
          setItems(catalogData?.items ?? []);
          setPricingItems(pricingData?.items ?? []);
          setAccountingSnapshot(accountingData?.snapshot ?? null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const pricingBySaas = new Map(pricingItems.map((item) => [item.saasId, item]));
  const saasByPack = new Map<string, string[]>();
  accountingSnapshot?.rows.forEach((row) => {
    if (!row.packId) return;
    const list = saasByPack.get(row.packId) ?? [];
    list.push(row.saasId);
    saasByPack.set(row.packId, list);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Operator · Catálogo de SaaS</p>
          <h1 className="text-3xl font-semibold">Activa un nuevo SaaS por vertical</h1>
          <p className="text-sm text-[var(--muted)]">
            Cada SaaS tiene su propia suscripción y módulos recomendados por pack.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
            Vertical
            <select
              className="ml-2 rounded-full border border-[var(--border)]/70 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
              value={verticalFilter}
              onChange={(event) => setVerticalFilter(event.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="SALON">Salón</option>
              <option value="CLINIC">Clínica</option>
              <option value="PET_GROOMING">Grooming</option>
              <option value="LAUNDRY">Lavandería</option>
            </select>
          </label>
          <Link href="/operator">
            <Button variant="outline">Volver al portfolio</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <Card tone="glass" title="Cargando catálogo">
          <p className="text-sm text-[var(--muted)]">Un momento…</p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <EmptyState title="Sin catálogo" subtitle="No hay packs disponibles con ese filtro." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredItems.map((item) => {
            const packSaasIds = saasByPack.get(item.id) ?? [];
            const packRecommendations = packSaasIds.map((saasId) => pricingBySaas.get(saasId)).filter(Boolean) as PricingRecommendation[];
            const packCount = packRecommendations.length;
            const avgCurrent =
              packCount > 0
                ? packRecommendations.reduce((acc, rec) => acc + rec.currentMonthlyPrice, 0) / packCount
                : 0;
            const avgTarget =
              packCount > 0
                ? packRecommendations.reduce((acc, rec) => acc + rec.recommendedTargetPriceMonthly, 0) / packCount
                : 0;
            const hasUnderwater = packRecommendations.some((rec) => rec.status === "UNDERWATER");
            const hasAtRisk = packRecommendations.some((rec) => rec.status === "AT_RISK");
            const pricingStatus = hasUnderwater ? "UNDERWATER" : hasAtRisk ? "AT_RISK" : packCount > 0 ? "ABOVE_TARGET" : null;

            return (
              <Card key={item.id} tone="glass" title={item.label} subtitle={item.shortTagline}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{item.vertical}</Badge>
                <Badge variant="info">{item.startingFromText}</Badge>
              </div>
              {packCount > 0 ? (
                <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                  <p>Instancias reales de este pack: {packCount}</p>
                  <p>Precio medio actual: {avgCurrent.toFixed(0)} €/mes</p>
                  <p>Precio objetivo recomendado: {avgTarget.toFixed(0)} €/mes</p>
                  {pricingStatus ? (
                    <Badge
                      variant={pricingStatus === "UNDERWATER" ? "err" : pricingStatus === "AT_RISK" ? "warn" : "ok"}
                    >
                      Pricing medio: {pricingStatus}
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-[var(--muted)]">Sin instancias reales asociadas a este pack.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                {item.idealFor.map((value) => (
                  <span key={`${item.id}-${value}`} className="rounded-full border border-[var(--border)]/60 px-3 py-1">
                    {value}
                  </span>
                ))}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                {item.highlightBullets.map((bullet) => (
                  <li key={`${item.id}-${bullet}`}>• {bullet}</li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">{item.startingFromText}</span>
                <Link href={`/saas/create?packId=${encodeURIComponent(item.id)}`}>
                  <Button size="sm">Activar para nuevo SaaS</Button>
                </Link>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
