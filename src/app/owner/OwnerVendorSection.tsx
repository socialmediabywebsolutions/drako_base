"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import type { DrakoVendorAccountingSnapshot } from "@/lib/owner/vendor-types";

const VERTICAL_LABELS: Record<string, string> = {
  SALON: "Salon",
  CLINIC: "Clinic",
  PET_GROOMING: "Grooming",
  LAUNDRY: "Laundry",
  OTHER: "Other",
};

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(0)} €`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

export default function OwnerVendorSection() {
  const [snapshot, setSnapshot] = useState<DrakoVendorAccountingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/vendor/snapshot", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { snapshot?: DrakoVendorAccountingSnapshot } | null;
      setSnapshot(data?.snapshot ?? null);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el snapshot del vendor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const totalMargin = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.estimatedMarginByVertical.reduce((acc, row) => acc + row.margin, 0);
  }, [snapshot]);

  const negativeVerticals = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.estimatedMarginByVertical.filter((row) => row.margin < 0).length;
  }, [snapshot]);

  const hasData = Boolean(
    snapshot &&
      (snapshot.vendorExpensesByType.length > 0 ||
        snapshot.vendorExpensesByVertical.length > 0 ||
        snapshot.estimatedMarginByVertical.length > 0),
  );

  return (
    <Card
      tone="glass"
      title="Drako Vendor (operator)"
      subtitle="Gastos de infra, IA, marketing y equipo con margen aproximado por vertical."
    >
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando vendor snapshot...</p>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : !snapshot || !hasData ? (
        <EmptyState title="Sin gastos de vendor" subtitle="Aún no hay gastos del vendor registrados en este entorno demo." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Gastos vendor (mes)</p>
              <p className="text-xl font-semibold">{formatCurrency(snapshot.totalVendorExpensesThisMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Gastos vendor (mes anterior)</p>
              <p className="text-xl font-semibold">{formatCurrency(snapshot.totalVendorExpensesLastMonth)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Margen global Drako</p>
              <p className="text-xl font-semibold">{formatCurrency(totalMargin)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Verticales en negativo</p>
              <p className="text-xl font-semibold">{negativeVerticals}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Vendor margin by vertical">
                <thead>
                  <tr>
                    <th>Vertical</th>
                    <th>Ingresos Drako</th>
                    <th>Gastos vendor</th>
                    <th>Margen</th>
                    <th>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.estimatedMarginByVertical.map((row) => (
                    <tr key={row.verticalId ?? "unassigned"}>
                      <td className="font-semibold">{VERTICAL_LABELS[row.verticalId ?? ""] ?? row.verticalId ?? "Unassigned"}</td>
                      <td>{formatCurrency(row.revenue)}</td>
                      <td>{formatCurrency(row.vendorCosts)}</td>
                      <td>{formatCurrency(row.margin)}</td>
                      <td>{formatPercent(row.marginRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Vendor expenses by type">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Total (mes)</th>
                    <th>% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.vendorExpensesByType.map((item) => (
                    <tr key={item.type}>
                      <td className="font-semibold">{item.type}</td>
                      <td>{formatCurrency(item.amount)}</td>
                      <td>{formatPercent(item.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
