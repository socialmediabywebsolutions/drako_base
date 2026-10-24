"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp } from "lucide-react";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { MentoriaAcademicProgressView } from "@/lib/mentoria/academic-types";

type ProgressResponse = {
  ok?: boolean;
  progress?: MentoriaAcademicProgressView;
  error?: string;
};

export function MentoriaAcademicProgress() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("studentId")?.trim() || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<MentoriaAcademicProgressView | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const url = new URL("https://mentoria.drako.systems/api/mentoria/academic/progress");
      if (selectedStudentId) url.searchParams.set("studentId", selectedStudentId);
      const response = await fetch(`${url.pathname}${url.search}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/progress";
        return;
      }
      if (response.status === 409) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const body = (await response.json().catch(() => null)) as ProgressResponse | null;
      if (!response.ok || !body?.progress) {
        setError(body?.error ?? "MENTORIA_ACADEMIC_PROGRESS_LOAD_FAILED");
        setLoading(false);
        return;
      }
      setProgress(body.progress);
      setLoading(false);
    })();
  }, [selectedStudentId]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <MentoriaAppSectionNav active="progress" />
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Mi progreso</h1>
          <p className="mt-2 text-sm text-slate-500">Comparativa clara entre colegio y Mentoría, sin mezclarlo con el aula.</p>
          {loading ? <div className="mt-4 text-sm text-slate-500">Cargando progreso...</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {progress ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Colegio</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{progress.summary.schoolAverageScore ?? "-"}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mentoría dominio</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{progress.summary.mentoriaMasteryAverage ?? "-"}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mentoría confianza</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{progress.summary.mentoriaConfidenceAverage ?? "-"}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <section className="rounded-3xl border border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-950">Evolución por materia</h2>
                  <div className="mt-4 space-y-3">
                    {progress.subjects.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                        Aún no hay suficiente evidencia académica para comparar colegio y Mentoría.
                      </div>
                    ) : progress.subjects.map((subject) => (
                      <div key={subject.subjectSlug} className="rounded-3xl bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{subject.subjectName}</div>
                            <div className="mt-1 text-xs text-slate-500">Colegio {subject.schoolAverageScore ?? "-"} · Mentoría {subject.mentoriaMasteryScore ?? "-"}</div>
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${subject.trendDirection === "up" ? "bg-emerald-100 text-emerald-700" : subject.trendDirection === "down" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700"}`}>
                            {subject.trendDirection === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {subject.trendDirection}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Puntos débiles</div>
                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                              {subject.weakPoints.length > 0 ? subject.weakPoints.map((item) => <li key={item}>- {item}</li>) : <li>- Sin señales débiles claras.</li>}
                            </ul>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Puntos fuertes</div>
                            <ul className="mt-2 space-y-1 text-sm text-slate-700">
                              {subject.strongPoints.length > 0 ? subject.strongPoints.map((item) => <li key={item}>- {item}</li>) : <li>- Sin fortalezas claras todavía.</li>}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 p-5">
                  <h2 className="text-lg font-semibold text-slate-950">Resumen ejecutivo</h2>
                  <div className="mt-4 space-y-4 text-sm text-slate-700">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Más fuertes</div>
                      <div className="mt-1">{progress.summary.strongestSubjects.length > 0 ? progress.summary.strongestSubjects.join(", ") : "Aún sin materias fuertes consolidadas."}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Más débiles</div>
                      <div className="mt-1">{progress.summary.weakestSubjects.length > 0 ? progress.summary.weakestSubjects.join(", ") : "Aún sin materias débiles detectadas."}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 text-slate-600">
                      Esta pantalla compara rendimiento real del colegio con señales de dominio y confianza dentro de Mentoría. No forma parte del aula.
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
