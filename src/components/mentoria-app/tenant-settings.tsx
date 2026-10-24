"use client";

import { useEffect, useState } from "react";
import type { TenantSettings } from "@/app/api/mentoria/tenant-settings/route";

type Field = {
  key: keyof TenantSettings;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

const FIELDS: Field[] = [
  { key: "centerName", label: "Nombre del centro", type: "text", placeholder: "Ej: Academia Montserrat" },
  { key: "contactEmail", label: "Email de contacto", type: "email", placeholder: "info@academia.com" },
  { key: "contactPhone", label: "Teléfono de contacto", type: "tel", placeholder: "+34 600 000 000" },
  { key: "whatsappNumber", label: "WhatsApp para familias", type: "tel", placeholder: "+34 600 000 000" },
  {
    key: "timezone", label: "Zona horaria", type: "select",
    options: [
      { value: "Europe/Madrid", label: "España (Europe/Madrid)" },
      { value: "Europe/London", label: "Reino Unido (Europe/London)" },
      { value: "America/New_York", label: "EE.UU. Este (America/New_York)" },
      { value: "America/Mexico_City", label: "México (America/Mexico_City)" },
      { value: "America/Bogota", label: "Colombia (America/Bogota)" },
      { value: "America/Lima", label: "Perú (America/Lima)" },
      { value: "America/Santiago", label: "Chile (America/Santiago)" },
      { value: "America/Buenos_Aires", label: "Argentina (America/Buenos_Aires)" },
    ],
  },
  {
    key: "language", label: "Idioma", type: "select",
    options: [
      { value: "es", label: "Español" },
      { value: "en", label: "English" },
      { value: "pt", label: "Português" },
    ],
  },
  { key: "welcomeMessage", label: "Mensaje de bienvenida", type: "textarea", placeholder: "Mensaje que verán los alumnos al iniciar sesión…" },
];

export function MentoriaTenantSettings() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<TenantSettings>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/tenant-settings", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel/config"; return; }
      if (res.status === 403) { setError("Solo el propietario puede acceder a la configuración."); setLoading(false); return; }
      const body = await res.json().catch(() => null) as { settings?: TenantSettings } | null;
      if (!body?.settings) { setError("Error al cargar la configuración."); setLoading(false); return; }
      setSettings(body.settings);
      setForm(body.settings);
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/mentoria/tenant-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { setError("Error al guardar. Inténtalo de nuevo."); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const hasChanges = settings && JSON.stringify(form) !== JSON.stringify(settings);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Configuración del tenant</h1>
          <p className="mt-1 text-sm text-slate-500">Ajustes del centro: nombre, contacto y preferencias generales.</p>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando configuración…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="rounded-[28px] bg-white p-6 shadow-sm space-y-5">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {field.label}
                </label>

                {field.type === "select" ? (
                  <select
                    value={(form[field.key] as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={(form[field.key] as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={(form[field.key] as string) ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                )}
              </div>
            ))}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => void handleSave()}
                disabled={saving || !hasChanges}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              {saved && (
                <span className="text-sm text-emerald-600 font-medium">✓ Guardado</span>
              )}
              {hasChanges && !saving && !saved && (
                <button
                  onClick={() => settings && setForm(settings)}
                  className="text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  Descartar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
