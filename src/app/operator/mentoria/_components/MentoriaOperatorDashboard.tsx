"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SystemHealth = {
  notifications: { pending: number; failed: number; abandoned: number; total: number };
  feedback: { pending: number; failed: number; total: number };
  publishes: { pending: number; failed: number; abandoned: number; total: number };
  criticalEvents: number;
  silence: {
    studentsWithoutRecentFeedback: number;
    studentsWithoutRecentParentNotification: number;
    studentsWithoutRecentAcademicActivity: number;
  };
};

type StudentRow = {
  tenantId: string;
  studentId: string;
  name: string;
  plan: string | null;
  schoolYear: string | null;
  sessionsToday: number;
  lastSessionAt: string | null;
  trialEndsAt: string | null;
  status: "active" | "trial" | "expired" | "inactive";
};

type FamilyRow = {
  tenantId: string;
  familyId: string;
  parentName: string;
  parentEmail: string;
  studentCount: number;
  plan: string | null;
  createdAt: string;
  trialEndsAt: string | null;
};

type SessionMetrics = {
  sessionsToday: number;
  sessionsThisWeek: number;
  activeNow: number;
  avgDurationMinutes: number;
  completionRate: number;
};

type SafetyAlertRow = {
  id: string;
  tenantId: string | null;
  sessionId: string;
  studentId: string;
  parentPhoneMasked: string;
  level: string;
  category: string;
  sendStatus: string;
  messageId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
};

type SafetyData = {
  summary: { total: number; high: number; medium: number; sent: number; failed: number; pendingReview: number };
  alerts: SafetyAlertRow[];
};

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "resumen"   as const, icon: "🏠", label: "Resumen",   desc: "Health + KPIs" },
  { id: "familias"  as const, icon: "👨‍👩‍👧", label: "Familias",  desc: "Clientes activos" },
  { id: "sesiones"  as const, icon: "📚", label: "Sesiones",  desc: "Actividad de hoy" },
  { id: "salud"     as const, icon: "🩺", label: "Salud",     desc: "Alertas del sistema" },
  { id: "seguridad" as const, icon: "🔴", label: "Seguridad", desc: "Protocolo de seguridad" },
] as const;
type NavId = (typeof NAV)[number]["id"];

// ─── Atoms ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: "green" | "red" | "blue" | "amber" }) {
  const colors = {
    green: "text-emerald-600",
    red: "text-red-500",
    blue: "text-blue-600",
    amber: "text-amber-500",
  };
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${accent ? colors[accent] : "text-gray-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">{children}</h2>;
}

function AlertBanner({ type, children }: { type: "error" | "warn" | "ok"; children: React.ReactNode }) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-700",
    warn:  "bg-amber-50 border-amber-200 text-amber-700",
    ok:    "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  const icons = { error: "🔴", warn: "🟡", ok: "🟢" };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${styles[type]}`}>
      <span>{icons[type]}</span>
      {children}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return <span className="text-xs text-gray-400">—</span>;
  const colors: Record<string, string> = {
    free:   "bg-gray-100 text-gray-600",
    pro:    "bg-blue-100 text-blue-700",
    family: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[plan] ?? "bg-gray-100 text-gray-600"}`}>
      {plan}
    </span>
  );
}

function StatusDot({ status }: { status: StudentRow["status"] }) {
  const map = {
    active:   "bg-emerald-400",
    trial:    "bg-blue-400",
    expired:  "bg-red-400",
    inactive: "bg-gray-300",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${map[status]}`} />;
}

