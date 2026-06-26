"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SaasSocialPost, SaasSocialCampaign } from "@/lib/social-core/types";

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
  IDEA:       { label: "Idea",       chipBg: "bg-white/6 text-white/45",           dotBg: "bg-white/30"    },
  DRAFT:      { label: "Borrador",   chipBg: "bg-white/8 text-white/55",           dotBg: "bg-white/40"    },
  IN_REVIEW:  { label: "En revisión",chipBg: "bg-amber-500/15 text-amber-300",     dotBg: "bg-amber-500"   },
  APPROVED:   { label: "Aprobado",   chipBg: "bg-indigo-500/15 text-indigo-300",   dotBg: "bg-indigo-500"  },
  REJECTED:   { label: "Rechazado",  chipBg: "bg-rose-500/15 text-rose-300",       dotBg: "bg-rose-400"    },
  SCHEDULED:  { label: "Programado", chipBg: "bg-sky-500/15 text-sky-300",         dotBg: "bg-sky-500"     },
  PUBLISHING: { label: "Publicando", chipBg: "bg-violet-500/15 text-violet-300",   dotBg: "bg-violet-500"  },
  POSTED:     { label: "Publicado",  chipBg: "bg-emerald-500/15 text-emerald-300", dotBg: "bg-emerald-500" },
  PUBLISHED:  { label: "Publicado",  chipBg: "bg-emerald-500/15 text-emerald-300", dotBg: "bg-emerald-500" },
  FAILED:     { label: "Error",      chipBg: "bg-rose-500/15 text-rose-400",       dotBg: "bg-rose-500"    },
};

const STATUS_RING: Record<string, string> = {
  APPROVED:   "ring-indigo-400/60",
  SCHEDULED:  "ring-sky-400/60",
  IN_REVIEW:  "ring-amber-400/50",
  REJECTED:   "ring-rose-400/60",
  POSTED:     "ring-emerald-400/70",
  PUBLISHED:  "ring-emerald-400/70",
  PUBLISHING: "ring-violet-400/60",
  IDEA:       "ring-white/8",
  DRAFT:      "ring-white/8",
  FAILED:     "ring-rose-500/50",
};

