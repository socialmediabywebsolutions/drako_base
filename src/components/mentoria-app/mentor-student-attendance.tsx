"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { AttendanceRecord } from "@/app/api/mentoria/attendance/route";

// ─── Config ───────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent_justified" | "absent" | "late" | "left_early";

const STATUS_META: Record<AttendanceStatus, { label: string; emoji: string; color: string; bgColor: string }> = {
  present:          { label: "Asistió",           emoji: "✅", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-100" },
  absent_justified: { label: "Falta justificada", emoji: "📋", color: "text-amber-700",   bgColor: "bg-amber-50 border-amber-100" },
  absent:           { label: "Falta",             emoji: "❌", color: "text-rose-700",    bgColor: "bg-rose-50 border-rose-100" },
  late:             { label: "Llegó tarde",        emoji: "⏰", color: "text-orange-700",  bgColor: "bg-orange-50 border-orange-100" },
  left_early:       { label: "Salió antes",        emoji: "🚪", color: "text-orange-700",  bgColor: "bg-orange-50 border-orange-100" },
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

// ─── Component ────────────────────────────────────────────────────────────────

export function MentorStudentAttendance() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(() => todayISO());
  const [formStatus, setFormStatus] = useState<AttendanceStatus>("present");
  const [formSubject, setFormSubject] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mentoria/attendance?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { records?: AttendanceRecord[] };
      setRecords(data.records ?? []);
    } catch {
      setError("No se pudo cargar el registro de asistencia.");
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
        status: formStatus,
      };
      if (formSubject) body.subjectSlug = formSubject;
      if (formNotes.trim()) body.notes = formNotes.trim();

      const res = await fetch("/api/mentoria/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      setFormDate(todayISO());
      setFormStatus("present");
      setFormSubject("");
      setFormNotes("");
      await load();
    } catch {
      alert("Error al guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  // Stats
  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const justified = records.filter(r => r.status === "absent_justified").length;
  const late = records.filter(r => r.status === "late").length;
  const total = records.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 100;

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
          <h1 className="text-xl font-semibold text-slate-800">📅 Asistencia</h1>
        </div>

        {/* Stats */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Resumen ({total} registros)</p>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${
              rate >= 90 ? "bg-emerald-100 text-emerald-700" :
              rate >= 75 ? "bg-amber-100 text-amber-700" :
              "bg-rose-100 text-rose-700"
            }`}>
              {rate}% asistencia
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${rate}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { count: present,   label: "Asistencias", color: "text-emerald-700" },
              { count: absent,    label: "Faltas",       color: "text-rose-700" },
              { count: justified, label: "Justificadas", color: "text-amber-700" },
              { count: late,      label: "Tardes",       color: "text-orange-700" },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-2">
                <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Add record */}
        <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-700">Registros</h2>
            <button
              onClick={() => setShowForm(v => !v)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              {showForm ? "Cancelar" : "+ Añadir registro"}
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as AttendanceStatus)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {(Object.keys(STATUS_META) as AttendanceStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
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
              <textarea
                placeholder="Notas (opcional)"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
              <button
                onClick={handleSave}
                disabled={saving || !formDate}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
              >
                {saving ? "Guardando…" : "Guardar registro"}
              </button>
            </div>
          )}

          {/* Records list */}
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-rose-500">{error}</p>
          ) : records.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No hay registros de asistencia todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {records.map(rec => {
                const meta = STATUS_META[rec.status] ?? STATUS_META.present;
                const subject = SUBJECT_OPTIONS.find(s => s.value === rec.subjectSlug);
                return (
                  <li key={rec.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${meta.bgColor}`}>
                    <span className="text-xl leading-none">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                        {subject && (
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600">
                            {subject.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(rec.recordDate)}</p>
                      {rec.notes && (
                        <p className="text-xs text-slate-400 italic mt-0.5">{rec.notes}</p>
                      )}
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
