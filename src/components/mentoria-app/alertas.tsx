"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { ParentAlert, AlertLevel } from "@/app/api/mentoria/alerts/route";

const LEVEL_CONFIG: Record<AlertLevel, { bg: string; border: string; icon: string; badge: string }> = {
  critical: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: "🚨",
    badge: "bg-rose-100 text-rose-700",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "⚠️",
    badge: "bg-amber-100 text-amber-700",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "ℹ️",
    badge: "bg-blue-100 text-blue-700",
  },
};

const LEVEL_LABELS: Record<AlertLevel, string> = {
  critical: "Urgente",
  warning: "Atención",
  info: "Información",
};

function AlertCard({ alert }: { alert: ParentAlert }) {
  const cfg = LEVEL_CONFIG[alert.level];
  return (
    <div className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
              {LEVEL_LABELS[alert.level]}
            </span>
            <span className="text-xs text-slate-400">{alert.studentName}</span>
          </div>
          <div className="font-semibold text-slate-950 text-sm">{alert.title}</div>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{alert.message}</p>
        </div>
      </div>
    </div>
  );
}

export function MentoriaAlertas() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ParentAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const url = studentId
        ? `/api/mentoria/alerts?studentId=${encodeURIComponent(studentId)}`
        : "/api/mentoria/alerts";
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/alertas";
        return;
      }
      if (res.status === 409) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const body = await res.json().catch(() => null) as { alerts?: ParentAlert[] } | null;
      if (!body) {
        setError("Error al cargar alertas.");
        setLoading(false);
        return;
      }
      setAlerts(body.alerts ?? []);
      setLoading(false);
    })();
  }, [studentId]);

  const critical = alerts.filter((a) => a.level === "critical");
  const warning = alerts.filter((a) => a.level === "warning");
  const info = alerts.filter((a) => a.level === "info");

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <MentoriaAppSectionNav active="parents" />
        <div className="space-y-6">

          {/* Header */}
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">Alertas</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Avisos importantes sobre la actividad y preparación de tu hijo/a.
                </p>
              </div>
              {!loading && alerts.length > 0 && (
                <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${critical.length > 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
                </span>
              )}
            </div>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Analizando actividad…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && alerts.length === 0 && (
            <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-semibold text-slate-950">Todo va bien</div>
              <p className="mt-1 text-sm text-slate-500">
                No hay alertas activas. Tu hijo/a mantiene un buen ritmo en Mentoría.
              </p>
            </div>
          )}

          {!loading && critical.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-600 px-1">
                Urgente
              </div>
              {critical.map((a) => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}

          {!loading && warning.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 px-1">
                Atención
              </div>
              {warning.map((a) => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}

          {!loading && info.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 px-1">
                Información
              </div>
              {info.map((a) => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}

          {!loading && alerts.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400 text-center">
                Las alertas se calculan en tiempo real según la actividad registrada en Mentoría.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
