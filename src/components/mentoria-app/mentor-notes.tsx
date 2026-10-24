"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MentorNote, MentorNoteVisibility } from "@/app/api/mentoria/mentor-notes/route";

const VISIBILITY_LABELS: Record<MentorNoteVisibility, { label: string; badge: string }> = {
  internal: { label: "Solo mentor", badge: "bg-slate-100 text-slate-600" },
  parent:   { label: "Visible padres", badge: "bg-blue-100 text-blue-700" },
  student:  { label: "Visible alumno", badge: "bg-emerald-100 text-emerald-700" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function NoteCard({ note }: { note: MentorNote }) {
  const vis = VISIBILITY_LABELS[note.visibility];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{note.body}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${vis.badge}`}>
          {vis.label}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-500">{note.authorName}</span>
        <span>·</span>
        <span>{formatDate(note.createdAt)}</span>
      </div>
    </div>
  );
}

type CreateNoteFormProps = {
  studentId: string;
  onCreated: () => void;
};

function CreateNoteForm({ studentId, onCreated }: CreateNoteFormProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<MentorNoteVisibility>("internal");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    await fetch("/api/mentoria/mentor-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, body: body.trim(), visibility }),
    });
    setSubmitting(false);
    setOpen(false);
    setBody("");
    setVisibility("internal");
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition"
      >
        + Añadir nota
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4"
    >
      <h3 className="font-semibold text-slate-950">Nueva nota</h3>
      <textarea
        required
        rows={4}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 resize-none"
        placeholder="Escribe la nota sobre este alumno…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Visibilidad</label>
        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as MentorNoteVisibility)}
        >
          <option value="internal">Solo mentor (interno)</option>
          <option value="parent">Visible para padres</option>
          <option value="student">Visible para el alumno</option>
        </select>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? "Guardando…" : "Guardar nota"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-white px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Read-only view (parent/student) ──────────────────────────────────────────
function ReadOnlyNotes({ notes, loading }: { notes: MentorNote[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Cargando notas…
      </div>
    );
  }
  if (notes.length === 0) {
    return (
      <div className="rounded-[28px] bg-white p-10 shadow-sm text-center">
        <div className="text-4xl mb-3">📝</div>
        <div className="font-semibold text-slate-950">Sin notas del mentor</div>
        <p className="mt-1 text-sm text-slate-500">El mentor no ha añadido notas visibles aún.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{n.body}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-500">{n.authorName}</span>
            <span>·</span>
            <span>{formatDate(n.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mentor view (owner|admin) ─────────────────────────────────────────────────
function MentorNotesEditor({ studentId }: { studentId: string }) {
  const [notes, setNotes] = useState<MentorNote[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/mentoria/mentor-notes?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({ notes: [] })) as { notes: MentorNote[] };
    setNotes(body.notes ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [studentId]);

  return (
    <div className="space-y-3">
      <CreateNoteForm studentId={studentId} onCreated={() => { void load(); }} />
      {loading && (
        <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Cargando notas…
        </div>
      )}
      {!loading && notes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
          Sin notas aún. ¡Añade la primera!
        </div>
      )}
      {!loading && notes.map((n) => <NoteCard key={n.id} note={n} />)}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function MentoriaMentorNotes({ isMentorView = false }: { isMentorView?: boolean }) {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() ?? "";

  const [notes, setNotes] = useState<MentorNote[]>([]);
  const [loading, setLoading] = useState(!isMentorView);

  useEffect(() => {
    if (isMentorView) return; // mentor editor handles its own state
    void (async () => {
      setLoading(true);
      const url = studentId
        ? `/api/mentoria/mentor-notes?studentId=${encodeURIComponent(studentId)}`
        : "/api/mentoria/mentor-notes";
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins"; return; }
      if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
      const body = await res.json().catch(() => ({ notes: [] })) as { notes: MentorNote[] };
      setNotes(body.notes ?? []);
      setLoading(false);
    })();
  }, [isMentorView, studentId]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">
            {isMentorView ? "Notas del mentor" : "Notas de tu mentor"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isMentorView
              ? "Anota observaciones, acuerdos y seguimiento del alumno."
              : "Tu mentor puede dejarte observaciones y recomendaciones."}
          </p>
        </div>

        {isMentorView && studentId ? (
          <MentorNotesEditor studentId={studentId} />
        ) : (
          <ReadOnlyNotes notes={notes} loading={loading} />
        )}
      </div>
    </div>
  );
}