function HealthBar({ label, value, max, warn = 3 }: { label: string; value: number; max?: number; warn?: number }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const bad = value > warn;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 truncate text-xs text-gray-500">{label}</span>
      <span className={`w-8 text-right text-sm font-bold tabular-nums ${bad ? "text-red-600" : "text-gray-700"}`}>{value}</span>
      {max != null && (
        <div className="h-1.5 flex-1 rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${bad ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function ResumenSection({
  health,
  families,
  sessions,
  loading,
}: {
  health: SystemHealth | null;
  families: FamilyRow[];
  sessions: SessionMetrics | null;
  loading: boolean;
}) {
  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>;

  const trialCount    = families.filter((f) => f.trialEndsAt && new Date(f.trialEndsAt) > new Date()).length;
  const expiredCount  = families.filter((f) => f.trialEndsAt && new Date(f.trialEndsAt) <= new Date() && !f.plan?.startsWith("pro") && !f.plan?.startsWith("family")).length;
  const criticalAlerts = health ? health.criticalEvents + health.notifications.failed + health.feedback.failed : 0;

  return (
    <div className="space-y-6">
      {/* Alertas críticas */}
      {criticalAlerts > 0 && (
        <div className="space-y-2">
          <SectionLabel>Alertas activas</SectionLabel>
          {(health?.notifications.failed ?? 0) > 0 && (
            <AlertBanner type="error">
              {health!.notifications.failed} notificaciones WhatsApp fallidas — padres sin recibir resúmenes
            </AlertBanner>
          )}
          {(health?.feedback.failed ?? 0) > 0 && (
            <AlertBanner type="warn">
              {health!.feedback.failed} feedbacks de sesión sin guardar
            </AlertBanner>
          )}
          {(health?.criticalEvents ?? 0) > 0 && (
            <AlertBanner type="error">
              {health!.criticalEvents} eventos críticos en el sistema de resiliencia
            </AlertBanner>
          )}
        </div>
      )}
      {criticalAlerts === 0 && health && (
        <AlertBanner type="ok">Sistema operativo — sin alertas críticas</AlertBanner>
      )}

      {/* KPIs */}
      <div>
        <SectionLabel>Familias</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Total familias" value={families.length} accent="blue" />
          <KpiCard label="En trial"       value={trialCount}      accent="amber" sub="activos" />
          <KpiCard label="Trial expirado" value={expiredCount}    accent={expiredCount > 0 ? "red" : undefined} />
          <KpiCard label="Con plan activo" value={families.filter(f => f.plan === "pro" || f.plan === "family").length} accent="green" />
        </div>
      </div>

      {sessions && (
        <div>
          <SectionLabel>Sesiones</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Hoy"           value={sessions.sessionsToday}     accent="blue" />
            <KpiCard label="Esta semana"   value={sessions.sessionsThisWeek} />
            <KpiCard label="Activas ahora" value={sessions.activeNow}         accent={sessions.activeNow > 0 ? "green" : undefined} />
            <KpiCard label="Tasa compleción" value={`${(sessions.completionRate * 100).toFixed(0)}%`} />
          </div>
        </div>
      )}

      {/* Silencio del sistema */}
      {health && (
        <div>
          <SectionLabel>Alumnos sin actividad reciente</SectionLabel>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              <HealthBar label="Sin feedback reciente"         value={health.silence.studentsWithoutRecentFeedback}              max={families.length * 2} warn={2} />
              <HealthBar label="Sin notif. a padres"          value={health.silence.studentsWithoutRecentParentNotification}     max={families.length * 2} warn={2} />
              <HealthBar label="Sin actividad académica"      value={health.silence.studentsWithoutRecentAcademicActivity}       max={families.length * 2} warn={2} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FamiliasSection({ families, loading }: { families: FamilyRow[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = families.filter(
    (f) =>
      f.parentName.toLowerCase().includes(search.toLowerCase()) ||
      f.parentEmail.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Cargando familias...</div>;

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Buscar familia por nombre o email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
      />

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          {families.length === 0 ? "Sin familias registradas aún" : "Sin resultados para esa búsqueda"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4">Familia</th>
                <th className="pb-2 pr-4">Alumnos</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Trial hasta</th>
                <th className="pb-2">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const trialDate = f.trialEndsAt ? new Date(f.trialEndsAt) : null;
                const trialActive = trialDate && trialDate > new Date();
                const daysLeft = trialDate ? Math.ceil((trialDate.getTime() - Date.now()) / 86400000) : null;
                return (
                  <tr key={f.tenantId} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">{f.parentName}</div>
                      <div className="text-[11px] text-gray-400">{f.parentEmail}</div>
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-gray-600">{f.studentCount}</td>
                    <td className="py-3 pr-4"><PlanBadge plan={f.plan} /></td>
                    <td className="py-3 pr-4">
                      {trialDate ? (
                        <span className={`text-xs font-medium ${trialActive ? (daysLeft! <= 3 ? "text-amber-600" : "text-blue-600") : "text-red-500"}`}>
                          {trialActive ? `${daysLeft}d restantes` : "Expirado"}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="py-3 text-xs text-gray-400">
                      {new Date(f.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SesionesSection({ students, loading }: { students: StudentRow[]; loading: boolean }) {
  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Cargando sesiones...</div>;

  const active = students.filter((s) => s.sessionsToday > 0).sort((a, b) => (b.lastSessionAt ?? "").localeCompare(a.lastSessionAt ?? ""));
  const inactive = students.filter((s) => s.sessionsToday === 0);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Con actividad hoy ({active.length})</SectionLabel>
        {active.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">Sin sesiones por el momento</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Alumno</th>
                  <th className="px-4 py-3">Curso</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Sesiones hoy</th>
                  <th className="px-4 py-3">Última sesión</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.studentId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.schoolYear ?? "—"}</td>
                    <td className="px-4 py-3"><PlanBadge plan={s.plan} /></td>
                    <td className="px-4 py-3 tabular-nums text-gray-700">{s.sessionsToday}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {s.lastSessionAt ? new Date(s.lastSessionAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusDot status={s.status} />
                        <span className="text-xs capitalize text-gray-500">{s.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Sin sesiones hoy ({inactive.length})</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {inactive.map((s) => (
            <div key={s.studentId} className="rounded-lg border border-gray-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{s.name}</span>
                <StatusDot status={s.status} />
              </div>
              <div className="mt-0.5 text-[11px] text-gray-400">{s.schoolYear ?? "Sin curso"}</div>
              <div className="mt-1"><PlanBadge plan={s.plan} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SaludSection({ health, loading }: { health: SystemHealth | null; loading: boolean }) {
  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Cargando salud del sistema...</div>;
  if (!health) return <AlertBanner type="warn">No se pudo cargar la salud del sistema</AlertBanner>;

  const subsystems = [
    {
      title: "Notificaciones WhatsApp",
      icon: "💬",
      rows: [
        { label: "Pendientes", value: health.notifications.pending },
        { label: "Fallidas",   value: health.notifications.failed,   bad: health.notifications.failed > 0 },
        { label: "Abandonadas",value: health.notifications.abandoned, bad: health.notifications.abandoned > 0 },
        { label: "Total",      value: health.notifications.total,    total: true },
      ],
    },
    {
      title: "Feedback de sesión",
      icon: "📝",
      rows: [
        { label: "Pendiente",  value: health.feedback.pending },
        { label: "Fallido",    value: health.feedback.failed,  bad: health.feedback.failed > 0 },
        { label: "Total",      value: health.feedback.total,   total: true },
      ],
    },
    {
      title: "Publicaciones adquisición",
      icon: "📣",
      rows: [
        { label: "Pendientes", value: health.publishes.pending },
        { label: "Fallidas",   value: health.publishes.failed,    bad: health.publishes.failed > 0 },
        { label: "Abandonadas",value: health.publishes.abandoned, bad: health.publishes.abandoned > 0 },
        { label: "Total",      value: health.publishes.total,     total: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {health.criticalEvents > 0 && (
        <AlertBanner type="error">
          {health.criticalEvents} eventos críticos en el sistema de resiliencia — revisar logs
        </AlertBanner>
      )}
      {health.criticalEvents === 0 && (
        <AlertBanner type="ok">Sin eventos críticos registrados</AlertBanner>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {subsystems.map((sys) => (
          <div key={sys.title} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">{sys.icon}</span>
              <span className="text-sm font-semibold text-gray-800">{sys.title}</span>
            </div>
            <div className="space-y-2">
              {sys.rows.map((row) => (
                <div key={row.label} className={`flex justify-between text-sm ${row.total ? "border-t border-gray-100 pt-2 font-bold" : ""}`}>
                  <span className={row.bad ? "text-red-600" : "text-gray-500"}>{row.label}</span>
                  <span className={`tabular-nums font-semibold ${row.bad ? "text-red-600" : row.total ? "text-gray-900" : "text-gray-700"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <SectionLabel>Silencio del sistema (alumnos sin actividad reciente)</SectionLabel>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <HealthBar label="Sin feedback reciente"   value={health.silence.studentsWithoutRecentFeedback}           max={20} warn={2} />
            <HealthBar label="Sin notif. a padres"     value={health.silence.studentsWithoutRecentParentNotification}  max={20} warn={2} />
            <HealthBar label="Sin actividad académica" value={health.silence.studentsWithoutRecentAcademicActivity}    max={20} warn={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SeguridadSection({ safetyData, loading, onReload }: { safetyData: SafetyData | null; loading: boolean; onReload: () => void }) {
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Cargando alertas de seguridad...</div>;

  const summary = safetyData?.summary ?? { total: 0, high: 0, medium: 0, sent: 0, failed: 0, pendingReview: 0 };
  const alerts  = safetyData?.alerts ?? [];

  const categoryLabel: Record<string, string> = {
    suicidal:          "Ideación suicida",
    self_harm:         "Autolesión",
    abuse:             "Abuso / maltrato",
    bullying:          "Acoso escolar",
    emotional_distress:"Malestar emocional",
  };

  async function markReviewed(alertId: string) {
    setReviewError(null);
    try {
      const res = await fetch("/api/operator/mentoria/safety-alerts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, notes: reviewNotes || null }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!body.ok) throw new Error(body.error ?? "REVIEW_FAILED");
      setReviewing(null);
      setReviewNotes("");
      onReload();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Error al marcar como revisada");
    }
  }

  return (
    <div className="space-y-6">
      {summary.high > 0 && (
        <AlertBanner type="error">
          {summary.high} alerta{summary.high > 1 ? "s" : ""} de nivel ALTO — notificaciones críticas enviadas a padres
        </AlertBanner>
      )}
      {summary.pendingReview > 0 && (
        <AlertBanner type="warn">
          {summary.pendingReview} alerta{summary.pendingReview > 1 ? "s" : ""} pendiente{summary.pendingReview > 1 ? "s" : ""} de revisión por operador
        </AlertBanner>
      )}
      {summary.failed > 0 && (
        <AlertBanner type="warn">
          {summary.failed} notificación{summary.failed > 1 ? "es" : ""} de seguridad fallida{summary.failed > 1 ? "s" : ""} — padres no contactados
        </AlertBanner>
      )}
      {summary.total === 0 && (
        <AlertBanner type="ok">Sin alertas de seguridad registradas</AlertBanner>
      )}

      <div>
        <SectionLabel>Resumen últimas 100 alertas</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <KpiCard label="Total"              value={summary.total}              />
          <KpiCard label="Nivel ALTO"         value={summary.high}          accent={summary.high > 0 ? "red" : undefined} />
          <KpiCard label="Nivel MEDIO"        value={summary.medium}        accent={summary.medium > 0 ? "amber" : undefined} />
          <KpiCard label="Enviadas"           value={summary.sent}          accent="green" />
          <KpiCard label="Fallidas"           value={summary.failed}        accent={summary.failed > 0 ? "red" : undefined} />
          <KpiCard label="Sin revisar"        value={summary.pendingReview} accent={summary.pendingReview > 0 ? "amber" : undefined} />
        </div>
      </div>

      {reviewError && <AlertBanner type="error">{reviewError}</AlertBanner>}

      {alerts.length > 0 && (
        <div>
          <SectionLabel>Historial de alertas</SectionLabel>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Alumno ID</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Envío</th>
                  <th className="px-4 py-3">Revisión</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <>
                    <tr key={a.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${reviewing === a.id ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          a.level === "high"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {a.level === "high" ? "ALTO" : "MEDIO"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {categoryLabel[a.category] ?? a.category}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                        {a.studentId.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {a.parentPhoneMasked}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${
                          a.sendStatus === "success" ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {a.sendStatus === "success" ? "✓ Enviado" : "✗ Fallido"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {a.reviewedAt ? (
                          <div className="text-[11px] text-emerald-600">
                            ✓ Revisado
                            <div className="text-gray-400">{new Date(a.reviewedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReviewing(a.id); setReviewNotes(""); setReviewError(null); }}
                            className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                          >
                            Marcar revisada
                          </button>
                        )}
                      </td>
                    </tr>
                    {reviewing === a.id && (
                      <tr key={`review-${a.id}`} className="bg-amber-50/60">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              placeholder="Notas de seguimiento (opcional)…"
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs focus:border-amber-400 focus:outline-none"
                            />
                            <button
                              onClick={() => void markReviewed(a.id)}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                            >
                              Confirmar revisión
                            </button>
                            <button
                              onClick={() => { setReviewing(null); setReviewNotes(""); }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function MentoriaOperatorDashboard() {
  const [tab, setTab]             = useState<NavId>("resumen");
  const [health, setHealth]       = useState<SystemHealth | null>(null);
  const [families, setFamilies]   = useState<FamilyRow[]>([]);
  const [students, setStudents]   = useState<StudentRow[]>([]);
  const [sessions, setSessions]   = useState<SessionMetrics | null>(null);
  const [safetyData, setSafetyData] = useState<SafetyData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, familiesRes, studentsRes, sessionsRes, safetyRes] = await Promise.allSettled([
        fetch("/api/operator/mentoria/health/system").then((r) => r.json() as Promise<Record<string, unknown>>),
        fetch("/api/operator/mentoria/families").then((r) => r.json() as Promise<Record<string, unknown>>),
        fetch("/api/operator/mentoria/students").then((r) => r.json() as Promise<Record<string, unknown>>),
        fetch("/api/operator/mentoria/sessions/metrics").then((r) => r.json() as Promise<Record<string, unknown>>),
        fetch("/api/operator/mentoria/safety-alerts?limit=100").then((r) => r.json() as Promise<Record<string, unknown>>),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value?.ok) {
        setHealth(healthRes.value.health as SystemHealth);
      }
      if (familiesRes.status === "fulfilled" && familiesRes.value?.ok) {
        setFamilies((familiesRes.value.families as FamilyRow[]) ?? []);
      }
      if (studentsRes.status === "fulfilled" && studentsRes.value?.ok) {
        setStudents((studentsRes.value.students as StudentRow[]) ?? []);
      }
      if (sessionsRes.status === "fulfilled" && sessionsRes.value?.ok) {
        setSessions(sessionsRes.value.metrics as SessionMetrics);
      }
      if (safetyRes.status === "fulfilled" && safetyRes.value?.ok) {
        setSafetyData({
          summary: safetyRes.value.summary as SafetyData["summary"],
          alerts: (safetyRes.value.alerts as SafetyAlertRow[]) ?? [],
        });
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white shadow-sm">
                M
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">Mentoría</div>
                <div className="text-[11px] text-gray-400">Panel de operador</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">
                Actualizado {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                onClick={() => void fetchData()}
                disabled={loading}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "…" : "↻ Refrescar"}
              </button>
            </div>
          </div>

          {/* Nav */}
          <div className="flex gap-1 overflow-x-auto pb-0" role="tablist">
            {NAV.map((n) => (
              <button
                key={n.id}
                role="tab"
                aria-selected={tab === n.id}
                onClick={() => setTab(n.id)}
                className={[
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === n.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                ].join(" ")}
              >
                <span className="text-base leading-none">{n.icon}</span>
                <span>{n.label}</span>
                <span className="hidden text-[11px] text-gray-400 sm:inline">— {n.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && <AlertBanner type="error">Error: {error}</AlertBanner>}

        {tab === "resumen" && (
          <ResumenSection health={health} families={families} sessions={sessions} loading={loading} />
        )}
        {tab === "familias" && (
          <FamiliasSection families={families} loading={loading} />
        )}
        {tab === "sesiones" && (
          <SesionesSection students={students} loading={loading} />
        )}
        {tab === "salud" && (
          <SaludSection health={health} loading={loading} />
        )}
        {tab === "seguridad" && (
          <SeguridadSection safetyData={safetyData} loading={loading} onReload={() => void fetchData()} />
        )}
      </div>
    </div>
  );
}
