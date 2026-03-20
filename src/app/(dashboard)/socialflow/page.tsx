"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostForm } from "@/app/components/socialflow/PostForm";
import { PostList } from "@/app/components/socialflow/PostList";
import { Calendar } from "@/app/components/socialflow/Calendar";
import { CampaignForm } from "@/app/components/socialflow/CampaignForm";

export type SocialCampaign = {
  id: string;
  name: string;
  status: string;
};

export type SocialPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  campaignId: string | null;
  campaignName?: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
};

export default function SocialflowPage() {
  const searchParams = useSearchParams();
  const initialSaasId = searchParams.get("saasId") ?? "socialflow";

  const [saasId] = useState(initialSaasId);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [campaignRes, postsRes] = await Promise.all([
        fetch(`/api/social/campaigns?saasId=${encodeURIComponent(saasId)}`),
        fetch(`/api/social/posts?saasId=${encodeURIComponent(saasId)}`),
      ]);

      if (!campaignRes.ok) {
        throw new Error("Failed to load campaigns");
      }
      if (!postsRes.ok) {
        throw new Error("Failed to load posts");
      }

      const campaignJson = (await campaignRes.json()) as { items?: SocialCampaign[] };
      const postsJson = (await postsRes.json()) as { items?: SocialPost[] };

      setCampaigns((campaignJson.items ?? []) as SocialCampaign[]);
      setPosts((postsJson.items ?? []) as SocialPost[]);
    } catch (err) {
      console.error("SOCIALFLOW_DASHBOARD_LOAD_ERROR", err);
      setError("No se pudieron cargar los datos de SocialFlow");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saasId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timeout);
  }, [toast]);

  const summary = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const scheduledPosts = posts.filter((p) => p.status === "SCHEDULED").length;
    const publishedPosts = posts.filter((p) => p.status === "POSTED" || p.status === "PUBLISHED").length;
    const upcomingPosts = posts
      .filter((p) => p.status === "SCHEDULED" && p.scheduledAt)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
      .slice(0, 5);

    return { totalCampaigns, scheduledPosts, publishedPosts, upcomingPosts };
  }, [campaigns, posts]);

  return (
    <div className="space-y-8 bg-gradient-to-b from-slate-50 via-white to-white p-6">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SocialFlow</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Planifica y automatiza tu contenido en redes
            </h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Organiza campañas, programa publicaciones y deja que SocialFlow las publique por ti.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("socialflow-post-form");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            Crear mi primer post
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Campañas activas" value={summary.totalCampaigns} />
        <SummaryCard label="Publicaciones programadas" value={summary.scheduledPosts} />
        <SummaryCard label="Publicaciones publicadas" value={summary.publishedPosts} />
      </div>

      {toast && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          {toast}
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Campañas</h2>
                <p className="text-xs text-slate-500">Agrupa tus publicaciones por objetivos</p>
              </div>
              <span className="text-xs text-slate-400">{campaigns.length} en total</span>
            </div>
            <CampaignList
              campaigns={campaigns}
              posts={posts}
              onEmptyCta={() => {
                const el = document.getElementById("socialflow-campaign-form");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </section>

          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Próximas publicaciones</h2>
                <p className="text-xs text-slate-500">Programa tu contenido y deja que se publique automáticamente</p>
              </div>
              <span className="text-xs text-slate-400">{summary.upcomingPosts.length} próximas</span>
            </div>
            <PostList posts={summary.upcomingPosts} campaigns={campaigns} />
          </section>

          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Calendario semanal</h2>
                <p className="text-xs text-slate-500">Visualiza tu contenido semanal</p>
              </div>
            </div>
            <Calendar posts={posts} campaigns={campaigns} />
          </section>
        </div>

        <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-gray-900">Nueva campaña</h2>
          <div id="socialflow-campaign-form" className="mb-6">
            <CampaignForm
              saasId={saasId}
              onCreated={async (campaignId) => {
                if (campaignId) setSelectedCampaignId(campaignId);
                setToast("Campaña creada");
                await loadData();
              }}
            />
          </div>

          <div id="socialflow-post-form" className="mt-2 border-t border-dashed border-gray-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Nuevo post</h3>
            <PostForm
              saasId={saasId}
              campaigns={campaigns}
              prefillCampaignId={selectedCampaignId}
              onCreated={async () => {
                setToast("Post programado");
                await loadData();
              }}
            />
          </div>
        </section>
      </div>

      {loading && (
        <div className="text-xs text-gray-400">Cargando SocialFlow...</div>
      )}
    </div>
  );
}

function SummaryCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{props.value}</p>
    </div>
  );
}

function CampaignList(props: { campaigns: SocialCampaign[]; posts: SocialPost[]; onEmptyCta: () => void }) {
  if (props.campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-700">Crea tu primera campaña</p>
        <p className="mt-1 text-xs text-slate-500">Define un objetivo y agrupa allí tus próximas publicaciones.</p>
        <button
          type="button"
          onClick={props.onEmptyCta}
          className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
        >
          Nueva campaña
        </button>
      </div>
    );
  }

  const postsByCampaign = new Map<string, number>();
  for (const post of props.posts) {
    if (!post.campaignId) continue;
    postsByCampaign.set(post.campaignId, (postsByCampaign.get(post.campaignId) ?? 0) + 1);
  }

  return (
    <div className="divide-y divide-slate-100">
      {props.campaigns.map((campaign) => (
        <div key={campaign.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{campaign.name}</p>
            <p className="text-xs text-slate-500">{postsByCampaign.get(campaign.id) ?? 0} publicaciones asociadas</p>
          </div>
          <span
            className={
              campaign.status === "ACTIVE"
                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
                : "rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
            }
          >
            {campaign.status === "ACTIVE" ? "Activa" : "Pausada"}
          </span>
        </div>
      ))}
    </div>
  );
}
