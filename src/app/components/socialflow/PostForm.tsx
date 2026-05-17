"use client";

import { useEffect, useState } from "react";
import type { SocialCampaign } from "@/app/components/socialflow/types";

export function PostForm(props: {
  saasId: string;
  campaigns: SocialCampaign[];
  prefillCampaignId?: string | null;
  onCreated?: () => void | Promise<void>;
}) {
  const [campaignId, setCampaignId] = useState<string | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SCHEDULED">("SCHEDULED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.prefillCampaignId) return;
    setCampaignId(props.prefillCampaignId);
  }, [props.prefillCampaignId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: props.saasId,
          campaignId: campaignId || null,
          provider: "LINKEDIN",
          contentType: "FEED",
          title,
          body,
          status,
          scheduledAt: scheduledAt || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data?.message || "No se pudo crear el post");
      }

      setTitle("");
      setBody("");
      setScheduledAt("");
      setCampaignId("");
      setStatus("SCHEDULED");

      if (props.onCreated) {
        await props.onCreated();
      }
    } catch (err) {
      console.error("SOCIALFLOW_POSTFORM_ERROR", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <p className="text-xs text-gray-500">Programa tu contenido y deja que se publique automáticamente.</p>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Campaña</label>
        <select
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">Sin campaña</option>
          {props.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Título del post</label>
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. 5 ideas para cuidar tu imagen esta semana"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">Texto del post</label>
        <textarea
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el mensaje que verá tu audiencia"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Fecha de publicación</label>
          <input
            type="datetime-local"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Estado del post</label>
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            value={status}
            onChange={(e) => setStatus(e.target.value as "DRAFT" | "SCHEDULED")}
          >
            <option value="DRAFT">Borrador</option>
            <option value="SCHEDULED">Programado</option>
          </select>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Guardando..." : "Crear post"}
      </button>
    </form>
  );
}
