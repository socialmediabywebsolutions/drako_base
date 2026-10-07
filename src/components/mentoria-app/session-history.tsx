"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { SessionHistoryItem } from "@/app/api/mentoria/session-history/route";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊",
  neutro: "😐",
  desanimado: "😔",
  bloqueado: "😤",
  happy: "😊",
  neutral: "😐",
  sad: "😔",
  frustrated: "😤",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function SessionCard({ session }: { session: SessionHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const mood = session.emotionalState ?? "";
  const emoji = MOOD_EMOJI[mood.toLowerCase()] ?? "🙂";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl">{emoji}</span>
            <div className="min-w-0">
              <div className="font-medium text-slate-950 truncate">
                {session.subjectName ?? "Sesión general"}
              </div>
              {session.topic && (
                <div className="text-xs text-slate-500 truncate mt-0.5">{session.topic}</div>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm text-slate-500">{formatDate(session.createdAt)}</div>
            <div className="text-xs text-emerald-600 font-medium">{formatDuration(session.durationMinutes)}</div>
          </div>
        </div>
      </button>

      {expanded && (session.tutorSummary || session.recommendedNextStep) && (
        <div className="border-t border-slate-100 px-5 pb-4 pt-3 space-y-3">
          {session.tutorSummary && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Resumen del tutor</div>
              <p className="text-sm text-slate-700 leading-relaxed">{session.tutorSummary}</p>
            </div>
          )}
          {session.recommendedNextStep && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <div className="text-xs font-semibold text-emerald-600 mb-1">→ Próximo paso recomendado</div>
              <p className="text-sm text-slate-700">{session.recommendedNextStep}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

export function MentoriaSessionHistory() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    if (p === 0) setLoading(true);
    else setLoadingMore(true);

    const base = studentId
      ? `/api/mentoria/session-history?studentId=${encodeURIComponent(studentId)}`
      : "/api/mentoria/session-history";
    const url = `${base}&page=${p}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, { cache: "no-store" });

    if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/historial"; return; }
    if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }

    const body = await res.json().catch(() => null) as { sessions?: SessionHistoryItem[]; total?: number } | null;
    if (!body) {
      setError("Error al cargar historial.");
    } else {
      setSessions((prev) => append ? [...prev, ...(body.sessions ?? [])] : (body.sessions ?? []));
      setTotal(body.total ?? 0);
    }

    if (p === 0) setLoading(false);
    else setLoadingMore(false);
  }, [studentId]);

  useEffect(() => {
    setPage(0);
    void fetchPage(0, false);
  }, [fetchPage]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchPage(nextPage, true);
  }

  const hasMore = sessions.length < total;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <MentoriaAppSectionNav active="historial" />
        <div className="space-y-4">

          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-950">Historial de sesiones</h1>
            <p className="mt-1 text-sm text-slate-500">
              {total > 0 ? `${total} sesiones completadas` : "Tus sesiones completadas en Mentoría."}
            </p>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Cargando sesiones…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
              <div className="text-4xl mb-3">📚</div>
              <div className="font-semibold text-slate-950">Sin sesiones todavía</div>
              <p className="mt-1 text-sm text-slate-500">
                Cuando completes tu primera sesión, aparecerá aquí con el resumen del tutor.
              </p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}

          {hasMore && !loading && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-2xl bg-white py-4 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {loadingMore ? "Cargando…" : `Ver más (${total - sessions.length} restantes)`}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
