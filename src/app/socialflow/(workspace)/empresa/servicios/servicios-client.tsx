"use client";

import { useState } from "react";
import type { EmpresaService } from "@/lib/socialflow/services/types";
import ServiceForm from "./ServiceForm";

type ListItem = Omit<EmpresaService, "tenantId" | "saasId">;

export default function ServiciosClient({ initialServices }: { initialServices: EmpresaService[] }) {
  const [services, setServices] = useState<ListItem[]>(initialServices);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(service: ListItem) {
    setEditing(service);
    setFormOpen(true);
  }

  function handleSaved(service: ListItem) {
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      return exists ? prev.map((s) => (s.id === service.id ? service : s)) : [service, ...prev];
    });
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/socialflow/empresa/services/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: true } | { ok: false; error?: string };
      if (json.ok) {
        setServices((prev) => prev.filter((s) => s.id !== id));
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
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">
            Socialcors · Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Servicios</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Añade los servicios de tu negocio para que la IA identifique qué se ofrece en cada foto.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110"
        >
          + Añadir servicio
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {services.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-16 text-center">
          <div className="text-5xl">🗂️</div>
          <p className="mt-4 text-sm text-gray-500">
            Añade los servicios de tu negocio para que la IA los reconozca en las fotos
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white shadow-sm">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              deleting={deletingId === service.id}
              onEdit={() => openEdit(service)}
              onDelete={() => handleDelete(service.id)}
            />
          ))}
        </ul>
      )}

      {formOpen && (
        <ServiceForm
          service={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function ServiceRow({
  service, deleting, onEdit, onDelete,
}: {
  service: ListItem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-400">
        <span className="text-lg">🗂️</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{service.name}</p>
        <p className="truncate text-xs text-gray-500">
          {service.category || "Sin categoría"}
        </p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
        >
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </li>
  );
}
