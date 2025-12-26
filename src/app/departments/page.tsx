import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";
import { headers } from "next/headers";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { getServerBaseUrl } from "@/lib/http/base-url";
import { Shield, Layers, Users, Megaphone, MessageCircle, Cpu, Scale, Lock, Sparkles } from "lucide-react";

type CoreDepartment = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  es_critico: number;
};

type CoreAgent = {
  id: string;
  department_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
};

type ActiveAgent = {
  id: string;
  department_id: string;
  active: number;
};

type AlertItem = {
  id: string;
  severity: string;
  source: string;
  message: string;
  saas_id?: string | null;
  created_at: string;
};

type AnyAlert = AlertItem & {
  department_id?: string | null;
};

const iconByDepartment: Record<string, React.ComponentType<{ className?: string }>> = {
  core_dir: Shield,
  core_acc: Layers,
  core_mkt: Megaphone,
  core_sales: Users,
  core_support: MessageCircle,
  core_dev: Cpu,
  core_sec: Lock,
  core_legal: Scale,
  core_grants: Sparkles,
};

const variantByCritical = (es_critico: number) => {
  if (es_critico) return "warn" as const;
  return "ok" as const;
};

type PageProps = {
  searchParams?: Promise<{ tenantId?: string }>;
};

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const baseUrl = getServerBaseUrl(await headers());
  const tenantId = resolvedSearchParams?.tenantId?.trim() || DEMO_TENANT_ID;
  const qs = `tenantId=${encodeURIComponent(tenantId)}`;

  let departments: CoreDepartment[] = [];
  let coreAgents: CoreAgent[] = [];
  let activeAgents: ActiveAgent[] = [];
  let alerts: AlertItem[] = [];
  let hadError = false;

  try {
    const [deptRes, coreAgentsRes, activeAgentsRes, alertsRes] = await Promise.all([
      fetch(`${baseUrl}/api/core-departments?${qs}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/core-agents?${qs}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/agents?${qs}`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/alerts?${qs}`, { cache: "no-store" }),
    ]);

    if (deptRes.ok) {
      const data = (await deptRes.json()) as { items?: CoreDepartment[] };
      departments = data.items ?? [];
    } else {
      hadError = true;
    }

    if (coreAgentsRes.ok) {
      const data = (await coreAgentsRes.json()) as { items?: CoreAgent[] };
      coreAgents = data.items ?? [];
    } else {
      hadError = true;
    }

    if (activeAgentsRes.ok) {
      const data = (await activeAgentsRes.json()) as { items?: ActiveAgent[] };
      activeAgents = data.items ?? [];
    } else {
      hadError = true;
    }

    if (alertsRes.ok) {
      const data = (await alertsRes.json()) as { items?: AlertItem[] };
      alerts = data.items ?? [];
    } else {
      hadError = true;
    }
  } catch (error) {
    console.error("DEPARTMENTS_PAGE_CORE_FETCH_ERROR", error);
    hadError = true;
  }

  const hasData = departments.length > 0;

  const alertsByDepartment: Record<string, number> = {};
  for (const alert of alerts as AnyAlert[]) {
    const deptId = alert.department_id;
    if (!deptId) continue;
    alertsByDepartment[deptId] = (alertsByDepartment[deptId] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title="Departamentos base"
        subtitle="Áreas que sostienen el Campamento Base y su ejército de agentes IA"
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
          aria-label="Departamentos base"
        >
          {hasData
            ? departments.map((d) => {
                const Icon = iconByDepartment[d.id] ?? Shield;
                const coreAgentsCount = coreAgents.filter((a) => a.department_id === d.id).length;
                const activeAgentsCount = activeAgents.filter((a) => a.department_id === d.id && a.active === 1).length;
                const alertsCount = alertsByDepartment[d.id] ?? 0;

                return (
                  <section
                    key={d.id}
                    className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 space-y-3"
                    role="listitem"
                    aria-live="polite"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-9 w-9 rounded-2xl bg-[var(--brand-quiet)]/80 text-[var(--brand)] flex items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h3 className="text-base font-semibold">{d.nombre}</h3>
                      </div>
                      <Badge variant={variantByCritical(d.es_critico)}>
                        {d.es_critico ? "Crítico" : "Apoyo"}
                      </Badge>
                    </div>
                    {d.descripcion && (
                      <p className="text-sm text-[var(--muted)]">{d.descripcion}</p>
                    )}
                    <p className="text-xs text-[var(--muted)] uppercase tracking-[0.3em]">
                      CORE AGENTS: {coreAgentsCount} • ACTIVE AGENTS: {activeAgentsCount} • ALERTS: {alertsCount}
                    </p>
                  </section>
                );
              })
            : (
                <EmptyState
                  title="Sin departamentos disponibles"
                  subtitle="No hay datos para este tenant todavía. En modo demo se usarán datos de ejemplo cuando estén configurados."
                />
              )}
        </div>
        {hadError && hasData && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Algunos contadores pueden no estar actualizados por un problema temporal al cargar datos de agentes o
            alertas.
          </p>
        )}
      </Card>
    </div>
  );
}
