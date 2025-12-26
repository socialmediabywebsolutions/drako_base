"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { TextInput } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import { TableWrap, Table, THead, TBody, TH, TD } from "@/components/ui/table";
import { useSearchParams } from "next/navigation";

type Agent = {
  id: string;
  name: string;
  department_id: string;
  provider: string | null;
  model: string | null;
  active: number;
  created_at: string;
};

type CoreAgent = {
  id: string;
  department_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
};

type TabKey = "configured" | "catalog";

export default function AgentsPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get("tenantId") ?? "demo-tenant";
  const [activeTab, setActiveTab] = useState<TabKey>("configured");

  // Configured agents (tenant instances)
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsMessage, setAgentsMessage] = useState<string | null>(null);
  const [configuredSearch, setConfiguredSearch] = useState("");
  const [configuredDepartmentFilter, setConfiguredDepartmentFilter] = useState<string>("all");
  const [configuredStatusFilter, setConfiguredStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Core catalog (base core_agents)
  const [coreAgents, setCoreAgents] = useState<CoreAgent[]>([]);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreMessage, setCoreMessage] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogDepartmentFilter, setCatalogDepartmentFilter] = useState<string>("all");
  const [recruitingId, setRecruitingId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    setAgentsMessage(null);
    try {
      const res = await fetch(`/api/agents?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: Agent[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los agentes.");
      }
      setAgents(data.items ?? []);
    } catch (error) {
      console.error(error);
      setAgentsMessage(error instanceof Error ? error.message : "Error al cargar agentes.");
    } finally {
      setAgentsLoading(false);
    }
  }, [tenantId]);

  const handleRecruit = useCallback(
    async (coreAgent: CoreAgent) => {
      setRecruitingId(coreAgent.id);
      setCoreMessage(null);
      try {
        const res = await fetch(`/api/agents?tenantId=${encodeURIComponent(tenantId)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: coreAgent.nombre,
            department_id: coreAgent.department_id,
            provider: null,
            model: null,
            active: true,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok === false) {
          throw new Error(data.error ?? "No se pudo crear el agente en el tenant.");
        }
        await loadAgents();
      } catch (error) {
        console.error(error);
        setCoreMessage(
          error instanceof Error ? error.message : "No se pudo crear el agente en el tenant."
        );
      } finally {
        setRecruitingId(null);
      }
    },
    [loadAgents, tenantId]
  );

  const loadCoreAgents = useCallback(async () => {
    setCoreLoading(true);
    setCoreMessage(null);
    try {
      const res = await fetch(`/api/core-agents?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: CoreAgent[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los core agents.");
      }
      setCoreAgents(data.items ?? []);
    } catch (error) {
      console.error(error);
      setCoreMessage(error instanceof Error ? error.message : "Error al cargar el catálogo de agentes.");
    } finally {
      setCoreLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAgents();
    void loadCoreAgents();
  }, [loadAgents, loadCoreAgents]);

  const isConfigured = activeTab === "configured";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Operación</p>
          <h1 className="text-3xl font-semibold">Agents</h1>
          <p className="text-sm text-[var(--muted)]">
            Gestiona los agentes IA operativos del tenant y explora el catálogo base del sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Tenant: {tenantId}</Badge>
          <Button
            variant="outline"
            onClick={() => {
              void loadAgents();
              void loadCoreAgents();
            }}
          >
            Refrescar
          </Button>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5 text-xs">
        {([
          ["configured", "Configured"],
          ["catalog", "Catalog"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`px-4 py-1.5 rounded-full transition ${
              activeTab === key
                ? "bg-[var(--brand-quiet)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <Card
        tone="glass"
        title="Agents overview"
        subtitle={
          isConfigured
            ? "Filtra y revisa los agentes ya configurados para este tenant."
            : "Explora el catálogo completo de agentes IA base disponibles en el sistema."
        }
        right={
          <div className="flex flex-wrap gap-2 items-center">
            {isConfigured ? (
              <TextInput
                aria-label="Buscar configured agent por nombre o modelo"
                placeholder="Buscar por nombre, provider o modelo"
                value={configuredSearch}
                onChange={(e) => setConfiguredSearch(e.target.value)}
              />
            ) : (
              <TextInput
                aria-label="Buscar core agent en el catálogo"
                placeholder="Buscar por nombre, slug o descripción"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            )}
          </div>
        }
      >
        {isConfigured ? (
          <ConfiguredAgentsSection
            agents={agents}
            loading={agentsLoading}
            message={agentsMessage}
            search={configuredSearch}
            departmentFilter={configuredDepartmentFilter}
            statusFilter={configuredStatusFilter}
            onDepartmentFilterChange={setConfiguredDepartmentFilter}
            onStatusFilterChange={setConfiguredStatusFilter}
          />
        ) : (
          <CoreAgentsCatalogSection
            agents={coreAgents}
            loading={coreLoading}
            message={coreMessage}
            search={catalogSearch}
            departmentFilter={catalogDepartmentFilter}
            onDepartmentFilterChange={setCatalogDepartmentFilter}
            onRecruit={handleRecruit}
            recruitingId={recruitingId}
          />
        )}
      </Card>
    </div>
  );
}

type ConfiguredAgentsSectionProps = {
  agents: Agent[];
  loading: boolean;
  message: string | null;
  search: string;
  departmentFilter: string;
  statusFilter: "all" | "active" | "inactive";
  onDepartmentFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | "active" | "inactive") => void;
};

function ConfiguredAgentsSection({
  agents,
  loading,
  message,
  search,
  departmentFilter,
  statusFilter,
  onDepartmentFilterChange,
  onStatusFilterChange,
}: ConfiguredAgentsSectionProps) {
  const departmentOptions = useMemo(() => {
    const ids = Array.from(new Set(agents.map((a) => a.department_id))).sort();
    return ids;
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agents.filter((agent) => {
      if (departmentFilter !== "all" && agent.department_id !== departmentFilter) return false;
      if (statusFilter === "active" && agent.active !== 1) return false;
      if (statusFilter === "inactive" && agent.active !== 0) return false;
      if (!term) return true;
      const haystack = `${agent.name} ${agent.provider ?? ""} ${agent.model ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [agents, departmentFilter, search, statusFilter]);

  return (
    <>
      {message && <p className="mb-3 text-sm text-[var(--muted)]">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4" aria-label="Filtros de agentes">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Department</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value)}
          >
            <option value="all">All departments</option>
            {departmentOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Status</span>
          <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5 text-xs">
            {["all", "active", "inactive"].map((value) => (
              <button
                key={value}
                type="button"
                className={`px-3 py-1 rounded-full transition ${
                  statusFilter === value
                    ? "bg-[var(--brand-quiet)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => onStatusFilterChange(value as typeof statusFilter)}
              >
                {value === "all" ? "All" : value === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando agentes...</p>
      ) : filteredAgents.length === 0 ? (
        <EmptyState title="Sin agentes" subtitle="Todavía no hay agentes registrados para este tenant." />
      ) : (
        <TableWrap>
          <Table aria-label="Listado de agentes IA">
            <THead>
              <tr>
                <TH>Agent</TH>
                <TH>Department</TH>
                <TH>Provider / Model</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {filteredAgents.map((agent) => (
                <tr key={agent.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--foreground)]">{agent.name}</span>
                      {(agent.provider || agent.model) && (
                        <span className="text-xs text-[var(--muted)]">
                          {agent.provider ?? "Unknown"}
                          {agent.model ? ` • ${agent.model}` : ""}
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD>{agent.department_id}</TD>
                  <TD>
                    {agent.provider ?? "–"}
                    {agent.model ? ` • ${agent.model}` : ""}
                  </TD>
                  <TD>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        agent.active === 1
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40"
                          : "bg-[var(--panel)] text-[var(--muted)] border border-[var(--border)]/70"
                      }`}
                    >
                      {agent.active === 1 ? "Active" : "Inactive"}
                    </span>
                  </TD>
                  <TD>{new Date(agent.created_at).toLocaleString()}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

type CoreAgentsCatalogSectionProps = {
  agents: CoreAgent[];
  loading: boolean;
  message: string | null;
  search: string;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  onRecruit: (agent: CoreAgent) => void;
  recruitingId: string | null;
};

function CoreAgentsCatalogSection({
  agents,
  loading,
  message,
  search,
  departmentFilter,
  onDepartmentFilterChange,
  onRecruit,
  recruitingId,
}: CoreAgentsCatalogSectionProps) {
  const departmentOptions = useMemo(() => {
    const ids = Array.from(new Set(agents.map((a) => a.department_id))).sort();
    return ids;
  }, [agents]);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(agents.map((a) => a.tipo))).filter(Boolean).sort();
    return types;
  }, [agents]);

  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agents.filter((agent) => {
      if (departmentFilter !== "all" && agent.department_id !== departmentFilter) return false;
      if (typeFilter !== "all" && agent.tipo !== typeFilter) return false;
      if (!term) return true;
      const haystack = `${agent.nombre} ${agent.slug} ${agent.descripcion ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [agents, departmentFilter, search, typeFilter]);

  return (
    <>
      {message && <p className="mb-3 text-sm text-[var(--muted)]">{message}</p>}

      <div
        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4"
        aria-label="Filtros del catálogo de core agents"
      >
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Department</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value)}
          >
            <option value="all">All departments</option>
            {departmentOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Function</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm capitalize"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All functions</option>
            {typeOptions.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando catálogo de agentes...</p>
      ) : agents.length === 0 ? (
        <EmptyState
          title="Sin core agents"
          subtitle="No hay agentes base definidos en el catálogo. Revisa el seed de core_agents."
        />
      ) : filteredAgents.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No hay agentes en el catálogo que coincidan con los filtros actuales.
        </p>
      ) : (
        <TableWrap>
          <Table aria-label="Catálogo de core agents">
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Department</TH>
                <TH>Type</TH>
                <TH>Description</TH>
                <TH></TH>
              </tr>
            </THead>
            <TBody>
              {filteredAgents.map((agent) => (
                <tr key={agent.id}>
                  <TD>
                    <div className="flex flex-col">
                      <span className="font-semibold text-[var(--foreground)]">{agent.nombre}</span>
                      <span className="text-xs text-[var(--muted)]">{agent.slug}</span>
                    </div>
                  </TD>
                  <TD>{agent.department_id}</TD>
                  <TD className="capitalize">{agent.tipo}</TD>
                  <TD>{agent.descripcion ?? "—"}</TD>
                  <TD className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRecruit(agent)}
                      disabled={recruitingId === agent.id}
                    >
                      {recruitingId === agent.id ? "Adding..." : "Add to tenant"}
                    </Button>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