const STATUS_DOT: Record<string, string> = {
  APPROVED:   "bg-indigo-400",
  SCHEDULED:  "bg-sky-400",
  IN_REVIEW:  "bg-amber-300",
  REJECTED:   "bg-rose-400",
  POSTED:     "bg-emerald-400",
  PUBLISHED:  "bg-emerald-400",
  PUBLISHING: "bg-violet-400",
  IDEA:       "bg-white/20",
  DRAFT:      "bg-white/20",
  FAILED:     "bg-rose-500",
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
  TWITTER_X: "bg-white/15 text-white",
  TIKTOK: "bg-white/10 text-white",
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

function PostChip({ post }: { post: SaasSocialPost }) {
  const cfg = STATUS_CFG[post.status];
  const abbr = PROVIDER_ABBR[post.provider] ?? "?";
  const title = post.title.length > 22 ? post.title.slice(0, 22) + "…" : post.title;
  return (
    <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cfg.chipBg}`}>
      <span className="font-black opacity-60">{abbr}</span>
      <span className="truncate">{title}</span>
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

function PostThumb({ post, onClick }: { post: SaasSocialPost; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!post.imageHint?.startsWith("http") && !imageError;
  const gradient = thumbGradient(post.id);
  const ring = STATUS_RING[post.status] ?? "ring-white/8";
  const dot  = STATUS_DOT[post.status]  ?? "bg-white/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square w-full overflow-hidden rounded-xl ring-2 ${ring} transition-all duration-150 hover:scale-[1.03] hover:ring-white/30 active:scale-[0.98]`}
    >
      {hasImage ? (
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
  onAction: (action: string, extra?: Record<string, string>) => void;
  onClose: () => void;
};

function PostDetailModal({ post, campaigns, isPending, onAction, onClose }: PostDetailModalProps) {
  const [scheduling, setScheduling] = useState(false);
  const [schedDate, setSchedDate] = useState(todayStr());
  const [schedTime, setSchedTime] = useState("09:00");
  const campaign = campaigns.find((c) => c.id === post.campaignId);

  const isEditable = ["IDEA", "DRAFT", "IN_REVIEW"].includes(post.status);
  const isApproved = post.status === "APPROVED";
  const isScheduled = post.status === "SCHEDULED";
  const isDone = ["POSTED", "PUBLISHED"].includes(post.status);
  const isFailed = post.status === "FAILED";
  const isRejected = post.status === "REJECTED";
  const isApprovable = isEditable;
  const gradient = thumbGradient(post.id);

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
      <div className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0d0d14] sm:h-[88vh] sm:rounded-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/8 text-white/50 transition hover:bg-white/15 hover:text-white/80"
          aria-label="Cerrar"
        >
          <IconX />
        </button>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left: image */}
          <div className="relative flex h-52 shrink-0 items-center justify-center bg-black/30 md:h-auto md:w-5/12">
            {post.imageHint?.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.imageHint} alt={post.title} className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${gradient} flex flex-col items-start justify-end p-5`}>
                <p className="text-sm font-semibold leading-snug text-white/60 line-clamp-4">{post.title}</p>
              </div>
            )}
          </div>

          {/* Right: content + footer */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 pr-10">
              {/* Badges */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${PROVIDER_COLOR[post.provider] ?? "bg-white/10 text-white/70"}`}>
                  {PROVIDER_LABEL[post.provider] ?? post.provider}
                </span>
                <StatusBadge status={post.status} />
                {campaign && (
                  <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-medium text-white/40">
                    {campaign.name}
                  </span>
                )}
              </div>

              {/* Scheduled date */}
              {post.scheduledAt && (
                <p className="mb-2 text-xs text-white/35">
                  {formatDateLong(post.scheduledAt.slice(0, 10))} · {formatTime(post.scheduledAt)}
                </p>
              )}

              {/* Title + body */}
              <h2 className="mb-2 text-base font-semibold leading-snug text-white/90">{post.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">{post.body}</p>

              {/* Metadata */}
              {Array.isArray((post.metadata as Record<string, unknown> | null)?.hashtags) && (
                <p className="mt-3 text-xs leading-relaxed text-violet-300/65">
                  {((post.metadata as Record<string, unknown>).hashtags as string[]).map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}
                </p>
              )}

              {isDone && post.externalPostId && (
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-400 font-medium">
                  Publicado · ID externo: {post.externalPostId}
                </div>
              )}

              {isFailed && (
                <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-400 font-medium">
                  Publicación fallida — revisa la cuenta conectada.
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="shrink-0 border-t border-white/8 px-5 py-4">
              {isDone || isRejected ? (
                <p className="text-center text-xs text-white/30 italic">
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

                  {isApproved && scheduling && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                          min={todayStr()}
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                        />
                        <input
                          type="time"
                          value={schedTime}
                          onChange={(e) => setSchedTime(e.target.value)}
                          className="w-28 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
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
                        <button type="button" onClick={() => setScheduling(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/40 transition hover:text-white/60">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {isScheduled && (
                    <p className="text-center text-xs text-white/35 italic">
                      Será publicado automáticamente por el scheduler.
                    </p>
                  )}

                  {/* Secondary: Rechazar */}
                  {!isScheduled && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onAction("reject")}
                      className="w-full rounded-xl border border-rose-500/25 bg-rose-500/10 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
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
  imageUrl: string;
  imageUploading: boolean;
  schedule: boolean;
  error: string | null;
  saving: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onProviderChange: (v: string) => void;
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
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0d1e] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-violet-400">Nuevo post</div>
            <div className="mt-0.5 text-base font-black text-white">Crear publicación</div>
          </div>
          <button
            onClick={p.onClose}
            className="rounded-xl border border-white/10 p-1.5 text-white/40 transition hover:border-white/20 hover:text-white/70"
          >
            <IconX />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-5">
          {/* Provider */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">
              Red social
            </label>
            <select
              value={p.provider}
              onChange={(e) => p.onProviderChange(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0d0d1e] px-3 py-2.5 text-sm font-semibold text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              <option value="LINKEDIN">LinkedIn</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">
              Contenido
            </label>
            <textarea
              value={p.content}
              onChange={(e) => p.onContentChange(e.target.value)}
              placeholder="Escribe el contenido del post aquí…"
              rows={5}
              maxLength={MAX}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 focus:bg-white/6 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
            <div className="mt-1 text-right text-[10px] text-white/25">
              {p.content.length}/{MAX}
            </div>
          </div>

          {/* Media */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-white/40">
              Imagen / Vídeo
              {p.provider === "INSTAGRAM" && <span className="text-rose-400">*</span>}
              {p.provider !== "INSTAGRAM" && <span className="font-normal normal-case text-white/25">(opcional)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={p.imageUrl}
                onChange={(e) => p.onImageUrlChange(e.target.value)}
                placeholder="https://ejemplo.com/media.jpg"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 focus:bg-white/6 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
              <label className={[
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                p.imageUploading
                  ? "border-white/8 bg-white/4 text-white/25 cursor-not-allowed"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-violet-500/40 hover:text-violet-300",
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
                  <video src={p.imageUrl} className="h-20 w-20 rounded-xl border border-white/10 object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="Preview" className="h-20 w-20 rounded-xl border border-white/10 object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => p.onImageUrlChange("")}
                  className="rounded-lg border border-white/10 p-1 text-white/35 transition hover:border-rose-500/30 hover:text-rose-400"
                >
                  <IconX />
                </button>
              </div>
            )}
            {p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http") && (
              <p className="mt-1.5 text-xs text-amber-300/80">
                Instagram requiere una imagen o vídeo público. Pega una URL o sube un archivo.
              </p>
            )}
          </div>

          {/* Schedule toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">
              Publicación
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => p.onScheduleChange(false)}
                className={[
                  "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition",
                  !p.schedule
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/8 bg-transparent text-white/45 hover:border-white/15",
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
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-white/8 bg-transparent text-white/45 hover:border-white/15",
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
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">Fecha</label>
                <input
                  type="date"
                  value={p.date}
                  min={todayStr()}
                  onChange={(e) => p.onDateChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/40">Hora (UTC)</label>
                <input
                  type="time"
                  value={p.time}
                  onChange={(e) => p.onTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>
            </div>
          )}

          {p.error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">
              {p.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-white/8 px-6 py-4">
          <button
            onClick={p.onClose}
            disabled={p.saving}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/55 transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={p.onSubmit}
            disabled={p.saving || !p.content.trim() || (p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http"))}
            className={[
              "flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0",
              p.schedule
                ? "bg-violet-500 shadow-violet-500/25 hover:bg-violet-600"
                : "bg-white/10 hover:bg-white/15",
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

  const [fContent, setFContent] = useState("");
  const [fProvider, setFProvider] = useState("LINKEDIN");
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
    setFSchedule(!!date); setFError(null);
    setFImageUrl(""); setFImageUploading(false);
    setShowCreate(true);
  }

  async function handleImageFileSelect(file: File) {
    setFImageUploading(true);
    setFError(null);
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

  return (
    <div className="space-y-6">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-xl border border-white/10 bg-white/4 p-2 text-white/50 transition hover:border-white/20 hover:text-white">
            <IconChevronLeft />
          </button>
          <h2 className="min-w-[190px] text-center text-xl font-black text-white">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth} className="rounded-xl border border-white/10 bg-white/4 p-2 text-white/50 transition hover:border-white/20 hover:text-white">
            <IconChevronRight />
          </button>
          <button
            onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(today); }}
            className="rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-sm font-semibold text-white/50 transition hover:bg-white/8 hover:text-white"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
        >
          + Nuevo post
        </button>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/3">
        <div className="grid grid-cols-7 border-b border-white/8 bg-white/3">
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
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
                    "min-h-[96px] bg-white/2",
                    !isLastRow && "border-b border-white/6",
                    !isLastCol && "border-r border-white/6",
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
                  !isLastRow && "border-b border-white/6",
                  !isLastCol && "border-r border-white/6",
                  isSelected
                    ? "bg-violet-500/8 ring-1 ring-inset ring-violet-500/30"
                    : isPast && !isToday
                    ? "bg-white/2 hover:bg-white/4"
                    : "hover:bg-white/4",
                ].filter(Boolean).join(" ")}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={[
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-violet-500 text-white"
                      : isSelected ? "bg-violet-500/20 text-violet-300"
                      : isPast ? "text-white/20"
                      : "text-white/60",
                  ].join(" ")}>
                    {dayNum}
                  </span>
                  {!isPast && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreate(dateStr); }}
                      className="rounded-md p-0.5 text-white/15 opacity-0 transition hover:text-violet-400 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((p) => <PostChip key={p.id} post={p} />)}
                  {dayPosts.length > 3 && (
                    <div className="pl-1 text-[9px] font-bold text-white/30">+{dayPosts.length - 3} más</div>
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
              <span className="text-xs text-white/35">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Selected day panel ────────────────────────────────────────────── */}
      {selectedDate && (
        <div className="rounded-3xl border border-white/8 bg-white/4 p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              {selectedDate === today && (
                <div className="mb-0.5 text-[11px] font-black uppercase tracking-widest text-violet-400">Hoy</div>
              )}
              <h3 className="text-xl font-black capitalize text-white">{formatDateLong(selectedDate)}</h3>
              <p className="mt-0.5 text-sm text-white/45">
                {selectedPosts.length === 0
                  ? "Sin posts programados"
                  : `${selectedPosts.length} post${selectedPosts.length !== 1 ? "s" : ""} programado${selectedPosts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => openCreate(selectedDate)}
              className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-300 transition hover:bg-violet-500/15"
            >
              + Agregar
            </button>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center">
              <div className="mb-2 text-2xl">📅</div>
              <p className="text-sm text-white/35">Sin publicaciones para este día.</p>
              <button
                onClick={() => openCreate(selectedDate)}
                className="mt-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Crear el primer post
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 md:gap-2">
                {selectedPosts.map((p) => (
                  <PostThumb key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-white/25">Toca un post para ver detalles</p>
            </>
          )}
        </div>
      )}

      {/* ── Backlog ───────────────────────────────────────────────────────── */}
      {backlog.length > 0 && (
        <div className="rounded-3xl border border-white/8 bg-white/4 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white">Sin programar</h3>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-300">
                {backlog.length}
              </span>
            </div>
            <p className="text-xs text-white/30">Aprueba estos posts y asígnales una fecha.</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 md:gap-2">
            {backlog.map((p) => (
              <PostThumb key={p.id} post={p} onClick={() => setSelectedPostId(p.id)} />
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-white/25">Toca un post para aprobar o programar</p>
        </div>
      )}

      {/* ── Create post modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <CreatePostModal
          date={fDate}
          time={fTime}
          content={fContent}
          provider={fProvider}
          imageUrl={fImageUrl}
          imageUploading={fImageUploading}
          schedule={fSchedule}
          error={fError}
          saving={fSaving}
          onDateChange={setFDate}
          onTimeChange={setFTime}
          onContentChange={setFContent}
          onProviderChange={setFProvider}
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
          onAction={(action, extra) => patchPost(selectedPost.id, action, extra)}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </div>
  );
}
