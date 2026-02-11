"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import type { SaasInventoryItem, SaasProfitabilitySnapshot, SaasService } from "@/lib/economy/types";
import type { PricingSuggestion } from "@/lib/economy/pricing";

const statusTone: Record<PricingSuggestion["status"], "ok" | "warn" | "err"> = {
  OK: "ok",
  LOW_MARGIN: "warn",
  LOSS: "err",
};

const statusLabel: Record<PricingSuggestion["status"], string> = {
  OK: "OK",
  LOW_MARGIN: "LOW MARGIN",
  LOSS: "LOSS",
};

const expenseLabels: Record<string, string> = {
  RENT: "Alquiler",
  UTILITIES: "Servicios",
  PAYROLL: "Sueldos",
  PRODUCTS: "Productos",
  MARKETING: "Marketing",
  OTHER_FIXED: "Otros fijos",
  OTHER_VARIABLE: "Otros variables",
};

type Expense = {
  id: string;
  type: string;
  label: string;
  amount: number;
  currency: string;
};

type SaasEconomySectionProps = {
  saasId: string | null;
};

function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} €`;
}

export default function SaasEconomySection({ saasId }: SaasEconomySectionProps) {
  const [services, setServices] = useState<SaasService[]>([]);
  const [inventory, setInventory] = useState<SaasInventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [snapshot, setSnapshot] = useState<SaasProfitabilitySnapshot | null>(null);

  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const loadServices = useCallback(async () => {
    if (!saasId) return;
    const res = await fetch(`/api/economy/services?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
    const data = (await res.json()) as { items?: SaasService[] };
    setServices(data.items ?? []);
  }, [saasId]);

  const loadInventory = useCallback(async () => {
    if (!saasId) return;
    setLoadingInventory(true);
    try {
      const res = await fetch(`/api/economy/inventory?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasInventoryItem[] };
      setInventory(data.items ?? []);
    } finally {
      setLoadingInventory(false);
    }
  }, [saasId]);

  const loadSuggestions = useCallback(async () => {
    if (!saasId) return;
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/economy/pricing/suggestions?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: PricingSuggestion[] };
      setSuggestions(data.items ?? []);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [saasId]);

  const loadSnapshot = useCallback(async () => {
    if (!saasId) return;
    setLoadingSnapshot(true);
    try {
      const res = await fetch(`/api/economy/profitability?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { snapshot?: SaasProfitabilitySnapshot };
      setSnapshot(data.snapshot ?? null);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [saasId]);

  const loadExpenses = useCallback(async () => {
    if (!saasId) return;
    setLoadingExpenses(true);
    try {
      const res = await fetch(`/api/economy/expenses?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Expense[] };
      setExpenses(data.items ?? []);
    } finally {
      setLoadingExpenses(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadServices();
    void loadInventory();
    void loadSuggestions();
    void loadSnapshot();
    void loadExpenses();
  }, [loadServices, loadInventory, loadSuggestions, loadSnapshot, loadExpenses]);

  const expenseSummary = useMemo(() => {
    return expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.type] = (acc[expense.type] ?? 0) + expense.amount;
      return acc;
    }, {});
  }, [expenses]);

  const applySuggestedPrice = useCallback(
    async (suggestion: PricingSuggestion) => {
      if (!saasId) return;
      const service = serviceMap.get(suggestion.serviceId);
      if (!service) return;
      await fetch("/api/economy/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: service.id,
          saasId,
          name: service.name,
          slug: service.slug,
          category: service.category ?? null,
          durationMinutes: service.durationMinutes,
          currentPrice: suggestion.suggestedPrice,
          recommendedPrice: suggestion.suggestedPrice,
          isActive: service.isActive,
        }),
      });
      await Promise.all([loadServices(), loadSuggestions(), loadSnapshot()]);
    },
    [loadServices, loadSnapshot, loadSuggestions, saasId, serviceMap],
  );

  const registerPurchase = useCallback(
    async (item: SaasInventoryItem) => {
      if (!saasId) return;
      await fetch("/api/economy/inventory/movements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          inventoryItemId: item.id,
          type: "IN",
          quantity: 10,
          reason: "Compra simulada",
          source: "PURCHASE",
        }),
      });
      await loadInventory();
    },
    [loadInventory, saasId],
  );

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card tone="glass" title="Margen estimado" subtitle="Actual vs objetivo">
          {loadingSnapshot ? (
            <p className="text-sm text-[var(--muted)]">Calculando margen...</p>
          ) : snapshot ? (
            <div className="space-y-2">
              <div className="text-3xl font-semibold text-[var(--foreground)]">
                {snapshot.marginPercent.toFixed(0)}% / {snapshot.targetMarginPercent.toFixed(0)}%
              </div>
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3 text-sm font-semibold">
                {snapshot.canHireAdvice}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Sin datos de margen.</p>
          )}
        </Card>

        <Card tone="glass" title="Ingresos estimados" subtitle="Escenario mensual">
          {loadingSnapshot ? (
            <p className="text-sm text-[var(--muted)]">Calculando ingresos...</p>
          ) : snapshot ? (
            <div className="space-y-2">
              <div className="text-3xl font-semibold text-[var(--foreground)]">
                {formatCurrency(snapshot.estimatedMonthlyRevenue ?? snapshot.totalRevenue)}
              </div>
              <p className="text-xs text-[var(--muted)]">
                Costes estimados: {formatCurrency(snapshot.estimatedMonthlyCosts ?? snapshot.totalCosts)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Sin datos de ingresos.</p>
          )}
        </Card>

        <Card tone="glass" title="Costes clave" subtitle="Top mensual">
          {loadingSnapshot ? (
            <p className="text-sm text-[var(--muted)]">Calculando costes...</p>
          ) : snapshot ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Alquiler</span>
                <span>{formatCurrency(snapshot.rentCosts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Servicios</span>
                <span>{formatCurrency(snapshot.utilitiesCosts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Payroll</span>
                <span>{formatCurrency(snapshot.payrollCosts)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Sin datos de costes.</p>
          )}
        </Card>
      </div>

      <Card tone="glass" title="Servicios y precios" subtitle="Sugerencias para mejorar margen">
        {loadingSuggestions ? (
          <p className="text-sm text-[var(--muted)]">Calculando sugerencias...</p>
        ) : suggestions.length === 0 ? (
          <EmptyState title="Sin servicios" subtitle="Registra servicios para obtener sugerencias de precio" />
        ) : (
          <div className="overflow-x-auto">
            <table className="modern text-sm" aria-label="Tabla de precios y márgenes">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Precio actual</th>
                  <th>Precio sugerido</th>
                  <th>Coste</th>
                  <th>Margen</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.serviceId}>
                    <td>{suggestion.serviceName}</td>
                    <td>{formatCurrency(suggestion.currentPrice)}</td>
                    <td>{formatCurrency(suggestion.suggestedPrice)}</td>
                    <td>{formatCurrency(suggestion.serviceCost)}</td>
                    <td>{suggestion.marginCurrent.toFixed(0)}%</td>
                    <td>
                      <Badge variant={statusTone[suggestion.status]}>{statusLabel[suggestion.status]}</Badge>
                    </td>
                    <td className="text-right">
                      <Button onClick={() => applySuggestedPrice(suggestion)} size="sm">
                        Aplicar precio sugerido
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card tone="glass" title="Inventario" subtitle="Stock por producto">
          {loadingInventory ? (
            <p className="text-sm text-[var(--muted)]">Cargando inventario...</p>
          ) : inventory.length === 0 ? (
            <EmptyState title="Sin inventario" subtitle="Agrega productos para ver el stock" />
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Tabla de inventario">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Stock</th>
                    <th>Min</th>
                    <th>Coste/unidad</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => {
                    const low = item.stockQuantity < item.minStockQuantity;
                    return (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.stockQuantity}</td>
                        <td>{item.minStockQuantity}</td>
                        <td>{formatCurrency(item.costPerUnit)}</td>
                        <td>
                          <Badge variant={low ? "warn" : "ok"}>{low ? "LOW STOCK" : "OK"}</Badge>
                        </td>
                        <td className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => registerPurchase(item)}>
                            Registrar compra +10
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card tone="glass" title="Gastos" subtitle="Resumen por tipo">
          {loadingExpenses ? (
            <p className="text-sm text-[var(--muted)]">Cargando gastos...</p>
          ) : expenses.length === 0 ? (
            <EmptyState title="Sin gastos" subtitle="Agrega gastos para ver el resumen" />
          ) : (
            <div className="space-y-3 text-sm">
              {Object.entries(expenseSummary).map(([type, total]) => (
                <div key={type} className="flex items-center justify-between">
                  <span>{expenseLabels[type] ?? type}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
