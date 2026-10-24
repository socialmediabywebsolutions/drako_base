"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import type { SaasPricingRecommendation } from "@/lib/owner/pricing-engine";

type PricingStatus = SaasPricingRecommendation["status"];

const STATUS_ORDER: Record<PricingStatus, number> = {
  UNDERWATER: 0,
  AT_RISK: 1,
  ABOVE_TARGET: 2,
};

const VERTICAL_RULES: Record<string, { label: string; minFactor: number; targetFactor: number; stretchFactor: number }> = {
  SALON: { label: "Salón", minFactor: 1.2, targetFactor: 1.6, stretchFactor: 2.0 },
  CLINIC: { label: "Clínica", minFactor: 1.4, targetFactor: 1.8, stretchFactor: 2.2 },
  PET_GROOMING: { label: "Grooming", minFactor: 1.2, targetFactor: 1.5, stretchFactor: 1.9 },
  LAUNDRY: { label: "Lavandería", minFactor: 1.15, targetFactor: 1.4, stretchFactor: 1.8 },
  DEFAULT: { label: "General", minFactor: 1.2, targetFactor: 1.5, stretchFactor: 2.0 },
};

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(0)} €`;
}

function formatShare(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function resolveStatusVariant(status: PricingStatus): "err" | "warn" | "ok" {
  if (status === "UNDERWATER") return "err";
  if (status === "AT_RISK") return "warn";
  return "ok";
}

export default function OwnerPricingSection() {
  const [items, setItems] = useState<SaasPricingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/saas-pricing/recommendations", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: SaasPricingRecommendation[] } | null;
      setItems(data?.items ?? []);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar las recomendaciones de precios ahora mismo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  useEffect(() => {
    if (!items.length) return;
    const nextId = selectedId && items.some((item) => item.saasId === selectedId) ? selectedId : items[0].saasId;
    setSelectedId(nextId);
  }, [items, selectedId]);

  useEffect(() => {
    if (!items.length) return;
    const selected = items.find((item) => item.saasId === selectedId) ?? items[0];
    if (!selected) return;
    const safePrice = Math.max(0, selected.recommendedTargetPriceMonthly);
    setSimulatedPrice(safePrice);
  }, [items, selectedId]);

  const sortedItems = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.saasName.localeCompare(b.saasName));
  }, [items]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { UNDERWATER: 0, AT_RISK: 0, ABOVE_TARGET: 0 },
    );
  }, [items]);

  const selected = useMemo(() => {
    return items.find((item) => item.saasId === selectedId) ?? null;
  }, [items, selectedId]);

  const selectedRule = useMemo(() => {
    if (!selected?.verticalId) return VERTICAL_RULES.DEFAULT;
    return VERTICAL_RULES[selected.verticalId] ?? VERTICAL_RULES.DEFAULT;
  }, [selected]);

  const simulatorMin = selected?.recommendedMinPriceMonthly ?? 0;
  const simulatorMax = selected?.recommendedStretchPriceMonthly
    ? selected.recommendedStretchPriceMonthly * 2.5
    : selected
      ? selected.recommendedTargetPriceMonthly * 2
      : simulatorMin;
  const safeSimulatedPrice = Math.max(simulatorMin, Math.min(simulatorMax, simulatedPrice));
  const simulatedMargin = selected ? safeSimulatedPrice - selected.estimatedVendorCostMonthly : 0;
  const simulatedMarginRate = selected && safeSimulatedPrice > 0 ? (simulatedMargin / safeSimulatedPrice) * 100 : 0;
  const simulatedPackShare =
    selected?.marketingPackMonthlyPrice && safeSimulatedPrice > 0
      ? selected.marketingPackMonthlyPrice / safeSimulatedPrice
      : null;

  return (
    <Card tone="glass" title="Precios por SaaS" subtitle="Precio actual vs coste imputado y minimo recomendado">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando precios...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState title="Sin recomendaciones" subtitle="No hay datos suficientes para calcular precios por SaaS." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="err">UNDERWATER</Badge>
              <span>{summary.UNDERWATER}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warn">AT_RISK</Badge>
              <span>{summary.AT_RISK}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="ok">ABOVE_TARGET</Badge>
              <span>{summary.ABOVE_TARGET}</span>
            </div>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)]/60 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="err">UNDERWATER</Badge>
                <span className="text-[var(--muted)]">
                  El precio actual esta por debajo del coste estimado. Este SaaS te hace perder dinero cada mes.
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)]/60 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="warn">AT_RISK</Badge>
                <span className="text-[var(--muted)]">
                  El margen es muy estrecho; pequeños cambios en costes o uso de IA pueden dejarte en perdidas.
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)]/60 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="ok">ABOVE_TARGET</Badge>
                <span className="text-[var(--muted)]">
                  El precio actual esta por encima del minimo recomendado; este SaaS esta sano a nivel de margen.
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Pricing recommendations">
              <thead>
                <tr>
                  <th>SaaS</th>
                  <th>Vertical</th>
                  <th>Precio actual</th>
                  <th>Coste estimado</th>
                  <th>Minimo recomendado</th>
                  <th>Objetivo</th>
                  <th>Stretch</th>
                  <th>Pack Marketing</th>
                  <th>Estado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const note = item.notes[0];
                  const extraNotes = item.notes.length > 1 ? `+${item.notes.length - 1}` : null;
                  const packLabel =
                    item.marketingPackTier && item.marketingPackMonthlyPrice !== null
                      ? `${item.marketingPackTier} (${formatCurrency(item.marketingPackMonthlyPrice)}, ${formatShare(item.marketingPackShareOfPrice)})`
                      : "—";
                  return (
                    <tr key={item.saasId}>
                      <td className="font-semibold">{item.saasName}</td>
                      <td>{item.verticalId ?? "OTHER"}</td>
                      <td>{formatCurrency(item.currentMonthlyPrice)}</td>
                      <td>{formatCurrency(item.estimatedVendorCostMonthly)}</td>
                      <td>{formatCurrency(item.recommendedMinPriceMonthly)}</td>
                      <td>{formatCurrency(item.recommendedTargetPriceMonthly)}</td>
                      <td>{formatCurrency(item.recommendedStretchPriceMonthly ?? 0)}</td>
                      <td>{packLabel}</td>
                      <td>
                        <Badge variant={resolveStatusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[var(--muted)]">{note ?? "—"}</span>
                          {extraNotes ? <Badge variant="neutral">{extraNotes}</Badge> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 rounded-xl border border-[var(--border)]/60 p-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Simulador</p>
                <h3 className="text-lg font-semibold">Precio objetivo por SaaS</h3>
              </div>
              <label className="text-sm text-[var(--muted)]" htmlFor="pricing-saas-select">
                Selecciona SaaS
              </label>
              <select
                id="pricing-saas-select"
                className="w-full rounded-lg border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {items.map((item) => (
                  <option key={item.saasId} value={item.saasId}>
                    {item.saasName}
                  </option>
                ))}
              </select>
              {selected ? (
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Coste estimado mensual</span>
                    <span className="font-semibold">{formatCurrency(selected.estimatedVendorCostMonthly)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Precio actual</span>
                    <span className="font-semibold">{formatCurrency(selected.currentMonthlyPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Minimo recomendado</span>
                    <span className="font-semibold">{formatCurrency(selected.recommendedMinPriceMonthly)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Precio objetivo</span>
                    <span className="font-semibold">{formatCurrency(selected.recommendedTargetPriceMonthly)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Precio stretch</span>
                    <span className="font-semibold">{formatCurrency(selected.recommendedStretchPriceMonthly ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted)]">Pack marketing</span>
                    <span className="font-semibold">
                      {selected.marketingPackTier && selected.marketingPackMonthlyPrice !== null
                        ? `${selected.marketingPackTier} (${formatCurrency(selected.marketingPackMonthlyPrice)})`
                        : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Regla de vertical: {selectedRule.label} (min {selectedRule.minFactor.toFixed(2)}x, objetivo{" "}
                    {selectedRule.targetFactor.toFixed(2)}x, stretch {selectedRule.stretchFactor.toFixed(2)}x sobre coste).
                  </p>
                </div>
              ) : null}
            </div>
            <div className="space-y-3">
              <label className="text-sm text-[var(--muted)]" htmlFor="pricing-simulated-input">
                Precio simulado (€/mes)
              </label>
              <input
                id="pricing-simulated-input"
                type="number"
                className="w-full rounded-lg border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm"
                value={Number.isFinite(safeSimulatedPrice) ? safeSimulatedPrice : 0}
                min={simulatorMin}
                max={simulatorMax}
                step={5}
                onChange={(event) => setSimulatedPrice(Number(event.target.value))}
              />
              <input
                type="range"
                min={simulatorMin}
                max={simulatorMax}
                step={5}
                value={Number.isFinite(safeSimulatedPrice) ? safeSimulatedPrice : 0}
                onChange={(event) => setSimulatedPrice(Number(event.target.value))}
                className="w-full"
              />
              <div className="rounded-lg border border-[var(--border)]/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Margen estimado</span>
                  <span className="font-semibold">{formatCurrency(simulatedMargin)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[var(--muted)]">Margen %</span>
                  <span className="font-semibold">{simulatedMarginRate.toFixed(0)}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[var(--muted)]">Peso pack marketing</span>
                  <span className="font-semibold">{formatShare(simulatedPackShare)}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Este simulador te ayuda a ver cuanto margen tendrias por SaaS segun tu precio mensual. No cambia los precios reales ni las
                suscripciones.
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Si la mayoria de tus SaaS estan UNDERWATER, sera dificil cubrir tu minimo vital y las reservas de tesoreria.
          </p>
        </div>
      )}
    </Card>
  );
}
