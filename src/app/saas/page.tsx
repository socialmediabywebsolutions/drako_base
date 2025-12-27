"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Tooltip from "@/components/ui/tooltip";
import Select from "@/components/ui/select";
import { TextInput } from "@/components/ui/input";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import EmptyState from "@/components/ui/empty-state";

type Saas = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  created_at: string;
};

type Provision = {
  id: string;
  saas_id: string;
  step: string;
  status: string;
  details: string | null;
  created_at: string;
};

function normalizeProvisioningStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "success") return "completed";
  if (normalized === "error") return "failed";
  return normalized;
}

export default function SaasPage() {
  const router = useRouter();
  const [items, setItems] = useState<Saas[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loadingProv, setLoadingProv] = useState(true);
  const [provisionMessage, setProvisionMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [pSaasId, setPSaasId] = useState<string>("");
  const [pStep, setPStep] = useState<string>("pages_project");
  const [pStatus, setPStatus] = useState<string>("pending");
  const [pDetails, setPDetails] = useState<string>("");

  useEffect(() => {
    (async () => {
      setErrorMessage(null);
      try {
        const res = await fetch("/api/saas", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { items?: Saas[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "No se pudo cargar el listado de SaaS.");
        }
        setItems(data.items ?? []);
      } catch (error) {
        console.error(error);
        setErrorMessage(error instanceof Error ? error.message : "Error cargando los proyectos SaaS.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingProv(true);
      setProvisionMessage(null);
      try {
        const res = await fetch("/api/provisioning", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { items?: Provision[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "No se pudo cargar el timeline de provisión.");
        }
        setProvisions(data.items ?? []);
      } catch (error) {
        console.error(error);
        setProvisionMessage(error instanceof Error ? error.message : "Error cargando provisión.");
      } finally {
        setLoadingProv(false);
      }
    })();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((s) => {
      const byStatus = statusFilter ? s.status === statusFilter : true;
      const bySearch = searchTerm
        ? [s.name, s.slug, s.domain, s.subdomain].some((value) => value?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      return byStatus && bySearch;
    });
  }, [items, statusFilter, searchTerm]);

  const saasSummary = useMemo(() => {
    const total = items.length;
    const activos = items.filter((s) => s.status === "active").length;
    const enProvision = items.filter((s) => s.status === "inactive" || s.status === "pending").length;
    const incidencia = items.filter((s) => s.status === "failed").length;
    return { total, activos, enProvision, incidencia };
  }, [items]);

  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title="Proyectos SaaS"
        subtitle="Gestiona dominios, provisión y estado operativo"
        right={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setStatusFilter(""); setSearchTerm(""); }}>Limpiar filtros</Button>
            <Link href="/saas/create"><Button variant="primary">Nuevo SaaS</Button></Link>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4" role="region" aria-label="Resumen de proyectos">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4" aria-live="polite">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Total</p>
            <p className="text-2xl font-semibold">{saasSummary.total}</p>
            <p className="text-xs text-[var(--muted)]">Proyectos registrados</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4" aria-live="polite">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Activos</p>
            <p className="text-2xl font-semibold text-emerald-400">{saasSummary.activos}</p>
            <p className="text-xs text-[var(--muted)]">SaaS en producción</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4" aria-live="polite">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">En provisión</p>
            <p className="text-2xl font-semibold text-sky-400">{saasSummary.enProvision}</p>
            <p className="text-xs text-[var(--muted)]">Pendientes de despliegue</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4" aria-live="polite">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Incidencias</p>
            <p className="text-2xl font-semibold text-rose-400">{saasSummary.incidencia}</p>
            <p className="text-xs text-[var(--muted)]">Revisar alertas</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[2fr,1fr] mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <TextInput aria-label="Buscar proyectos" placeholder="Buscar por nombre, slug o dominio" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="pending">Pendiente</option>
              <option value="failed">Incidencia</option>
            </Select>
            <Button variant="secondary" onClick={() => { setSearchTerm(""); setStatusFilter(""); }} aria-label="Reiniciar filtros">
              Reiniciar
            </Button>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4 text-sm text-[var(--muted)]">
            <p className="text-xs uppercase tracking-[0.3em]">Consejo</p>
            <p>Filtra por estado para concentrar recursos en los despliegues críticos.</p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}
        {provisionMessage && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {provisionMessage}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-[var(--muted)]">Cargando listado...</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState title="Sin proyectos" subtitle="Crea tu primer SaaS para comenzar">
            <Link href="/saas/create"><Button variant="primary">Crear SaaS</Button></Link>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Nombre</TH>
                  <TH>Slug</TH>
                  <TH>Dominio</TH>
                  <TH>Estado</TH>
                  <TH>Provisionamiento</TH>
                  <TH>Creado</TH>
                </tr>
              </THead>
              <TBody>
                {filteredItems.map((s) => {
                  const list = provisions.filter((p) => p.saas_id === s.id);
                  let derivado: ReactNode = <Badge variant="neutral">-</Badge>;
                  const normalizedStatuses = list.map((p) => normalizeProvisioningStatus(p.status));
                  if (normalizedStatuses.some((status) => status === "failed") || list.some((p) => p.step === "failed")) {
                    derivado = <Badge variant="err">fallido</Badge>;
                  } else if (list.some((p) => p.step === "done") && normalizedStatuses.some((status) => status === "completed")) {
                    derivado = <Badge variant="ok">operativo</Badge>;
                  } else if (normalizedStatuses.some((status) => status === "running")) {
                    derivado = <Badge variant="info">en curso</Badge>;
                  }
                  else if (list.length > 0) derivado = <Badge variant="warn">pendiente</Badge>;
                  return (
                    <tr key={s.id} className="cursor-pointer hover:bg-[var(--brand-quiet)]/30" onClick={() => router.push(`/saas/${s.id}`)}>
                      <TD className="font-semibold text-[var(--foreground)]">{s.name}</TD>
                      <TD>{s.slug}</TD>
                      <TD>{s.domain ?? s.subdomain ?? "-"}</TD>
                      <TD>
                        <Tooltip label={`Estado operativo: ${s.status}`}>
                          <Badge variant="neutral">{s.status}</Badge>
                        </Tooltip>
                      </TD>
                      <TD>
                        <Tooltip label="Resultado del timeline de provisión">
                          {derivado}
                        </Tooltip>
                      </TD>
                      <TD>{new Date(s.created_at).toLocaleString()}</TD>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card title="Timeline de provisión" subtitle="Registra pasos y sincroniza equipos">
        <div className="mb-4 grid gap-2 md:grid-cols-5">
          <Select value={pSaasId} onChange={(e) => setPSaasId(e.target.value)}>
            <option value="">Selecciona SaaS</option>
            {items.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.slug})</option>))}
          </Select>
          <Select value={pStep} onChange={(e) => setPStep(e.target.value)}>
            <option value="pages_project">Proyecto Pages</option>
            <option value="domain">Dominio</option>
            <option value="connect">Integraciones</option>
            <option value="done">Operativo</option>
            <option value="failed">Incidencia</option>
          </Select>
          <Select value={pStatus} onChange={(e) => setPStatus(e.target.value)}>
            <option value="pending">Pendiente</option>
            <option value="running">En curso</option>
            <option value="completed">Completado</option>
            <option value="failed">Fallido</option>
          </Select>
          <TextInput placeholder="Detalles o enlaces" value={pDetails} onChange={(e) => setPDetails(e.target.value)} />
          <Button
            variant="secondary"
            onClick={async () => {
              if (!pSaasId) return;
              await fetch("/api/provisioning", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ saas_id: pSaasId, step: pStep, status: pStatus, details: pDetails || null }) });
              setPDetails("");
              const res = await fetch("/api/provisioning", { cache: "no-store" });
              const data = (await res.json()) as { items?: Provision[] };
              setProvisions(data.items ?? []);
            }}
          >Añadir paso</Button>
        </div>
        {loadingProv ? (
          <div className="text-sm text-[var(--muted)]">Cargando timeline...</div>
        ) : provisions.length === 0 ? (
          <EmptyState title="Sin registros" subtitle="Aún no se registran pasos de provisión" />
        ) : (
          <ul className="space-y-3">
            {provisions.map((p) => (
              <li key={p.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 flex flex-wrap gap-3 items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{p.step}</p>
                  <p className="text-xs text-[var(--muted)]">Estado {p.status} • SaaS {p.saas_id}</p>
                  <p className="text-sm text-[var(--foreground)] break-words">{p.details ?? "Sin detalles"}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Button variant="outline" size="sm"
                    onClick={async () => {
                      await fetch("/api/provisioning", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, status: "completed" }) });
                      const res = await fetch("/api/provisioning", { cache: "no-store" });
                      const data = (await res.json()) as { items?: Provision[] };
                      setProvisions(data.items ?? []);
                    }}
                  >Marcar listo</Button>
                  <Button variant="outline" size="sm"
                    onClick={async () => {
                      await fetch("/api/provisioning", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, status: "failed" }) });
                      const res = await fetch("/api/provisioning", { cache: "no-store" });
                      const data = (await res.json()) as { items?: Provision[] };
                      setProvisions(data.items ?? []);
                    }}
                  >Reportar fallo</Button>
                  <span className="text-[var(--muted)]">{new Date(p.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
