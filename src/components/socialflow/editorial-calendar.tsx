"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalyticsMeta, SaasSocialPost, SaasSocialCampaign } from "@/lib/social-core/types";
import { getImageDimensions, isHorizontalImage } from "@/lib/socialflow/media/image-dimensions";

type PostStatus = SaasSocialPost["status"];

type Props = {
  posts: SaasSocialPost[];
  campaigns: SaasSocialCampaign[];
  saasId: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

const STATUS_CFG: Record<PostStatus, { label: string; chipBg: string; dotBg: string }> = {
  IDEA:       { label: "Idea",       chipBg: "bg-gray-100 text-gray-500",          dotBg: "bg-gray-300"    },
  DRAFT:      { label: "Borrador",   chipBg: "bg-gray-100 text-gray-600",          dotBg: "bg-gray-400"    },
  IN_REVIEW:  { label: "En revisión",chipBg: "bg-amber-50 text-amber-700",         dotBg: "bg-amber-500"   },
  APPROVED:   { label: "Aprobado",   chipBg: "bg-indigo-50 text-indigo-700",       dotBg: "bg-indigo-500"  },
  REJECTED:   { label: "Rechazado",  chipBg: "bg-rose-50 text-rose-700",           dotBg: "bg-rose-400"    },
  SCHEDULED:  { label: "Programado", chipBg: "bg-sky-50 text-sky-700",             dotBg: "bg-sky-500"     },
  PUBLISHING: { label: "Publicando", chipBg: "bg-blue-50 text-blue-700",           dotBg: "bg-blue-500"    },
  POSTED:     { label: "Publicado",  chipBg: "bg-emerald-50 text-emerald-700",     dotBg: "bg-emerald-500" },
  PUBLISHED:  { label: "Publicado",  chipBg: "bg-emerald-50 text-emerald-700",     dotBg: "bg-emerald-500" },
  FAILED:     { label: "Error",      chipBg: "bg-rose-50 text-rose-700",           dotBg: "bg-rose-500"    },
};

const STATUS_RING: Record<string, string> = {
  APPROVED:   "ring-indigo-400/60",
  SCHEDULED:  "ring-sky-400/60",
  IN_REVIEW:  "ring-amber-400/50",
  REJECTED:   "ring-rose-400/60",
  POSTED:     "ring-emerald-400/70",
  PUBLISHED:  "ring-emerald-400/70",
  PUBLISHING: "ring-blue-400/60",
  IDEA:       "ring-gray-200",
  DRAFT:      "ring-gray-200",
  FAILED:     "ring-rose-500/50",
};

const STATUS_DOT: Record<string, string> = {
  APPROVED:   "bg-indigo-400",
  SCHEDULED:  "bg-sky-400",
  IN_REVIEW:  "bg-amber-300",
  REJECTED:   "bg-rose-400",
  POSTED:     "bg-emerald-400",
  PUBLISHED:  "bg-emerald-400",
  PUBLISHING: "bg-blue-400",
  IDEA:       "bg-gray-300",
  DRAFT:      "bg-gray-300",
  FAILED:     "bg-rose-500",
};

const POST_TYPE_OPTIONS = [
  { value: "FEED",  label: "Feed",     icon: "🖼️"  },
  { value: "REEL",  label: "Reel",     icon: "🎬"  },
  { value: "STORY", label: "Historia", icon: "⭕"  },
] as const;

const CONTENT_TYPE_CFG: Record<string, { label: string; icon: string; pill: string }> = {
  FEED:     { label: "Post",     icon: "📸",  pill: "bg-blue-50 text-blue-700"     },
  REEL:     { label: "Reel",     icon: "🎬",  pill: "bg-purple-50 text-purple-700"  },
  STORY:    { label: "Historia", icon: "⭕",  pill: "bg-orange-50 text-orange-700"  },
  SHORT:    { label: "Short",    icon: "▶️",  pill: "bg-red-50 text-red-700"        },
  CAROUSEL: { label: "Carrusel", icon: "📑",  pill: "bg-teal-50 text-teal-700"     },
};

// IMPORTED (publicado directamente en Instagram) se muestra igual que MANUAL — sin
// distinción visual respecto a los posts nativos, por decisión de producto.
const CREATION_MODE_CFG: Record<"AUTO" | "MANUAL" | "IMPORTED", { label: string; color: string }> = {
  AUTO:     { label: "✦ IA",     color: "bg-blue-50 text-blue-700" },
  MANUAL:   { label: "✎ Manual", color: "bg-slate-100 text-slate-700"   },
  IMPORTED: { label: "✎ Manual", color: "bg-slate-100 text-slate-700"   },
};

const PROVIDER_ABBR: Record<string, string> = {
  LINKEDIN: "LI", INSTAGRAM: "IG", FACEBOOK_PAGE: "FB", TWITTER_X: "X", TIKTOK: "TT",
};
const PROVIDER_LABEL: Record<string, string> = {
  LINKEDIN: "LinkedIn", INSTAGRAM: "Instagram", FACEBOOK_PAGE: "Facebook",
  TWITTER_X: "X / Twitter", TIKTOK: "TikTok",
};
const PROVIDER_COLOR: Record<string, string> = {
  LINKEDIN: "bg-sky-600 text-white",
  INSTAGRAM: "bg-rose-500 text-white",
  FACEBOOK_PAGE: "bg-blue-600 text-white",
  TWITTER_X: "bg-gray-900 text-white",
  TIKTOK: "bg-gray-800 text-white",
};

// Hardcoded so Tailwind's scanner sees the full class names
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  let dow = first.getDay();
  dow = dow === 0 ? 6 : dow - 1;
  const cells: (string | null)[] = Array(dow).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function toScheduledAt(date: string, time: string) {
  return `${date}T${time || "09:00"}:00.000Z`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function formatMetricValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function MetricCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-gray-50 px-2 py-2.5">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-sm font-black text-gray-900">{formatMetricValue(value)}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── PostChip (mini pill inside calendar cells) ────────────────────────────

function isOverdue(post: SaasSocialPost, today: string): boolean {
  return (
    (post.status === "SCHEDULED" || post.status === "APPROVED") &&
    !!post.scheduledAt &&
    post.scheduledAt.slice(0, 10) < today
  );
}

function PostChip({ post, today }: { post: SaasSocialPost; today: string }) {
  const cfg = STATUS_CFG[post.status];
  const abbr = PROVIDER_ABBR[post.provider] ?? "?";
  const typeIcon = CONTENT_TYPE_CFG[post.contentType]?.icon ?? "🖼️";
  const modeCfg = CREATION_MODE_CFG[post.creationMode ?? "AUTO"];
  const overdue = isOverdue(post, today);
  const title = post.title.length > 13 ? post.title.slice(0, 13) + "…" : post.title;
  const time = post.scheduledAt ? formatTime(post.scheduledAt) : null;
  return (
    <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${overdue ? "bg-amber-100 text-amber-800" : cfg.chipBg}`}>
      {overdue && <span className="shrink-0 font-black text-amber-600">!</span>}
      <span className="shrink-0 text-[9px] leading-none">{typeIcon}</span>
      <span className={`shrink-0 rounded px-1 py-px text-[9px] font-black leading-none ${modeCfg.color}`}>
        {modeCfg.label}
      </span>
      <span className="font-black opacity-60">{abbr}</span>
      <span className="truncate">{title}</span>
      {time && <span className="ml-auto shrink-0 text-[10px] font-bold opacity-65">{time}</span>}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.chipBg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotBg}`} />
      {cfg.label}
    </span>
  );
}

// ─── PostThumb — Instagram-style square tile ──────────────────────────────────

function isMediaUrl(hint: string | null | undefined): hint is string {
  return !!hint && (hint.startsWith("http://") || hint.startsWith("https://"));
}

function PostThumb({ post, onClick }: { post: SaasSocialPost; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const postVideoUrl =
    typeof (post.metadata as Record<string, unknown> | null)?.videoUrl === "string"
      ? ((post.metadata as Record<string, unknown>).videoUrl as string)
      : null;
  const hasVideo = isMediaUrl(postVideoUrl);
  const hasImage = !hasVideo && isMediaUrl(post.imageHint) && !imageError;
  const gradient = thumbGradient(post.id);
  const ring = STATUS_RING[post.status] ?? "ring-gray-200";
  const dot  = STATUS_DOT[post.status]  ?? "bg-gray-300";
  const modeCfg = CREATION_MODE_CFG[post.creationMode ?? "AUTO"];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square w-full overflow-hidden rounded-xl ring-2 ${ring} transition-all duration-150 hover:scale-[1.03] hover:ring-gray-400 active:scale-[0.98]`}
    >
      {hasVideo ? (
        // Reel (imagen o vídeo del cliente) — mismo criterio que PostDetailModal:
        // metadata.videoUrl es el MP4 real, imageHint puede no ser una imagen decodificable.
        <video src={postVideoUrl!} muted autoPlay loop playsInline className="h-full w-full object-cover" />
      ) : hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageHint!}
          alt={post.title}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`h-full w-full bg-gradient-to-br ${gradient} flex flex-col items-start justify-end p-2`}>
          <p className="line-clamp-3 text-left text-[10px] leading-snug text-white/55">{post.title}</p>
        </div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1 py-0.5 text-[10px] leading-none backdrop-blur-sm">
        {CONTENT_TYPE_CFG[post.contentType]?.icon ?? "🖼️"}
      </span>
      <span className={`absolute right-1.5 top-1.5 rounded-md px-1 py-0.5 text-[9px] font-black leading-none backdrop-blur-sm ${modeCfg.color}`}>
        {modeCfg.label}
      </span>
      <span className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ${dot} ring-1 ring-black/40`} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-150 group-hover:bg-black/45">
        <svg className="h-6 w-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>
    </button>
  );
}

