"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  { value: "lectura_escritura", label: "Lectura/Escritura" },
];

export function MentorAddStudentForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [schoolYear, setSchoolYear] = useState("1 ESO");
  const [preferredStudyMinutes, setPreferredStudyMinutes] = useState(45);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [learningPreference, setLearningPreference] = useState("");
  const [supportNotes, setSupportNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mentoria/mentor-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          schoolYear,
          preferredStudyMinutes,
          guardianEmail: guardianEmail.trim() || null,
          learningPreference: learningPreference || null,
          supportNotes: supportNotes.trim() || null,
        }),
      });

      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel/nuevo-alumno"; return; }
      if (res.status === 403) { setError("No tienes permiso para crear alumnos."); setSaving(false); return; }

      const body = await res.json().catch(() => null) as { ok?: boolean; studentId?: string; fullName?: string; error?: string } | null;

      if (!body?.ok) {
        setError(body?.error ?? "Error al crear el alumno.");
        setSaving(false);
        return;
      }

      setSuccess(`Alumno "${body.fullName}" creado correctamente.`);
      setTimeout(() => {
        router.push("/mentoria/panel");
      }, 1500);
    } catch {
      setError("Error de red al crear el alumno.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition"
            >
              ← Volver
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Nuevo alumno</h1>
              <p className="text-sm text-slate-500">Añade un alumno directamente al tenant.</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">

          {/* Nombre completo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre completo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. Lucía Martínez García"
              required
              minLength={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          </div>

          {/* Curso */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Curso escolar</label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
            >
              {SCHOOL_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Minutos de estudio preferidos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Minutos de estudio preferidos: <span className="font-bold text-emerald-600">{preferredStudyMinutes} min</span>
            </label>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={preferredStudyMinutes}
              onChange={(e) => setPreferredStudyMinutes(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>10 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* Email del tutor/padre */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email del tutor / padre
              <span className="ml-1 text-xs text-slate-400">(opcional)</span>
            </label>
            <input
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="padre@email.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
            <p className="mt-1 text-xs text-slate-400">
              Si ya existe un usuario con este email se vinculará automáticamente. Si no, se creará un perfil pendiente.
            </p>
          </div>

          {/* Preferencia de aprendizaje */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Estilo de aprendizaje
              <span className="ml-1 text-xs text-slate-400">(opcional)</span>
            </label>
            <select
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition bg-white"
            >
              {LEARNING_PREFERENCES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Notas de apoyo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Notas de apoyo
              <span className="ml-1 text-xs text-slate-400">(opcional)</span>
            </label>
            <textarea
              value={supportNotes}
              onChange={(e) => setSupportNotes(e.target.value)}
              placeholder="Dificultades específicas, necesidades especiales, contexto relevante…"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition resize-none"
            />
            <div className="text-right text-xs text-slate-400">{supportNotes.length}/500</div>
          </div>

          {/* Feedback */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? "Creando alumno…" : "Crear alumno"}
          </button>
        </form>

      </div>
    </div>
  );
}
