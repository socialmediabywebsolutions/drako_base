"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostForm } from "@/app/components/socialflow/PostForm";
import { PostList } from "@/app/components/socialflow/PostList";
import { Calendar } from "@/app/components/socialflow/Calendar";
import { CampaignForm } from "@/app/components/socialflow/CampaignForm";
import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

export default function SocialFlowOperationsPanel() {
  const searchParams = useSearchParams();
  const initialSaasId = searchParams.get("saasId") ?? "socialflow";

  const [saasId] = useState(initialSaasId);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [campaignFilter, setCampaignFilter] = useState<string>("ALL");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter && statusFilter !== "ALL" ? `&status=${encodeURIComponent(statusFilter)}` : "";
      const campaignParam = campaignFilter && campaignFilter !== "ALL" ? `&campaignId=${encodeURIComponent(campaignFilter)}` : "";
      const providerParam = providerFilter && providerFilter !== "ALL" ? `&provider=${encodeURIComponent(providerFilter)}` : "";

      const [campaignRes, postsRes] = await Promise.all([
        fetch(`/api/socialflow/campaigns?saasId=${encodeURIComponent(saasId)}`),
        fetch(`/api/socialflow/posts?saasId=${encodeURIComponent(saasId)}${statusParam}${campaignParam}${providerParam}`),
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

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (campaignFilter !== "ALL" && p.campaignId !== campaignFilter) return false;
      if (search && !`${p.title} ${p.body}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [posts, statusFilter, campaignFilter, search]);

  return (
    <div className="space-y-8">
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
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Campanas</h2>
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
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Proximas publicaciones</h2>
                <p className="text-xs text-slate-500">Programa tu contenido y deja que se publique automaticamente</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <select
                  className="rounded border border-slate-200 bg-white px-2 py-1"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="IDEA">Idea</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="IN_REVIEW">En revision</option>
                  <option value="APPROVED">Aprobado</option>
                  <option value="SCHEDULED">Programado</option>
                  <option value="POSTED">Publicado</option>
                </select>
                <select
                  className="rounded border border-slate-200 bg-white px-2 py-1"
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                >
                  <option value="ALL">Todas las campanas</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded border border-slate-200 px-2 py-1"
                  placeholder="Buscar por titulo o texto"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <PostList posts={filteredPosts} campaigns={campaigns} />
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
          <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">Pipeline editorial</h2>
                <p className="text-xs text-slate-500">Visualiza tus posts por estado editorial</p>
              </div>
            </div>
            <EditorialPipeline
              posts={filteredPosts}
              onStatusChange={async (id, nextStatus) => {
                try {
                  const res = await fetch("/api/socialflow/posts", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ saasId, id, status: nextStatus }),
                  });
                  if (!res.ok) return;
                  const data = (await res.json().catch(() => null)) as { post?: SocialPost } | null;
                  if (data?.post) {
                    setPosts((prev) => prev.map((p) => (p.id === data.post!.id ? { ...p, ...data.post } : p)));
                  }
                } catch (e) {
                  console.error("SOCIALFLOW_PIPELINE_STATUS_ERROR", e);
                }
              }}
            />
          </section>
        </div>

        <section className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-gray-900">Nueva campana</h2>
          <div id="socialflow-campaign-form" className="mb-6">
            <CampaignForm
              saasId={saasId}
              onCreated={async (campaignId) => {
                if (campaignId) setSelectedCampaignId(campaignId);
                setToast("Campana creada");
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

function EditorialPipeline(props: { posts: SocialPost[]; onStatusChange?: (id: string, nextStatus: string) => void }) {
  const columns: { key: string; label: string }[] = [
    { key: "IDEA", label: "Ideas" },
    { key: "DRAFT", label: "Borradores" },
    { key: "IN_REVIEW", label: "En revision" },
    { key: "APPROVED", label: "Aprobados" },
    { key: "SCHEDULED", label: "Programados" },
    { key: "POSTED", label: "Publicados" },
  ];

  return (
    <div className="grid gap-4 text-xs md:grid-cols-3 lg:grid-cols-6">
      {columns.map((col) => {
        const bucket = props.posts.filter((post) => post.status === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{col.label}</p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {bucket.length}
              </span>
            </div>
            {bucket.length === 0 ? (
              <p className="text-[11px] text-slate-400">Sin posts en este estado</p>
            ) : (
              <ul className="space-y-1">
                {bucket.slice(0, 50).map((post) => (
                  <li
                    key={post.id}
                    className="cursor-pointer rounded-md border border-slate-200/80 bg-white px-2 py-1 shadow-sm hover:bg-slate-50"
                    onClick={() => {
                      if (!props.onStatusChange) return;
                      const order = ["IDEA", "DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "POSTED"];
                      const idx = order.indexOf(post.status);
                      const next = order[Math.min(order.length - 1, Math.max(0, idx + 1))];
                      if (next && next !== post.status) {
                        props.onStatusChange(post.id, next);
                      }
                    }}
                  >
                    <p className="truncate text-[11px] font-medium text-slate-900">{post.title}</p>
                    {post.scheduledAt && (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {new Date(post.scheduledAt).toLocaleDateString()}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CampaignList(props: { campaigns: SocialCampaign[]; posts: SocialPost[]; onEmptyCta: () => void }) {
  if (props.campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-700">Crea tu primera campana</p>
        <p className="mt-1 text-xs text-slate-500">Define un objetivo y agrupa ahi tus proximas publicaciones.</p>
        <button
          type="button"
          onClick={props.onEmptyCta}
          className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
        >
          Nueva campana
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
