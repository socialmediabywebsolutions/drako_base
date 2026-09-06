"use client";

import { useRef, useState } from "react";
import type { EmpresaEmployee } from "@/lib/socialflow/employees/types";

type ListItem = Omit<EmpresaEmployee, "tenantId" | "saasId">;
type SaveResponse = { ok: true; employee: EmpresaEmployee } | { ok: false; error?: string; message?: string };

export default function EmployeeForm({
  employee,
  onClose,
  onSaved,
}: {
  employee: ListItem | null;
  onClose: () => void;
  onSaved: (employee: ListItem) => void;
}) {
  const isEdit = Boolean(employee);
  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState(employee?.role ?? "");
  const [specialty, setSpecialty] = useState(employee?.specialty ?? "");
  const [description, setDescription] = useState(employee?.description ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee?.photoUrl ?? null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  function handleFaceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFaceFile(file);
    if (file) setFacePreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(employeeId: string): Promise<string | null> {
    if (!photoFile) return null;
    const fd = new FormData();
    fd.append("file", photoFile);
    const res = await fetch(`/api/socialflow/empresa/employees/${employeeId}/photo`, {
      method: "POST",
      body: fd,
    });
    const json = (await res.json()) as SaveResponse;
    if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al subir la foto");
    return json.employee.photoUrl;
  }

  async function uploadFace(employeeId: string): Promise<string | null> {
    if (!faceFile) return null;
    const fd = new FormData();
    fd.append("file", faceFile);
    const res = await fetch(`/api/socialflow/empresa/employees/${employeeId}/face`, {
      method: "POST",
      body: fd,
    });
    const json = (await res.json()) as SaveResponse;
    if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al subir la foto de rostro");
    return json.employee.faceR2Key;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName || !trimmedRole) {
      setError("Nombre y cargo son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        role: trimmedRole,
        specialty: specialty.trim() || null,
        description: description.trim() || null,
      };

      let saved: ListItem;
      if (isEdit && employee) {
        const res = await fetch(`/api/socialflow/empresa/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as SaveResponse;
        if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al actualizar");
        saved = json.employee;
      } else {
        const res = await fetch("/api/socialflow/empresa/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as SaveResponse;
        if (!json.ok) throw new Error(json.message ?? json.error ?? "Error al crear");
        saved = json.employee;
      }

      if (photoFile) {
        const photoUrl = await uploadPhoto(saved.id);
        if (photoUrl) saved = { ...saved, photoUrl };
      }
      if (faceFile) {
        const faceR2Key = await uploadFace(saved.id);
        if (faceR2Key) saved = { ...saved, faceR2Key };
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
            {isEdit ? "Editar empleado" : "Añadir empleado"}
          </h3>
          <button type="button" onClick={onClose} className="text-white/40 transition hover:text-white/80">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="flex justify-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/15 bg-white/5 text-white/30 transition hover:border-violet-500/40"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Foto de referencia" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">📷</span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <p className="-mt-2 text-center text-[11px] text-white/30">
            Foto de referencia (para que la IA lo reconozca)
          </p>

          <Field label="Nombre completo *">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juanita Pérez" className={inputCls} autoFocus />
          </Field>
          <Field label="Cargo / puesto *">
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Estilista" className={inputCls} />
          </Field>
          <Field label="Especialidad">
            <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Mechas y balayage" className={inputCls} />
          </Field>
          <Field label="Descripción de su estilo de trabajo">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Le encanta trabajar con colores vibrantes..." rows={3} className={inputCls} />
          </Field>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-white/45">
              Foto de rostro de referencia — la IA usará esta imagen para reconocer a este empleado en las fotos
            </span>
            <div className="flex items-center gap-3">
              {facePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={facePreview} alt="Foto de rostro de referencia" className="h-12 w-12 rounded-lg border border-white/10 object-cover" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFaceChange}
                className="text-xs text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-200 hover:file:bg-violet-500/30"
              />
            </div>
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
