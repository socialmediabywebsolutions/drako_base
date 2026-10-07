"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { MentorSessionItem } from "@/app/api/mentoria/mentor-sessions/route";

const MOOD_EMOJI: Record<string, string> = {
  animado: "😊", neutro: "😐", desanimado: "😔", bloqueado: "😤",
  happy: "😊", neutral: "😐", sad: "😔", frustrated: "😤",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SessionCard({ session }: { session: MentorSessionItem }) {
  const mood = session.emotionalState?.toLowerCase() ?? "";
  const emoji = MOOD_EMOJI[mood] ?? "🙂";
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base">{emoji}</span>
            <span className="font-semibold text-slate-900 truncate">
              {session.subjectName ?? "Sesión general"}
            </span>
            {session.topic && (
              <span className="text-xs text-slate-500 truncate hidden sm:block">· {session.topic}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">{formatDate(session.createdAt)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-slate-700">{session.durationMinutes} min</div>
        </div>
      </div>

      {(session.tutorSummary ?? session.recommendedNextStep) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 transition"
        >
          {expanded ? "▲ Ocultar resumen" : "▼ Ver resumen"}
        </button>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {session.tutorSummary && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-0.5">Resumen</div>
              <p className="text-sm text-slate-700 leading-relaxed">{session.tutorSummary}</p>
            </div>
          )}
          {session.recommendedNextStep && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-0.5">Siguiente paso recomendado</div>
              <p className="text-sm text-slate-700 leading-relaxed">{session.recommendedNextStep}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

export function MentorStudentSessions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<MentorSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");

  const loadPage = useCallback(
    async (p: number) => {
      if (!studentId) return;
      setLoading(true);
      const res = await fetch(
        `/api/mentoria/mentor-sessions?studentId=${encodeURIComponent(studentId)}&page=${p}&limit=${PAGE_SIZE}`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel";
        return;
      }
      if (res.status === 403) {
        setError("Acceso restringido.");
        setLoading(false);
        return;
      }
      const body = await res.json().catch(() => null) as {
        sessions?: MentorSessionItem[];
        total?: number;
        page?: number;
      } | null;

      if (!body) {
        setError("Error al cargar las sesiones.");
        setLoading(false);
        return;
      }

      setSessions(body.sessions ?? []);
      setTotal(body.total ?? 0);
      setPage(body.page ?? 0);
      setLoading(false);
    },
    [studentId],
  );

  useEffect(() => {
    if (!studentId) {
      setError("No se especificó el alumno.");
      setLoading(false);
      return;
    }

    void (async () => {
      const studentRes = await fetch(
        `/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`,
        { cache: "no-store" },
      );
      if (studentRes.ok) {
        const body = await studentRes.json().catch(() => null) as { fullName?: string } | null;
        setStudentName(body?.fullName ?? "");
      }
      await loadPage(0);
    })();
  }, [studentId, loadPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Historial de sesiones</h1>
              {studentName && (
                <p className="mt-0.5 text-sm text-slate-500">{studentName}</p>
              )}
              {total > 0 && (
                <p className="mt-1 text-xs text-slate-400">{total} sesiones completadas</p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)
              }
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando sesiones…
          </div>
        )}

        {/* Empty */}
        {!loading && sessions.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📚</div>
            <div className="font-semibold text-slate-950">Sin sesiones completadas</div>
            <p className="mt-1 text-sm text-slate-500">
              Aparecerán aquí cuando el alumno complete su primera sesión de estudio.
            </p>
          </div>
        )}

        {/* Sessions list */}
        {!loading && sessions.length > 0 && (
          <>
            <div className="space-y-3">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => void loadPage(page - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-slate-500">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => void loadPage(page + 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`}
            className="text-sm text-slate-400 hover:text-slate-600 transition"
          >
            ← Volver al perfil del alumno
          </Link>
        </div>
      </div>
    </div>
  );
}
