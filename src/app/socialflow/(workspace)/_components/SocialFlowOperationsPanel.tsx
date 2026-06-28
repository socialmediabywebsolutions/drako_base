"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Calendar } from "@/app/components/socialflow/Calendar";
import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

function formatScheduled(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

// ── Upcoming post row ─────────────────────────────────────────────────────────

function UpcomingPostRow({ post }: { post: SocialPost }) {
  const { date, time } = post.scheduledAt ? formatScheduled(post.scheduledAt) : { date: "—", time: "" };

  return (
    <div className="flex items-center gap-4 py-3">
      {/* Icon placeholder */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-base">
        🖼️
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/85">{post.title}</p>
        <p className="mt-0.5 truncate text-xs text-white/40">{post.body}</p>
      </div>

      {/* Date + time */}
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-semibold capitalize text-white/50">{date}</p>
        {time && <p className="text-[10px] text-white/30">{time} UTC</p>}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function DarkSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-white/35">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SocialFlowOperationsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSaasId = searchParams.get("saasId") ?? "socialflow";

  const [saasId] = useState(initialSaasId);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/socialflow/posts?saasId=${encodeURIComponent(saasId)}`);
      if (!res.ok) throw new Error("Failed to load posts");
      const json = (await res.json()) as { items?: SocialPost[] };
      setPosts(json.items ?? []);
    } catch (err) {
      console.error("SOCIALFLOW_DASHBOARD_LOAD_ERROR", err);
      setError("No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saasId]);

  const upcomingPosts = posts
    .filter((p) => p.scheduledAt && p.status === "SCHEDULED")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .slice(0, 12);

  // Calendar expects SocialCampaign[] — pass empty since campaigns are removed
  const emptyCampaigns: SocialCampaign[] = [];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-6">
        <h2 className="text-xl font-black text-white">¿Qué publicamos hoy?</h2>
        <p className="mt-1.5 text-sm text-white/50">
          Sube una foto y la IA genera el caption, hashtags y horario óptimo.
        </p>
        <button
          onClick={() => router.push("/socialflow/upload")}
          className="mt-5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
        >
          ✦ Subir foto
        </button>
      </section>

      {/* ── Upcoming posts ───────────────────────────────────────────────── */}
      <DarkSection
        title="Próximas publicaciones"
        subtitle="Tu contenido programado en orden cronológico"
      >
        {loading ? (
          <p className="animate-pulse text-sm text-white/30">Cargando…</p>
        ) : upcomingPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-white/35">No tienes posts programados aún.</p>
            <button
              onClick={() => router.push("/socialflow/upload")}
              className="mt-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Subir tu primera foto
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {upcomingPosts.map((post) => (
              <UpcomingPostRow key={post.id} post={post} />
            ))}
          </div>
        )}
      </DarkSection>

      {/* ── Weekly calendar ──────────────────────────────────────────────── */}
      <DarkSection title="Calendario semanal" subtitle="Visualiza tu contenido semanal">
        <Calendar posts={posts} campaigns={emptyCampaigns} />
      </DarkSection>
    </div>
  );
}
