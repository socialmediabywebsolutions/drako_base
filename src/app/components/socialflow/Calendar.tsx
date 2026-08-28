"use client";

import { useState } from "react";
import { Image as ImageIcon, Video, RectangleVertical, GalleryHorizontal, PlayCircle } from "lucide-react";
import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// ─── Content type — icon + label, same set as editorial-calendar.tsx (Próximas
// publicaciones) for visual consistency between the two calendars ─────────────

const CONTENT_TYPE_CFG: Record<string, { icon: typeof ImageIcon; label: string }> = {
  FEED:     { icon: ImageIcon,       label: "Post" },
  REEL:     { icon: Video,           label: "Reel" },
  STORY:    { icon: RectangleVertical, label: "Historia" },
  CAROUSEL: { icon: GalleryHorizontal, label: "Carrusel" },
  SHORT:    { icon: PlayCircle,      label: "Short" },
};

function contentTypeCfg(contentType: string) {
  return CONTENT_TYPE_CFG[contentType] ?? CONTENT_TYPE_CFG.FEED;
}

// ─── Status — full label set, REJECTED (manual, non-technical) kept visually
// distinct from FAILED (real publish error) — same labels/colors as
// editorial-calendar.tsx's STATUS_CFG for consistency ──────────────────────────

const STATUS_CFG: Record<string, { label: string; dotBg: string; chipBg: string }> = {
  IDEA:       { label: "Idea",        dotBg: "bg-white/30",   chipBg: "bg-white/6 text-white/45" },
  DRAFT:      { label: "Borrador",    dotBg: "bg-white/40",   chipBg: "bg-white/8 text-white/55" },
  IN_REVIEW:  { label: "En revisión", dotBg: "bg-amber-500",  chipBg: "bg-amber-500/15 text-amber-300" },
  APPROVED:   { label: "Aprobado",    dotBg: "bg-indigo-500", chipBg: "bg-indigo-500/15 text-indigo-300" },
  REJECTED:   { label: "Rechazado",   dotBg: "bg-orange-400", chipBg: "bg-orange-500/15 text-orange-300" },
  SCHEDULED:  { label: "Programado",  dotBg: "bg-sky-500",    chipBg: "bg-sky-500/15 text-sky-300" },
  PUBLISHING: { label: "Publicando",  dotBg: "bg-violet-500", chipBg: "bg-violet-500/15 text-violet-300" },
  POSTED:     { label: "Publicado",   dotBg: "bg-emerald-500",chipBg: "bg-emerald-500/15 text-emerald-300" },
  PUBLISHED:  { label: "Publicado",   dotBg: "bg-emerald-500",chipBg: "bg-emerald-500/15 text-emerald-300" },
  FAILED:     { label: "Error",       dotBg: "bg-rose-500",   chipBg: "bg-rose-500/15 text-rose-400" },
};

function statusCfg(status: string) {
  return STATUS_CFG[status] ?? STATUS_CFG.SCHEDULED;
}

function isMediaUrl(hint: string | null | undefined): hint is string {
  return !!hint && (hint.startsWith("http://") || hint.startsWith("https://"));
}

// Deterministic gradient per post id — same technique as editorial-calendar.tsx's
// thumbGradient, so a post without a usable image still gets a stable, distinct tile
// instead of every placeholder looking identical.
const THUMB_GRADIENTS = [
  "from-violet-900 to-fuchsia-900",
  "from-blue-900 to-indigo-900",
  "from-rose-900 to-pink-900",
  "from-emerald-900 to-teal-900",
  "from-amber-900 to-orange-900",
  "from-sky-900 to-cyan-900",
] as const;

function thumbGradient(postId: string): string {
  const hash = postId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return THUMB_GRADIENTS[hash % THUMB_GRADIENTS.length];
}

// ─── Thumb — small 32px preview tile, non-interactive (this widget has no detail
// modal, unlike editorial-calendar.tsx's PostThumb) ─────────────────────────────

function Thumb({ post }: { post: SocialPost }) {
  const [imageError, setImageError] = useState(false);
  const hasImage = isMediaUrl(post.imageHint) && !imageError;
  const { icon: Icon } = contentTypeCfg(post.contentType);

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.imageHint!}
        alt=""
        className="h-8 w-8 shrink-0 rounded-md object-cover"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${thumbGradient(post.id)}`}
    >
      <Icon className="h-3.5 w-3.5 text-white/50" strokeWidth={2} />
    </div>
  );
}

export function Calendar(props: { posts: SocialPost[]; campaigns: SocialCampaign[] }) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekStart = startOfWeek(now);
  const days: { label: string; dateIso: string }[] = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + idx);
    const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    return { label, dateIso: d.toISOString().slice(0, 10) };
  });

  const postsByDay = new Map<string, SocialPost[]>();
  for (const post of props.posts) {
    if (!post.scheduledAt) continue;
    const key = post.scheduledAt.slice(0, 10);
    if (!postsByDay.has(key)) postsByDay.set(key, []);
    postsByDay.get(key)!.push(post);
  }

  const campaignName = (id: string | null) =>
    id ? props.campaigns.find((c) => c.id === id)?.name ?? "Sin campaña" : "Sin campaña";

  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const dayPosts = postsByDay.get(day.dateIso) ?? [];
        const isToday = day.dateIso === todayKey;
        return (
          <div
            key={day.dateIso}
            className={
              "flex min-h-[120px] flex-col rounded-lg border p-2 text-xs " +
              (isToday
                ? "border-violet-500/40 bg-violet-500/8 text-white"
                : "border-white/8 bg-white/4 text-white/80")
            }
          >
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-white/40">
              <span className={isToday ? "font-semibold text-violet-300" : ""}>{day.label}</span>
              <span className={"text-[10px] " + (isToday ? "text-violet-300/70" : "text-white/25")}>
                {dayPosts.length}
              </span>
            </div>
            <div className="space-y-1">
              {dayPosts.slice(0, 3).map((post) => {
                const status = statusCfg(post.status);
                return (
                  <div
                    key={post.id}
                    className={
                      "flex items-start gap-1.5 rounded-md p-1.5 " +
                      (isToday ? "bg-white/10 text-white" : "bg-white/6 text-white/85")
                    }
                    title={post.body}
                  >
                    <Thumb post={post} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium">{post.title}</div>
                      <div className="truncate text-[9px] text-white/35">{campaignName(post.campaignId)}</div>
                      <div className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-semibold ${status.chipBg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dotBg}`} />
                        {status.label}
                      </div>
                    </div>
                  </div>
                );
              })}
              {dayPosts.length > 3 && (
                <div className="text-[10px] text-white/25">+{dayPosts.length - 3} más</div>
              )}
              {dayPosts.length === 0 && (
                <div className="mt-2 text-[10px] text-white/20">
                  {isToday ? "Empieza programando un post" : "Sin posts"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
