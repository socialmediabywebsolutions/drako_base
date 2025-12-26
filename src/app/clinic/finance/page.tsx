"use client";

import { useCallback, useEffect, useState } from "react";
import { ClinicNoSubscriptionState } from "@/components/clinic/no-subscription-state";
import { isNoSubscriptionError, unwrapClinicResponse } from "@/app/clinic/api-client";
import type { ClinicFinanceEntry, ClinicFinanceSummary } from "@/lib/clinic/types";

export default function ClinicFinancePage() {
  const [items, setItems] = useState<ClinicFinanceEntry[]>([]);
  const [summary, setSummary] = useState<ClinicFinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ serviceName: "", amount: "", paidAt: "" });
  const [saving, setSaving] = useState(false);
  const [noSubscription, setNoSubscription] = useState(false);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const json = await unwrapClinicResponse<{ items: ClinicFinanceEntry[]; summary: ClinicFinanceSummary | null }>(
        await fetch("/api/clinic/finance"),
        { fallbackMessage: "No se pudieron cargar los cobros" },
      );
      setItems(json?.items ?? []);
      setSummary(json?.summary ?? null);
      setError(null);
      setNoSubscription(false);
    } catch (err) {
      if (isNoSubscriptionError(err)) {
        setNoSubscription(true);
        setItems([]);
        setSummary(null);
        setError(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  async function addEntry(event: React.FormEvent) {
    event.preventDefault();
    const amountNumber = Number(form.amount);
    if (Number.isNaN(amountNumber)) {
      setError("El importe debe ser numérico");
      return;
    }
    setSaving(true);
    try {
      await unwrapClinicResponse(
        await fetch("/api/clinic/finance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceName: form.serviceName || null,
            amount: Math.round(amountNumber * 100),
            paidAt: form.paidAt || new Date().toISOString(),
          }),
        }),
        { fallbackMessage: "No se pudo registrar el pago" },
      );
      setForm({ serviceName: "", amount: "", paidAt: "" });
      await loadFinance();
    } catch (err) {
      if (isNoSubscriptionError(err)) {
        setNoSubscription(true);
        setError(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Ingresos mes</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary ? `${(summary.totalRevenue / 100).toFixed(2)} €` : loading ? "..." : "0 €"}
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Ticket medio</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary ? `${(summary.averageTicket / 100).toFixed(2)} €` : loading ? "..." : "0 €"}
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Entradas</p>
          <p className="mt-2 text-3xl font-semibold">{loading ? "..." : items.length}</p>
        </div>
      </div>

      {noSubscription ? (
        <ClinicNoSubscriptionState />
      ) : (
        <>
          {error && <div className="rounded-2xl border border-red-400/40 bg-red-900/20 px-4 py-3 text-sm text-red-100">{error}</div>}

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Movimientos recientes</h2>
              {loading && <span className="text-xs text-[var(--muted)]">Cargando...</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-2 text-left font-medium">Fecha</th>
                    <th className="py-2 text-left font-medium">Servicio</th>
                    <th className="py-2 text-left font-medium">Importe</th>
                    <th className="py-2 text-left font-medium">Método</th>
                  </tr>
                </thead>
                <tbody>
                  {(loading ? [] : items).map((entry) => (
                    <tr key={entry.id} className="border-t border-[var(--border)]/60">
                      <td className="py-2">{new Date(entry.paidAt).toLocaleString()}</td>
                      <td className="py-2">{entry.serviceName ?? "General"}</td>
                      <td className="py-2 font-semibold">{(entry.amount / 100).toFixed(2)} €</td>
                      <td className="py-2 text-[var(--muted)]">{entry.method ?? "card"}</td>
                    </tr>
                  ))}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[var(--muted)]">
                        Sin pagos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={addEntry} className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Registrar pago manual</h2>
            <label className="text-sm block">
              Servicio / concepto
              <input
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.serviceName}
                onChange={(e) => setForm((prev) => ({ ...prev, serviceName: e.target.value }))}
                placeholder="Limpieza facial"
              />
            </label>
            <label className="text-sm block">
              Importe (€)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm block">
              Fecha de cobro
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                value={form.paidAt}
                onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))}
                required
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Registrar pago"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
