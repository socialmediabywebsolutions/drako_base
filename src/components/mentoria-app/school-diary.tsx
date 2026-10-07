"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AttendanceRecord } from "@/app/api/mentoria/attendance/route";
import type { BehaviorRecord } from "@/app/api/mentoria/behavior/route";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "attendance" | "behavior";

const ATTENDANCE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  present:           { label: "Asistió",            color: "bg-emerald-100 text-emerald-700", emoji: "✅" },
  absent_justified:  { label: "Falta justificada",  color: "bg-amber-100 text-amber-700",    emoji: "📋" },
  absent:            { label: "Falta sin justificar", color: "bg-rose-100 text-rose-700",     emoji: "❌" },
  late:              { label: "Llegó tarde",         color: "bg-orange-100 text-orange-700",  emoji: "⏰" },
  left_early:        { label: "Salió antes",         color: "bg-orange-100 text-orange-700",  emoji: "🚪" },
};

const BEHAVIOR_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  positive:    { label: "Positivo",          color: "bg-emerald-100 text-emerald-700", emoji: "⭐" },
  neutral:     { label: "Normal",            color: "bg-slate-100 text-slate-600",     emoji: "😐" },
  attention:   { label: "Necesita atención", color: "bg-amber-100 text-amber-700",     emoji: "⚠️" },
  disruptive:  { label: "Conducta difícil",  color: "bg-rose-100 text-rose-700",       emoji: "🔴" },
  disengaged:  { label: "Desconectado",      color: "bg-slate-100 text-slate-600",     emoji: "💭" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Attendance section ───────────────────────────────────────────────────────

type AttendanceFormState = {
  recordDate: string;
  status: string;
  notes: string;
};

function AttendanceSection({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AttendanceFormState>({
    recordDate: todayISO(),
    status: "present",
    notes: "",
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadRecords() {
    setLoading(true);
    const res = await fetch(
      `/api/mentoria/attendance?studentId=${encodeURIComponent(studentId)}`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => null) as { ok?: boolean; records?: AttendanceRecord[] } | null;
    setRecords(body?.records ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (studentId) void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSave() {
    if (!form.status) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    const res = await fetch("/api/mentoria/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        recordDate: form.recordDate,
        status: form.status,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Error al guardar. Inténtalo de nuevo.");
      return;
    }
    setSuccessMsg("Registro guardado ✓");
    setTimeout(() => setSuccessMsg(null), 3000);
    void loadRecords();
  }

  const todayRecord = records.find((r) => r.recordDate === todayISO() && !r.subjectSlug);
  const att = ATTENDANCE_LABELS[form.status] ?? ATTENDANCE_LABELS.present;

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950 mb-4">Registrar asistencia del día</h2>

        {todayRecord && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            ⚠️ Ya hay un registro para hoy: <strong>{ATTENDANCE_LABELS[todayRecord.status]?.label ?? todayRecord.status}</strong>. Guardar lo actualizará.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha</label>
            <input
              type="date"
              value={form.recordDate}
              max={todayISO()}
              onChange={(e) => setForm((f) => ({ ...f, recordDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(ATTENDANCE_LABELS).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setForm((f) => ({ ...f, status: key }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    form.status === key
                      ? `${meta.color} border-current font-semibold`
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas (opcional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Faltó por visita médica"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-40"
            >
              {saving ? "Guardando…" : `Guardar — ${att.emoji} ${att.label}`}
            </button>
            {successMsg && <span className="text-sm text-emerald-600 font-medium">{successMsg}</span>}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950 mb-4">Historial de asistencia</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            Aún no hay registros de asistencia.
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => {
              const meta = ATTENDANCE_LABELS[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600", emoji: "❓" };
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{meta.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{formatDate(r.recordDate)}</div>
                      {r.notes && <div className="text-xs text-slate-500 truncate">{r.notes}</div>}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Behavior section ─────────────────────────────────────────────────────────

type BehaviorFormState = {
  recordDate: string;
  behaviorType: string;
  intensity: number;
  note: string;
};

function BehaviorSection({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState<BehaviorFormState>({
    recordDate: todayISO(),
    behaviorType: "neutral",
    intensity: 2,
    note: "",
  });

  async function loadRecords() {
    setLoading(true);
    const res = await fetch(
      `/api/mentoria/behavior?studentId=${encodeURIComponent(studentId)}`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => null) as { ok?: boolean; records?: BehaviorRecord[] } | null;
    setRecords(body?.records ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (studentId) void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSave() {
    if (!form.behaviorType) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    const res = await fetch("/api/mentoria/behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        recordDate: form.recordDate,
        behaviorType: form.behaviorType,
        intensity: form.intensity,
        note: form.note || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Error al guardar. Inténtalo de nuevo.");
      return;
    }
    setSuccessMsg("Nota guardada ✓");
    setTimeout(() => setSuccessMsg(null), 3000);
    setForm((f) => ({ ...f, note: "" }));
    void loadRecords();
  }

  const beh = BEHAVIOR_LABELS[form.behaviorType] ?? BEHAVIOR_LABELS.neutral;

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950 mb-1">Anotar comportamiento en clase</h2>
        <p className="text-sm text-slate-500 mb-4">Lo que te cuenta el profesor o lo que observas tú en casa.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha</label>
            <input
              type="date"
              value={form.recordDate}
              max={todayISO()}
              onChange={(e) => setForm((f) => ({ ...f, recordDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de comportamiento</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(BEHAVIOR_LABELS).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setForm((f) => ({ ...f, behaviorType: key }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    form.behaviorType === key
                      ? `${meta.color} border-current font-semibold`
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Intensidad: <span className="text-slate-900">{form.intensity}/5</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.intensity}
              onChange={(e) => setForm((f) => ({ ...f, intensity: Number(e.target.value) }))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Leve</span>
              <span>Muy marcado</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nota (opcional)</label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Ej: Estuvo muy participativo en la clase de mates"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-40"
            >
              {saving ? "Guardando…" : `Guardar — ${beh.emoji} ${beh.label}`}
            </button>
            {successMsg && <span className="text-sm text-emerald-600 font-medium">{successMsg}</span>}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-950 mb-4">Notas de comportamiento</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            Aún no hay notas de comportamiento.
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => {
              const meta = BEHAVIOR_LABELS[r.behaviorType] ?? { label: r.behaviorType, color: "bg-slate-100 text-slate-600", emoji: "❓" };
              return (
                <div key={r.id} className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{meta.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800">{formatDate(r.recordDate)}</div>
                        {r.subjectSlug && (
                          <div className="text-xs text-slate-500">{r.subjectSlug}</div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs text-slate-400">{r.intensity}/5</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  {r.note && <p className="mt-1.5 text-xs text-slate-600 pl-7">{r.note}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MentoriaSchoolDiary() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";
  const [tab, setTab] = useState<Tab>("attendance");

  if (!studentId) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Falta el ID del alumno en la URL.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Diario escolar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registra la asistencia y el comportamiento de tu hijo en el colegio.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
          {(["attendance", "behavior"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "attendance" ? "📋 Asistencia" : "📊 Comportamiento"}
            </button>
          ))}
        </div>

        {tab === "attendance" && <AttendanceSection studentId={studentId} />}
        {tab === "behavior" && <BehaviorSection studentId={studentId} />}
      </div>
    </div>
  );
}