// ─── PostDetailModal ──────────────────────────────────────────────────────────

type PostDetailModalProps = {
  post: SaasSocialPost;
  campaigns: SaasSocialCampaign[];
  isPending: boolean;
  isRefreshingMetrics: boolean;
  onSave: (title: string, body: string) => void;
  onDelete: () => void;
  onAction: (action: string, extra?: Record<string, string>) => void;
  onRefreshMetrics: () => void;
  onClose: () => void;
};

function PostDetailModal({ post, campaigns, isPending, isRefreshingMetrics, onAction, onRefreshMetrics, onClose, onSave, onDelete }: PostDetailModalProps) {
  const [scheduling, setScheduling] = useState(false);
  const [schedDate, setSchedDate] = useState(post.scheduledAt?.slice(0, 10) ?? todayStr());
  const [schedTime, setSchedTime] = useState(post.scheduledAt?.slice(11, 16) ?? "09:00");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [modalImageError, setModalImageError] = useState(false);
  const campaign = campaigns.find((c) => c.id === post.campaignId);

  const isEditable = ["IDEA", "DRAFT", "IN_REVIEW"].includes(post.status);
  const isApproved = post.status === "APPROVED";
  const isScheduled = post.status === "SCHEDULED";
  const isDone = ["POSTED", "PUBLISHED"].includes(post.status);
  const isFailed = post.status === "FAILED";
  const isRejected = post.status === "REJECTED";
  const isApprovable = isEditable;
  const gradient = thumbGradient(post.id);
  const postVideoUrl =
    typeof (post.metadata as Record<string, unknown> | null)?.videoUrl === "string"
      ? ((post.metadata as Record<string, unknown>).videoUrl as string)
      : null;

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white sm:h-[88vh] sm:rounded-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
          aria-label="Cerrar"
        >
          <IconX />
        </button>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left: image/video */}
          <div className="relative flex h-52 shrink-0 items-center justify-center bg-gray-100 md:h-auto md:w-5/12">
            {isMediaUrl(postVideoUrl) ? (
              // Reel (imagen o vídeo del cliente) — el MP4 real, reproducible, en vez del
              // imageHint estático. postVideoUrl viene de metadata.videoUrl (ver approveReelItem
              // en publish-reel.tsx), que siempre existe para posts REEL aprobados desde este flujo.
              <video src={postVideoUrl} controls playsInline className="h-full w-full object-cover" />
            ) : isMediaUrl(post.imageHint) && !modalImageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.imageHint} alt={post.title} className="h-full w-full object-cover" onError={() => setModalImageError(true)} />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${gradient} flex flex-col items-start justify-end p-5`}>
                <p className="text-sm font-semibold leading-snug text-white/80 line-clamp-4">{post.title}</p>
              </div>
            )}
          </div>

          {/* Right: content + footer */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 pr-10">
              {/* Badges */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${PROVIDER_COLOR[post.provider] ?? "bg-gray-100 text-gray-600"}`}>
                  {PROVIDER_LABEL[post.provider] ?? post.provider}
                </span>
                {CONTENT_TYPE_CFG[post.contentType] && (
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${CONTENT_TYPE_CFG[post.contentType].pill}`}>
                    {CONTENT_TYPE_CFG[post.contentType].icon} {CONTENT_TYPE_CFG[post.contentType].label}
                  </span>
                )}
                <StatusBadge status={post.status} />
                {campaign && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {campaign.name}
                  </span>
                )}
              </div>

              {/* Scheduled date */}
              {post.scheduledAt && (
                <p className="mb-2 text-xs text-gray-500">
                  {formatDateLong(post.scheduledAt.slice(0, 10))} · {formatTime(post.scheduledAt)}
                </p>
              )}

              {/* Title + body */}
              <h2 className="mb-2 text-base font-semibold leading-snug text-gray-900">{post.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{post.body}</p>

              {/* Metadata */}
              {Array.isArray((post.metadata as Record<string, unknown> | null)?.hashtags) && (
                <p className="mt-3 text-xs leading-relaxed text-blue-600">
                  {((post.metadata as Record<string, unknown>).hashtags as string[]).map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}
                </p>
              )}

              {/* Instagram metrics */}
              {isDone && post.provider === "INSTAGRAM" && (() => {
                const meta = post.analyticsMeta as AnalyticsMeta | undefined;
                const hasData = meta && meta.source === "social_db";
                return (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Métricas Instagram
                      </span>
                      <button
                        type="button"
                        onClick={onRefreshMetrics}
                        disabled={isRefreshingMetrics}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition hover:border-blue-400 hover:text-blue-600 disabled:opacity-40"
                      >
                        {isRefreshingMetrics ? "Actualizando…" : "↺ Actualizar"}
                      </button>
                    </div>
                    {hasData ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <MetricCard icon="❤️" label="Likes" value={meta.likes} />
                          <MetricCard icon="💬" label="Comentarios" value={meta.comments} />
                          <MetricCard icon="👁️" label="Impresiones" value={meta.impressions} />
                          <MetricCard icon="📡" label="Alcance" value={meta.reach} />
                          <MetricCard icon="🔁" label="Compartidos" value={meta.shares} />
                          <MetricCard icon="🔖" label="Guardados" value={meta.saved} />
                        </div>
                        {meta.lastFetchedAt && (
                          <p className="mt-2.5 text-center text-[10px] text-gray-400">
                            Actualizado {formatRelativeTime(meta.lastFetchedAt)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="py-2 text-center text-xs text-gray-500">
                        {isRefreshingMetrics ? "Obteniendo métricas de Instagram…" : "Sin datos aún — pulsa Actualizar."}
                      </p>
                    )}
                  </div>
                );
              })()}

              {isDone && post.externalPostId && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 font-medium">
                  Publicado · ID externo: {post.externalPostId}
                </div>
              )}

              {isFailed && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
                  Publicación fallida — revisa la cuenta conectada.
                </div>
              )}
            </div>

            {/* Overdue warning */}
            {(post.status === "SCHEDULED" || post.status === "APPROVED") &&
              post.scheduledAt && post.scheduledAt < new Date().toISOString() && (
              <div className="mx-5 mb-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                <span className="font-black">⚠ Fecha pasada.</span>{" "}
                {post.status === "APPROVED"
                  ? "Aprueba y reprograma este post para publicarlo."
                  : "El scheduler lo publicará en el próximo ciclo. Si persiste, reprograma la fecha."}
              </div>
            )}

            {/* Action footer */}
            <div className="shrink-0 border-t border-gray-200 px-5 py-4">
              {isDone || isRejected ? (
                <p className="text-center text-xs text-gray-400 italic">
                  {isDone ? "Publicado correctamente." : "Post rechazado."}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {/* Primary CTA */}
                  {isApprovable && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onAction("approve")}
                      className="w-full rounded-xl border border-emerald-500/50 bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isPending ? "…" : "✓ Aprobar"}
                    </button>
                  )}

                  {isApproved && !scheduling && (
                    <button
                      type="button"
                      onClick={() => setScheduling(true)}
                      className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                    >
                      Programar fecha
                    </button>
                  )}

                  {(isApproved || isScheduled) && scheduling && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                          min={todayStr()}
                          className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                        <input
                          type="time"
                          value={schedTime}
                          onChange={(e) => setSchedTime(e.target.value)}
                          className="w-28 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isPending || !schedDate}
                          onClick={() => { onAction("schedule", { scheduledAt: toScheduledAt(schedDate, schedTime) }); setScheduling(false); }}
                          className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-400 disabled:opacity-50"
                        >
                          {isPending ? "…" : "Confirmar"}
                        </button>
                        <button type="button" onClick={() => setScheduling(false)} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-500 transition hover:text-gray-700">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SCHEDULED: info + Editar / Reprogramar / Eliminar */}
                  {isScheduled && !scheduling && !editing && (
                    <>
                      <p className="text-center text-xs text-gray-500 italic">
                        Será publicado automáticamente por el scheduler.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditTitle(post.title); setEditBody(post.body); setEditing(true); }}
                          className="flex-1 rounded-xl border border-gray-300 bg-white py-2 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduling(true)}
                          className="flex-1 rounded-xl border border-sky-300 bg-sky-50 py-2 text-sm text-sky-700 transition hover:bg-sky-100"
                        >
                          Reprogramar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={onDelete}
                          className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-2 text-sm text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}

                  {/* Inline edit form for SCHEDULED posts */}
                  {isScheduled && editing && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={4}
                        placeholder="Contenido del post"
                        className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isPending || !editTitle.trim() || !editBody.trim()}
                          onClick={() => { onSave(editTitle.trim(), editBody.trim()); setEditing(false); }}
                          className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-2.5 text-sm font-bold text-white shadow-sm transition hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
                        >
                          {isPending ? "…" : "Guardar"}
                        </button>
                        <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-500 transition hover:text-gray-700">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Secondary: Rechazar (non-scheduled only) */}
                  {!isScheduled && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onAction("reject")}
                      className="w-full rounded-xl border border-rose-300 bg-rose-50 py-2 text-sm text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CreatePostModal ──────────────────────────────────────────────────────────

type CreateModalProps = {
  date: string;
  time: string;
  content: string;
  provider: string;
  contentType: string;
  imageUrl: string;
  imageUploading: boolean;
  schedule: boolean;
  error: string | null;
  saving: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onProviderChange: (v: string) => void;
  onContentTypeChange: (v: string) => void;
  onImageUrlChange: (v: string) => void;
  onFileSelect: (file: File) => void;
  onScheduleChange: (v: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
};

function CreatePostModal(p: CreateModalProps) {
  const MAX = 3000;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={p.onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">Nuevo post</div>
            <div className="mt-0.5 text-base font-black text-gray-900">Crear publicación</div>
          </div>
          <button
            onClick={p.onClose}
            className="rounded-xl border border-gray-300 p-1.5 text-gray-500 transition hover:border-gray-400 hover:text-gray-700"
          >
            <IconX />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-5">
          {/* Provider */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Red social
            </label>
            <select
              value={p.provider}
              onChange={(e) => p.onProviderChange(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="LINKEDIN">LinkedIn</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </div>

          {/* Content type */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Tipo de contenido
            </label>
            <div className="grid grid-cols-3 gap-2">
              {POST_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => p.onContentTypeChange(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold transition",
                    p.contentType === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700",
                  ].join(" ")}
                >
                  <span className="text-lg leading-none">{opt.icon}</span>
                  <span className="text-[11px]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Contenido
            </label>
            <textarea
              value={p.content}
              onChange={(e) => p.onContentChange(e.target.value)}
              placeholder="Escribe el contenido del post aquí…"
              rows={5}
              maxLength={MAX}
              className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
            <div className="mt-1 text-right text-[10px] text-gray-400">
              {p.content.length}/{MAX}
            </div>
          </div>

          {/* Media */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              Imagen / Vídeo
              {p.provider === "INSTAGRAM" && <span className="text-rose-500">*</span>}
              {p.provider !== "INSTAGRAM" && <span className="font-normal normal-case text-gray-400">(opcional)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={p.imageUrl}
                onChange={(e) => p.onImageUrlChange(e.target.value)}
                placeholder="https://ejemplo.com/media.jpg"
                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              <label className={[
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                p.imageUploading
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600",
              ].join(" ")}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {p.imageUploading ? "Subiendo…" : "Subir"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                  className="hidden"
                  disabled={p.imageUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onFileSelect(f); e.target.value = ""; }}
                />
              </label>
            </div>
            {p.imageUrl.startsWith("http") && (
              <div className="mt-2 flex items-start gap-2">
                {/\.(mp4|mov)(\?|$)/i.test(p.imageUrl) ? (
                  <video src={p.imageUrl} className="h-20 w-20 rounded-xl border border-gray-200 object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="Preview" className="h-20 w-20 rounded-xl border border-gray-200 object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => p.onImageUrlChange("")}
                  className="rounded-lg border border-gray-300 p-1 text-gray-500 transition hover:border-rose-300 hover:text-rose-600"
                >
                  <IconX />
                </button>
              </div>
            )}
            {p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http") && (
              <p className="mt-1.5 text-xs text-amber-700">
                Instagram requiere una imagen o vídeo público. Pega una URL o sube un archivo.
              </p>
            )}
          </div>

          {/* Schedule toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Publicación
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => p.onScheduleChange(false)}
                className={[
                  "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition",
                  !p.schedule
                    ? "border-gray-300 bg-gray-100 text-gray-900"
                    : "border-gray-200 bg-transparent text-gray-500 hover:border-gray-300",
                ].join(" ")}
              >
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={() => p.onScheduleChange(true)}
                className={[
                  "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition",
                  p.schedule
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-200 bg-transparent text-gray-500 hover:border-gray-300",
                ].join(" ")}
              >
                Programar
              </button>
            </div>
          </div>

          {/* Date + time */}
          {p.schedule && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Fecha</label>
                <input
                  type="date"
                  value={p.date}
                  min={todayStr()}
                  onChange={(e) => p.onDateChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Hora</label>
                <input
                  type="time"
                  value={p.time}
                  onChange={(e) => p.onTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
              </div>
            </div>
          )}

          {p.error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {p.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={p.onClose}
            disabled={p.saving}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={p.onSubmit}
            disabled={p.saving || !p.content.trim() || (p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http"))}
            className={[
              "flex-1 rounded-xl py-2.5 text-sm font-bold shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0",
              p.schedule
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-500/25 hover:from-blue-600 hover:to-cyan-600"
                : "bg-gray-100 text-gray-900 hover:bg-gray-200",
            ].join(" ")}
          >
            {p.saving ? "Guardando…" : p.schedule ? "Programar post" : "Guardar borrador"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditorialCalendar({ posts: initialPosts, campaigns, saasId }: Props) {
  const router = useRouter();
  const today = todayStr();
  const now = new Date();

  const [posts, setPosts] = useState(initialPosts);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refreshingMetricsId, setRefreshingMetricsId] = useState<string | null>(null);
  const selectedDayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) {
      selectedDayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedDate]);

  const [fContent, setFContent] = useState("");
  const [fProvider, setFProvider] = useState("LINKEDIN");
  const [fContentType, setFContentType] = useState("FEED");
  const [fDate, setFDate] = useState(today);
  const [fTime, setFTime] = useState("09:00");
  const [fSchedule, setFSchedule] = useState(false);
  const [fImageUrl, setFImageUrl] = useState("");
  const [fImageUploading, setFImageUploading] = useState(false);
  const [fError, setFError] = useState<string | null>(null);
  const [fSaving, setFSaving] = useState(false);

  const grid = buildGrid(viewYear, viewMonth);
  const byDate = new Map<string, SaasSocialPost[]>();
  for (const p of posts) {
    if (!p.scheduledAt) continue;
    const key = p.scheduledAt.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }

  const selectedPosts = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const backlog = posts.filter(
    (p) => !p.scheduledAt && !["POSTED", "PUBLISHED", "FAILED", "REJECTED"].includes(p.status),
  );

  // Derive selected post from current posts state (auto-updates after patchPost)
  const selectedPost = selectedPostId ? posts.find((p) => p.id === selectedPostId) ?? null : null;

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function openCreate(date?: string) {
    const d = date ?? today;
    setFDate(d); setFContent(""); setFTime("09:00");
    setFContentType("FEED"); setFSchedule(!!date); setFError(null);
    setFImageUrl(""); setFImageUploading(false);
    setShowCreate(true);
  }

  async function handleImageFileSelect(file: File) {
    setFError(null);
    if (file.type.startsWith("image/")) {
      const dims = await getImageDimensions(file).catch(() => null);
      if (dims && isHorizontalImage(dims.width, dims.height)) {
        setFError("Esta foto es horizontal. Instagram requiere fotos verticales o cuadradas.");
        return;
      }
    }
    setFImageUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) { setFError(data.message ?? data.error ?? "Error al subir el archivo."); return; }
      setFImageUrl(data.url);
    } catch {
      setFError("No se pudo subir el archivo. Pega la URL directamente.");
    } finally {
      setFImageUploading(false);
    }
  }

  async function submitCreate() {
    if (!fContent.trim()) { setFError("El contenido es requerido."); return; }
    if (fProvider === "INSTAGRAM" && !fImageUrl.trim().startsWith("http")) {
      setFError("Instagram requiere una URL de imagen o vídeo pública válida."); return;
    }
    if (fSchedule && !fDate) { setFError("Selecciona una fecha para programar."); return; }
    setFSaving(true); setFError(null);
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          content: fContent.trim(),
          provider: fProvider,
          contentType: fContentType,
          status: fSchedule ? "SCHEDULED" : "DRAFT",
          scheduledAt: fSchedule ? toScheduledAt(fDate, fTime) : null,
          imageHint: fImageUrl.trim() || null,
        }),
      });
      const data = (await res.json()) as { post?: SaasSocialPost; code?: string };
      if (!res.ok || !data.post) throw new Error(data.code ?? "Error al guardar");
      setPosts((prev) => [data.post!, ...prev]);
      setShowCreate(false);
      if (fSchedule && fDate) setSelectedDate(fDate);
    } catch (e) {
      setFError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setFSaving(false);
    }
  }

  async function refreshMetrics(postId: string) {
    setRefreshingMetricsId(postId);
    try {
      const res = await fetch(`/api/socialflow/posts/${postId}/metrics/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId }),
      });
      const data = (await res.json()) as { post?: SaasSocialPost; ok?: boolean };
      if (res.ok && data.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
      }
    } catch {
      // silent — user can retry
    } finally {
      setRefreshingMetricsId(null);
    }
  }

  function patchPost(postId: string, action: string, extra?: Record<string, string>) {
    setPendingId(postId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: postId, saasId, action, ...extra }),
        });
        const data = (await res.json()) as { post?: SaasSocialPost };
        if (res.ok && data.post) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
        }
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  function editPost(postId: string, title: string, body: string) {
    setPendingId(postId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: postId, saasId, title, body }),
        });
        const data = (await res.json()) as { post?: SaasSocialPost };
        if (res.ok && data.post) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
        }
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  function deletePost(postId: string) {
    setPendingId(postId);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/socialflow/posts?id=${encodeURIComponent(postId)}&saasId=${encodeURIComponent(saasId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
          setSelectedPostId(null);
        }
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-900">
            <IconChevronLeft />
          </button>
          <h2 className="min-w-[190px] text-center text-xl font-black text-gray-900">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth} className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-gray-300 hover:text-gray-900">
            <IconChevronRight />
          </button>
          <button
            onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(today); }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => router.push("/socialflow/upload")}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:from-blue-600 hover:to-cyan-600"
        >
          ✦ Subir foto
        </button>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((dateStr, idx) => {
            const isLastRow = idx >= grid.length - 7;
            const isLastCol = (idx + 1) % 7 === 0;

            if (!dateStr) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={[
                    "min-h-[96px] bg-gray-50",
                    !isLastRow && "border-b border-gray-100",
                    !isLastCol && "border-r border-gray-100",
                  ].filter(Boolean).join(" ")}
                />
              );
            }

            const dayPosts = byDate.get(dateStr) ?? [];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isPast = dateStr < today;
            const dayNum = parseInt(dateStr.slice(8), 10);

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={[
                  "group min-h-[96px] cursor-pointer p-2 transition",
                  !isLastRow && "border-b border-gray-100",
                  !isLastCol && "border-r border-gray-100",
                  isSelected
                    ? "bg-blue-50 ring-2 ring-inset ring-blue-400"
                    : isPast && !isToday
                    ? "bg-gray-50 hover:bg-gray-100"
                    : "hover:bg-gray-50",
                ].filter(Boolean).join(" ")}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-blue-500 text-white"
                      : isSelected ? "bg-blue-400 text-white"
                      : isPast ? "text-gray-300"
                      : "text-gray-600",
                  ].join(" ")}>
                    {dayNum}
                  </span>
                  {!isPast && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreate(dateStr); }}
                      className="rounded-md p-0.5 text-gray-300 opacity-0 transition hover:text-blue-500 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((p) => <PostChip key={p.id} post={p} today={today} />)}
                  {dayPosts.length > 3 && (
                    <div className="pl-1 text-[9px] font-bold text-gray-400">+{dayPosts.length - 3} más</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status legend ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        {(["DRAFT","APPROVED","SCHEDULED","PUBLISHED","FAILED"] as PostStatus[]).map((s) => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cfg.dotBg}`} />
              <span className="text-xs text-gray-500">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Selected day panel ────────────────────────────────────────────── */}
      {selectedDate && (
        <div ref={selectedDayRef} className="rounded-3xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              {selectedDate === today && (
                <div className="mb-0.5 text-[11px] font-black uppercase tracking-widest text-blue-500">Hoy</div>
              )}
              <h3 className="text-xl font-black capitalize text-gray-900">{formatDateLong(selectedDate)}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {selectedPosts.length === 0
                  ? "Sin posts programados"
                  : `${selectedPosts.length} post${selectedPosts.length !== 1 ? "s" : ""} programado${selectedPosts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => router.push("/socialflow/upload")}
              className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
            >
              + Subir foto
            </button>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 py-10 text-center">
              <div className="mb-2 text-2xl">📅</div>
              <p className="text-sm text-gray-500">Sin publicaciones para este día.</p>
              <button
                onClick={() => router.push("/socialflow/upload")}
                className="mt-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-0.5 hover:from-blue-600 hover:to-cyan-600"
              >
                Subir tu primera foto
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 md:gap-2">
                {selectedPosts.map((p) => (
                  <PostThumb key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-gray-400">Toca un post para ver detalles</p>
            </>
          )}
        </div>
      )}

      {/* ── Backlog ───────────────────────────────────────────────────────── */}
      {backlog.length > 0 && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-gray-900">Sin programar</h3>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700">
                {backlog.length}
              </span>
            </div>
            <p className="text-xs text-gray-400">Aprueba estos posts y asígnales una fecha.</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 md:gap-2">
            {backlog.map((p) => (
              <PostThumb key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-400">Toca un post para aprobar o programar</p>
        </div>
      )}

      {/* ── Create post modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <CreatePostModal
          date={fDate}
          time={fTime}
          content={fContent}
          provider={fProvider}
          contentType={fContentType}
          imageUrl={fImageUrl}
          imageUploading={fImageUploading}
          schedule={fSchedule}
          error={fError}
          saving={fSaving}
          onDateChange={setFDate}
          onTimeChange={setFTime}
          onContentChange={setFContent}
          onProviderChange={setFProvider}
          onContentTypeChange={setFContentType}
          onImageUrlChange={setFImageUrl}
          onFileSelect={handleImageFileSelect}
          onScheduleChange={setFSchedule}
          onSubmit={submitCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* ── Post detail modal ─────────────────────────────────────────────── */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          campaigns={campaigns}
          isPending={isPending && pendingId === selectedPost.id}
          isRefreshingMetrics={refreshingMetricsId === selectedPost.id}
          onAction={(action, extra) => patchPost(selectedPost.id, action, extra)}
          onSave={(title, body) => editPost(selectedPost.id, title, body)}
          onDelete={() => deletePost(selectedPost.id)}
          onRefreshMetrics={() => refreshMetrics(selectedPost.id)}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}
