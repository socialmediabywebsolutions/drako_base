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

export default function SocialFlowAIPage() {
  const [niche, setNiche] = useState("Beauty salons");
  const [tone, setTone] = useState("Friendly, expert, concrete");
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
      setError(e?.message || "Failed to load generated posts");
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
        setError(campaign.notes || "Campaign generation failed");
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
        setError(json.error || "Failed to start campaign generation");
        return;
      }
      setCampaignId(json.campaignId);
      setCampaignStatus("GENERATING");
      startPolling(json.campaignId);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
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
        body: JSON.stringify({
          saasId: "socialflow",
          postId,
          niche,
          tone,
          frequencyPerWeek: frequency,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "No se pudo regenerar el post");
      }
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
        body: JSON.stringify({
          saasId: "socialflow",
          id: payload.id,
          action,
          scheduledAt: payload.scheduledAt ?? null,
        }),
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
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">SocialFlow AI</h1>
        <p className="mb-4 text-sm text-gray-600">
          Generate an AI-powered campaign for your SocialFlow workspace. Generation runs in the
          background and can take a few minutes for larger campaigns.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Niche</label>
            <input className="rounded border px-3 py-2 text-sm" value={niche} onChange={(e) => setNiche(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-medium">Tone of voice</label>
            <input className="rounded border px-3 py-2 text-sm" value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Posts per week</label>
            <input
              type="number"
              className="rounded border px-3 py-2 text-sm"
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
          className="mt-4 inline-flex items-center rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading || campaignStatus === "GENERATING" ? "Generating..." : "Generate AI Campaign"}
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {campaignStatus === "GENERATING" && (
          <p className="mt-2 text-sm text-gray-600">
            Generating your campaign in the background... this can take a few minutes. You can leave
            this page open; it will update automatically when it&apos;s ready.
          </p>
        )}
      </div>

      {campaignStatus === "ACTIVE" && (
        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Generated posts & schedule</h2>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {posts.map((post) => {
              const hashtags = post.metadata?.hashtags ?? [];
              return (
                <div key={post.id} className="flex flex-col gap-2 rounded border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{post.title}</span>
                    {post.scheduledAt && <span className="text-xs text-gray-500">{new Date(post.scheduledAt).toLocaleString()}</span>}
                  </div>
                  {editingPostId === post.id ? (
                    <div className="mt-1 space-y-2">
                      <input
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={editDraft?.title ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                        placeholder="Titulo"
                      />
                      <textarea
                        className="w-full rounded border px-2 py-1 text-xs"
                        rows={4}
                        value={editDraft?.body ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
                        placeholder="Texto del post"
                      />
                      <input
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={editDraft?.hook ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, hook: e.target.value } : prev))}
                        placeholder="Angulo / Hook"
                      />
                      <input
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={editDraft?.cta ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, cta: e.target.value } : prev))}
                        placeholder="CTA"
                      />
                      <input
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={editDraft?.hashtags ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, hashtags: e.target.value } : prev))}
                        placeholder="Hashtags (separados por coma o #)"
                      />
                      <input
                        type="datetime-local"
                        className="w-full rounded border px-2 py-1 text-xs"
                        value={editDraft?.scheduledAt ?? ""}
                        onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, scheduledAt: e.target.value } : prev))}
                      />
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-xs text-gray-800">{post.body}</p>
                      {hashtags.length > 0 && <p className="text-xs text-gray-600">Hashtags: {hashtags.join(" ")}</p>}
                    </>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                      onClick={() => updatePost("approve", { id: post.id })}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700"
                      onClick={() => updatePost("reject", { id: post.id })}
                    >
                      Reject
                    </button>
                    {post.scheduledAt && (
                      <button
                        type="button"
                        className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700"
                        onClick={() => updatePost("schedule", { id: post.id, scheduledAt: post.scheduledAt ?? undefined })}
                      >
                        Re-schedule
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700"
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
                      {editingPostId === post.id ? "Save" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700"
                      onClick={() => regeneratePost(post.id)}
                    >
                      Regenerate
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
