"use client";

import { useState } from "react";
import type { EmpresaService } from "@/lib/socialflow/services/types";

type ListItem = Omit<EmpresaService, "tenantId" | "saasId">;
type SaveResponse = { ok: true; service: EmpresaService } | { ok: false; error?: string; message?: string };

export default function ServiceForm({
  service,
  onClose,
  onSaved,
}: {
  service: ListItem | null;
  onClose: () => void;
  onSaved: (service: ListItem) => void;
}) {
  const isEdit = Boolean(service);
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [zona, setZona] = useState(service?.zona ?? "");
  const [tarifa, setTarifa] = useState(service?.tarifa ?? "");
  const [credentialDeclared, setCredentialDeclared] = useState(service?.credentialDeclared ?? false);
  const [credentialDescription, setCredentialDescription] = useState(service?.credentialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        category: category.trim() || null,
        description: description.trim() || null,
        zona: zona.trim() || null,
        tarifa: tarifa.trim() || null,
        credentialDeclared,
        credentialDescription: credentialDeclared ? (credentialDescription.trim() || null) : null,
      };

      let saved: ListItem;
      if (isEdit && service) {
        const res = await fetch(`/api/socialflow/empresa/services/${service.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as SaveResponse;
        if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al actualizar");
        saved = json.service;
      } else {
        const res = await fetch("/api/socialflow/empresa/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as SaveResponse;
        if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al crear");
        saved = json.service;
      }

      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/40">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-sm font-black text-white">
            {isEdit ? "Editar servicio" : "Añadir servicio"}
          </h3>
          <button type="button" onClick={onClose} className="text-white/40 transition hover:text-white/80">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <Field label="Nombre del servicio *">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte de cabello" className={inputCls} autoFocus />
          </Field>
          <Field label="Categoría">
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Peluquería" className={inputCls} />
          </Field>
          <Field label="Descripción">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="En qué consiste el servicio..." rows={3} className={inputCls} />
          </Field>
          <Field label="Zona de cobertura">
            <input type="text" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Madrid centro, a domicilio en un radio de 20km..." className={inputCls} />
          </Field>
          <Field label="Tarifa">
            <input type="text" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="Desde 30€" className={inputCls} />
          </Field>
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-white/45">
              <input
                type="checkbox"
                checked={credentialDeclared}
                onChange={(e) => setCredentialDeclared(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-500"
              />
              Tengo una credencial/certificación relevante
            </label>
            {credentialDeclared && (
              <div className="mt-2">
                <input
                  type="text"
                  value={credentialDescription}
                  onChange={(e) => setCredentialDescription(e.target.value)}
                  placeholder="Certificado en depilación láser, colegiado #1234..."
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition backdrop-blur-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/45">{label}</label>
      {children}
    </div>
  );
}
