"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";

// Ayudas y Subvenciones: tabla de drako_funding_opportunities (DRACO_DB) que llena el
// Agente de Financiación de drako-scheduler cada lunes a las 08:00 UTC.
// "Ejecutar ahora" llama a /api/cron/funding con la sesión del operator (cookies),
// nunca con CRON_SECRET: cualquier secreto en este bundle sería público.

type FundingOpportunity = {
  id: number;
  title: string;
  organism: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  url: string | null;
  tags: string[];
  source: string | null;
  status: string;
  created_at: string;
};

type ListResponse = { ok: boolean; items?: FundingOpportunity[]; page?: number; totalPages?: number; error?: string };

const PORTALS = [
  { name: "Oficina Nacional de Emprendimiento", short: "ONE", url: "https://one.gob.es/es/buscador-de-ayudas-e-incentivos-para-empresas", tone: "from-blue-500 to-blue-600" },
  { name: "Plan de Recuperación", short: "PRTR", url: "https://planderecuperacion.gob.es/asistente-de-busqueda-de-convocatorias", tone: "from-cyan-500 to-blue-500" },
  { name: "Portal PYME (Ipyme)", short: "PYME", url: "https://ipyme.org/es-es/AyudasIncentivos/Paginas/buscador-de-ayudas.aspx", tone: "from-sky-500 to-cyan-500" },
];

const STATUS_STYLE: Record<string, string> = {
  nueva: "bg-blue-50 text-blue-700 border-blue-200",
  "en proceso": "bg-amber-50 text-amber-700 border-amber-200",
  descartada: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatEur(value: number): string {
  return `€${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatAmount(min: number | null, max: number | null): string {
  if (min != null && max != null) return min === max ? formatEur(max) : `${formatEur(min)} – ${formatEur(max)}`;
  if (max != null) return `Hasta ${formatEur(max)}`;
  if (min != null) return `Desde ${formatEur(min)}`;
  return "—";
}

function formatDeadline(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export default function GrantsPage() {
  const [items, setItems] = useState<FundingOpportunity[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<number | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/funding/opportunities?page=${targetPage}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as ListResponse | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las oportunidades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [load, page]);

  async function runNow() {
    setRunning(true);
    setRunMessage(null);
    try {
      const res = await fetch("/api/cron/funding", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; inserted?: number; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setRunMessage(`${data.inserted ?? 0} oportunidades nuevas`);
      setPage(1);
      await load(1);
    } catch (runError) {
      setRunMessage(runError instanceof Error ? `Error: ${runError.message}` : "Error al ejecutar el agente");
    } finally {
      setRunning(false);
    }
  }

  async function discard(id: number) {
    setDiscarding(id);
    try {
      const res = await fetch(`/api/funding/opportunities?id=${id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "descartada" } : item)));
    } finally {
      setDiscarding(null);
    }
  }

  const runButton = (
    <button
      type="button"
      onClick={runNow}
      disabled={running}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-70"
    >
      {running ? <Spinner /> : null}
      {running ? "Buscando convocatorias…" : "Ejecutar ahora"}
    </button>
  );

  return (
    <div className="space-y-6">
      <Card tone="glass">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">Ayudas y Subvenciones</h1>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-700">
                Actualizado automáticamente · Lunes 08:00 UTC
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">El agente busca convocatorias cada semana en portales oficiales del Estado</p>
          </div>
          {items.length ? runButton : null}
        </div>
        {runMessage ? <p className="mt-3 text-sm text-slate-600">{runMessage}</p> : null}
      </Card>

      <Card title="Oportunidades" subtitle="Convocatorias detectadas por el agente, más recientes primero">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Spinner /> Cargando oportunidades…</div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-sm text-slate-600">El agente aún no ha ejecutado. Próxima búsqueda: lunes 08:00 UTC</p>
            {runButton}
          </div>
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Convocatoria</TH>
                    <TH>Organismo</TH>
                    <TH>Importe</TH>
                    <TH>Plazo</TH>
                    <TH>Estado</TH>
                    <TH>Acciones</TH>
                  </tr>
                </THead>
                <TBody>
                  {items.map((o) => (
                    <tr key={o.id} className={o.status === "descartada" ? "opacity-60" : undefined}>
                      <TD className="font-medium">
                        {o.title}
                        {o.description ? <span className="block max-w-md text-xs font-normal text-[var(--muted)]">{o.description}</span> : null}
                        {o.source?.startsWith("simulado:") ? (
                          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Simulada · verificar en {o.source.slice("simulado:".length)}
                          </span>
                        ) : null}
                      </TD>
                      <TD>{o.organism}</TD>
                      <TD className="whitespace-nowrap">{formatAmount(o.amount_min, o.amount_max)}</TD>
                      <TD className="whitespace-nowrap">{formatDeadline(o.deadline)}</TD>
                      <TD>
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status] ?? STATUS_STYLE.descartada}`}>
                          {o.status}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          {o.url ? (
                            <a
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whitespace-nowrap rounded-lg border-2 border-blue-500 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              Ver convocatoria
                            </a>
                          ) : null}
                          {o.status !== "descartada" ? (
                            <button
                              type="button"
                              onClick={() => discard(o.id)}
                              disabled={discarding === o.id}
                              className="whitespace-nowrap rounded-lg border-2 border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {discarding === o.id ? "Descartando…" : "Descartar"}
                            </button>
                          ) : null}
                        </div>
                      </TD>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            {totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-end gap-3 text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border-2 border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-40">
                  Anterior
                </button>
                <span className="text-slate-500">Página {page} de {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border-2 border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-40">
                  Siguiente
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Buscar manualmente en los portales oficiales</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PORTALS.map((portal) => (
            <div key={portal.url} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${portal.tone} text-[10px] font-black text-white`}>
                {portal.short}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{portal.name}</p>
                <a href={portal.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline">
                  Buscar manualmente →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
