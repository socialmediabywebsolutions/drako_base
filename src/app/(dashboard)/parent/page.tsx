/**
 * Parent Dashboard — standalone parent view
 *
 * Wrapper limpio para que los padres accedan al panel de su hijo
 * desde fuera del workspace de Mentoría.
 *
 * URL: /parent?studentId=<id>
 *
 * Delega toda la lógica y presentación en ParentStudentDashboard,
 * que ya consume /api/mentoria/parent-dashboard y tiene el UI completo.
 */

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ParentStudentDashboard } from "@/components/mentoria-app/parent-student-dashboard";

// ─── Inner component (necesita Suspense por useSearchParams) ──────────────────

function ParentDashboardInner() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  if (!studentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl">🎒</div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            Alumno no especificado
          </h2>
          <p className="text-sm text-slate-500">
            Accede a este panel desde el área de familia de Mentoría, donde
            encontrarás el enlace directo al seguimiento de tu hijo.
          </p>
          <a
            href="/mentoria/app"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Ir a Mentoría
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header mínimo */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">Mentoría</span>
            <span className="h-4 w-px bg-slate-200" />
            <span className="text-sm text-slate-500">Panel familiar</span>
          </div>
          <a
            href="/mentoria/app"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ir al workspace
          </a>
        </div>
      </header>

      {/* Dashboard */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        <ParentStudentDashboard studentId={studentId} />
      </main>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function ParentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Cargando panel familiar…</p>
          </div>
        </div>
      }
    >
      <ParentDashboardInner />
    </Suspense>
  );
}
