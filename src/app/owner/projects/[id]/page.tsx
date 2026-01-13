"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import Tooltip from "@/components/ui/tooltip";
import { TextInput } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", DATE_FORMAT_OPTIONS).format(new Date(value));
  } catch {
    return value;
  }
}

type AddDomainFormProps = {
  domain: string;
  onDomainChange: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
};

function AddDomainForm({ domain, onDomainChange, loading, onSubmit }: AddDomainFormProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-4 shadow-inner shadow-[var(--border)]/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Nuevo dominio</label>
          <TextInput
            placeholder="example.com"
            value={domain}
            onChange={(event) => onDomainChange(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-[var(--muted)]">Debe apuntar al registro CNAME indicado por Campamento Base.</p>
        </div>
        <Button onClick={onSubmit} loading={loading} disabled={loading} className="md:self-stretch">
          {loading ? "Guardando" : "Agregar dominio"}
        </Button>
      </div>
    </div>
  );
}

type DomainsSectionProps = {
  state: DomainsState;
  verifyingId: string | null;
  onReload: () => void;
  onAddRequest: () => void;
  onVerify: (domainId: string) => Promise<void>;
};

function DomainsSection({ state, verifyingId, onReload, onAddRequest, onVerify }: DomainsSectionProps) {
  if (state.status === "loading" && state.items.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Cargando dominios…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-400/40 bg-rose-100/20 p-4 text-sm text-rose-900">
        <p className="mb-3 font-semibold">{state.error}</p>
        <Button variant="secondary" size="sm" onClick={onReload}>
          Reintentar carga
        </Button>
      </div>
    );
  }

  const items = state.items;
  if (items.length === 0) {
    return (
      <EmptyState title="Aún no hay dominios" subtitle="Registra el primero para comenzar la verificación.">
        <Button variant="secondary" size="sm" onClick={onAddRequest}>
          Sugerir dominio
        </Button>
      </EmptyState>
    );
  }

  return (
    <TableWrap>
      <Table>
        <THead>
          <tr className="text-left text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            <TH>Dominio</TH>
            <TH>Estado</TH>
            <TH>Último error</TH>
            <TH>Registrado</TH>
            <TH></TH>
          </tr>
        </THead>
        <TBody>
          {items.map((item) => {
            const statusLabel = getStatusLabel(item.status);
            const variant = getStatusBadgeVariant(item.status);
            const canVerify = ["pending", "error", "failed"].includes(item.status.toLowerCase());
            const showRetry = item.status.toLowerCase() === "error" || item.status.toLowerCase() === "failed";
            const isVerifying = verifyingId === item.id;
            const displayError = item.lastError ? truncate(item.lastError, 48) : "—";
            const errorContent = item.lastError ? (
              <Tooltip label={item.lastError}>
                <span className="max-w-xs truncate font-mono text-xs text-rose-500">{displayError}</span>
              </Tooltip>
            ) : (
              <span className="text-xs text-[var(--muted)]">Sin errores</span>
            );

            return (
              <tr key={item.id} className="border-t border-[var(--border)]/50">
                <TD className="py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.domain}</p>
                    <p className="text-xs text-[var(--muted)]">ID: {item.id}</p>
                  </div>
                </TD>
                <TD>
                  <Badge variant={variant}>{statusLabel}</Badge>
                </TD>
                <TD>{errorContent}</TD>
                <TD>
                  <p className="text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</p>
                  {item.updatedAt ? <p className="text-[10px] uppercase text-[var(--muted)]">Update: {formatDate(item.updatedAt)}</p> : null}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-2">
                    {canVerify ? (
                      <Button size="sm" variant="outline" onClick={() => void onVerify(item.id)} loading={isVerifying}>
                        Verify
                      </Button>
                    ) : null}
                    {showRetry ? (
                      <Button size="sm" variant="ghost" onClick={() => void onVerify(item.id)} disabled={isVerifying}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}

type ProjectDomainApi = {
  id: string;
  domain: string;
  status: string;
  verificationToken: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type ProjectDetailApi = {
  ok: boolean;
  item: {
    project: {
      id: string;
      tenant_id: string;
      company_id: string | null;
      name: string;
      slug: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    domains: Array<{
      id: string;
      tenant_id: string;
      project_id: string;
      domain: string;
      status: string;
      verification_token: string | null;
      last_error: string | null;
      created_at: string;
      updated_at: string | null;
    }>;
    entitlements: {
      enabledPacks: string[];
      enabledFeatures: string[];
      limits: Record<string, number>;
      metadata: Record<string, unknown> | null;
      updatedAt: string | null;
    };
  };
};

type DetailState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProjectDetailApi["item"] };

type DomainsState =
  | { status: "idle" | "loading"; items: ProjectDomainApi[]; error: null }
  | { status: "error"; items: ProjectDomainApi[]; error: string }
  | { status: "ready"; items: ProjectDomainApi[]; error: null };

function normalizeDomainRecord(record: ProjectDetailApi["item"]["domains"][number]): ProjectDomainApi {
  return {
    id: record.id,
    domain: record.domain,
    status: record.status,
    verificationToken: record.verification_token ?? null,
    lastError: record.last_error ?? null,
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? null,
  };
}

function sanitizeDomainInput(input: string): string {
  return input.trim().toLowerCase();
}

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: "Pendiente",
  verified: "Verificado",
  active: "Activo",
  error: "Error",
  failed: "Error",
};

function getStatusLabel(status: string): string {
  const key = status.toLowerCase();
  return STATUS_LABEL_MAP[key] ?? status;
}

function getStatusBadgeVariant(status: string): "ok" | "warn" | "neutral" | "err" | "info" {
  const key = status.toLowerCase();
  if (key === "verified" || key === "active") return "ok";
  if (key === "pending") return "warn";
  if (key === "error" || key === "failed") return "err";
  return "neutral";
}

function truncate(value: string, max = 42): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export default function OwnerProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [domainsState, setDomainsState] = useState<DomainsState>({ status: "idle", items: [], error: null });
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const projectId = params?.id;

  const loadDomains = useCallback(
    async (targetProjectId: string) => {
      setDomainsState((prev) => ({ status: "loading", items: prev.items, error: null }));
      try {
        const res = await fetch(`/api/projects/${targetProjectId}/domains`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; items?: ProjectDomainApi[] } | null;
        if (!payload?.ok || !Array.isArray(payload.items)) {
          throw new Error("Respuesta inválida del API de domains");
        }
        setDomainsState({ status: "ready", items: payload.items, error: null });
      } catch (error) {
        setDomainsState({
          status: "error",
          items: [],
          error: error instanceof Error ? error.message : "No se pudieron cargar los dominios",
        });
      }
    },
    [],
  );

  const fetchProjectDetail = useCallback(async () => {
    if (!projectId) {
      throw new Error("Identificador del proyecto no encontrado");
    }
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (res.status === 404) {
      throw new Error("Proyecto no encontrado");
    }
    if (!res.ok) {
      throw new Error(`Error ${res.status}`);
    }
    const json = (await res.json().catch(() => null)) as ProjectDetailApi | null;
    if (!json?.ok || !json.item) {
      throw new Error("Respuesta inválida del API");
    }
    return json.item;
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchProjectDetail()
      .then((item) => {
        if (cancelled) return;
        setState({ status: "ready", data: item });
        setDomainsState({ status: "ready", items: item.domains.map(normalizeDomainRecord), error: null });
        void loadDomains(item.project.id);
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "No se pudo cargar el proyecto" });
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProjectDetail, loadDomains]);

  const headerTitle = state.status === "ready" ? state.data.project.name : "Project";
  const statusBadge = useMemo(() => {
    if (state.status !== "ready") return { label: "—", variant: "neutral" as const };
    const status = state.data.project.status?.toLowerCase();
    if (status === "active") return { label: "Activo", variant: "ok" as const };
    if (status === "archived") return { label: "Archivado", variant: "neutral" as const };
    return { label: state.data.project.status ?? "Desconocido", variant: "warn" as const };
  }, [state]);

  let body: React.ReactNode;
  if (state.status === "loading" || state.status === "idle") {
    body = (
      <Card tone="glass" title="Cargando proyecto" subtitle="Un momento…">
        <p className="text-sm text-[var(--muted)]">Obteniendo detalle desde la API.</p>
      </Card>
    );
  } else if (state.status === "error") {
    body = (
      <Card tone="glass" title="Error" subtitle="No se pudo recuperar la información">
        <p className="text-sm text-rose-400">{state.message}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/owner/projects")}>Volver a la lista</Button>
          <Button
            onClick={() => {
              if (projectId) {
                setState({ status: "loading" });
                void fetch(`/api/projects/${projectId}`, { cache: "no-store" })
                  .then(async (res) => {
                    if (!res.ok) throw new Error(`Error ${res.status}`);
                    const json = (await res.json().catch(() => null)) as ProjectDetailApi | null;
                    if (!json?.ok || !json.item) throw new Error("Respuesta inválida del API");
                    setState({ status: "ready", data: json.item });
                  })
                  .catch((error) => {
                    setState({
                      status: "error",
                      message: error instanceof Error ? error.message : "No se pudo recargar",
                    });
                  });
              }
            }}
          >
            Reintentar
          </Button>
        </div>
      </Card>
    );
  } else if (state.status === "ready") {
    const detail = state.data;
    body = (
      <>
        <Card tone="glass" title="Metadata" subtitle="Información principal">
          <div className="grid gap-4 md:grid-cols-3">
            <MetadataTile label="Estado">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            </MetadataTile>
            <MetadataTile label="Compañía">
              {detail.project.company_id ? detail.project.company_id : <span className="italic">Sin compañía</span>}
            </MetadataTile>
            <MetadataTile label="Slug">/{detail.project.slug}</MetadataTile>
            <MetadataTile label="Tenant">{detail.project.tenant_id}</MetadataTile>
            <MetadataTile label="Creado">{formatDate(detail.project.created_at)}</MetadataTile>
            <MetadataTile label="Actualizado">{formatDate(detail.project.updated_at)}</MetadataTile>
          </div>
        </Card>

        <Card
          title="Domains"
          subtitle="Gestión de dominios personalizados"
          right={<span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{domainsState.items.length} registrados</span>}
        >
          <div className="space-y-6">
            <AddDomainForm
              domain={newDomain}
              onDomainChange={setNewDomain}
              loading={adding}
              onSubmit={async () => {
                if (!projectId) {
                  setFeedback({ type: "error", message: "Proyecto no disponible" });
                  return;
                }
                const normalized = sanitizeDomainInput(newDomain);
                if (!normalized) {
                  setFeedback({ type: "error", message: "El dominio es obligatorio." });
                  return;
                }
                if (!normalized.includes(".")) {
                  setFeedback({ type: "error", message: "El dominio debe contener un punto." });
                  return;
                }
                setAdding(true);
                setFeedback(null);
                try {
                  const res = await fetch(`/api/projects/${projectId}/domains`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({ domain: normalized }),
                  });
                  const payload = (await res.json().catch(() => null)) as { ok?: boolean; duplicated?: boolean; error?: string } | null;
                  if (!res.ok || !payload?.ok) {
                    throw new Error(payload?.error ?? "No se pudo registrar el dominio.");
                  }
                  setNewDomain("");
                  await loadDomains(projectId);
                  setFeedback({
                    type: "success",
                    message: payload.duplicated ? "El dominio ya existía y se reutilizó." : "Dominio añadido correctamente.",
                  });
                } catch (error) {
                  setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo registrar el dominio." });
                } finally {
                  setAdding(false);
                }
              }}
            />

            {feedback ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-400/40 bg-emerald-100/20 text-emerald-900"
                    : "border-rose-400/60 bg-rose-100/30 text-rose-900"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}

            <DomainsSection
              state={domainsState}
              verifyingId={verifying}
              onReload={() => projectId && loadDomains(projectId)}
              onAddRequest={() => setNewDomain((current) => current || "example.com")}
              onVerify={async (domainId) => {
                if (!projectId) return;
                setVerifying(domainId);
                setFeedback(null);
                try {
                  const res = await fetch(`/api/projects/${projectId}/domains/verify`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({ domainId }),
                  });
                  const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
                  if (!res.ok || !payload?.ok) {
                    throw new Error(payload?.error ?? "Verificación fallida");
                  }
                  await loadDomains(projectId);
                  setFeedback({ type: "success", message: "Verificación solicitada. Revisa el estado en unos minutos." });
                } catch (error) {
                  setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo verificar el dominio." });
                } finally {
                  setVerifying(null);
                }
              }}
            />
          </div>
        </Card>

        <Card title="Entitlements" subtitle="Packs y funcionalidades asignadas">
          <div className="grid gap-4 md:grid-cols-2">
            <MetadataTile label="Última actualización">{formatDate(detail.entitlements.updatedAt)}</MetadataTile>
            <MetadataTile label="Total funcionalidades">
              {detail.entitlements.enabledFeatures.length + detail.entitlements.enabledPacks.length}
            </MetadataTile>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Packs</h3>
              {detail.entitlements.enabledPacks.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Sin packs asignados.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
                  {detail.entitlements.enabledPacks.map((pack) => (
                    <li key={pack} className="rounded-full border border-[var(--border)]/50 px-4 py-2">
                      {pack}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">Features</h3>
              {detail.entitlements.enabledFeatures.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Sin funcionalidades asignadas.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-[var(--text)]">
                  {detail.entitlements.enabledFeatures.map((feature) => (
                    <li key={feature} className="rounded-full border border-[var(--border)]/50 px-4 py-2">
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </>
    );
  } else {
    body = null;
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Campamento Base · Projects</p>
          <h1 className="text-3xl font-semibold text-[var(--text)]">{headerTitle}</h1>
          <p className="text-sm text-[var(--muted)]">Detalle del proyecto y sus recursos asociados.</p>
          {projectId ? <p className="text-xs text-[var(--muted)]">ID: {projectId}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>Regresar</Button>
          <Link href="/owner/projects">
            <Button variant="secondary">Ver lista</Button>
          </Link>
        </div>
      </header>

      {body}
    </div>
  );
}

type MetadataTileProps = {
  label: string;
  children: React.ReactNode;
};

function MetadataTile({ label, children }: MetadataTileProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/50 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-sm text-[var(--text)]">{children}</div>
    </div>
  );
}
