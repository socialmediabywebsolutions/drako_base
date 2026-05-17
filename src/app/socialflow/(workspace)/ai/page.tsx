"use client";

import { useState } from "react";

export default function SocialFlowAIPage() {
  const [niche, setNiche] = useState("Beauty salons");
  const [tone, setTone] = useState("Friendly, expert, concrete");
  const [frequency, setFrequency] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    body: string;
    hook: string;
    cta: string;
    hashtags: string;
    scheduledAt: string;
  } | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, tone, frequencyPerWeek: frequency, saasId: "socialflow" }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; result?: unknown };
      if (!json.ok) {
        setError(json.error || "Failed to generate campaign");
        setResult(null);
      } else {
        setResult(json.result ?? null);
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
      setResult(null);
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
            hook: editDraft.hook,
            cta: editDraft.cta,
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
    } catch (e: any) {
      setError(e?.message || "Error al actualizar el post");
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">SocialFlow AI</h1>
        <p className="mb-4 text-sm text-gray-600">
          Generate an AI-powered campaign for your SocialFlow demo. This runs locally using a deterministic stub model,
          and persists a demo campaign and scheduled posts.
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
          disabled={loading}
          className="mt-4 inline-flex items-center rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate AI Campaign"}
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="space-y-6">
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Trend & Keyword Engine</h2>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div>
                <h3 className="font-medium">Trend signals</h3>
                <ul className="list-disc pl-4 text-gray-700">
                  {(result.trends?.trendingTopics ?? []).map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium">Viral angles & hooks</h3>
                <ul className="list-disc pl-4 text-gray-700">
                  {(result.trends?.viralAngles ?? []).map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                  {(result.trends?.hookIdeas ?? []).slice(0, 3).map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium">Keyword clusters</h3>
                <ul className="list-disc pl-4 text-gray-700">
                  {(result.keywords?.clusters ?? []).map((c: any) => (
                    <li key={c.cluster}>
                      <span className="font-medium">{c.cluster}</span> - {c.intent} - {c.difficulty} - score {c.trendScore}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Competitor intelligence</h2>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              {result.competitors?.map((c: any) => (
                <div key={c.name} className="flex flex-col gap-1 rounded border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs uppercase text-gray-500">{c.platform}</span>
                  </div>
                  <p className="text-xs text-gray-600">Patterns: {c.patterns?.join(", ") || c.contentPatterns?.join(", ")}</p>
                  <p className="text-xs text-gray-600">Winning formats: {c.winningFormats?.join(", ")}</p>
                  <p className="text-xs text-gray-600">Hook styles: {c.hookStyles?.join(" | ")}</p>
                  <p className="text-xs text-gray-600">Hashtags: {c.hashtagsUsed?.join(" ")}</p>
                  <p className="text-xs text-gray-600">Strengths: {c.strengths?.join(", ")}</p>
                  <p className="text-xs text-gray-600">
                    Opportunities: {c.opportunities?.join(", ") || c.differentiationOpportunities?.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Strategy (Timeline)</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              {result.strategy?.items?.map((item: any) => (
                <div key={item.id} className="rounded border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium">Day {item.dayOffset + 1}</span>
                    <span className="text-xs uppercase text-gray-500">{item.format}</span>
                  </div>
                  <p className="mb-1 text-xs text-gray-700">Theme: {item.theme}</p>
                  <p className="mb-1 text-xs text-gray-700">Angle: {item.angle}</p>
                  <p className="text-xs text-gray-700">CTA: {item.callToAction}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Generated posts & schedule</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              {result.optimizedPosts?.map((post: any) => {
                const sched = result.schedule?.find((s: any) => s.postId === post.id.replace(/^gen_/, "day_"));
                const postCoreId = post.id.replace(/^gen_/, "");
                const persistedId = `ai_post_${result?.scheduleCampaignId ?? "socialflow"}_${postCoreId}`;
                return (
                  <div key={post.id} className="flex flex-col gap-2 rounded border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Post {post.id}</span>
                      {sched && <span className="text-xs text-gray-500">{new Date(sched.scheduledAt).toLocaleString()}</span>}
                    </div>
                    {editingPostId === persistedId ? (
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
                          placeholder="Hook principal"
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
                        <p className="whitespace-pre-wrap text-xs text-gray-800">{post.improvedText}</p>
                        <p className="text-xs text-gray-600">Hashtags: {post.hashtags?.join(" ")}</p>
                      </>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                        onClick={() => updatePost("approve", { id: persistedId })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700"
                        onClick={() => updatePost("reject", { id: persistedId })}
                      >
                        Reject
                      </button>
                      {sched && (
                        <button
                          type="button"
                          className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700"
                          onClick={() => updatePost("schedule", { id: persistedId, scheduledAt: sched.scheduledAt })}
                        >
                          Re-schedule
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-700"
                        onClick={() => {
                          if (editingPostId === persistedId) {
                            void saveEdits(persistedId);
                          } else {
                            setEditingPostId(persistedId);
                            setEditDraft({
                              title: post.title ?? "",
                              body: post.improvedText ?? "",
                              hook: post.hook ?? "",
                              cta: post.callToAction ?? "",
                              hashtags: (post.hashtags ?? []).join(" "),
                              scheduledAt: sched?.scheduledAt ?? "",
                            });
                          }
                        }}
                      >
                        {editingPostId === persistedId ? "Save" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700"
                        onClick={() => regeneratePost(persistedId)}
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
