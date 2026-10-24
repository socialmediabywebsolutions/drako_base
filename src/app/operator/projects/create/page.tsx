"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";

type CompanyOption = {
  id: string;
  name: string;
  slug: string | null;
};

type CompaniesResponse = {
  ok: boolean;
  companies: Array<{
    id: string;
    name: string;
    slug: string | null;
    created_at: string | null;
  }>;
};

type CreatePayload = {
  ok: boolean;
  item: {
    project: {
      id: string;
      name: string;
      slug: string;
      company_id: string | null;
      status: string;
      created_at: string;
    };
  };
};

type FormState = {
  name: string;
  companyId: string;
  slug: string;
};

type UiState = {
  submitting: boolean;
  error: string | null;
  successMessage: string | null;
};

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateProjectPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesState, setCompaniesState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });
  const [form, setForm] = useState<FormState>({ name: "", companyId: "", slug: "" });
  const [uiState, setUiState] = useState<UiState>({ submitting: false, error: null, successMessage: null });

  useEffect(() => {
    let active = true;
    async function loadCompanies() {
      setCompaniesState({ loading: true, error: null });
      try {
        const res = await fetch("/api/companies", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        const data = (await res.json().catch(() => null)) as CompaniesResponse | null;
        if (!data?.ok) {
          throw new Error("Respuesta inválida del API de compañías");
        }
        if (!active) return;
        const options = data.companies.map((company) => ({ id: company.id, name: company.name, slug: company.slug }));
        setCompanies(options);
      } catch (error) {
        if (!active) return;
        setCompaniesState({ loading: false, error: error instanceof Error ? error.message : "No se pudieron cargar las compañías" });
        return;
      }
      if (!active) return;
      setCompaniesState({ loading: false, error: null });
    }
    void loadCompanies();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!form.slug && form.name.trim()) {
      setForm((prev) => ({ ...prev, slug: toSlug(form.name) }));
    }
  }, [form.name, form.slug]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUiState({ submitting: true, error: null, successMessage: null });
    try {
      const payload = {
        name: form.name.trim(),
        company_id: form.companyId ? form.companyId : undefined,
        slug: form.slug.trim() || undefined,
      };

      if (!payload.name) {
        throw new Error("El nombre es obligatorio");
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? `Error ${res.status}`);
      }

      const data = (await res.json().catch(() => null)) as CreatePayload | null;
      if (!data?.ok || !data.item?.project?.id) {
        throw new Error("Respuesta inválida del API de creación");
      }

      setUiState({ submitting: false, error: null, successMessage: "Proyecto creado correctamente" });
      router.replace(`/operator/projects/${data.item.project.id}`);
    } catch (error) {
      setUiState({
        submitting: false,
        successMessage: null,
        error: error instanceof Error ? error.message : "No se pudo crear el proyecto",
      });
    }
  }

  const selectedCompany = useMemo(() => {
    if (!form.companyId) return null;
    return companies.find((company) => company.id === form.companyId) ?? null;
  }, [companies, form.companyId]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Operator · Projects</p>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Crear nuevo proyecto</h1>
          <p className="text-sm text-[var(--muted)]">
            Define el nombre, compañía y slug; podrás ajustar dominios y entitlements más adelante.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </header>

      <Card tone="glass" title="Formulario de creación" subtitle="Completa los datos básicos">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]" htmlFor="project-name">
              Nombre del proyecto
            </label>
            <TextInput
              id="project-name"
              placeholder="Ej. Campaña Primavera"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              disabled={uiState.submitting}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]" htmlFor="project-company">
              Compañía (opcional)
            </label>
            {companiesState.loading ? (
              <p className="text-sm text-[var(--muted)]">Cargando compañías…</p>
            ) : companiesState.error ? (
              <EmptyState title="No disponible" subtitle={companiesState.error} />
            ) : companies.length === 0 ? (
              <EmptyState title="Sin compañías" subtitle="Puedes crear proyectos sin compañía asociada." />
            ) : (
              <select
                id="project-company"
                className="w-full rounded-2xl border border-[var(--border)]/60 bg-transparent px-3 py-2 text-sm text-[var(--text)]"
                value={form.companyId}
                onChange={(event) => setForm((prev) => ({ ...prev, companyId: event.target.value }))}
                disabled={uiState.submitting}
              >
                <option value="">Sin compañía</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} · {company.id}
                  </option>
                ))}
              </select>
            )}
            {selectedCompany ? (
              <p className="text-xs text-[var(--muted)]">
                Seleccionado: {selectedCompany.name} ({selectedCompany.id})
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]" htmlFor="project-slug">
              Slug (opcional, auto-generado)
            </label>
            <TextInput
              id="project-slug"
              placeholder="campana-primavera"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))}
              disabled={uiState.submitting}
            />
            <p className="text-xs text-[var(--muted)]">
              Se usará como identificador público. Se autocompleta desde el nombre si lo dejas vacío.
            </p>
          </div>

          {uiState.error ? <p className="text-sm text-rose-400">{uiState.error}</p> : null}
          {uiState.successMessage ? <p className="text-sm text-emerald-400">{uiState.successMessage}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={uiState.submitting}>
              {uiState.submitting ? "Creando…" : "Crear proyecto"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setForm({ name: "", companyId: "", slug: "" })} disabled={uiState.submitting}>
              Limpiar
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Consejo rápido" subtitle="Asegúrate de que el slug sea único">
        <p className="text-sm text-[var(--muted)]">
          Si el slug ya existe para este tenant, se añadirá un sufijo automático. Podrás ajustar dominios y packs tras la creación.
        </p>
      </Card>
    </div>
  );
}
