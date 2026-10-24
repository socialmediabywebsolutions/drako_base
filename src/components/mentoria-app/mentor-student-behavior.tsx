"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { BehaviorRecord } from "@/app/api/mentoria/behavior/route";

// ─── Config ───────────────────────────────────────────────────────────────────

type BehaviorType = "positive" | "neutral" | "attention" | "disruptive" | "disengaged";

const BEHAVIOR_META: Record<BehaviorType, { label: string; emoji: string; color: string; bgColor: string }> = {
  positive:   { label: "Positivo",          emoji: "⭐", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-100" },
  neutral:    { label: "Normal",            emoji: "😐", color: "text-slate-600",   bgColor: "bg-slate-50 border-slate-200" },
  attention:  { label: "Necesita atención", emoji: "⚠️", color: "text-amber-700",   bgColor: "bg-amber-50 border-amber-100" },
  disruptive: { label: "Conducta difícil",  emoji: "🔴", color: "text-rose-700",    bgColor: "bg-rose-50 border-rose-100" },
  disengaged: { label: "Desconectado",      emoji: "💭", color: "text-slate-500",   bgColor: "bg-slate-50 border-slate-200" },
};

const SUBJECT_OPTIONS = [
  { value: "matematicas", label: "Matemáticas" },
  { value: "fisica", label: "Física" },
  { value: "quimica", label: "Química" },
  { value: "biologia", label: "Biología" },
  { value: "lengua", label: "Lengua" },
  { value: "historia", label: "Historia" },
  { value: "ingles", label: "Inglés" },
  { value: "frances", label: "Francés" },
  { value: "filosofia", label: "Filosofía" },
  { value: "programacion", label: "Programación" },
  { value: "economia", label: "Economía" },
  { value: "geografia", label: "Geografía" },
  { value: "arte", label: "Arte" },
  { value: "musica", label: "Música" },
  { value: "educacion_fisica", label: "Ed. Física" },
  { value: "tecnologia", label: "Tecnología" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function intensityLabel(v: number): string {
  return ["", "Muy leve", "Leve", "Moderado", "Notable", "Intenso"][v] ?? String(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MentorStudentBehavior() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => todayISO());
  const [formType, setFormType] = useState<BehaviorType>("positive");
  const [formIntensity, setFormIntensity] = useState(2);
  const [formSubject, setFormSubject] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mentoria/behavior?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { records?: BehaviorRecord[] };
      setRecords(data.records ?? []);
    } catch {
      setError("No se pudo cargar el historial de conducta.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    if (!studentId || !formDate) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        studentId,
        recordDate: formDate,
        behaviorType: formType,
        intensity: formIntensity,
      };
      if (formSubject) body.subjectSlug = formSubject;
      if (formNote.trim()) body.note = formNote.trim();

      const res = await fetch("/api/mentoria/behavior", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setFormDate(todayISO());
      setFormType("positive");
      setFormIntensity(2);
      setFormSubject("");
      setFormNote("");
      await load();
    } catch {
      alert("Error al guardar el registro de conducta.");
    } finally {
      setSaving(false);
    }
  }

  // Stats
  const positive = records.filter(r => r.behaviorType === "positive").length;
  const attention = records.filter(r => r.behaviorType === "attention" || r.behaviorType === "disruptive").length;
  const total = records.length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`}
            className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
          >
            ← Volver
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">🧠 Conducta y actitud</h1>
        </div>

        {/* Stats */}
        {total > 0 && (
          <div className="rounded-[28px] bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">Resumen ({total} registros)</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-2xl font-bold text-emerald-700">{positive}</p>
                <p className="text-xs text-emerald-600">⭐ Positivos</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-600">{total - positive - attention}</p>
                <p className="text-xs text-slate-500">😐 Neutrales</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-2xl font-bold text-rose-700">{attention}</p>
                <p className="text-xs text-rose-600">⚠️ Atención</p>
              </div>
            </div>
          </div>
        )}

        {/* Records section */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">Observaciones</h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              {showForm ? "Cancelar" : "+ Añadir observación"}
            </button>
          </div>

          {showForm && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Fecha</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    max={todayISO()}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as BehaviorType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {(Object.keys(BEHAVIOR_META) as BehaviorType[]).map(t => (
                      <option key={t} value={t}>{BEHAVIOR_META[t].emoji} {BEHAVIOR_META[t].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Intensidad (1–5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => setFormIntensity(v)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                          formIntensity === v
                            ? "bg-emerald-500 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-center text-xs text-slate-400">{intensityLabel(formIntensity)}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Materia (opcional)</label>
                  <select
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">— Sesión general —</option>
                    {SUBJECT_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                placeholder="Nota o descripción (opcional)"
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
              <button
                onClick={handleSave}
                disabled={saving || !formDate}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {saving ? "Guardando…" : "Guardar observación"}
              </button>
            </div>
          )}

          {/* List */}
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-rose-500">{error}</p>
          ) : records.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay observaciones registradas todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {records.map(rec => {
                const meta = BEHAVIOR_META[rec.behaviorType] ?? BEHAVIOR_META.neutral;
                const subject = SUBJECT_OPTIONS.find(s => s.value === rec.subjectSlug);
                return (
                  <li key={rec.id} className={`rounded-2xl border p-3 ${meta.bgColor}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-xl leading-none">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-500">
                            Intensidad {rec.intensity}/5
                          </span>
                          {subject && (
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600">
                              {subject.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDate(rec.recordDate)}</p>
                        {rec.note && (
                          <p className="mt-1 text-xs text-slate-500 italic">💬 {rec.note}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
