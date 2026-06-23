"use client";

import { useEffect, useRef, useState } from "react";

type CampaignStatus = "GENERATING" | "ACTIVE" | "FAILED" | null;

type SocialPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  metadata?: {
    hashtags?: string[];
    angle?: string;
    callToAction?: string;
  } | null;
};

const inputCls = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";
const labelCls = "text-sm font-medium text-white/50";

export default function SocialFlowAIPage() {
  const [niche, setNiche] = useState("Beauty salons");
  const [tone, setTone] = useState("Cercano, experto, concreto");
  const [frequency, setFrequency] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    body: string;
    hook: string;
    cta: string;
    hashtags: string;
    scheduledAt: string;
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  async function loadPosts(id: string) {
    try {
      const res = await fetch(`/api/socialflow/posts?saasId=socialflow&campaignId=${id}`);
      const json = (await res.json()) as { items?: SocialPost[] };
      setPosts(json.items ?? []);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar los posts generados");
    }
  }

  async function checkCampaignStatus(id: string) {
    try {
      const res = await fetch(`/api/socialflow/campaigns?saasId=socialflow`);
      const json = (await res.json()) as { items?: { id: string; status: string; notes: string | null }[] };
      const campaign = json.items?.find((item) => item.id === id);
      if (!campaign) return;
      if (campaign.status === "ACTIVE") {
        stopPolling();
        setCampaignStatus("ACTIVE");
        await loadPosts(id);
      } else if (campaign.status === "FAILED") {
        stopPolling();
        setCampaignStatus("FAILED");
        setError(campaign.notes || "La generación de la campaña falló");
      }
    } catch {
      // transient polling error, retry on next tick
    }
  }

  function startPolling(id: string) {
    stopPolling();
    void checkCampaignStatus(id);
    pollRef.current = setInterval(() => void checkCampaignStatus(id), 5000);
  }

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setPosts([]);
    setCampaignId(null);
    setCampaignStatus(null);
    stopPolling();
    try {
      const res = await fetch("/api/socialflow/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, tone, frequencyPerWeek: frequency, saasId: "socialflow" }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; campaignId?: string; status?: string };
      if (!json.ok || !json.campaignId) {
        setError(json.error || "No se pudo iniciar la generación de campaña");
        return;
      }
      setCampaignId(json.campaignId);
      setCampaignStatus("GENERATING");
      startPolling(json.campaignId);
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdits(postId: string) {
    if (!editDraft) return;
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "socialflow",
          id: postId,
          title: editDraft.title,
          body: editDraft.body,
          metadata: {
            angle: editDraft.hook,
            callToAction: editDraft.cta,
            hashtags: editDraft.hashtags.split(/[,#]/).map((t) => t.trim()).filter(Boolean),
          },
          scheduledAt: editDraft.scheduledAt || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || "No se pudo guardar el post");
      }
      setEditingPostId(null);
      setEditDraft(null);
      if (campaignId) await loadPosts(campaignId);
    } catch (e: any) {
      setError(e?.message || "Error al guardar cambios");
    }
  }

  async function regeneratePost(postId: string) {
    try {
      const res = await fetch("/api/socialflow/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", postId, niche, tone, frequencyPerWeek: frequency }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || json?.ok === false) throw new Error(json?.message || "No se pudo regenerar el post");
      if (campaignId) await loadPosts(campaignId);
    } catch (e: any) {
      setError(e?.message || "Error al regenerar el post");
    }
  }

  async function updatePost(action: "approve" | "reject" | "schedule", payload: { id: string; scheduledAt?: string }) {
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", id: payload.id, action, scheduledAt: payload.scheduledAt ?? null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || "No se pudo actualizar el post");
      }
      if (campaignId) await loadPosts(campaignId);
    } catch (e: any) {
      setError(e?.message || "Error al actualizar el post");
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · IA</p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white">Generador de campañas IA</h1>
      </div>

      {/* Generator panel */}
      <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
        <p className="mb-5 text-sm text-white/45">
          Genera una campaña impulsada por IA para tu workspace. La generación corre en segundo plano y puede tardar unos minutos para campañas grandes.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nicho</label>
            <input className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Beauty salons" />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className={labelCls}>Tono de comunicación</label>
            <input className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Cercano, experto, concreto" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Posts por semana</label>
            <input
              type="number"
              className={inputCls}
              value={frequency}
              min={1}
              max={21}
              onChange={(e) => setFrequency(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || campaignStatus === "GENERATING"}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(loading || campaignStatus === "GENERATING") && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          )}
          {loading || campaignStatus === "GENERATING" ? "Generando..." : "Generar campaña IA"}
        </button>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {campaignStatus === "GENERATING" && (
          <p className="mt-3 text-sm text-white/45">
            Generando tu campaña en segundo plano... puede tardar unos minutos. Puedes dejar esta página abierta; se actualizará automáticamente cuando esté lista.
          </p>
        )}
      </div>

      {/* Generated posts */}
      {campaignStatus === "ACTIVE" && (
        <section className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <h2 className="mb-4 text-lg font-black uppercase italic tracking-tight text-white">Posts generados y programación</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {posts.map((post) => {
              const hashtags = post.metadata?.hashtags ?? [];
              return (
                <div key={post.id} className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/4 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/85">{post.title}</span>
                    {post.scheduledAt && (
                      <span className="text-xs text-white/35">{new Date(post.scheduledAt).toLocaleString()}</span>
                    )}
                  </div>
                  {editingPostId === post.id ? (
                    <div className="mt-1 space-y-2">
                      <input className={inputCls + " text-xs"} value={editDraft?.title ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))} placeholder="Título" />
                      <textarea className={inputCls + " text-xs"} rows={4} value={editDraft?.body ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, body: e.target.value } : prev))} placeholder="Texto del post" />
                      <input className={inputCls + " text-xs"} value={editDraft?.hook ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, hook: e.target.value } : prev))} placeholder="Ángulo / Hook" />
                      <input className={inputCls + " text-xs"} value={editDraft?.cta ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, cta: e.target.value } : prev))} placeholder="CTA" />
                      <input className={inputCls + " text-xs"} value={editDraft?.hashtags ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, hashtags: e.target.value } : prev))} placeholder="Hashtags (separados por coma o #)" />
                      <input type="datetime-local" className={inputCls + " text-xs"} value={editDraft?.scheduledAt ?? ""} onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, scheduledAt: e.target.value } : prev))} />
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-xs text-white/70">{post.body}</p>
                      {hashtags.length > 0 && <p className="text-xs text-white/40">Hashtags: {hashtags.join(" ")}</p>}
                    </>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 transition hover:bg-emerald-500/15" onClick={() => updatePost("approve", { id: post.id })}>
                      Aprobar
                    </button>
                    <button type="button" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 transition hover:bg-rose-500/15" onClick={() => updatePost("reject", { id: post.id })}>
                      Rechazar
                    </button>
                    {post.scheduledAt && (
                      <button type="button" className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300 transition hover:bg-sky-500/15" onClick={() => updatePost("schedule", { id: post.id, scheduledAt: post.scheduledAt ?? undefined })}>
                        Reprogramar
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/55 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300"
                      onClick={() => {
                        if (editingPostId === post.id) {
                          void saveEdits(post.id);
                        } else {
                          setEditingPostId(post.id);
                          setEditDraft({
                            title: post.title ?? "",
                            body: post.body ?? "",
                            hook: post.metadata?.angle ?? "",
                            cta: post.metadata?.callToAction ?? "",
                            hashtags: hashtags.join(" "),
                            scheduledAt: post.scheduledAt ?? "",
                          });
                        }
                      }}
                    >
                      {editingPostId === post.id ? "Guardar" : "Editar"}
                    </button>
                    <button type="button" className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300 transition hover:bg-indigo-500/15" onClick={() => regeneratePost(post.id)}>
                      Regenerar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
