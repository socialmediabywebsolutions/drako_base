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

      if (!campaignRes.ok) throw new Error("Failed to load campaigns");
      if (!postsRes.ok) throw new Error("Failed to load posts");

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
    <div className="space-y-5">
      {toast && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
          {toast}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column – main panels */}
        <div className="space-y-5 lg:col-span-2">

          {/* Campaigns */}
          <DarkSection
            title="Campañas"
            subtitle="Agrupa tus publicaciones por objetivos"
            right={<span className="text-xs text-white/30">{campaigns.length} en total</span>}
          >
            <CampaignList
              campaigns={campaigns}
              posts={posts}
              onEmptyCta={() => {
                document.getElementById("socialflow-campaign-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </DarkSection>

          {/* Posts */}
          <DarkSection
            title="Próximas publicaciones"
            subtitle="Programa tu contenido y deja que se publique automáticamente"
            right={
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <DarkSelect value={statusFilter} onChange={setStatusFilter}>
                  <option value="ALL">Todos los estados</option>
                  <option value="IDEA">Idea</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="IN_REVIEW">En revisión</option>
                  <option value="APPROVED">Aprobado</option>
                  <option value="SCHEDULED">Programado</option>
                  <option value="POSTED">Publicado</option>
                </DarkSelect>
                <DarkSelect value={campaignFilter} onChange={setCampaignFilter}>
                  <option value="ALL">Todas las campañas</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </DarkSelect>
                <input
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/70 placeholder:text-white/25 outline-none focus:border-violet-500/50"
                  placeholder="Buscar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            <PostList posts={filteredPosts} campaigns={campaigns} />
          </DarkSection>

          {/* Calendar */}
          <DarkSection title="Calendario semanal" subtitle="Visualiza tu contenido semanal">
            <Calendar posts={posts} campaigns={campaigns} />
          </DarkSection>

          {/* Editorial pipeline */}
          <DarkSection title="Pipeline editorial" subtitle="Visualiza tus posts por estado editorial">
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
          </DarkSection>
        </div>

        {/* Right column – forms */}
        <DarkSection title="Nueva campaña">
          <div id="socialflow-campaign-form" className="mb-5">
            <CampaignForm
              saasId={saasId}
              onCreated={async (campaignId) => {
                if (campaignId) setSelectedCampaignId(campaignId);
                setToast("Campaña creada");
                await loadData();
              }}
            />
          </div>
          <div id="socialflow-post-form" className="border-t border-white/6 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/30">Nuevo post</p>
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
        </DarkSection>
      </div>

      {loading && (
        <p className="text-xs text-white/25 animate-pulse">Cargando SocialFlow…</p>
      )}
    </div>
  );
}

// ── Shared dark section wrapper ────────────────────────────────────────────────
function DarkSection({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ── Dark select ────────────────────────────────────────────────────────────────
function DarkSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      className="rounded-lg border border-white/10 bg-[#0d0d1e] px-2.5 py-1.5 text-[11px] text-white/60 outline-none focus:border-violet-500/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

// ── Editorial pipeline ─────────────────────────────────────────────────────────
const PIPELINE_COLUMNS = [
  { key: "IDEA",      label: "Ideas",       color: "text-white/50" },
  { key: "DRAFT",     label: "Borradores",  color: "text-blue-400" },
  { key: "IN_REVIEW", label: "En revisión", color: "text-amber-400" },
  { key: "APPROVED",  label: "Aprobados",   color: "text-emerald-400" },
  { key: "SCHEDULED", label: "Programados", color: "text-violet-400" },
  { key: "POSTED",    label: "Publicados",  color: "text-fuchsia-400" },
];

function EditorialPipeline(props: {
  posts: SocialPost[];
  onStatusChange?: (id: string, nextStatus: string) => void;
}) {
  return (
    <div className="grid gap-3 text-xs md:grid-cols-3 lg:grid-cols-6">
      {PIPELINE_COLUMNS.map((col) => {
        const bucket = props.posts.filter((p) => p.status === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/3 p-3">
            <div className="flex items-center justify-between gap-1">
              <p className={`text-[10px] font-bold uppercase tracking-wide ${col.color}`}>{col.label}</p>
              <span className="rounded-full border border-white/8 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/35">
                {bucket.length}
              </span>
            </div>
            {bucket.length === 0 ? (
              <p className="text-[10px] text-white/20">Vacío</p>
            ) : (
              <ul className="space-y-1">
                {bucket.slice(0, 50).map((post) => (
                  <li
                    key={post.id}
                    className="cursor-pointer rounded-lg border border-white/6 bg-white/3 px-2 py-1.5 transition hover:border-white/12 hover:bg-white/6"
                    onClick={() => {
                      if (!props.onStatusChange) return;
                      const order = ["IDEA", "DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "POSTED"];
                      const idx = order.indexOf(post.status);
                      const next = order[Math.min(order.length - 1, Math.max(0, idx + 1))];
                      if (next && next !== post.status) props.onStatusChange(post.id, next);
                    }}
                  >
                    <p className="truncate text-[10px] font-medium text-white/70">{post.title}</p>
                    {post.scheduledAt && (
                      <p className="mt-0.5 text-[9px] text-white/30">
                        {new Date(post.scheduledAt).toLocaleDateString("es-ES")}
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

// ── Campaign list ──────────────────────────────────────────────────────────────
function CampaignList(props: {
  campaigns: SocialCampaign[];
  posts: SocialPost[];
  onEmptyCta: () => void;
}) {
  if (props.campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-5">
        <p className="font-semibold text-white/60 text-sm">Crea tu primera campaña</p>
        <p className="mt-1 text-xs text-white/30">Define un objetivo y agrupa ahí tus próximas publicaciones.</p>
        <button
          type="button"
          onClick={props.onEmptyCta}
          className="mt-4 inline-flex rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
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
    <div className="divide-y divide-white/5">
      {props.campaigns.map((campaign) => (
        <div key={campaign.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white/80">{campaign.name}</p>
            <p className="text-xs text-white/30">{postsByCampaign.get(campaign.id) ?? 0} publicaciones</p>
          </div>
          <span
            className={
              campaign.status === "ACTIVE"
                ? "rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400"
                : "rounded-full bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400"
            }
          >
            {campaign.status === "ACTIVE" ? "Activa" : "Pausada"}
          </span>
        </div>
      ))}
    </div>
  );
}
