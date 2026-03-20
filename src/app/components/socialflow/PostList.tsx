"use client";

import type { SocialCampaign, SocialPost } from "@/app/(dashboard)/socialflow/page";

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
      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        Programa tu primer contenido para activar tu timeline de publicaciones.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {props.posts.map((post) => (
        <div key={post.id} className="flex gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
          <div className="w-16 shrink-0 rounded-md bg-slate-50 p-2 text-center">
            <p className="text-lg font-semibold leading-none text-slate-900">{formatDate(post.scheduledAt).day}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {formatDate(post.scheduledAt).month}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">{formatDate(post.scheduledAt).time}</p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{post.title}</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {campaignName(post.campaignId)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{post.body}</p>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
              <span>Fecha de publicación:</span>
              <span className="font-medium text-gray-700">
                {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Sin definir"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-gray-500">
            <StatusPill status={post.status} />
            <span className="text-[10px] text-gray-400">Estado del post</span>
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
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">
        Programado
      </span>
    );
  }
  if (s === "POSTED" || s === "PUBLISHED") {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
        Publicado
      </span>
    );
  }
  if (s === "FAILED") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
        Error
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
      {s}
    </span>
  );
}
