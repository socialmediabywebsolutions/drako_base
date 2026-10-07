"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MentorAlert, MentorAlertLevel } from "@/app/api/mentoria/mentor-alerts/route";

const LEVEL_CONFIG: Record<
  MentorAlertLevel,
  { bg: string; border: string; badge: string; icon: string }
> = {
  critical: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    badge: "bg-rose-100 text-rose-700",
    icon: "🔴",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: "⚠️",
  },
  info: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-600",
    icon: "ℹ️",
  },
};

const LEVEL_LABEL: Record<MentorAlertLevel, string> = {
  critical: "Crítico",
  warning: "Atención",
  info: "Info",
};

function AlertCard({ alert }: { alert: MentorAlert }) {
  const cfg = LEVEL_CONFIG[alert.level] ?? LEVEL_CONFIG.info;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{alert.title}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
              {LEVEL_LABEL[alert.level]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(alert.studentId)}`}
            className="mt-2 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-900 transition"
          >
            Ver perfil →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function MentorAlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<MentorAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | MentorAlertLevel>("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/mentor-alerts", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel/alertas";
        return;
      }
      if (res.status === 403) {
        setError("Acceso restringido.");
        setLoading(false);
        return;
      }
      const body = await res.json().catch(() => null) as { alerts?: MentorAlert[] } | null;
      if (!body) {
        setError("Error al cargar las alertas.");
        setLoading(false);
        return;
      }
      setAlerts(body.alerts ?? []);
      setLoading(false);
    })();
  }, []);

  const critical = alerts.filter((a) => a.level === "critical").length;
  const warning = alerts.filter((a) => a.level === "warning").length;

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.level === filter);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Alertas</h1>
              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? "Cargando alertas…"
                  : alerts.length > 0
                    ? `${alerts.length} alertas · ${critical} críticas · ${warning} de atención`
                    : "Sin alertas activas."}
              </p>
            </div>
            <Link
              href="/mentoria/panel"
              className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              ← Panel
            </Link>
          </div>
        </div>

        {/* Summary pills */}
        {!loading && alerts.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-rose-600">{critical}</div>
              <div className="text-xs text-slate-500 mt-1">Críticas</div>
            </div>
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-amber-600">{warning}</div>
              <div className="text-xs text-slate-500 mt-1">Atención</div>
            </div>
            <div className="rounded-[28px] bg-white p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-slate-700">
                {alerts.filter((a) => a.level === "info").length}
              </div>
              <div className="text-xs text-slate-500 mt-1">Informativas</div>
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && alerts.length > 1 && (
          <div className="rounded-[28px] bg-white p-4 shadow-sm">
            <div className="flex gap-2 flex-wrap">
              {(["all", "critical", "warning", "info"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filter === f
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "all"
                    ? "Todas"
                    : f === "critical"
                      ? "Críticas"
                      : f === "warning"
                        ? "Atención"
                        : "Info"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Analizando actividad de alumnos…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && alerts.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-semibold text-slate-950">Todo en orden</div>
            <p className="mt-1 text-sm text-slate-500">
              No hay alertas activas. Todos los alumnos están al día.
            </p>
          </div>
        )}

        {/* Alerts list */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}

        {!loading && !error && filter !== "all" && filtered.length === 0 && (
          <div className="rounded-[28px] bg-white p-6 shadow-sm text-center text-sm text-slate-400">
            Sin alertas en esta categoría.
          </div>
        )}
      </div>
    </div>
  );
}
