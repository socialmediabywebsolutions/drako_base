"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { MentorGuardianItem } from "@/app/api/mentoria/mentor-guardians/route";

const ROLE_LABELS: Record<string, string> = {
  father: "Padre",
  mother: "Madre",
  tutor: "Tutor",
};

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  primary_guardian: "Principal",
  secondary_guardian: "Secundario",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: "Activo", badge: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Invitación pendiente", badge: "bg-amber-100 text-amber-700" },
  removed: { label: "Desvinculado", badge: "bg-slate-100 text-slate-500" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function MentorStudentGuardians() {
  const params = useSearchParams();
  const studentId = params.get("studentId") ?? "";

  const [guardians, setGuardians] = useState<MentorGuardianItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("tutor");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mentoria/mentor-guardians?studentId=${encodeURIComponent(studentId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { guardians?: MentorGuardianItem[] };
      setGuardians(data.guardians ?? []);
    } catch {
      setError("No se pudieron cargar los tutores vinculados.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmail.trim()) return;
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch("/api/mentoria/mentor-guardians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          email: formEmail.trim(),
          name: formName.trim() || null,
          role: formRole,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        const msg =
          data.error === "guardian_already_linked" ? "Este email ya está vinculado al alumno." :
          data.error === "invalid_email" ? "El formato de email no es válido." :
          "No se pudo añadir el tutor. Inténtalo de nuevo.";
        setFormError(msg);
        return;
      }
      setFormSuccess("Tutor vinculado correctamente.");
      setFormEmail("");
      setFormName("");
      setFormRole("tutor");
      setShowForm(false);
      await load();
    } catch {
      setFormError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(linkId: string) {
    if (!confirm("¿Desvincular a este tutor del alumno?")) return;
    try {
      await fetch(`/api/mentoria/mentor-guardians?linkId=${encodeURIComponent(linkId)}`, { method: "DELETE" });
      await load();
    } catch {
      // silent
    }
  }

  const activeGuardians = guardians.filter((g) => g.status !== "removed");

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
            <h1 className="text-xl font-bold text-slate-950">Familia vinculada</h1>
            <p className="text-sm text-slate-500">Tutores y familia con acceso al seguimiento</p>
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
            {/* Guardian list */}
            {activeGuardians.length === 0 ? (
              <div className="rounded-[28px] bg-white border border-dashed border-slate-200 px-6 py-12 text-center">
                <div className="text-3xl mb-2">👨‍👩‍👧</div>
                <p className="text-sm font-medium text-slate-600">Sin tutores vinculados</p>
                <p className="mt-1 text-xs text-slate-400">
                  Añade a la familia para que puedan seguir el progreso del alumno.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {activeGuardians.map((guardian) => {
                  const sc = STATUS_CONFIG[guardian.status] ?? STATUS_CONFIG.pending;
                  return (
                    <div
                      key={guardian.linkId}
                      className="rounded-2xl bg-white border border-slate-200 px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-950">
                              {guardian.guardianName ?? guardian.guardianEmail}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc.badge}`}>
                              {sc.label}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              {SYSTEM_ROLE_LABELS[guardian.systemRole] ?? guardian.systemRole}
                            </span>
                          </div>
                          {guardian.guardianName && (
                            <div className="mt-0.5 text-xs text-slate-400 truncate">{guardian.guardianEmail}</div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>{ROLE_LABELS[guardian.role] ?? guardian.role}</span>
                            {guardian.guardianPhone && <span>📞 {guardian.guardianPhone}</span>}
                            <span>Vinculado {formatDate(guardian.createdAt)}</span>
                            {guardian.lastSeenAt && (
                              <span>Último acceso {formatDate(guardian.lastSeenAt)}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemove(guardian.linkId)}
                          className="shrink-0 rounded-xl px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 transition"
                        >
                          Desvincular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invite form */}
            {showForm ? (
              <div className="rounded-[28px] bg-white border border-slate-200 px-6 py-6">
                <h2 className="mb-4 text-base font-semibold text-slate-950">Añadir tutor</h2>
                <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-slate-600">
                      Email del tutor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="tutor@ejemplo.com"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-slate-600">
                      Nombre (opcional)
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="María García"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-slate-600">Relación</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="mother">Madre</option>
                      <option value="father">Padre</option>
                      <option value="tutor">Tutor/a legal</option>
                    </select>
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
                      {submitting ? "Guardando…" : "Vincular tutor"}
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
                + Añadir tutor o familiar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
