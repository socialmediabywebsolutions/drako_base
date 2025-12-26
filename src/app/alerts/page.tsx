"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";

type Alert = {
  id: string;
  severity: string;
  source: string;
  message: string;
  saas_id?: string | null;
  created_at: string;
};

const severityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const severityVariants: Record<string, "err" | "warn" | "info"> = {
  critical: "err",
  high: "err",
  medium: "warn",
  low: "info",
};

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get("tenantId") ?? "demo-tenant";
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string>("");
  const devProjectId = searchParams.get("devProjectId") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("tenantId", tenantId);
      if (severity) params.set("severity", severity);
      if (devProjectId) params.set("devProjectId", devProjectId);
      const qs = params.toString();
      const res = await fetch(`/api/alerts${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Alert[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las alertas");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado cargando alertas");
    } finally {
      setLoading(false);
    }
  }, [severity, devProjectId, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [items],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Operación</p>
          <h1 className="text-3xl font-semibold">Alertas</h1>
          <p className="text-sm text-[var(--muted)]">
            Monitoriza señales críticas del sistema y de tus proyectos SaaS.
          </p>
        </div>
        <Badge variant="outline">Tenant: {tenantId}</Badge>
      </div>

      <Card
        tone="glass"
        title="Filtros de alertas"
        subtitle="Enfócate en las señales con mayor impacto"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select aria-label="Filtrar por severidad" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Todas las severidades</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </Select>
        </div>
      </Card>

      <Card title="Timeline de alertas" subtitle="Últimas 200 alertas registradas">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando alertas...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Sin alertas registradas"
            subtitle="Cuando el sistema genere las primeras alertas aparecerán aquí"
          />
        ) : (
          <ul className="space-y-3" role="list" aria-live="polite">
            {ordered.map((a) => {
              const sevLabel = severityLabels[a.severity] ?? a.severity;
              const sevVariant = severityVariants[a.severity] ?? "info";
              return (
                <li
                  key={a.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/70 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{a.message}</p>
                      <p className="text-xs text-[var(--muted)]">Fuente: {a.source}</p>
                    </div>
                    <Badge variant={sevVariant}>{sevLabel}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                    {a.saas_id && <span>SaaS: {a.saas_id}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
