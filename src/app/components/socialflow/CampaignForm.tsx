"use client";

import { useState } from "react";

export function CampaignForm(props: {
  saasId: string;
  onCreated?: (campaignId?: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/socialflow/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: props.saasId, name, status }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message || "No se pudo crear la campaña");
      }

      const data = (await res.json().catch(() => null)) as { campaign?: { id?: string } } | null;
      const createdCampaignId = data?.campaign?.id;

      setName("");
      setStatus("ACTIVE");
      setMessage("Campaña creada");

      if (props.onCreated) {
        await props.onCreated(createdCampaignId);
      }
    } catch (err) {
      console.error("SOCIALFLOW_CAMPAIGNFORM_ERROR", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      <p className="text-xs text-gray-500">Agrupa tus publicaciones por objetivos para planificar mejor tu contenido.</p>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Nombre de campaña</label>
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Lanzamiento de abril"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Estado de la campaña</label>
        <select
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value as "ACTIVE" | "PAUSED")}
        >
          <option value="ACTIVE">Activa</option>
          <option value="PAUSED">Pausada</option>
        </select>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
      {message && !error && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{message}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creando..." : "Crear campaña"}
      </button>
    </form>
  );
}
