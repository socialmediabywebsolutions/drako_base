"use client";

import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

export function PostList(props: { posts: SocialPost[]; campaigns: SocialCampaign[] }) {
  const campaignName = (id: string | null) =>
    id ? props.campaigns.find((c) => c.id === id)?.name ?? "Sin campaña" : "Sin campaña";

  const formatDate = (iso: string | null) => {
    if (!iso) return { day: "--", month: "", time: "Sin fecha" };
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString(undefined, { day: "2-digit" }),
      month: d.toLocaleDateString(undefined, { month: "short" }),
      time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  };

  if (props.posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/3 p-3 text-xs text-white/35">
        Programa tu primer contenido para activar tu timeline de publicaciones.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {props.posts.map((post) => (
        <div key={post.id} className="flex gap-3 rounded-lg border border-white/8 bg-white/4 p-3">
          <div className="w-16 shrink-0 rounded-md bg-white/6 p-2 text-center">
            <p className="text-lg font-semibold leading-none text-white/85">{formatDate(post.scheduledAt).day}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/35">
              {formatDate(post.scheduledAt).month}
            </p>
            <p className="mt-1 text-[10px] text-white/30">{formatDate(post.scheduledAt).time}</p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white/90">{post.title}</p>
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-white/45">
                {campaignName(post.campaignId)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-white/50">{post.body}</p>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/35">
              <span>Fecha de publicación:</span>
              <span className="font-medium text-white/60">
                {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Sin definir"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-white/35">
            <StatusPill status={post.status} />
            <span className="text-[10px] text-white/25">Estado del post</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill(props: { status: string }) {
  const s = props.status;
  if (s === "SCHEDULED") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        Programado
      </span>
    );
  }
  if (s === "POSTED" || s === "PUBLISHED") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        Publicado
      </span>
    );
  }
  if (s === "FAILED") {
    return (
      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
        Error
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
      {s}
    </span>
  );
}
