"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MentorStudentDetail } from "@/app/api/mentoria/mentor-student/route";

const SCHOOL_YEARS = [
  "1 Primaria", "2 Primaria", "3 Primaria", "4 Primaria", "5 Primaria", "6 Primaria",
  "1 ESO", "2 ESO", "3 ESO", "4 ESO",
  "1 Bachillerato", "2 Bachillerato",
  "FP Básica", "FP Medio", "FP Superior",
  "Universidad",
  "Otro",
];

const LEARNING_PREFERENCES = [
  { value: "", label: "Sin especificar" },
  { value: "visual", label: "Visual" },
  { value: "auditivo", label: "Auditivo" },
  { value: "kinestesico", label: "Kinestésico" },
  { value: "lectura_escritura", label: "Lectura / escritura" },
];

export function MentorEditStudentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [schoolYear, setSchoolYear] = useState("1 ESO");
  const [preferredStudyMinutes, setPreferredStudyMinutes] = useState(45);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [learningPreference, setLearningPreference] = useState("");
  const [supportNotes, setSupportNotes] = useState("");

  useEffect(() => {
    if (!studentId) {
      setError("No se especificó el alumno.");
      setLoading(false);
      return;
    }

    void (async () => {
      const res = await fetch(`/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`, {
        cache: "no-store",
      });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
      if (res.status === 403) { setError("Acceso denegado."); setLoading(false); return; }
      if (res.status === 404) { setError("Alumno no encontrado."); setLoading(false); return; }

      const data = await res.json().catch(() => null) as MentorStudentDetail | null;
      if (!data) { setError("Error al cargar datos del alumno."); setLoading(false); return; }

      setFullName(data.fullName ?? "");
      setSchoolYear(data.schoolYear ?? "1 ESO");
      setPreferredStudyMinutes(data.preferredStudyMinutes ?? 45);
      setGuardianEmail(data.guardianEmail ?? "");
      setGuardianPhone(data.guardianPhone ?? "");
      setLearningPreference(data.learningPreference ?? "");
      setSupportNotes(data.supportNotes ?? "");
      setLoading(false);
    })();
  }, [studentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const res = await fetch(`/api/mentoria/mentor-students/${encodeURIComponent(studentId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        schoolYear,
        preferredStudyMinutes,
        guardianEmail: guardianEmail.trim() || null,
        guardianPhone: guardianPhone.trim() || null,
        learningPreference: learningPreference || null,
        supportNotes: supportNotes.trim() || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      setSaveError(body?.error ?? "Error al guardar cambios.");
      setSaving(false);
      return;
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => {
      router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`);
    }, 1200);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-500">Cargando datos del alumno…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Editar alumno</h1>
              <p className="mt-1 text-sm text-slate-500">Modifica los datos del perfil del alumno.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">

          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="fullName">
              Nombre completo <span className="text-rose-500">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="Nombre y apellidos"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* School year */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="schoolYear">
              Curso
            </label>
            <select
              id="schoolYear"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {SCHOOL_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Study minutes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="studyMinutes">
              Minutos de estudio diarios preferidos: <span className="font-semibold text-emerald-700">{preferredStudyMinutes} min</span>
            </label>
            <input
              id="studyMinutes"
              type="range"
              min={10}
              max={120}
              step={5}
              value={preferredStudyMinutes}
              onChange={(e) => setPreferredStudyMinutes(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>10 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* Guardian email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="guardianEmail">
              Email del tutor / padre (opcional)
            </label>
            <input
              id="guardianEmail"
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              maxLength={200}
              placeholder="email@ejemplo.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Guardian phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="guardianPhone">
              Teléfono del tutor (opcional)
            </label>
            <input
              id="guardianPhone"
              type="tel"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              maxLength={30}
              placeholder="+34 600 000 000"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Learning preference */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="learningPref">
              Estilo de aprendizaje
            </label>
            <select
              id="learningPref"
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {LEARNING_PREFERENCES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Support notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="supportNotes">
              Notas de apoyo (opcional)
            </label>
            <textarea
              id="supportNotes"
              value={supportNotes}
              onChange={(e) => setSupportNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Dificultades especiales, ritmo de aprendizaje, observaciones del mentor…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>

          {saveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {saveError}
            </div>
          )}

          {saved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              ✅ Cambios guardados. Redirigiendo…
            </div>
          )}

          <button
            type="submit"
            disabled={saving || saved}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}
