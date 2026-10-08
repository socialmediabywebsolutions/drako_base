"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MentorSessionAllRow } from "@/app/api/mentoria/mentor-sessions-all/route";

const EMOTIONAL_LABELS: Record<string, string> = {
  animado: "😊 Animado",
  neutro: "😐 Neutro",
  desanimado: "😔 Desanimado",
  bloqueado: "😤 Bloqueado",
};

const EMOTIONAL_COLORS: Record<string, string> = {
  animado: "bg-emerald-50 text-emerald-700",
  neutro: "bg-slate-100 text-slate-600",
  desanimado: "bg-amber-50 text-amber-700",
  bloqueado: "bg-rose-50 text-rose-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionRow({ session }: { session: MentorSessionAllRow }) {
  const emoColor = EMOTIONAL_COLORS[session.emotionalState ?? ""] ?? "bg-slate-100 text-slate-600";
  const emoLabel = EMOTIONAL_LABELS[session.emotionalState ?? ""] ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(session.studentId)}`}
              className="font-semibold text-slate-900 hover:text-emerald-700 transition text-sm"
            >
              {session.studentName}
            </Link>
            {session.subjectName && (
              <>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-sm text-slate-700">{session.subjectName}</span>
              </>
            )}
            {session.topic && (
              <span className="text-xs text-slate-400 truncate max-w-[200px]">— {session.topic}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">{formatDate(session.createdAt)}</span>
            <span className="text-xs font-medium text-slate-700">{session.durationMinutes} min</span>
            {emoLabel && (
              <span className={`text-xs rounded-lg px-2 py-0.5 ${emoColor}`}>{emoLabel}</span>
            )}
          </div>
          {session.tutorSummary && (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2">{session.tutorSummary}</p>
          )}
        </div>
        <Link
          href={`/mentoria/panel/alumno/sesiones?studentId=${encodeURIComponent(session.studentId)}`}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
        >
          Ver →
        </Link>
      </div>
    </div>
  );
}

export function MentorSessionsOverview() {
  const router = useRouter();
  const [sessions, setSessions] = useState<MentorSessionAllRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const LIMIT = 30;

  const fetchSessions = useCallback(async (p: number, replace: boolean) => {
    if (p === 0) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/mentoria/mentor-sessions-all?page=${p}&limit=${LIMIT}`, {
        cache: "no-store",
      });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
      if (res.status === 403) { setError("Acceso restringido."); return; }
      const data = await res.json().catch(() => null) as {
        sessions?: MentorSessionAllRow[];
        total?: number;
      } | null;
      const rows = data?.sessions ?? [];
      setSessions((prev) => replace ? rows : [...prev, ...rows]);
      setTotal(data?.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions(0, true);
  }, [fetchSessions]);

  const hasMore = sessions.length < total;

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  // Group by date
  const grouped: { label: string; sessions: MentorSessionAllRow[] }[] = [];
  const seenDates = new Set<string>();
  for (const s of sessions) {
    const dateLabel = new Date(s.createdAt).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!seenDates.has(dateLabel)) {
      seenDates.add(dateLabel);
      grouped.push({ label: dateLabel, sessions: [] });
    }
    grouped[grouped.length - 1].sessions.push(s);
  }

  const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remMin = totalMinutes % 60;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Historial de sesiones</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {loading ? "Cargando…" : `${total} sesiones completadas de todos los alumnos`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/mentoria/panel")}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Panel
            </button>
          </div>

          {!loading && sessions.length > 0 && (
            <div className="mt-4 flex gap-4 text-sm">
              <div className="rounded-xl bg-slate-50 px-4 py-2">
                <span className="font-semibold text-slate-900">{total}</span>
                <span className="text-slate-500 ml-1">sesiones</span>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-2">
                <span className="font-semibold text-emerald-800">
                  {totalHours > 0 ? `${totalHours}h ` : ""}{remMin}min
                </span>
                <span className="text-emerald-600 ml-1">en esta página</span>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando sesiones…
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="font-semibold text-slate-950">Sin sesiones registradas</div>
            <p className="mt-1 text-sm text-slate-500">
              Las sesiones aparecerán aquí a medida que se registren desde el perfil de cada alumno.
            </p>
          </div>
        )}

        {!loading && grouped.map((group) => (
          <div key={group.label}>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1 capitalize">
              {group.label}
            </h2>
            <div className="space-y-2">
              {group.sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </div>
        ))}

        {hasMore && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => void fetchSessions(page + 1, false)}
              disabled={loadingMore}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {loadingMore ? "Cargando…" : `Cargar más (${total - sessions.length} restantes)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
