"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SocialCampaign = {
  id: string;
  name: string;
  status: string;
};

type SocialPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  campaignId: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
};

type CampaignResponse = { items?: SocialCampaign[] };
type PostResponse = { items?: SocialPost[] };

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

export default function SocialFlowWorkspacePage() {
  const searchParams = useSearchParams();
  const initialSaasId = searchParams.get("saasId") ?? "socialflow";

  const [saasId] = useState(initialSaasId);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [campaignResponse, postResponse] = await Promise.all([
        fetch(`/api/socialflow/campaigns?saasId=${encodeURIComponent(saasId)}`),
        fetch(`/api/socialflow/posts?saasId=${encodeURIComponent(saasId)}`),
      ]);

      if (!campaignResponse.ok || !postResponse.ok) {
        throw new Error("Unable to load SocialFlow workspace data.");
      }

      const campaignJson = (await campaignResponse.json()) as CampaignResponse;
      const postJson = (await postResponse.json()) as PostResponse;
      setCampaigns(campaignJson.items ?? []);
      setPosts(postJson.items ?? []);
    } catch (loadError) {
      console.error("SOCIALFLOW_RUNTIME_WORKSPACE_LOAD_ERROR", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load SocialFlow workspace data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saasId]);

  const summary = useMemo(() => {
    return {
      campaigns: campaigns.length,
      scheduled: posts.filter((post) => post.status === "SCHEDULED").length,
      published: posts.filter((post) => post.status === "POSTED" || post.status === "PUBLISHED").length,
    };
  }, [campaigns, posts]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCampaign(true);
    setError(null);

    try {
      const response = await fetch("/api/socialflow/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          name: campaignName,
          status: "ACTIVE",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to create campaign.");
      }

      setCampaignName("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create campaign.");
    } finally {
      setSavingCampaign(false);
    }
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPost(true);
    setError(null);

    try {
      const response = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: selectedCampaignId || null,
          provider: "LINKEDIN",
          contentType: "FEED",
          title: postTitle,
          body: postBody,
          status: scheduledAt ? "SCHEDULED" : "DRAFT",
          scheduledAt: scheduledAt || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to create post.");
      }

      setPostTitle("");
      setPostBody("");
      setScheduledAt("");
      setSelectedCampaignId("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create post.");
    } finally {
      setSavingPost(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow runtime canary</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Campaigns and posts inside the isolated runtime</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          This page runs against the new `/api/socialflow/*` runtime inside `apps/socialflow-runtime`, while the active
          production worker remains unchanged.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Campaigns" value={summary.campaigns} />
        <MetricCard label="Scheduled posts" value={summary.scheduled} />
        <MetricCard label="Published posts" value={summary.published} />
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="space-y-6">
          <form onSubmit={createCampaign} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black tracking-tight text-slate-950">Create campaign</div>
            <p className="mt-2 text-sm text-slate-500">Writes to the ported `POST /api/socialflow/campaigns` handler.</p>
            <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Campaign name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="April retention push"
              required
            />
            <button
              type="submit"
              disabled={savingCampaign}
              className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {savingCampaign ? "Creating..." : "Create campaign"}
            </button>
          </form>

          <form onSubmit={createPost} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-black tracking-tight text-slate-950">Create post</div>
            <p className="mt-2 text-sm text-slate-500">Writes to the ported `POST /api/socialflow/posts` handler.</p>

            <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Campaign</label>
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
            >
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Title</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={postTitle}
              onChange={(event) => setPostTitle(event.target.value)}
              placeholder="5 retention hooks for beauty clinics"
              required
            />

            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Body</label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={postBody}
              onChange={(event) => setPostBody(event.target.value)}
              placeholder="Write the post body here..."
              required
            />

            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Scheduled at</label>
            <input
              type="datetime-local"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />

            <button
              type="submit"
              disabled={savingPost}
              className="mt-4 inline-flex rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {savingPost ? "Saving..." : "Create post"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black tracking-tight text-slate-950">Recent posts</div>
              <p className="mt-2 text-sm text-slate-500">Direct read from the ported `GET /api/socialflow/posts` route.</p>
            </div>
            {loading ? <span className="text-xs text-slate-400">Loading...</span> : null}
          </div>

          <div className="mt-6 space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No posts found yet for this SocialFlow workspace.
              </div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black tracking-tight text-slate-950">{post.title}</h2>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {post.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{post.body}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>campaign {post.campaignId ?? "none"}</span>
                    <span>scheduled {post.scheduledAt ?? "not set"}</span>
                    <span>posted {post.postedAt ?? "not set"}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
