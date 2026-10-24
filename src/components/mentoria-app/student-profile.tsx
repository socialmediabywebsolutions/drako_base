"use client";

import { useEffect, useState } from "react";
import { MentoriaAppSectionNav } from "@/components/mentoria-app/app-section-nav";
import type { StudentProfilePublic } from "@/app/api/mentoria/profile/route";

const STUDY_MINUTES_OPTIONS = [15, 20, 25, 30, 45, 60];

const LEARNING_PREFERENCE_LABELS: Record<string, string> = {
  visual: "Visual (diagramas y ejemplos)",
  verbal: "Verbal (explicaciones paso a paso)",
  practice: "Práctica (ejercicios directos)",
  mixed: "Mixto",
};

export function MentoriaStudentProfile() {
  const [profile, setProfile] = useState<StudentProfilePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    preferredStudyMinutes: 25,
    learningPreference: "",
    supportNotes: "",
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/mentoria/profile", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/perfil"; return; }
    if (res.status === 409) { window.location.href = "/mentoria/onboarding"; return; }
    const body = await res.json().catch(() => null) as { profile?: StudentProfilePublic } | null;
    if (!body?.profile) { setError("No se pudo cargar el perfil."); setLoading(false); return; }
    setProfile(body.profile);
    setForm({
      preferredStudyMinutes: body.profile.preferredStudyMinutes,
      learningPreference: body.profile.learningPreference ?? "",
      supportNotes: body.profile.supportNotes ?? "",
    });
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/mentoria/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredStudyMinutes: form.preferredStudyMinutes,
        learningPreference: form.learningPreference || null,
        supportNotes: form.supportNotes || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    void load();
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <MentoriaAppSectionNav active="perfil" />
        <div className="space-y-6">

          {/* Header */}
          <div className="rounded-[28px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">Mi perfil</h1>
                <p className="mt-1 text-sm text-slate-500">Ajusta tu experiencia de estudio en Mentoría.</p>
              </div>
              {profile && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          {loading && (
            <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Cargando perfil…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {profile && !editing && (
            <div className="space-y-4">
              {/* Identity */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
                    {profile.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-slate-950">{profile.fullName}</div>
                    <div className="text-sm text-slate-500">{profile.schoolYear}</div>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm space-y-4">
                <h2 className="font-semibold text-slate-950">Preferencias de estudio</h2>

                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Duración de sesión</span>
                  <span className="text-sm font-semibold text-slate-950">{profile.preferredStudyMinutes} min</span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Estilo de aprendizaje</span>
                  <span className="text-sm font-semibold text-slate-950">
                    {profile.learningPreference
                      ? (LEARNING_PREFERENCE_LABELS[profile.learningPreference] ?? profile.learningPreference)
                      : "No especificado"}
                  </span>
                </div>

                {profile.supportNotes && (
                  <div className="py-3">
                    <div className="text-sm text-slate-600 mb-1">Notas de apoyo</div>
                    <p className="text-sm text-slate-800 leading-relaxed">{profile.supportNotes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-400 text-center">
                Miembro desde {new Date(profile.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </div>
            </div>
          )}

          {profile && editing && (
            <form
              onSubmit={(e) => { void handleSave(e); }}
              className="rounded-[28px] bg-white p-6 shadow-sm space-y-5"
            >
              <h2 className="font-semibold text-slate-950">Editar preferencias</h2>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Duración preferida de sesión
                </label>
                <div className="flex flex-wrap gap-2">
                  {STUDY_MINUTES_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, preferredStudyMinutes: m }))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        form.preferredStudyMinutes === m
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estilo de aprendizaje</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                  value={form.learningPreference}
                  onChange={(e) => setForm((f) => ({ ...f, learningPreference: e.target.value }))}
                >
                  <option value="">No especificado</option>
                  {Object.entries(LEARNING_PREFERENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notas de apoyo (opcional)
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 resize-none"
                  placeholder="Información adicional para tu tutor IA…"
                  value={form.supportNotes}
                  onChange={(e) => setForm((f) => ({ ...f, supportNotes: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl bg-white border border-slate-200 px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
