"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead } from "@/components/ui/table";

// CRM — Centro de Operaciones en /operator/socialflow. Lee /api/operator/crm (DRACO_DB:
// clients + client_saas + drako_crm_sales); "＋ Crear venta" hace POST a /api/clients
// con plan y notas.

type LeadStatus = "nuevo" | "activo" | "en_riesgo";

type CrmResponse = {
  ok: boolean;
  error?: string;
  metrics?: { activeClients: number; mrr: number; avgPlan: number; leadsThisWeek: number; churnRate: number };
  leads?: { id: string; name: string; email: string | null; plan: string | null; createdAt: string | null; status: LeadStatus }[];
};

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter — €29/mes" },
  { value: "pro", label: "Pro — €79/mes" },
  { value: "business", label: "Business — €199/mes" },
];

const STATUS_BADGE: Record<LeadStatus, { label: string; className: string }> = {
  nuevo: { label: "Nuevo", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  activo: { label: "Activo", className: "bg-blue-50 border-blue-200 text-blue-700" },
  en_riesgo: { label: "En riesgo", className: "bg-orange-50 border-orange-200 text-orange-700" },
};

const INPUT_CLASS =
  "mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none";

function formatEur(value: number): string {
  return `€${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function mailtoHref(email: string, name: string): string {
  const subject = encodeURIComponent(`${name}, ¿hablamos de tu estrategia en redes con Socialcors?`);
  const body = encodeURIComponent(`Hola ${name},\n\nTe escribo desde Socialcors para ver cómo podemos ayudarte con tus redes sociales.\n\nUn saludo,`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border-2 border-sky-100 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function CreateSaleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("starter");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, plan, email: email.trim() || null, notes }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      onCreated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la venta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="crm-sale-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h4 id="crm-sale-title" className="text-lg font-bold text-slate-900">Crear venta</h4>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-500">
            Nombre cliente
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="Ej. Clínica Dental Sonrisa" />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Plan
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={INPUT_CLASS}>
              {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} placeholder="contacto@empresa.com" />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            Notas
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={INPUT_CLASS} />
          </label>
        </div>
        {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CrmOperationsPanel() {
  const [data, setData] = useState<CrmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/crm", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as CrmResponse | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el CRM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = data?.metrics;
  const leads = data?.leads ?? [];

  return (
    <Card
      tone="default"
      title="CRM — Centro de Operaciones"
      subtitle="Clientes, ingresos y leads del holding, leídos de DRACO_DB"
      right={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
        >
          ＋ Crear venta
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clientes activos" value={loading ? "…" : String(metrics?.activeClients ?? 0)} />
        <MetricCard
          label="MRR estimado"
          value={loading ? "…" : formatEur(metrics?.mrr ?? 0)}
          hint={metrics?.avgPlan ? `Plan medio ${formatEur(metrics.avgPlan)}/mes` : undefined}
        />
        <MetricCard label="Leads esta semana" value={loading ? "…" : String(metrics?.leadsThisWeek ?? 0)} hint="Altas en los últimos 7 días" />
        <MetricCard label="Churn este mes" value={loading ? "…" : `${((metrics?.churnRate ?? 0) * 100).toFixed(1)}%`} />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Leads Calientes</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando clientes…</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay clientes. Registra el primero con &quot;＋ Crear venta&quot;.</p>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Cliente</TH>
                  <TH>Plan</TH>
                  <TH>Fecha alta</TH>
                  <TH>Estado</TH>
                  <TH>Acciones</TH>
                </tr>
              </THead>
              <TBody>
                {leads.map((lead) => {
                  const badge = STATUS_BADGE[lead.status];
                  return (
                    <tr key={lead.id}>
                      <TD className="font-medium">
                        {lead.name}
                        {lead.email ? <span className="block text-xs font-normal text-slate-500">{lead.email}</span> : null}
                      </TD>
                      <TD className="capitalize">{lead.plan ?? "—"}</TD>
                      <TD className="whitespace-nowrap">{formatDate(lead.createdAt)}</TD>
                      <TD>
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          {lead.email ? (
                            <a
                              href={mailtoHref(lead.email, lead.name)}
                              className="whitespace-nowrap rounded-lg border-2 border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              Enviar email
                            </a>
                          ) : (
                            <span className="whitespace-nowrap rounded-lg border-2 border-slate-100 px-3 py-1 text-xs font-semibold text-slate-300" title="Sin email registrado">
                              Enviar email
                            </span>
                          )}
                          <Link
                            href={`/clients/${encodeURIComponent(lead.id)}`}
                            className="whitespace-nowrap rounded-lg border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Ver perfil
                          </Link>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </div>

      {modalOpen ? (
        <CreateSaleModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            void load();
          }}
        />
      ) : null}
    </Card>
  );
}
