"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { TextArea } from "@/components/ui/input";
import Select from "@/components/ui/select";
import type { EmployeePartnerContext, PartnerSuggestion } from "@/lib/agents/employee-partner";
import type { CustomerServiceSuggestion } from "@/lib/agents/customer-partner";
import type { SaasAppointment } from "@/lib/appointments/types";
import type { ConversationListActorItem, SaasConversation, SaasConversationMessage } from "@/lib/conversations/types";
import type { BrandingLayoutDensity, ResolvedTheme } from "@/lib/branding/types";

type PartnerResponse = {
  partner: EmployeePartnerContext;
  realtimeSuggestions: PartnerSuggestion[];
};

type TimerState = {
  appointmentId: string;
  label: string;
  endAt: number;
  remainingSeconds: number;
  status: "running" | "done";
};

type StaffEmployeeClientProps = {
  employeeId: string;
};

function formatTime(value: string): string {
  const date = new Date(value);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatMinutes(value?: number | null): string {
  if (!value) return "—";
  return `${value} min`;
}

function formatHours(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} h`;
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

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getComplianceBadge(status: "OK" | "WARNING" | "CRITICAL") {
  if (status === "CRITICAL") return { label: "Critical", variant: "err" as const };
  if (status === "WARNING") return { label: "Warning", variant: "warn" as const };
  return { label: "OK", variant: "ok" as const };
}

export default function StaffEmployeeClient({ employeeId }: StaffEmployeeClientProps) {
  const searchParams = useSearchParams();
  const rawSaasId = searchParams.get("saasId");
  const saasId = rawSaasId?.trim() ?? "";
  const [partner, setPartner] = useState<PartnerResponse | null>(null);
  const [appointments, setAppointments] = useState<SaasAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Record<string, CustomerServiceSuggestion[]>>({});
  const [guardrailNotice, setGuardrailNotice] = useState<{ type: "block" | "warn"; messages: string[] } | null>(null);
  const [tasks, setTasks] = useState<Array<{ id: string; title: string; category: string; severity: string; dueDate?: string | null; status: string }>>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [playbooks, setPlaybooks] = useState<
    Array<{ id: string; title: string; type: string; audience?: string; importance?: string }>
  >([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);
  const [inbox, setInbox] = useState<ConversationListActorItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<{
    conversation: SaasConversation;
    messages: SaasConversationMessage[];
  } | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ResolvedTheme | null>(null);
  const [density, setDensity] = useState<BrandingLayoutDensity>("NORMAL");
  const [whatsappIdentity, setWhatsappIdentity] = useState<{
    id: string;
    phoneNumber: string;
    actorType: string;
    actorId: string;
  } | null>(null);
  const [whatsappCommandsOpen, setWhatsappCommandsOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappResponse, setWhatsappResponse] = useState<string[] | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [lastWhatsappCommand, setLastWhatsappCommand] = useState<string | null>(null);

  useEffect(() => {
    if (!saasId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [partnerRes, apptRes] = await Promise.all([
          fetch(`/api/employees/${encodeURIComponent(employeeId)}/partner?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
          fetch(`/api/employees/${encodeURIComponent(employeeId)}/appointments?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
        ]);
        if (!partnerRes.ok) throw new Error("No se pudo cargar el partner");
        if (!apptRes.ok) throw new Error("No se pudo cargar la agenda");
        const partnerJson = (await partnerRes.json()) as PartnerResponse;
        const apptJson = (await apptRes.json()) as { items?: SaasAppointment[] };
        if (!cancelled) {
          setPartner(partnerJson);
          setAppointments(apptJson.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setPartner(null);
          setAppointments([]);
          setError(err instanceof Error ? err.message : "No se pudo cargar la vista");
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
    if (!saasId || !employeeId) return;
    let cancelled = false;
    async function loadTheme() {
      try {
        const params = new URLSearchParams({
          saasId,
          roleType: "EMPLOYEE",
          userId: employeeId,
        });
        const res = await fetch(`/api/branding/theme?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { theme?: ResolvedTheme } | null;
        if (!cancelled && data?.theme) {
          setTheme(data.theme);
          setDensity(data.theme.layoutDensity);
        }
      } catch {
        if (!cancelled) {
          setTheme(null);
          setDensity("NORMAL");
        }
      }
    }
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  useEffect(() => {
    if (!timer || timer.status !== "running") return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (!prev || prev.status !== "running") return prev;
        const remainingSeconds = Math.max(0, Math.ceil((prev.endAt - Date.now()) / 1000));
        return {
          ...prev,
          remainingSeconds,
          status: remainingSeconds === 0 ? "done" : "running",
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!saasId || appointments.length === 0) return;
    let cancelled = false;
    async function loadSuggestions() {
      const entries = await Promise.all(
        appointments
          .filter(
            (appointment) =>
              appointment.customerId &&
              appointment.serviceId &&
              (appointment.status === "CONFIRMED" || appointment.status === "IN_PROGRESS"),
          )
          .map(async (appointment) => {
            try {
              const params = new URLSearchParams({
                saasId,
                referenceServiceId: appointment.serviceId,
              });
              const res = await fetch(`/api/customers/${encodeURIComponent(appointment.customerId!)}/suggestions?${params.toString()}`, {
                cache: "no-store",
              });
              if (!res.ok) return [appointment.id, []] as const;
              const json = (await res.json().catch(() => null)) as { suggestions?: CustomerServiceSuggestion[] } | null;
              return [appointment.id, json?.suggestions ?? []] as const;
            } catch (error) {
              console.warn("STAFF_CUSTOMER_SUGGESTIONS_ERROR", error);
              return [appointment.id, []] as const;
            }
          }),
      );
      if (!cancelled) {
        setCustomerSuggestions(Object.fromEntries(entries));
      }
    }
    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [appointments, saasId]);

  useEffect(() => {
    if (!saasId || !employeeId) return;
    let cancelled = false;
    async function loadPlaybooks() {
      setPlaybooksLoading(true);
      try {
        const requests: Promise<Array<{ id: string; title: string; type: string; audience?: string; importance?: string }>>[] = [];

        const enqueue = (params: URLSearchParams) => {
          const promise = (async () => {
            const res = await fetch(`/api/knowledge/documents?${params.toString()}`, { cache: "no-store" });
            const json = (await res.json().catch(() => null)) as {
              items?: Array<{ id: string; title: string; type: string; audience?: string; importance?: string }>;
            } | null;
            return json?.items ?? [];
          })();
          requests.push(promise);
        };

        enqueue(
          new URLSearchParams({
            saasId,
            targetType: "EMPLOYEE",
            targetId: employeeId,
          }),
        );

        const roleId = partner?.partner.role?.id;
        if (roleId) {
          enqueue(
            new URLSearchParams({
              saasId,
              targetType: "ROLE",
              targetId: roleId,
            }),
          );
        }

        const serviceIds = Array.from(new Set(appointments.map((appt) => appt.serviceId))).slice(0, 3);
        serviceIds.forEach((serviceId) => {
          enqueue(
            new URLSearchParams({
              saasId,
              targetType: "SERVICE",
              targetId: serviceId,
            }),
          );
        });

        const results = await Promise.all(requests);
        const merged = results.flat();
        const unique = new Map(merged.map((doc) => [doc.id, doc]));
        const sorted = Array.from(unique.values())
          .filter((doc) => doc.audience !== "OWNER")
          .sort((a, b) => {
            const score = (value?: string) => (value === "CRITICAL" ? 3 : value === "STANDARD" ? 2 : 1);
            return score(b.importance) - score(a.importance);
          });
        if (!cancelled) setPlaybooks(sorted.slice(0, 5));
      } catch {
        if (!cancelled) setPlaybooks([]);
      } finally {
        if (!cancelled) setPlaybooksLoading(false);
      }
    }
    void loadPlaybooks();
    return () => {
      cancelled = true;
    };
  }, [appointments, employeeId, partner, saasId]);

  useEffect(() => {
    if (!saasId || !employeeId) return;
    let cancelled = false;
    async function loadTasks() {
      setTasksLoading(true);
      try {
        const params = new URLSearchParams({
          saasId,
          assigneeEmployeeId: employeeId,
          status: "OPEN",
        });
        const res = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { items?: typeof tasks } | null;
        if (!cancelled) {
          setTasks(data?.items ?? []);
        }
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  useEffect(() => {
    if (!saasId || !employeeId) return;
    let cancelled = false;
    async function loadInbox() {
      setInboxLoading(true);
      try {
        const params = new URLSearchParams({
          saasId,
          actorType: "EMPLOYEE",
          actorId: employeeId,
          status: "OPEN,PENDING",
        });
        const res = await fetch(`/api/conversations?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { conversations?: ConversationListActorItem[] } | null;
        const items = data?.conversations ?? [];
        if (!cancelled) {
          setInbox(items);
          setSelectedConversationId((prev) => prev ?? items[0]?.conversation.id ?? null);
        }
      } catch {
        if (!cancelled) setInbox([]);
      } finally {
        if (!cancelled) setInboxLoading(false);
      }
    }
    void loadInbox();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  useEffect(() => {
    if (!saasId || !employeeId) return;
    let cancelled = false;
    async function loadWhatsappIdentity() {
      try {
        const params = new URLSearchParams({ saasId });
        const res = await fetch(`/api/whatsapp/identities?${params.toString()}`, { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as {
          items?: Array<{ id: string; phoneNumber: string; actorType: string; actorId: string }>;
        } | null;
        const match = data?.items?.find((item) => item.actorType === "EMPLOYEE" && item.actorId === employeeId) ?? null;
        if (!cancelled) setWhatsappIdentity(match);
      } catch {
        if (!cancelled) setWhatsappIdentity(null);
      }
    }
    void loadWhatsappIdentity();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId]);

  useEffect(() => {
    if (!saasId || !employeeId || !selectedConversationId) {
      setConversationDetail(null);
      return;
    }
    const conversationId = selectedConversationId;
    let cancelled = false;
    async function loadConversation() {
      setConversationLoading(true);
      try {
        const params = new URLSearchParams({
          saasId,
          actorType: "EMPLOYEE",
          actorId: employeeId,
          markAsRead: "true",
        });
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as {
          conversation?: SaasConversation;
          messages?: SaasConversationMessage[];
        } | null;
        if (!cancelled && data?.conversation) {
          setConversationDetail({
            conversation: data.conversation,
            messages: data.messages ?? [],
          });
        }
      } catch {
        if (!cancelled) setConversationDetail(null);
      } finally {
        if (!cancelled) setConversationLoading(false);
      }
    }
    void loadConversation();
    return () => {
      cancelled = true;
    };
  }, [employeeId, saasId, selectedConversationId]);

  async function sendConversationReply() {
    if (!saasId || !selectedConversationId || !replyMessage.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(selectedConversationId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          actorType: "EMPLOYEE",
          actorId: employeeId,
          content: replyMessage.trim(),
        }),
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      setReplyMessage("");
      setSelectedConversationId((prev) => prev ?? null);
      const params = new URLSearchParams({
        saasId,
        actorType: "EMPLOYEE",
        actorId: employeeId,
        status: "OPEN,PENDING",
      });
      const inboxRes = await fetch(`/api/conversations?${params.toString()}`, { cache: "no-store" });
      const inboxData = (await inboxRes.json().catch(() => null)) as { conversations?: ConversationListActorItem[] } | null;
      setInbox(inboxData?.conversations ?? []);
      const detailParams = new URLSearchParams({
        saasId,
        actorType: "EMPLOYEE",
        actorId: employeeId,
        markAsRead: "true",
      });
      const detailRes = await fetch(
        `/api/conversations/${encodeURIComponent(selectedConversationId)}/messages?${detailParams.toString()}`,
        { cache: "no-store" },
      );
      const detailData = (await detailRes.json().catch(() => null)) as {
        conversation?: SaasConversation;
        messages?: SaasConversationMessage[];
      } | null;
      if (detailData?.conversation) {
        setConversationDetail({
          conversation: detailData.conversation,
          messages: detailData.messages ?? [],
        });
      }
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
    } finally {
      setReplySending(false);
    }
  }

  async function sendWhatsappDemo() {
    if (!saasId || !whatsappIdentity || !whatsappMessage.trim()) return;
    setWhatsappSending(true);
    setWhatsappError(null);
    setWhatsappResponse(null);
    try {
      const payload = whatsappMessage.trim();
      const res = await fetch("/api/whatsapp/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          phoneNumber: whatsappIdentity.phoneNumber,
          body: payload,
        }),
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      const data = (await res.json().catch(() => null)) as { messages?: string[] } | null;
      setWhatsappResponse(data?.messages ?? []);
      setLastWhatsappCommand(payload);
      setWhatsappMessage("");
    } catch (error) {
      setWhatsappError(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
    } finally {
      setWhatsappSending(false);
    }
  }

  const todaySummary = partner?.partner.todayScheduleSummary;
  const compliance = partner?.partner.hrComplianceReport.status ?? "OK";
  const complianceBadge = getComplianceBadge(compliance);
  const employee = partner?.partner.employee;
  const workload = partner?.partner.workloadSnapshot;
  const maxHoursWeek = partner?.partner.contract?.maxHoursWeek ?? partner?.partner.hrComplianceReport.metrics.maxHoursWeek ?? null;
  const servicesMap = useMemo(() => partner?.partner.servicesForAppointments ?? {}, [partner?.partner.servicesForAppointments]);

  const colorAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const service = servicesMap[appointment.serviceId];
        const name = (service?.name ?? "").toLowerCase();
        const category = (service?.category ?? "").toString().toLowerCase();
        return category.includes("hair") && (name.includes("color") || name.includes("balayage"));
      }),
    [appointments, servicesMap],
  );

  async function updateStatus(appointmentId: string, status: "IN_PROGRESS" | "DONE" | "NO_SHOW") {
    if (!saasId) return;
    setUpdating(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}?saasId=${encodeURIComponent(saasId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => null)) as {
        appointment?: SaasAppointment;
        guardrails?: Array<{ message: string }>;
        code?: string;
      } | null;
      if (!res.ok) {
        if (data?.code === "HARD_GUARDRAIL_VIOLATION") {
          setGuardrailNotice({
            type: "block",
            messages: (data.guardrails ?? []).map((item) => item.message),
          });
          return;
        }
        throw new Error("No se pudo actualizar la cita");
      }
      const updated = data?.appointment;
      if (updated) {
        setAppointments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        if (data?.guardrails?.length) {
          setGuardrailNotice({
            type: "warn",
            messages: data.guardrails.map((item) => item.message),
          });
        } else {
          setGuardrailNotice(null);
        }
      }
    } catch (err) {
      console.error("APPOINTMENT_STATUS_UPDATE_ERROR", err);
    } finally {
      setUpdating(null);
    }
  }

  function startTimerForAppointment(appointment: SaasAppointment) {
    const service = servicesMap[appointment.serviceId];
    const durationMinutes = service?.durationMinutes ?? 30;
    setTimer({
      appointmentId: appointment.id,
      label: service?.name ?? "Servicio",
      endAt: Date.now() + durationMinutes * 60 * 1000,
      remainingSeconds: Math.max(1, durationMinutes * 60),
      status: "running",
    });
  }

  async function updateTaskStatus(taskId: string, status: "IN_PROGRESS" | "DONE") {
    if (!saasId) return;
    await fetch(`/api/tasks/${encodeURIComponent(taskId)}?saasId=${encodeURIComponent(saasId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  async function updateDensity(nextDensity: BrandingLayoutDensity) {
    if (!saasId) return;
    setDensity(nextDensity);
    await fetch("/api/branding/user-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        userId: employeeId,
        roleType: "EMPLOYEE",
        layoutDensityOverride: nextDensity,
      }),
    });
  }

  const densityClass =
    density === "COMPACT" ? "p-4" : density === "COZY" ? "p-8" : "p-6";
  const themeStyle = theme
    ? ({
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        "--drako-accent": theme.colors.accent,
        "--drako-success": theme.colors.success,
        "--drako-danger": theme.colors.danger,
      } as CSSProperties)
    : undefined;

  if (!saasId) {
    return (
      <div className="p-6">
        <Card title="Staff Portal" subtitle="Selecciona un SaaS válido para continuar">
          <p className="text-sm text-[var(--muted)]">Falta el parámetro `saasId` en la URL.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={densityClass} style={themeStyle}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Staff Portal</p>
          <h1 className="text-2xl font-semibold">{employee?.fullName ?? "Empleado"}</h1>
          <p className="text-sm text-[var(--muted)]">{employee?.role ?? "Equipo"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={density} onChange={(event) => updateDensity(event.target.value as BrandingLayoutDensity)}>
            <option value="COMPACT">Compacto</option>
            <option value="NORMAL">Normal</option>
            <option value="COZY">Amplio</option>
          </Select>
          <Badge variant={complianceBadge.variant}>{complianceBadge.label}</Badge>
        </div>
      </div>

      {guardrailNotice && (
        <Card
          tone="glass"
          title={guardrailNotice.type === "block" ? "Fairness Guard bloqueó la acción" : "Fairness Guard advierte"}
          subtitle={
            guardrailNotice.type === "block"
              ? "No puedes añadir la cita por límites de horas o descanso."
              : "Estás cerca del límite semanal o de descanso configurado."
          }
        >
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {guardrailNotice.messages.map((message, idx) => (
              <li key={`${message}-${idx}`}>{message}</li>
            ))}
          </ul>
        </Card>
      )}

      {loading ? (
        <Card title="Cargando" subtitle="Preparando tu jornada">
          <p className="text-sm text-[var(--muted)]">Un momento…</p>
        </Card>
      ) : error ? (
        <Card title="Error" subtitle="No se pudo cargar la vista">
          <p className="text-sm text-[var(--muted)]">{error}</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="space-y-6">
            <Card title="Hoy" subtitle="Resumen de tu agenda">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">Citas hoy</p>
                  <p className="text-lg font-semibold">{todaySummary?.totalAppointments ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Minutos planificados</p>
                  <p className="text-lg font-semibold">{formatMinutes(todaySummary?.totalMinutesPlanned)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Ventana</p>
                  <p className="text-lg font-semibold">
                    {todaySummary?.windowStart ? formatTime(todaySummary.windowStart) : "—"} ·{" "}
                    {todaySummary?.windowEnd ? formatTime(todaySummary.windowEnd) : "—"}
                  </p>
                </div>
              </div>
              {workload && (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Carga semanal estimada: {formatHours(workload.actualHours)} / {maxHoursWeek ? `${maxHoursWeek}h` : "sin límite"} (Fairness Guard)
                </p>
              )}
            </Card>

            <Card title="Citas de hoy" subtitle="Gestión rápida de estados">
              {appointments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Sin citas asignadas.</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((appointment) => {
                    const service = servicesMap[appointment.serviceId];
                    const suggestions = customerSuggestions[appointment.id] ?? [];
                    return (
                      <div key={appointment.id} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {formatTime(appointment.scheduledStart)} · {service?.name ?? "Servicio"}
                            </p>
                            <p className="text-xs text-[var(--muted)]">{appointment.clientName}</p>
                          </div>
                          <Badge variant="neutral">{appointment.status}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updating === appointment.id}
                            onClick={() => updateStatus(appointment.id, "IN_PROGRESS")}
                          >
                            Iniciar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updating === appointment.id}
                            onClick={() => updateStatus(appointment.id, "DONE")}
                          >
                            Terminar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updating === appointment.id}
                            onClick={() => updateStatus(appointment.id, "NO_SHOW")}
                          >
                            No show
                          </Button>
                        </div>
                        {appointment.customerId && suggestions.length > 0 && (
                          <div className="mt-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/70 p-3">
                            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                              Recomendaciones de CustomerPartner
                            </p>
                            <div className="mt-2 space-y-2 text-sm">
                              {suggestions.slice(0, 3).map((suggestion) => (
                                <div key={suggestion.serviceId} className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold">{suggestion.title}</p>
                                    <p className="text-xs text-[var(--muted)]">{suggestion.reason}</p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge variant="ok">Stock OK</Badge>
                                    <Badge
                                      variant={
                                        suggestion.marginStatus === "OK"
                                          ? "ok"
                                          : suggestion.marginStatus === "LOW_MARGIN"
                                          ? "warn"
                                          : "err"
                                      }
                                    >
                                      {suggestion.marginStatus === "OK"
                                        ? "OK"
                                        : suggestion.marginStatus === "LOW_MARGIN"
                                        ? "Margen bajo"
                                        : "Pérdidas"}
                                    </Badge>
                                    <span className="text-[var(--muted)]">
                                      {suggestion.estimatedDuration} min · {suggestion.price.toFixed(2)} €
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3">
                              <Button variant="outline" size="sm">
                                Proponer upgrade
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Timers de color" subtitle="Cuenta atrás local para servicios de tinte">
              {colorAppointments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No hay servicios de color hoy.</p>
              ) : (
                <div className="space-y-3">
                  {colorAppointments.map((appointment) => {
                    const service = servicesMap[appointment.serviceId];
                    return (
                      <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{service?.name ?? "Servicio de color"}</p>
                          <p className="text-xs text-[var(--muted)]">{appointment.clientName}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => startTimerForAppointment(appointment)}>
                          Iniciar temporizador
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {timer && (
                <div className="mt-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-4">
                  <p className="text-sm font-semibold">{timer.label}</p>
                  <p className="text-lg font-semibold">{formatRemaining(timer.remainingSeconds)}</p>
                  {timer.status === "done" && <p className="text-xs text-[var(--muted)]">Tiempo completado. Aviso local.</p>}
                </div>
              )}
              {/* TODO: Persistir timers en D1 o Durable Object para multi-dispositivo */}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Stock para tus servicios" subtitle="Estado de inventario asociado">
              {partner?.partner.serviceInventoryIssues.length ? (
                <div className="space-y-3">
                  {partner.partner.serviceInventoryIssues.map((issue) => (
                    <div key={issue.serviceId} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{issue.serviceName}</p>
                        <Badge variant={issue.status === "OUT_OF_STOCK" ? "err" : issue.status === "LOW_STOCK" ? "warn" : "ok"}>
                          {issue.status}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                        {issue.items.map((item) => (
                          <p key={`${issue.serviceId}-${item.inventoryItemId}`}>
                            {item.name}: {item.stockQuantity} (min {item.minStockQuantity})
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No hay alertas de stock para tus servicios.</p>
              )}
            </Card>

            <Card title="Mis tareas" subtitle="Pendientes asignadas">
              {tasksLoading ? (
                <p className="text-sm text-[var(--muted)]">Cargando tareas...</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No tienes tareas abiertas.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3"
                      style={{ borderColor: theme?.colors.accent ?? "var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{task.title}</p>
                          <p className="text-xs text-[var(--muted)]">{task.category}</p>
                        </div>
                        <Badge variant={task.severity === "CRITICAL" ? "err" : task.severity === "WARNING" ? "warn" : "info"}>
                          {task.severity}
                        </Badge>
                      </div>
                      {task.dueDate && <p className="mt-1 text-xs text-[var(--muted)]">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}>
                          En progreso
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => updateTaskStatus(task.id, "DONE")}>
                          Marcar hecha
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="WhatsApp helper" subtitle="Comandos rápidos para tu turno">
              {!whatsappIdentity ? (
                <p className="text-sm text-[var(--muted)]">No hay identidad WhatsApp asignada.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span>Número asignado: {whatsappIdentity.phoneNumber}</span>
                    <Button size="sm" variant="outline" onClick={() => setWhatsappCommandsOpen((prev) => !prev)}>
                      {whatsappCommandsOpen ? "Ocultar comandos" : "Ver comandos"}
                    </Button>
                  </div>
                  {whatsappCommandsOpen && (
                    <ul className="space-y-1 text-xs text-[var(--muted)]">
                      <li>• mi horario de hoy</li>
                      <li>• mi horario de esta semana</li>
                      <li>• mis tareas de hoy</li>
                      <li>• playbooks hoy</li>
                    </ul>
                  )}
                  <div className="space-y-2">
                    <TextArea
                      rows={2}
                      value={whatsappMessage}
                      onChange={(event) => setWhatsappMessage(event.target.value)}
                      placeholder="Escribe un comando para simular..."
                    />
                    {whatsappError && <p className="text-xs text-[var(--danger)]">{whatsappError}</p>}
                    <div className="flex justify-end">
                      <Button size="sm" onClick={sendWhatsappDemo} disabled={whatsappSending || !whatsappMessage.trim()}>
                        {whatsappSending ? "Enviando..." : "Simular mensaje"}
                      </Button>
                    </div>
                    {whatsappResponse && (
                      <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3 text-xs text-[var(--muted)]">
                        {whatsappResponse.length === 0 ? "Sin respuesta." : whatsappResponse.join("\n")}
                      </div>
                    )}
                    {whatsappResponse && lastWhatsappCommand && (
                      <p className="text-[10px] text-[var(--muted)]">Ultimo comando: {lastWhatsappCommand}</p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card title="Inbox de conversaciones" subtitle="Emails y mensajes pendientes">
              {inboxLoading ? (
                <p className="text-sm text-[var(--muted)]">Cargando inbox...</p>
              ) : inbox.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No tienes conversaciones asignadas.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[1fr,1.1fr]">
                  <div className="space-y-2">
                    {inbox.map((item) => (
                      <button
                        key={item.conversation.id}
                        type="button"
                        onClick={() => setSelectedConversationId(item.conversation.id)}
                        className={`w-full rounded-xl border border-[var(--border)]/60 p-2 text-left ${
                          item.conversation.id === selectedConversationId ? "bg-[var(--panel)]" : "bg-[var(--panel)]/40"
                        }`}
                        style={{ borderColor: theme?.colors.accent ?? "var(--border)" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">{item.conversation.subject ?? "Conversacion"}</p>
                          {item.unreadForActor && <Badge variant="warn">{item.unreadCountForActor}</Badge>}
                        </div>
                        <p className="text-[10px] text-[var(--muted)]">{item.lastMessagePreview || "Sin mensajes"}</p>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3">
                    {conversationLoading || !conversationDetail ? (
                      <p className="text-sm text-[var(--muted)]">Selecciona una conversacion.</p>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold">{conversationDetail.conversation.subject ?? "Conversacion"}</p>
                          <p className="text-[10px] text-[var(--muted)]">{conversationDetail.conversation.channel ?? "EMAIL"}</p>
                        </div>
                        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                          {conversationDetail.messages.length === 0 ? (
                            <p className="text-[10px] text-[var(--muted)]">Aun no hay mensajes.</p>
                          ) : (
                            conversationDetail.messages.map((msg) => (
                              <div key={msg.id} className="rounded-lg border border-[var(--border)]/50 bg-[var(--panel)]/60 p-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-semibold">{msg.senderType}</p>
                                  <p className="text-[10px] text-[var(--muted)]">{formatDateTime(msg.createdAt)}</p>
                                </div>
                                <p className="text-xs">{msg.body}</p>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="space-y-2">
                          <TextArea
                            rows={3}
                            value={replyMessage}
                            onChange={(event) => setReplyMessage(event.target.value)}
                            placeholder="Escribe tu respuesta..."
                          />
                          {replyError && <p className="text-xs text-[var(--danger)]">{replyError}</p>}
                          <div className="flex justify-end">
                            <Button size="sm" onClick={sendConversationReply} disabled={replySending || !replyMessage.trim()}>
                              {replySending ? "Enviando..." : "Responder"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card title="Playbooks para hoy" subtitle="Guías recomendadas">
              {playbooksLoading ? (
                <p className="text-sm text-[var(--muted)]">Cargando playbooks...</p>
              ) : playbooks.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No hay playbooks recomendados.</p>
              ) : (
                <div className="space-y-2">
                  {playbooks.map((doc) => (
                    <div key={doc.id} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{doc.title}</p>
                        {doc.importance && (
                          <Badge variant={doc.importance === "CRITICAL" ? "err" : doc.importance === "STANDARD" ? "warn" : "outline"}>
                            {doc.importance}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)]">{doc.type}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Tu Partner IA" subtitle="Sugerencias prácticas para el turno">
              {partner?.realtimeSuggestions?.length ? (
                <div className="space-y-3">
                  {partner.realtimeSuggestions.map((item, idx) => (
                    <div key={`${item.title}-${idx}`} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <Badge variant={item.severity === "critical" ? "err" : item.severity === "warn" ? "warn" : "ok"}>
                          {item.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{item.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">Sin sugerencias destacadas.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
