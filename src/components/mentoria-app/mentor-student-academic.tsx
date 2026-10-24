"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import type { MentoriaAcademicRecord } from "@/lib/mentoria/academic-types";

const RECORD_TYPE_LABELS: Record<string, string> = {
  exam: "📝 Examen",
  homework: "📋 Tarea",
  project: "📁 Trabajo",
  notebook: "📓 Cuaderno",
  behavior: "🎭 Actitud",
  presentation: "✨ Presentación",
  custom: "📌 Otro",
};

const RECORD_TYPE_COLORS: Record<string, string> = {
  exam: "bg-amber-50 text-amber-700",
  homework: "bg-blue-50 text-blue-700",
  project: "bg-violet-50 text-violet-700",
  notebook: "bg-slate-100 text-slate-600",
  behavior: "bg-emerald-50 text-emerald-700",
  presentation: "bg-pink-50 text-pink-700",
  custom: "bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  provisional: "Provisional",
  needs_review: "Por revisar",
};

const RECORD_TYPES = [
  { value: "exam", label: "Examen" },
  { value: "homework", label: "Tarea" },
  { value: "project", label: "Trabajo" },
  { value: "notebook", label: "Cuaderno" },
  { value: "behavior", label: "Actitud" },
  { value: "presentation", label: "Presentación" },
  { value: "custom", label: "Otro" },
];

function scoreDisplay(score: number | null, scale: number | null, label: string | null) {
  if (label) return label;
  if (score !== null) return scale ? `${score}/${scale}` : String(score);
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface RecordCardProps {
  record: MentoriaAcademicRecord;
}

function RecordCard({ record }: RecordCardProps) {
  const typeColor = RECORD_TYPE_COLORS[record.recordType] ?? RECORD_TYPE_COLORS.custom;
  const typeLabel = RECORD_TYPE_LABELS[record.recordType] ?? record.recordType;
  const score = scoreDisplay(record.scoreValue, record.scoreScale, record.scoreLabel);

  const scoreColor =
    record.scoreValue !== null && record.scoreScale
      ? record.scoreValue / record.scoreScale >= 0.7
        ? "text-emerald-700 font-bold"
        : record.scoreValue / record.scoreScale >= 0.5
        ? "text-amber-700 font-bold"
        : "text-rose-700 font-bold"
      : "text-slate-700 font-semibold";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs rounded-lg px-2 py-0.5 ${typeColor}`}>{typeLabel}</span>
            {record.subjectSlug && (
              <span className="text-sm text-slate-700 font-medium">{record.subjectSlug}</span>
            )}
            {record.status !== "confirmed" && (
              <span className="text-xs rounded-lg px-2 py-0.5 bg-slate-100 text-slate-500">
                {STATUS_LABELS[record.status] ?? record.status}
              </span>
            )}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-900">{record.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <span>{formatDate(record.recordedAt)}</span>
            {score && (
              <span className={`text-sm ${scoreColor}`}>{score}</span>
            )}
          </div>
          {record.teacherComment && (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2">{record.teacherComment}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AddRecordFormProps {
  studentId: string;
  onSuccess: (record: MentoriaAcademicRecord) => void;
  onCancel: () => void;
}

function AddRecordForm({ studentId, onSuccess, onCancel }: AddRecordFormProps) {
  const [recordType, setRecordType] = useState("exam");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [scoreValue, setScoreValue] = useState("");
  const [scoreScale, setScoreScale] = useState("10");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr("El título es obligatorio."); return; }
    setSaving(true);
    setErr(null);
    const body: Record<string, unknown> = {
      studentId,
      recordType,
      title: title.trim(),
    };
    if (subject.trim()) body.subjectSlug = subject.trim().toLowerCase().replace(/\s+/g, "-");
    if (scoreValue.trim()) {
      body.scoreValue = parseFloat(scoreValue);
      body.scoreScale = scoreScale ? parseFloat(scoreScale) : null;
    }
    if (comment.trim()) body.teacherComment = comment.trim();

    const res = await fetch("/api/mentoria/academic/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null) as { error?: string } | null;
      setErr(data?.error ?? "Error al guardar el registro.");
      return;
    }
    const data = await res.json().catch(() => null) as { record?: MentoriaAcademicRecord } | null;
    if (data?.record) onSuccess(data.record);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Nuevo registro académico</span>
        <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 transition">✕ Cancelar</button>
      </div>

      {/* Tipo */}
      <div className="flex flex-wrap gap-2">
        {RECORD_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setRecordType(t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              recordType === t.value
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Título */}
      <div>
        <label className="block text-xs text-slate-500 mb-1">Título *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Examen parcial Matemáticas T1"
          maxLength={200}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Materia */}
      <div>
        <label className="block text-xs text-slate-500 mb-1">Materia (opcional)</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ej: matematicas, fisica..."
          maxLength={80}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* Nota */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">Nota obtenida (opcional)</label>
          <input
            type="number"
            value={scoreValue}
            onChange={(e) => setScoreValue(e.target.value)}
            placeholder="Ej: 7.5"
            step="0.1"
            min="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-slate-500 mb-1">Sobre (escala)</label>
          <input
            type="number"
            value={scoreScale}
            onChange={(e) => setScoreScale(e.target.value)}
            placeholder="10"
            step="0.5"
            min="1"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      {/* Comentario */}
      <div>
        <label className="block text-xs text-slate-500 mb-1">Comentario del profesor (opcional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Observaciones del docente…"
          rows={3}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {err && <p className="text-xs text-rose-600">{err}</p>}

      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 transition disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar registro"}
      </button>
    </form>
  );
}

export function MentorStudentAcademic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [records, setRecords] = useState<MentoriaAcademicRecord[]>([]);
  const [studentName, setStudentName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");

  const loadRecords = useCallback(async () => {
    if (!studentId) { setError("studentId requerido."); setLoading(false); return; }
    setLoading(true);
    const url = `/api/mentoria/academic/records?studentId=${encodeURIComponent(studentId)}${typeFilter ? `&recordType=${typeFilter}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
    if (res.status === 403) { setError("Acceso restringido."); setLoading(false); return; }
    const data = await res.json().catch(() => null) as {
      records?: MentoriaAcademicRecord[];
      student?: { fullName?: string } | null;
    } | null;
    setRecords(data?.records ?? []);
    if (data?.student?.fullName) setStudentName(data.student.fullName);
    setLoading(false);
  }, [studentId, typeFilter]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
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
              <h1 className="text-xl font-semibold text-slate-950">Registros académicos</h1>
              {studentName && (
                <p className="mt-0.5 text-sm text-slate-500">{studentName}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              ← Alumno
            </button>
          </div>

          {/* Filtros tipo */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setTypeFilter(""); setShowForm(false); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                !typeFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos
            </button>
            {RECORD_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setTypeFilter(t.value); setShowForm(false); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  typeFilter === t.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition"
            >
              {showForm ? "✕ Cancelar" : "+ Añadir registro"}
            </button>
          </div>
        </div>

        {/* Formulario */}
        {showForm && (
          <AddRecordForm
            studentId={studentId}
            onSuccess={(r) => {
              setRecords((prev) => [r, ...prev]);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando registros…
          </div>
        )}

        {!loading && records.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="font-semibold text-slate-950">Sin registros académicos</div>
            <p className="mt-1 text-sm text-slate-500">
              Añade exámenes, tareas o notas escolares para hacer seguimiento del rendimiento del alumno.
            </p>
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="space-y-2">
            {records.map((r) => (
              <RecordCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
