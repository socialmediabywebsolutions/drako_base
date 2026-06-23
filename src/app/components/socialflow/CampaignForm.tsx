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
      <p className="text-xs text-white/40">Agrupa tus publicaciones por objetivos para planificar mejor tu contenido.</p>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-white/50">Nombre de campaña</label>
        <input
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Lanzamiento de abril"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-white/50">Estado de la campaña</label>
        <select
          className="w-full rounded-lg border border-white/10 bg-[#0d0d1e] px-2.5 py-1.5 text-sm text-white/70 focus:border-violet-500/50 focus:outline-none"
          value={status}
          onChange={(e) => setStatus(e.target.value as "ACTIVE" | "PAUSED")}
        >
          <option value="ACTIVE">Activa</option>
          <option value="PAUSED">Pausada</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-2 text-xs text-red-300">{error}</div>
      )}
      {message && !error && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-2 text-xs text-emerald-300">{message}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creando..." : "Crear campaña"}
      </button>
    </form>
  );
}
