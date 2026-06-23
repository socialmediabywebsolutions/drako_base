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

  const inputCls = "w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";
  const selectCls = "w-full rounded-lg border border-white/10 bg-[#0d0d1e] px-2.5 py-1.5 text-sm text-white/70 focus:border-violet-500/50 focus:outline-none";
  const labelCls = "block text-xs font-medium text-white/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <p className="text-xs text-white/40">Programa tu contenido y deja que se publique automáticamente.</p>

      <div className="space-y-1">
        <label className={labelCls}>Campaña</label>
        <select className={selectCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">Sin campaña</option>
          {props.campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className={labelCls}>Título del post</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. 5 ideas para cuidar tu imagen esta semana"
          required
        />
      </div>

      <div className="space-y-1">
        <label className={labelCls}>Texto del post</label>
        <textarea
          className={inputCls}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el mensaje que verá tu audiencia"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelCls}>Fecha de publicación</label>
          <input
            type="datetime-local"
            className={inputCls}
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Estado del post</label>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "SCHEDULED")}>
            <option value="DRAFT">Borrador</option>
            <option value="SCHEDULED">Programado</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 p-2 text-xs text-red-300">{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Guardando..." : "Crear post"}
      </button>
    </form>
  );
}
