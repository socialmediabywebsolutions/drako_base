"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";

// Agente de Financiación IA. La búsqueda devuelve resultados mock hasta conectar el
// agente real; el pipeline lee /api/grants y, si está vacío, muestra filas de ejemplo.

type Grant = {
  id: string;
  title: string;
  region: string | null;
  deadline: string | null;
  budget_cents: number | null;
  requirements: string | null;
  link: string | null;
  status: string;
  created_at: string;
};

type FundingMatch = {
  id: string;
  name: string;
  amount: string;
  description: string;
  requirements: string[];
  url: string;
};

const MOCK_MATCHES: FundingMatch[] = [
  {
    id: "kit-digital",
    name: "Kit Digital",
    amount: "€12.000",
    description: "Bono para digitalizar pymes y autónomos: web, redes sociales, gestión de clientes, factura electrónica y ciberseguridad.",
    requirements: ["Pyme de 10 a 49 empleados", "Inscrita en Acelera pyme", "Al corriente con Hacienda y Seguridad Social"],
    url: "https://www.acelerapyme.gob.es/kit-digital",
  },
  {
    id: "cdti-neotec",
    name: "CDTI Neotec",
    amount: "Hasta €325.000",
    description: "Subvención para empresas de base tecnológica en sus primeros años, con un plan de empresa basado en I+D propia.",
    requirements: ["Pequeña empresa innovadora", "Constituida hace menos de 3 años", "Capital social mínimo de €20.000"],
    url: "https://www.cdti.es",
  },
  {
    id: "subvenciones-madrid",
    name: "Subvenciones Comunidad de Madrid",
    amount: "Hasta €50.000",
    description: "Ayudas regionales a la innovación y transformación digital de empresas con actividad en la Comunidad de Madrid.",
    requirements: ["Centro de trabajo en Madrid", "Proyecto de innovación o digitalización", "Cofinanciación propia del proyecto"],
    url: "https://www.comunidad.madrid",
  },
];

const MOCK_PIPELINE: Grant[] = [
  { id: "mock-1", title: "Kit Digital — Segmento I", region: "España", deadline: "2026-12-31", budget_cents: 1_200_000, requirements: null, link: "https://www.acelerapyme.gob.es/kit-digital", status: "candidate", created_at: "2026-09-15" },
  { id: "mock-2", title: "CDTI Neotec 2026", region: "España", deadline: "2026-11-20", budget_cents: 32_500_000, requirements: null, link: "https://www.cdti.es", status: "submitted", created_at: "2026-09-02" },
  { id: "mock-3", title: "Innovación Comunidad de Madrid", region: "Madrid", deadline: "2027-01-15", budget_cents: 5_000_000, requirements: null, link: "https://www.comunidad.madrid", status: "new", created_at: "2026-09-28" },
];

const STATUS_LABEL: Record<string, { label: string; badge: "neutral" | "info" | "warn" | "ok" | "err" }> = {
  new: { label: "Nuevo", badge: "neutral" },
  candidate: { label: "Candidato", badge: "info" },
  submitted: { label: "Enviado", badge: "warn" },
  won: { label: "Ganado", badge: "ok" },
  lost: { label: "Perdido", badge: "err" },
};

function formatEuros(cents: number | null): string {
  if (cents == null) return "—";
  return `€${Math.round(cents / 100).toLocaleString("es-ES")}`;
}

function formatDeadline(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function ResultSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex justify-between">
        <div className="h-5 w-40 rounded bg-slate-100" />
        <div className="h-5 w-20 rounded bg-slate-100" />
      </div>
      <div className="mb-2 h-3 w-full rounded bg-slate-100" />
      <div className="mb-4 h-3 w-4/5 rounded bg-slate-100" />
      <div className="h-8 w-32 rounded-xl bg-slate-100" />
    </div>
  );
}

export default function GrantsPage() {
  const [items, setItems] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<FundingMatch[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/grants", { cache: "no-store" });
      const data = (await res.json()) as { items?: Grant[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function search() {
    if (!description.trim()) return;
    setSearching(true);
    setMatches(null);
    window.setTimeout(() => {
      setMatches(MOCK_MATCHES);
      setSearching(false);
    }, 1800);
  }

  const pipeline = items.length ? items : MOCK_PIPELINE;
  const pipelineIsMock = items.length === 0;

  return (
    <div className="space-y-6">
      <Card tone="glass">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Agente de Financiación IA</h1>
          <span className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Beta</span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Describe tu empresa y el agente buscará ayudas, subvenciones y convocatorias públicas que encajen contigo.
        </p>

        <label className="mt-5 block text-xs font-semibold text-slate-500">
          Describe tu empresa
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Ej. Holding tecnológico en Madrid con 3 SaaS de IA, 4 empleados, constituido en 2025, buscamos financiar I+D y digitalización…"
            className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={search}
          disabled={searching || !description.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
        >
          {searching ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : <span aria-hidden>✨</span>}
          {searching ? "Buscando convocatorias…" : "Buscar con IA"}
        </button>
      </Card>

      {searching || matches ? (
        <Card title="Convocatorias recomendadas" subtitle={matches ? `${matches.length} oportunidades encajan con tu perfil` : "Analizando tu perfil…"}>
          <div className="grid gap-4 lg:grid-cols-3">
            {searching
              ? [0, 1, 2].map((i) => <ResultSkeleton key={i} />)
              : matches?.map((m) => (
                  <div key={m.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-slate-900">{m.name}</h3>
                      <span className="shrink-0 text-lg font-bold text-blue-600">{m.amount}</span>
                    </div>
                    <p className="text-sm text-slate-600">{m.description}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Requisitos</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                      {m.requirements.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex self-start rounded-xl border-2 border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                    >
                      Ver convocatoria
                    </a>
                  </div>
                ))}
          </div>
        </Card>
      ) : null}

      <Card title="Pipeline" subtitle={pipelineIsMock ? "Convocatorias en seguimiento (datos de ejemplo)" : "Convocatorias en seguimiento"}>
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando...</div>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Convocatoria</TH>
                  <TH>Estado</TH>
                  <TH>Fecha límite</TH>
                  <TH>Importe</TH>
                  <TH>Acciones</TH>
                </tr>
              </THead>
              <TBody>
                {pipeline.map((g) => {
                  const status = STATUS_LABEL[g.status] ?? { label: g.status, badge: "neutral" as const };
                  return (
                    <tr key={g.id}>
                      <TD className="font-medium">
                        {g.title}
                        {g.region ? <span className="block text-xs font-normal text-[var(--muted)]">{g.region}</span> : null}
                      </TD>
                      <TD><Badge variant={status.badge}>{status.label}</Badge></TD>
                      <TD>{formatDeadline(g.deadline)}</TD>
                      <TD>{formatEuros(g.budget_cents)}</TD>
                      <TD>
                        {g.link ? (
                          <a className="text-[var(--brand)] hover:underline" href={g.link} target="_blank" rel="noopener noreferrer">Ver convocatoria</a>
                        ) : "—"}
                      </TD>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
