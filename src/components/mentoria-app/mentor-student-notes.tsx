"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MentorNote, MentorNoteVisibility } from "@/app/api/mentoria/mentor-notes/route";

const VISIBILITY_OPTIONS: { value: MentorNoteVisibility; label: string; desc: string }[] = [
  { value: "internal", label: "🔒 Interna", desc: "Solo el mentor la ve" },
  { value: "parent", label: "👪 Padres", desc: "Visible a padres y mentor" },
  { value: "student", label: "🎓 Alumno", desc: "Visible a alumno, padres y mentor" },
];

function visibilityBadge(v: string) {
  if (v === "internal") return <span className="text-xs rounded-lg bg-slate-100 text-slate-500 px-2 py-0.5">🔒 Interna</span>;
  if (v === "parent") return <span className="text-xs rounded-lg bg-amber-50 text-amber-700 px-2 py-0.5">👪 Padres</span>;
  return <span className="text-xs rounded-lg bg-emerald-50 text-emerald-700 px-2 py-0.5">🎓 Alumno</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function MentorStudentNotes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [notes, setNotes] = useState<MentorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<MentorNoteVisibility>("internal");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!studentId) return;
    const res = await fetch(`/api/mentoria/mentor-notes?studentId=${encodeURIComponent(studentId)}`, {
      cache: "no-store",
    });
    if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel"; return; }
    if (res.status === 403) { setError("Acceso restringido."); setLoading(false); return; }
    const data = await res.json().catch(() => null) as { notes?: MentorNote[] } | null;
    setNotes(data?.notes ?? []);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    if (!studentId) { setError("No se especificó el alumno."); setLoading(false); return; }
    void (async () => {
      const sr = await fetch(`/api/mentoria/mentor-student?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
      if (sr.ok) {
        const sd = await sr.json().catch(() => null) as { fullName?: string } | null;
        setStudentName(sd?.fullName ?? "");
      }
      await loadNotes();
    })();
  }, [studentId, loadNotes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setSaveError(null);

    const res = await fetch("/api/mentoria/mentor-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, body: body.trim(), visibility }),
    });

    if (!res.ok) {
      const b = await res.json().catch(() => null) as { error?: string } | null;
      setSaveError(b?.error ?? "Error al guardar la nota.");
      setSaving(false);
      return;
    }

    // Reload notes list
    setBody("");
    setVisibility("internal");
    setShowForm(false);
    setSaving(false);
    await loadNotes();
  }

  if (!loading && error) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
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
              <h1 className="text-xl font-semibold text-slate-950">Notas del mentor</h1>
              {studentName && <p className="mt-0.5 text-sm text-slate-500">{studentName}</p>}
              <p className="mt-1 text-xs text-slate-400">{notes.length} nota{notes.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition"
              >
                {showForm ? "✕ Cancelar" : "+ Nueva nota"}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>

        {/* New note form */}
        {showForm && (
          <form onSubmit={(e) => void handleSubmit(e)} className="rounded-[28px] bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Nueva nota</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="note-body">
                Nota <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="note-body"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Observaciones, avances, puntos a trabajar…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
              />
              <div className="mt-1 text-right text-xs text-slate-400">{body.length}/2000</div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">Visibilidad</div>
              <div className="grid grid-cols-3 gap-2">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      visibility === opt.value
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-800">{opt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {saveError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</div>
            )}

            <button
              type="submit"
              disabled={saving || !body.trim()}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
            >
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando notas…</div>
        )}

        {/* Empty */}
        {!loading && notes.length === 0 && (
          <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
            <div className="text-4xl mb-3">📝</div>
            <div className="font-semibold text-slate-950">Sin notas todavía</div>
            <p className="mt-1 text-sm text-slate-500">Añade notas para registrar observaciones, avances o incidencias del alumno.</p>
          </div>
        )}

        {/* Notes list */}
        {!loading && notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{note.authorName}</span>
                    {visibilityBadge(note.visibility)}
                  </div>
                  <div className="text-xs text-slate-400">{formatDate(note.createdAt)}</div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
