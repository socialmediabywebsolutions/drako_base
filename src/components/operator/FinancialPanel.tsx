"use client";

import { useState } from "react";

// Panel financiero del operator: MRR/ARR por SaaS, costes, beneficio e IRPF estimado.
// Datos mock hasta conectar con la contabilidad real; "Actualizar datos" solo abre el
// modal (sin lógica todavía).

type SaasFinanceRow = { saas: string; clients: number; avgPlan: number };

const SAAS_ROWS: SaasFinanceRow[] = [
  { saas: "Socialcors", clients: 42, avgPlan: 49 },
  { saas: "Mentoría", clients: 18, avgPlan: 29 },
  { saas: "Crypto IA", clients: 6, avgPlan: 19 },
  { saas: "Cazh", clients: 0, avgPlan: 0 },
  { saas: "Rentia", clients: 0, avgPlan: 0 },
];

const MONTHLY_EXPENSES: { label: string; amount: number }[] = [
  { label: "Infraestructura Cloudflare", amount: 180 },
  { label: "Modelos IA (Workers AI, Anthropic, vídeo)", amount: 420 },
  { label: "Herramientas y SaaS", amount: 150 },
  { label: "Gestoría y otros", amount: 250 },
];

// Tramos de IRPF usados para la estimación (base liquidable anual).
const IRPF_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 12_450, rate: 0.15 },
  { upTo: 20_200, rate: 0.2 },
  { upTo: 35_200, rate: 0.3 },
  { upTo: 60_000, rate: 0.37 },
  { upTo: Infinity, rate: 0.45 },
];

// €X.XXX con punto de miles también en cifras de 4 dígitos (es-ES no agrupa 4 dígitos).
function formatEur(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = Math.round(Math.abs(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}€${digits}`;
}

function computeIrpf(annualBase: number) {
  let previous = 0;
  const lines: { range: string; rate: number; taxable: number; tax: number }[] = [];
  for (const bracket of IRPF_BRACKETS) {
    const taxable = Math.max(0, Math.min(annualBase, bracket.upTo) - previous);
    lines.push({
      range: bracket.upTo === Infinity ? `Desde ${formatEur(previous)}` : `${formatEur(previous)} – ${formatEur(bracket.upTo)}`,
      rate: bracket.rate,
      taxable,
      tax: taxable * bracket.rate,
    });
    if (annualBase <= bracket.upTo) break;
    previous = bracket.upTo;
  }
  const total = lines.reduce((sum, l) => sum + l.tax, 0);
  return { lines, total, effectiveRate: annualBase > 0 ? total / annualBase : 0 };
}

function StatCard({ label, value, hint, accent = false }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${accent ? "text-[#3b82f6]" : "text-slate-900"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function FinancialPanel() {
  const [modalOpen, setModalOpen] = useState(false);

  const rows = SAAS_ROWS.map((r) => ({ ...r, mrr: r.clients * r.avgPlan, arr: r.clients * r.avgPlan * 12 }));
  const totalClients = rows.reduce((sum, r) => sum + r.clients, 0);
  const totalMrr = rows.reduce((sum, r) => sum + r.mrr, 0);
  const totalArr = totalMrr * 12;
  const avgPlan = totalClients > 0 ? totalMrr / totalClients : 0;
  const monthlyExpenses = MONTHLY_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  const costPerClient = totalClients > 0 ? monthlyExpenses / totalClients : 0;
  const monthlyProfit = totalMrr - monthlyExpenses;
  const annualProfit = monthlyProfit * 12;
  const irpf = computeIrpf(Math.max(0, annualProfit));

  return (
    <section className="rounded-3xl border-2 border-sky-100 bg-[#f8fafc] p-6 shadow-md">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Panel Financiero</h3>
          <p className="text-sm text-slate-500">MRR, costes y fiscalidad estimada del holding · datos de ejemplo</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-[#3b82f6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          Actualizar datos
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR total" value={formatEur(totalMrr)} hint={`ARR ${formatEur(totalArr)}`} accent />
        <StatCard label="Coste por cliente" value={formatEur(costPerClient)} hint={`${totalClients} clientes de pago`} />
        <StatCard label="Total gastos" value={formatEur(monthlyExpenses)} hint="al mes" />
        <StatCard label="Beneficio estimado" value={formatEur(monthlyProfit)} hint={`${formatEur(annualProfit)} al año`} accent />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">SaaS</th>
              <th className="px-4 py-3 text-right">Clientes</th>
              <th className="px-4 py-3 text-right">Plan medio</th>
              <th className="px-4 py-3 text-right">MRR</th>
              <th className="px-4 py-3 text-right">ARR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.saas}>
                <td className="px-4 py-3 font-semibold text-slate-900">{r.saas}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.clients}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.avgPlan ? formatEur(r.avgPlan) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#3b82f6]">{formatEur(r.mrr)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatEur(r.arr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold text-slate-900">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{totalClients}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEur(avgPlan)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-[#3b82f6]">{formatEur(totalMrr)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatEur(totalArr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Desglose de gastos mensuales</p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {MONTHLY_EXPENSES.map((e) => (
              <li key={e.label} className="flex justify-between py-2">
                <span className="text-slate-600">{e.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatEur(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IRPF estimado España</p>
            <p className="text-xs text-slate-500">Base anual {formatEur(Math.max(0, annualProfit))}</p>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{formatEur(irpf.total)}</p>
          <p className="text-xs text-slate-500">Tipo efectivo {(irpf.effectiveRate * 100).toFixed(1)}%</p>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {irpf.lines.map((l) => (
                <tr key={l.range}>
                  <td className="py-1.5 text-slate-600">{l.range}</td>
                  <td className="py-1.5 text-right font-semibold text-[#3b82f6]">{Math.round(l.rate * 100)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-900">{formatEur(l.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-slate-400">Estimación orientativa sobre el beneficio anual; no sustituye el cálculo de tu asesor fiscal.</p>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="financial-refresh-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h4 id="financial-refresh-title" className="text-lg font-bold text-slate-900">Actualizar datos financieros</h4>
            <p className="mt-2 text-sm text-slate-600">
              Pronto podrás sincronizar clientes y MRR desde Stripe y los gastos desde la contabilidad. De momento el panel muestra datos de ejemplo.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cerrar
              </button>
              <button type="button" disabled className="rounded-xl bg-[#3b82f6] px-4 py-2 text-sm font-semibold text-white opacity-50">
                Sincronizar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
