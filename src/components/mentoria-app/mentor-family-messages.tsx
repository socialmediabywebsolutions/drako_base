"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { FamilyMessageItem } from "@/app/api/mentoria/mentor-family-messages/route";

const MESSAGE_TYPE_CONFIG: Record<string, { label: string; emoji: string; badge: string }> = {
  general:     { label: "General",      emoji: "💬", badge: "bg-slate-100 text-slate-600" },
  alert:       { label: "Alerta",       emoji: "⚠️", badge: "bg-amber-100 text-amber-700" },
  report:      { label: "Informe",      emoji: "📋", badge: "bg-blue-100 text-blue-700" },
  achievement: { label: "Logro",        emoji: "🏆", badge: "bg-emerald-100 text-emerald-700" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return `hoy ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function MentorFamilyMessages() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [messages, setMessages] = useState<FamilyMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formType, setFormType] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mentoria/mentor-family-messages?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { messages?: FamilyMessageItem[] };
      setMessages(data.messages ?? []);
    } catch {
      setError("No se pudieron cargar los mensajes.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmail.trim() || !formSubject.trim() || !formBody.trim()) return;
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch("/api/mentoria/mentor-family-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          recipientEmail: formEmail.trim(),
          subject: formSubject.trim(),
          body: formBody.trim(),
          messageType: formType,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        const msg =
          data.error === "all_fields_required" ? "Completa todos los campos obligatorios." :
          data.error === "invalid_email" ? "El formato del email no es válido." :
          data.error === "subject_too_long" ? "El asunto es demasiado largo (máx. 200 caracteres)." :
          "No se pudo enviar el mensaje. Inténtalo de nuevo.";
        setFormError(msg);
        return;
      }
      setFormSuccess("Mensaje registrado correctamente.");
      setFormEmail("");
      setFormSubject("");
      setFormBody("");
      setFormType("general");
      setShowForm(false);
      await load();
    } catch {
      setFormError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/mentoria/panel/alumno?studentId=${encodeURIComponent(studentId)}`}
            className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 transition"
          >
            ← Volver
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Mensajes a la familia</h1>
            <p className="text-sm text-slate-500">Comunicación del mentor hacia tutores y familia</p>
          </div>
        </div>

        {/* Success banner */}
        {formSuccess && (
          <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            ✅ {formSuccess}
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] bg-white border border-slate-200 px-6 py-12 text-center text-slate-400">
            Cargando…
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-rose-50 border border-rose-200 px-6 py-6 text-sm text-rose-600">
            {error}
          </div>
        ) : (
          <>
            {/* Message list */}
            {messages.length === 0 ? (
              <div className="rounded-[28px] bg-white border border-dashed border-slate-200 px-6 py-12 text-center mb-4">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm font-medium text-slate-600">Sin mensajes enviados</p>
                <p className="mt-1 text-xs text-slate-400">
                  Los mensajes que envíes a la familia del alumno aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {messages.map((msg) => {
                  const tc = MESSAGE_TYPE_CONFIG[msg.messageType] ?? MESSAGE_TYPE_CONFIG.general;
                  const isExpanded = expanded === msg.id;
                  return (
                    <div
                      key={msg.id}
                      className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : msg.id)}
                        className="w-full px-5 py-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tc.badge}`}>
                                {tc.emoji} {tc.label}
                              </span>
                              <span className="text-xs text-slate-400">{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="font-semibold text-sm text-slate-950 truncate">{msg.subject}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Para: {msg.recipientEmail}</p>
                          </div>
                          <span className="shrink-0 text-slate-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-slate-100">
                          <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {msg.body}
                          </p>
                          {msg.senderName && (
                            <p className="mt-3 text-xs text-slate-400">Enviado por {msg.senderName}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Compose form */}
            {showForm ? (
              <div className="rounded-[28px] bg-white border border-slate-200 px-6 py-6">
                <h2 className="mb-4 text-base font-semibold text-slate-950">Nuevo mensaje</h2>
                <form onSubmit={(e) => void handleSend(e)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block mb-1 text-xs font-medium text-slate-600">
                        Destinatario (email) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="familiar@ejemplo.com"
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block mb-1 text-xs font-medium text-slate-600">Tipo</label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="general">💬 General</option>
                        <option value="alert">⚠️ Alerta</option>
                        <option value="report">📋 Informe</option>
                        <option value="achievement">🏆 Logro</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-slate-600">
                      Asunto <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="Ej: Progreso semanal de matemáticas"
                      required
                      maxLength={200}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-slate-600">
                      Mensaje <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      placeholder="Escribe aquí el contenido del mensaje para la familia…"
                      required
                      rows={5}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-rose-600">{formError}</p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {submitting ? "Enviando…" : "Enviar mensaje"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setFormError(""); }}
                      className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="w-full rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition"
              >
                + Nuevo mensaje a la familia
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
