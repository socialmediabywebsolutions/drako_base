"use client";

import { useState } from "react";

type GenerateResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  result?: {
    campaign?: { name?: string };
    optimizedPosts?: unknown[];
    schedule?: unknown[];
  } & Record<string, unknown>;
  post?: Record<string, unknown>;
};

export default function SocialFlowAIPage() {
  const [niche, setNiche] = useState("Beauty salons");
  const [tone, setTone] = useState("Friendly, expert, concrete");
  const [frequencyPerWeek, setFrequencyPerWeek] = useState(7);
  const [postId, setPostId] = useState("");
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse["result"] | null>(null);
  const [regeneratedPost, setRegeneratedPost] = useState<Record<string, unknown> | null>(null);

  async function generateCampaign() {
    setLoading(true);
    setError(null);
    setRegeneratedPost(null);

    try {
      const response = await fetch("/api/socialflow/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          niche,
          tone,
          frequencyPerWeek,
          saasId: "socialflow",
        }),
      });
      const payload = (await response.json().catch(() => null)) as GenerateResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Unable to generate campaign.");
      }
      setResult(payload.result ?? null);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate campaign.");
    } finally {
      setLoading(false);
    }
  }

  async function regeneratePost() {
    if (!postId.trim()) {
      setError("postId is required to regenerate a post.");
      return;
    }

    setRegenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/socialflow/ai/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId: "socialflow",
          postId: postId.trim(),
          niche,
          tone,
          frequencyPerWeek,
        }),
      });
      const payload = (await response.json().catch(() => null)) as GenerateResponse | null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message ?? "Unable to regenerate post.");
      }
      setRegeneratedPost(payload?.post ?? null);
    } catch (regenerationError) {
      setError(regenerationError instanceof Error ? regenerationError.message : "Unable to regenerate post.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow AI</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Generate campaigns from the isolated runtime</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          This page calls the ported `POST /api/socialflow/ai/generate` and `POST /api/socialflow/ai/regenerate`
          handlers without going through the monolith root runtime.
        </p>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Niche</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
          />

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Tone</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={tone}
            onChange={(event) => setTone(event.target.value)}
          />

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Posts per week</label>
          <input
            type="number"
            min={1}
            max={21}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={frequencyPerWeek}
            onChange={(event) => setFrequencyPerWeek(Number(event.target.value) || 1)}
          />

          <button
            type="button"
            onClick={generateCampaign}
            disabled={loading}
            className="mt-5 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate campaign"}
          </button>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Existing post id</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={postId}
              onChange={(event) => setPostId(event.target.value)}
              placeholder="ai_post_socialflow_day_0"
            />
            <button
              type="button"
              onClick={regeneratePost}
              disabled={regenerating}
              className="mt-4 inline-flex rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {regenerating ? "Regenerating..." : "Regenerate post"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black tracking-tight text-slate-950">Generated campaign</div>
            {result ? (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div>
                  <span className="font-semibold text-slate-950">Campaign:</span>{" "}
                  {result.campaign?.name ?? "Unnamed campaign"}
                </div>
                <div>
                  <span className="font-semibold text-slate-950">Optimized posts:</span>{" "}
                  {Array.isArray(result.optimizedPosts) ? result.optimizedPosts.length : 0}
                </div>
                <div>
                  <span className="font-semibold text-slate-950">Scheduled entries:</span>{" "}
                  {Array.isArray(result.schedule) ? result.schedule.length : 0}
                </div>
                <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No AI result generated yet.</p>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black tracking-tight text-slate-950">Regenerated post</div>
            {regeneratedPost ? (
              <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(regeneratedPost, null, 2)}
              </pre>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No post regenerated yet.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
