"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import type {
  EmployeePartnerContext,
  PartnerInventoryUsage,
  PartnerServiceUsage,
  PartnerSuggestion,
} from "@/lib/agents/employee-partner";

type PartnerResponse = {
  partner: EmployeePartnerContext;
  dayPlan: string[];
  inventorySuggestions: PartnerSuggestion[];
  hrSuggestions: PartnerSuggestion[];
  customerCareSuggestions: PartnerSuggestion[];
  economySuggestions: PartnerSuggestion[];
  operationalSuggestions: PartnerSuggestion[];
};

function getFairnessBadgeVariant(status: string): "ok" | "warn" | "err" {
  if (status === "CRITICAL") return "err";
  if (status === "WARNING") return "warn";
  return "ok";
}

function formatHours(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} h`;
}

function formatPercent(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}%`;
}

function SuggestionsGroup({ title, items }: { title: string; items: PartnerSuggestion[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin recomendaciones</p>
      ) : (
        items.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{item.title}</p>
              <Badge variant={item.severity === "critical" ? "err" : item.severity === "warn" ? "warn" : "ok"}>{item.severity}</Badge>
            </div>
            <p className="mt-1 text-[var(--muted)]">{item.detail}</p>
          </div>
        ))
      )}
    </div>
  );
}

function InventoryBlocks({ usage }: { usage: PartnerInventoryUsage[] }) {
  if (usage.length === 0) return <p className="text-sm text-[var(--muted)]">Sin dependencias de inventario registradas.</p>;
  return (
    <div className="space-y-2 text-sm">
      {usage.map((item) => (
        <div key={item.serviceId} className="rounded-xl border border-[var(--border)]/60 p-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{item.serviceName}</p>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {item.items.map((product) => (
              <div key={product.inventoryItemId} className="flex items-center justify-between rounded-lg bg-[var(--panel-alt)] px-3 py-2">
                <span>{product.name}</span>
                <Badge variant={product.status === "LOW_STOCK" ? "warn" : "ok"}>
                  {product.status === "LOW_STOCK" ? "LOW STOCK" : "OK"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServicesTable({ services }: { services: PartnerServiceUsage[] }) {
  if (services.length === 0) return <p className="text-sm text-[var(--muted)]">Sin datos económicos todavía.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="modern text-sm" aria-label="Servicios del empleado">
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Margen</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {services.slice(0, 5).map((service) => (
            <tr key={service.serviceId}>
              <td>{service.serviceName}</td>
              <td>{formatPercent(service.marginCurrent)}</td>
              <td>
                {service.status ? (
                  <Badge variant={service.status === "OK" ? "ok" : service.status === "LOSS" ? "err" : "warn"}>{service.status}</Badge>
                ) : (
                  <Badge variant="neutral">—</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  employeeId: string;
  saasId: string;
  onClose: () => void;
};

export default function SaasEmployeePartnerPanel({ employeeId, saasId, onClose }: Props) {
  const [data, setData] = useState<PartnerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/employees/${encodeURIComponent(employeeId)}/partner?saasId=${encodeURIComponent(saasId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? "No se pudo cargar el partner");
        }
        const json = (await res.json()) as PartnerResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el partner");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  const partner = data?.partner;
  const suggestionGroups = useMemo(
    () =>
      data
        ? [
            { title: "Plan del día", items: data.dayPlan.map((item) => ({ title: item, detail: "", severity: "info" as const })) },
            { title: "Inventario", items: data.inventorySuggestions },
            { title: "HR / Fairness", items: data.hrSuggestions },
            { title: "Atención cliente", items: data.customerCareSuggestions },
            { title: "Economía", items: data.economySuggestions },
            { title: "Operación", items: data.operationalSuggestions },
          ]
        : [],
    [data],
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur">
      <div className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Partner</p>
            <h2 className="text-xl font-semibold">{partner?.employee.fullName ?? "Empleado"}</h2>
            {partner?.role && <p className="text-sm text-[var(--muted)]">{partner.role.label}</p>}
            {partner?.fairnessStatus && <Badge variant={getFairnessBadgeVariant(partner.fairnessStatus)}>Fairness {partner.fairnessStatus}</Badge>}
            {error && <p className="text-sm text-red-300">{error}</p>}
            {loading && <p className="text-sm text-[var(--muted)]">Cargando partner...</p>}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Cerrar partner">
            Cerrar
          </Button>
        </div>

        {partner && !loading && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card tone="glass" title="Carga" subtitle="Horas planificadas vs reales">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Planificadas</span>
                    <span>{formatHours(partner.workloadSnapshot.plannedHours)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reales</span>
                    <span>{formatHours(partner.workloadSnapshot.actualHours)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--muted)]">
                    <span>Extra</span>
                    <span>{formatHours(partner.workloadSnapshot.extraHours)}</span>
                  </div>
                </div>
              </Card>

              <Card tone="glass" title="Margen servicios" subtitle="Promedio asignado">
                <div className="space-y-2 text-sm">
                  <p className="text-2xl font-semibold">{formatPercent(partner.economyStats.averageServiceMargin)}</p>
                  <p className="text-[var(--muted)]">Promedio de servicios donde participa</p>
                </div>
              </Card>

              <Card tone="glass" title="Citas hoy" subtitle="Agenda">
                <div className="space-y-1 text-sm">
                  {partner.todayBookings.length === 0 ? (
                    <p className="text-[var(--muted)]">Sin citas asignadas hoy</p>
                  ) : (
                    partner.todayBookings.slice(0, 3).map((appt) => (
                      <div key={appt.id} className="flex items-center justify-between">
                        <span>{appt.customerName}</span>
                        <span className="text-xs text-[var(--muted)]">{new Date(appt.startTime).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card tone="glass" title="Plan y sugerencias" subtitle="Partner v3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestionGroups.map((group) => (
                  <SuggestionsGroup key={group.title} title={group.title} items={group.items} />
                ))}
              </div>
            </Card>

            <Card tone="glass" title="Servicios clave" subtitle="Márgenes y foco">
              <ServicesTable services={partner.services} />
            </Card>

            <Card tone="glass" title="Inventario crítico" subtitle="Productos usados por sus servicios">
              <InventoryBlocks usage={partner.inventoryUsage} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
