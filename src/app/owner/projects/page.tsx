"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

type ProjectListItem = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProjectsResponse = {
  ok: boolean;
  items: ProjectListItem[];
};

type ProjectsFetchState = {
  loading: boolean;
  error: string | null;
  items: ProjectListItem[];
};

const INITIAL_STATE: ProjectsFetchState = {
  loading: true,
  error: null,
  items: [],
};

export default function OwnerProjectsPage() {
  const [state, setState] = useState<ProjectsFetchState>(INITIAL_STATE);
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");

  async function loadProjects() {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/projects", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      const data = (await res.json().catch(() => null)) as ProjectsResponse | null;
      if (!data?.ok) {
        throw new Error("Respuesta inválida del API");
      }
      setState({ loading: false, error: null, items: data.items });
    } catch (error) {
      setState({
        loading: false,
        items: [],
        error: error instanceof Error ? error.message : "No se pudieron cargar los proyectos",
      });
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  const companies = useMemo(() => {
    const unique = new Map<string, { id: string; count: number }>();
    state.items.forEach((item) => {
      if (!item.company_id) return;
      const entry = unique.get(item.company_id);
      if (entry) {
        entry.count += 1;
      } else {
        unique.set(item.company_id, { id: item.company_id, count: 1 });
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [state.items]);

  const filteredProjects = useMemo(() => {
    if (companyFilter === "ALL") return state.items;
    if (companyFilter === "UNASSIGNED") return state.items.filter((item) => !item.company_id);
    return state.items.filter((item) => item.company_id === companyFilter);
  }, [companyFilter, state.items]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Campamento Base · Projects</p>
          <h1 className="text-3xl font-semibold">Projects Factory</h1>
          <p className="text-sm text-[var(--muted)]">
            Revisa los proyectos activos por compañía y su estado dentro del tenant actual.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
            Compañía
            <select
              className="ml-2 rounded-full border border-[var(--border)]/70 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="ALL">Todas ({state.items.length})</option>
              <option value="UNASSIGNED">Sin compañía</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.id} · {company.count}
                </option>
              ))}
            </select>
          </label>
          <Link href="/owner/projects/create">
            <Button>Nuevo proyecto</Button>
          </Link>
          <Button variant="secondary" onClick={() => void loadProjects()} disabled={state.loading}>
            {state.loading ? "Actualizando…" : "Recargar"}
          </Button>
          <Link href="/owner">
            <Button variant="outline">Volver a Campamento</Button>
          </Link>
        </div>
      </header>

      <Card tone="glass" title="Resumen" subtitle="Estado del registro de proyectos">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryTile label="Total" value={state.items.length} />
          <SummaryTile label="Con compañía" value={state.items.filter((item) => item.company_id).length} />
          <SummaryTile label="Sin compañía" value={state.items.filter((item) => !item.company_id).length} />
        </div>
      </Card>

      <Card title="Projects" subtitle="Listado de proyectos registrados">
        {state.loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando proyectos…</p>
        ) : state.error ? (
          <p className="text-sm text-rose-400">{state.error}</p>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            title="Sin proyectos"
            subtitle={companyFilter === "ALL" ? "Cuando registres un proyecto aparecerá aquí." : "No hay proyectos para ese filtro."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)]">
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Slug</th>
                  <th className="py-2 pr-4">Compañía</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="border-t border-[var(--border)]/40">
                    <td className="py-3 pr-4">
                      <Link href={`/owner/projects/${project.id}`} className="font-semibold text-[var(--text)] hover:underline">
                        {project.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">ID: {project.id}</p>
                    </td>
                    <td className="py-3 pr-4">/{project.slug}</td>
                    <td className="py-3 pr-4 text-[var(--muted)]">
                      {project.company_id ? project.company_id : <span className="italic">Sin compañía</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={project.status === "active" ? "ok" : project.status === "archived" ? "neutral" : "warn"}>
                        {project.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[var(--muted)]">
                      {new Intl.DateTimeFormat("es-ES", DATE_FORMAT_OPTIONS).format(new Date(project.updated_at))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

type SummaryTileProps = {
  label: string;
  value: number;
};

function SummaryTile({ label, value }: SummaryTileProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/60 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</p>
    </div>
  );
}
