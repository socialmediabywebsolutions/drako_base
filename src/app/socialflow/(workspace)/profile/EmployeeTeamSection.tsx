"use client";

import { useEffect, useRef, useState } from "react";
import { sectionCls } from "./ProfileFormFields";

const MAX_EMPLOYEES = 20;

type Employee = {
  id: string;
  name: string;
  jobTitle: string;
  jobDescription: string | null;
  faceR2Key: string | null;
  faceUrl: string | null;
  isActive: boolean;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition backdrop-blur-sm";

export default function EmployeeTeamSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/socialflow/employees");
        const json: any = await res.json();
        if (!cancelled && json.ok) setEmployees(json.employees || []);
      } catch {
        if (!cancelled) setError("No se pudo cargar el equipo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function upsertLocal(employee: Employee) {
    setEmployees((prev) => {
      const idx = prev.findIndex((e) => e.id === employee.id);
      if (idx === -1) return [...prev, employee];
      const copy = [...prev];
      copy[idx] = employee;
      return copy;
    });
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este empleado del equipo?")) return;
    try {
      const res = await fetch(`/api/socialflow/employees/${id}`, { method: "DELETE" });
      const json: any = await res.json();
      if (json.ok) setEmployees((prev) => prev.filter((e) => e.id !== id));
      else setError(json.message || json.error || "No se pudo eliminar");
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    }
  }

  return (
    <section className={sectionCls}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white/90">Equipo</h2>
        <span className="text-xs text-white/30">
          Empleados que la IA puede reconocer en tus fotos ({employees.length}/{MAX_EMPLOYEES}).
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {loading && <p className="text-sm text-white/40">Cargando equipo...</p>}

      {!loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <div
              key={employee.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-white/30">
                {employee.faceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={employee.faceUrl} alt={employee.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white/90">{employee.name}</p>
                <p className="truncate text-xs text-white/45">{employee.jobTitle}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(employee);
                    setFormOpen(true);
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(employee.id)}
                  className="rounded-lg px-2 py-1 text-xs text-white/50 transition hover:bg-red-500/20 hover:text-red-300"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        disabled={employees.length >= MAX_EMPLOYEES}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Añadir empleado
      </button>

      {formOpen && (
        <EmployeeInlineForm
          employee={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(employee) => {
            upsertLocal(employee);
            setFormOpen(false);
          }}
        />
      )}
    </section>
  );
}

function EmployeeInlineForm({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
}) {
  const isEdit = Boolean(employee);
  const [name, setName] = useState(employee?.name ?? "");
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle ?? "");
  const [jobDescription, setJobDescription] = useState(employee?.jobDescription ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(employee?.faceUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadFace(employeeId: string): Promise<{ url: string } | null> {
    if (!photoFile) return null;
    const fd = new FormData();
    fd.append("file", photoFile);
    const res = await fetch(`/api/socialflow/employees/${employeeId}/face`, { method: "POST", body: fd });
    const json: any = await res.json();
    if (!json.ok) throw new Error(json.message || json.error || "No se pudo subir la foto");
    return { url: json.url };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedJobTitle = jobTitle.trim();
    if (!trimmedName || !trimmedJobTitle) {
      setError("Nombre y puesto son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: trimmedName, jobTitle: trimmedJobTitle, jobDescription: jobDescription.trim() || null };
      let saved: Employee;

      if (isEdit && employee) {
        const res = await fetch(`/api/socialflow/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json: any = await res.json();
        if (!json.ok) throw new Error(json.message || json.error || "No se pudo actualizar");
        saved = json.employee;
      } else {
        const res = await fetch("/api/socialflow/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json: any = await res.json();
        if (!json.ok) throw new Error(json.message || json.error || "No se pudo crear");
        saved = json.employee;
      }

      if (photoFile) {
        const uploaded = await uploadFace(saved.id);
        if (uploaded) saved = { ...saved, faceUrl: uploaded.url };
      }

      onSaved(saved);
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/40">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="text-sm font-black text-white">{isEdit ? "Editar empleado" : "Añadir empleado"}</h3>
          <button type="button" onClick={onClose} className="text-white/40 transition hover:text-white/80">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="flex justify-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/15 bg-white/5 text-white/30 transition hover:border-violet-500/40"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Foto de rostro de referencia" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">📷</span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <p className="-mt-2 text-center text-[11px] text-white/30">
            Foto de rostro de referencia (para que la IA lo reconozca)
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/45">Nombre completo *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juanita Pérez" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/45">Puesto *</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Estilista"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/45">Descripción breve de sus labores</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Especialista en coloración y cortes modernos"
              rows={3}
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
