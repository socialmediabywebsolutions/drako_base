"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import type { AttendanceRecord } from "@/app/api/mentoria/attendance/route";
import type { BehaviorRecord } from "@/app/api/mentoria/behavior/route";

type DiaryTab = "attendance" | "behavior";

const ATTENDANCE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  present:          { label: "Asistió",               color: "bg-emerald-100 text-emerald-700", emoji: "✅" },
  absent_justified: { label: "Falta justificada",      color: "bg-amber-100 text-amber-700",    emoji: "📋" },
  absent:           { label: "Falta sin justificar",   color: "bg-rose-100 text-rose-700",      emoji: "❌" },
  late:             { label: "Llegó tarde",             color: "bg-orange-100 text-orange-700",  emoji: "⏰" },
  left_early:       { label: "Salió antes",             color: "bg-orange-100 text-orange-700",  emoji: "🚪" },
};

const BEHAVIOR_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  positive:   { label: "Positivo",           color: "bg-emerald-100 text-emerald-700", emoji: "⭐" },
  neutral:    { label: "Normal",             color: "bg-slate-100 text-slate-600",     emoji: "😐" },
  attention:  { label: "Necesita atención",  color: "bg-amber-100 text-amber-700",     emoji: "⚠️" },
  disruptive: { label: "Conducta difícil",   color: "bg-rose-100 text-rose-700",       emoji: "🔴" },
  disengaged: { label: "Desconectado",       color: "bg-slate-100 text-slate-600",     emoji: "💭" },
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Attendance Section ──────────────────────────────────────────────────────

function AttendanceSection({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ recordDate: todayISO(), status: "present", notes: "" });

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/mentoria/attendance?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null) as { records?: AttendanceRecord[] } | null;
    setRecords(data?.records ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [studentId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recordDate || !form.status) return;
    setSaving(true); setErr(null); setSuccess(null);
    const res = await fetch("/api/mentoria/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...form }),
    });
    setSaving(false);
    if (!res.ok) { setErr("Error al guardar."); return; }
    setSuccess("Guardado ✓");
    setTimeout(() => setSuccess(null), 3000);
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <form onSubmit={(e) => void handleSave(e)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Registrar asistencia</div>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fecha</label>
            <input
              type="date"
              value={form.recordDate}
              onChange={(e) => setForm((f) => ({ ...f, recordDate: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {Object.entries(ATTENDANCE_LABELS).map(([v, meta]) => (
                <option key={v} value={v}>{meta.emoji} {meta.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Notas (opcional)</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Ej: Falta por médico, traerá justificante"
            maxLength={300}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        {success && <p className="text-xs text-emerald-600">{success}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar asistencia"}
        </button>
      </form>

      {/* Records */}
      {loading && <div className="text-center text-sm text-slate-400 py-4">Cargando…</div>}
      {!loading && records.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-sm text-slate-400">
          Sin registros de asistencia.
        </div>
      )}
      {!loading && records.map((r) => {
        const meta = ATTENDANCE_LABELS[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600", emoji: "•" };
        return (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-700">{formatDate(r.recordDate)}</div>
              {r.notes && <div className="text-xs text-slate-400 mt-0.5">{r.notes}</div>}
            </div>
            <span className={`text-xs rounded-full px-3 py-1 font-medium ${meta.color}`}>
              {meta.emoji} {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Behavior Section ────────────────────────────────────────────────────────

function BehaviorSection({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<BehaviorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    recordDate: todayISO(),
    behaviorType: "positive",
    intensity: 3,
    note: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/mentoria/behavior?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null) as { records?: BehaviorRecord[] } | null;
    setRecords(data?.records ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [studentId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null); setSuccess(null);
    const res = await fetch("/api/mentoria/behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...form }),
    });
    setSaving(false);
    if (!res.ok) { setErr("Error al guardar."); return; }
    setSuccess("Guardado ✓");
    setTimeout(() => setSuccess(null), 3000);
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Form */}
      <form onSubmit={(e) => void handleSave(e)} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Registrar observación</div>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fecha</label>
            <input
              type="date"
              value={form.recordDate}
              onChange={(e) => setForm((f) => ({ ...f, recordDate: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Tipo</label>
            <select
              value={form.behaviorType}
              onChange={(e) => setForm((f) => ({ ...f, behaviorType: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {Object.entries(BEHAVIOR_LABELS).map(([v, meta]) => (
                <option key={v} value={v}>{meta.emoji} {meta.label}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-500 mb-1">Intensidad (1–5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={form.intensity}
              onChange={(e) => setForm((f) => ({ ...f, intensity: Number(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Nota (opcional)</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Describe brevemente la observación…"
            maxLength={400}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
        {success && <p className="text-xs text-emerald-600">{success}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Registrar observación"}
        </button>
      </form>

      {/* Records */}
      {loading && <div className="text-center text-sm text-slate-400 py-4">Cargando…</div>}
      {!loading && records.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-sm text-slate-400">
          Sin observaciones de comportamiento.
        </div>
      )}
      {!loading && records.map((r) => {
        const meta = BEHAVIOR_LABELS[r.behaviorType] ?? { label: r.behaviorType, color: "bg-slate-100 text-slate-600", emoji: "•" };
        return (
          <div key={r.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{formatDate(r.recordDate)}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${meta.color}`}>
                  {meta.emoji} {meta.label}
                </span>
                <span className="text-xs text-slate-400">{"★".repeat(r.intensity)}</span>
              </div>
              {r.note && <div className="text-xs text-slate-400 mt-0.5 truncate">{r.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MentorStudentDiary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";
  const [tab, setTab] = useState<DiaryTab>("attendance");

  if (!studentId) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          studentId requerido.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-4">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Diario escolar</h1>
              <p className="mt-0.5 text-sm text-slate-500">Asistencia y observaciones de comportamiento</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Alumno
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("attendance")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === "attendance"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ✅ Asistencia
            </button>
            <button
              type="button"
              onClick={() => setTab("behavior")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === "behavior"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ⭐ Comportamiento
            </button>
          </div>
        </div>

        {tab === "attendance" && <AttendanceSection studentId={studentId} />}
        {tab === "behavior" && <BehaviorSection studentId={studentId} />}
      </div>
    </div>
  );
}
