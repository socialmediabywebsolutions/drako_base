"use client";

import { useState } from "react";
import type { EmpresaEmployee } from "@/lib/socialflow/employees/types";
import EmployeeForm from "./EmployeeForm";

type ListItem = Omit<EmpresaEmployee, "tenantId" | "saasId">;

export default function EmpleadosClient({ initialEmployees }: { initialEmployees: EmpresaEmployee[] }) {
  const [employees, setEmployees] = useState<ListItem[]>(initialEmployees);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(employee: ListItem) {
    setEditing(employee);
    setFormOpen(true);
  }

  function handleSaved(employee: ListItem) {
    setEmployees((prev) => {
      const exists = prev.some((e) => e.id === employee.id);
      return exists ? prev.map((e) => (e.id === employee.id ? employee : e)) : [employee, ...prev];
    });
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este empleado?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/socialflow/empresa/employees/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: true } | { ok: false; error?: string };
      if (json.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== id));
      } else {
        setError(json.error ?? "Error al eliminar");
      }
    } catch {
      setError("Error inesperado");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
            Socialcors · Equipo
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Empleados</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Añade a tu equipo para que la IA los reconozca en las fotos y genere contenido personalizado.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
        >
          + Añadir empleado
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {employees.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-6 py-16 text-center">
          <div className="text-5xl">👥</div>
          <p className="mt-4 text-sm text-white/50">
            Añade tu equipo para que la IA los reconozca en las fotos
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-white/4">
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              deleting={deletingId === employee.id}
              onEdit={() => openEdit(employee)}
              onDelete={() => handleDelete(employee.id)}
            />
          ))}
        </ul>
      )}

      {formOpen && (
        <EmployeeForm
          employee={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function EmployeeRow({
  employee, deleting, onEdit, onDelete,
}: {
  employee: ListItem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-white/30">
        {employee.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={employee.photoUrl} alt={employee.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg">👤</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/90">{employee.name}</p>
        <p className="truncate text-xs text-white/40">
          {[employee.role, employee.specialty].filter(Boolean).join(" · ") || "Sin cargo definido"}
        </p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white/45 transition hover:border-white/15 hover:bg-white/5 hover:text-white/80"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-white/35 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
        >
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </li>
  );
}
