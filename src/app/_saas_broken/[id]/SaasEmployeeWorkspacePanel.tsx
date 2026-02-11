"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import type { EmployeePartnerContext, PartnerSuggestion } from "@/lib/agents/employee-partner";
import type { ServicePhase } from "@/lib/economy/types";

type BookingWorkspaceItem = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  customerIsVip: boolean;
  serviceId: string;
  serviceName?: string;
  serviceDurationMinutes?: number;
};

type PartnerResponse = {
  partner: EmployeePartnerContext;
  dayPlan: string[];
  inventorySuggestions: PartnerSuggestion[];
  hrSuggestions: PartnerSuggestion[];
  customerCareSuggestions: PartnerSuggestion[];
  economySuggestions: PartnerSuggestion[];
  phaseSuggestions: PartnerSuggestion[];
  operationalSuggestions: PartnerSuggestion[];
};

type TimerState = {
  endAt: number;
  remainingSeconds: number;
  status: "running" | "done";
};

type Props = {
  employeeId: string;
  saasId: string;
  employeeName?: string | null;
};

function formatTime(value: string): string {
  const date = new Date(value);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDuration(minutes?: number): string {
  if (!minutes || !Number.isFinite(minutes)) return "—";
  return `${minutes} min`;
}

function formatRemaining(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function SuggestionsGroup({ title, items }: { title: string; items: PartnerSuggestion[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin recomendaciones</p>
      ) : (
        items.map((item, idx) => (
          <div key={`${title}-${idx}`} className="rounded-lg border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3 text-sm">
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

export default function SaasEmployeeWorkspacePanel({ employeeId, saasId, employeeName }: Props) {
  const [partner, setPartner] = useState<PartnerResponse | null>(null);
  const [bookings, setBookings] = useState<BookingWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<string, TimerState>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [partnerRes, bookingsRes] = await Promise.all([
          fetch(`/api/employees/${encodeURIComponent(employeeId)}/partner?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
          fetch(
            `/api/customers/bookings?saasId=${encodeURIComponent(saasId)}&employeeId=${encodeURIComponent(employeeId)}&day=today`,
            { cache: "no-store" },
          ),
        ]);

        if (!partnerRes.ok) throw new Error("No se pudo cargar el partner");
        if (!bookingsRes.ok) throw new Error("No se pudo cargar la agenda");

        const partnerJson = (await partnerRes.json()) as PartnerResponse;
        const bookingsJson = (await bookingsRes.json()) as { items?: BookingWorkspaceItem[] };

        if (!cancelled) {
          setPartner(partnerJson);
          setBookings(bookingsJson.items ?? []);
        }
      } catch (error) {
        console.error("EMPLOYEE_WORKSPACE_LOAD_ERROR", error);
        if (!cancelled) {
          setPartner(null);
          setBookings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(prev).forEach(([key, timer]) => {
          if (timer.status !== "running") return;
          const remainingSeconds = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
          if (remainingSeconds !== timer.remainingSeconds) {
            next[key] = {
              ...timer,
              remainingSeconds,
              status: remainingSeconds === 0 ? "done" : "running",
            };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const phaseEntries = useMemo(() => {
    const phasesByService = partner?.partner.servicePhases ?? {};
    return bookings.flatMap((booking) => {
      const phases = phasesByService[booking.serviceId] ?? [];
      return phases.map((phase) => ({ booking, phase }));
    });
  }, [bookings, partner?.partner.servicePhases]);

  const suggestionGroups = useMemo(
    () =>
      partner
        ? [
            { title: "HR / Fairness", items: partner.hrSuggestions },
            { title: "Inventario", items: partner.inventorySuggestions },
            { title: "Atencion al cliente", items: partner.customerCareSuggestions },
            { title: "Fases y tiempos", items: partner.phaseSuggestions },
          ]
        : [],
    [partner],
  );

  function startTimer(bookingId: string, phase: ServicePhase) {
    const key = `${bookingId}:${phase.id}`;
    setTimers((prev) => {
      const existing = prev[key];
      if (existing?.status === "running") return prev;
      const durationSeconds = Math.max(1, Math.round(phase.durationMinutes * 60));
      return {
        ...prev,
        [key]: {
          endAt: Date.now() + durationSeconds * 1000,
          remainingSeconds: durationSeconds,
          status: "running",
        },
      };
    });
  }

  return (
    <Card
      tone="glass"
      title="Employee workspace"
      subtitle={employeeName ? `Jornada de ${employeeName}` : "Jornada del equipo"}
      className="space-y-4"
    >
      {loading ? <p className="text-sm text-[var(--muted)]">Cargando workspace...</p> : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-4">
            <h4 className="text-sm font-semibold">Agenda de hoy</h4>
            {bookings.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Sin citas asignadas hoy.</p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                {bookings.map((booking) => (
                  <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--background)] px-3 py-2">
                    <div>
                      <p className="font-semibold">
                        {formatTime(booking.startTime)} · {booking.serviceName ?? "Servicio"}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {booking.customerName} · {formatDuration(booking.serviceDurationMinutes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.customerIsVip ? <Badge variant="ok">VIP</Badge> : null}
                      <Badge variant="neutral">{booking.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-4">
            <h4 className="text-sm font-semibold">Timers de fases</h4>
            {phaseEntries.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Sin fases configuradas en los servicios de hoy.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {phaseEntries.map(({ booking, phase }) => {
                  const timer = timers[`${booking.id}:${phase.id}`];
                  return (
                    <div key={`${booking.id}:${phase.id}`} className="rounded-xl border border-[var(--border)]/60 bg-[var(--background)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {booking.customerName} · {phase.label}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {booking.serviceName ?? "Servicio"} · {formatDuration(phase.durationMinutes)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" onClick={() => startTimer(booking.id, phase)}>
                            Iniciar fase
                          </Button>
                          {timer ? (
                            <Badge variant={timer.status === "done" ? "ok" : "warn"}>
                              {timer.status === "done" ? "Finalizado" : formatRemaining(timer.remainingSeconds)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {suggestionGroups.map((group) => (
            <SuggestionsGroup key={group.title} title={group.title} items={group.items} />
          ))}
        </div>
      </div>
    </Card>
  );
}
