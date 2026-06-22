"use client";

import { useState, useTransition } from "react";
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
  IDEA:       { label: "Idea",       chipBg: "bg-slate-100 text-slate-500",   dotBg: "bg-slate-400" },
  DRAFT:      { label: "Borrador",   chipBg: "bg-slate-100 text-slate-600",   dotBg: "bg-slate-500" },
  IN_REVIEW:  { label: "En revisión",chipBg: "bg-amber-100 text-amber-700",   dotBg: "bg-amber-500" },
  APPROVED:   { label: "Aprobado",   chipBg: "bg-indigo-100 text-indigo-700", dotBg: "bg-indigo-500" },
  REJECTED:   { label: "Rechazado",  chipBg: "bg-rose-100 text-rose-500",     dotBg: "bg-rose-400" },
  SCHEDULED:  { label: "Programado", chipBg: "bg-sky-100 text-sky-700",       dotBg: "bg-sky-500" },
  PUBLISHING: { label: "Publicando", chipBg: "bg-violet-100 text-violet-700", dotBg: "bg-violet-500" },
  POSTED:     { label: "Publicado",  chipBg: "bg-emerald-100 text-emerald-700",dotBg: "bg-emerald-500" },
  PUBLISHED:  { label: "Publicado",  chipBg: "bg-emerald-100 text-emerald-700",dotBg: "bg-emerald-500" },
  FAILED:     { label: "Error",      chipBg: "bg-rose-100 text-rose-600",     dotBg: "bg-rose-500" },
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
  TWITTER_X: "bg-slate-900 text-white",
  TIKTOK: "bg-slate-800 text-white",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  let dow = first.getDay();
  dow = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
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

// ─── PostCard ─────────────────────────────────────────────────────────────────

type PostCardProps = {
  post: SaasSocialPost;
  campaigns: SaasSocialCampaign[];
  isPending: boolean;
  onAction: (action: string, extra?: Record<string, string>) => void;
};

function PostCard({ post, campaigns, isPending, onAction }: PostCardProps) {
  const [scheduling, setScheduling] = useState(false);
  const [schedDate, setSchedDate] = useState(todayStr());
  const [schedTime, setSchedTime] = useState("09:00");
  const campaign = campaigns.find(c => c.id === post.campaignId);

  const isEditable = ["IDEA", "DRAFT", "IN_REVIEW"].includes(post.status);
  const isApproved = post.status === "APPROVED";
  const isScheduled = post.status === "SCHEDULED";
  const isDone = ["POSTED", "PUBLISHED"].includes(post.status);
  const isFailed = post.status === "FAILED";
  const isRejected = post.status === "REJECTED";

  return (
    <div className={[
      "rounded-2xl border p-4 transition",
      isDone ? "border-emerald-100 bg-emerald-50/50" : "border-slate-100 bg-slate-50",
    ].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Provider + status row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${PROVIDER_COLOR[post.provider] ?? "bg-slate-200 text-slate-700"}`}>
              {PROVIDER_LABEL[post.provider] ?? post.provider}
            </span>
            <StatusBadge status={post.status} />
            {campaign && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {campaign.name}
              </span>
            )}
            {post.scheduledAt && (
              <span className="text-[10px] text-slate-400">
                {formatDateLong(post.scheduledAt.slice(0, 10))} · {formatTime(post.scheduledAt)}
              </span>
            )}
          </div>

          {/* Content */}
          <p className="text-sm font-semibold text-slate-800 line-clamp-1">{post.title}</p>
          <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">{post.body}</p>
          {post.imageHint?.startsWith("http") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.imageHint}
              alt=""
              className="mt-2 h-32 w-full rounded-xl border border-slate-100 object-cover"
            />
          )}
        </div>
      </div>

      {/* Actions */}
      {!isDone && !isRejected && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3">
          {(isEditable) && (
            <>
              <button
                onClick={() => onAction("approve")}
                disabled={isPending}
                className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-600 disabled:opacity-50"
              >
                {isPending ? "…" : "Aprobar"}
              </button>
              <button
                onClick={() => onAction("reject")}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                Rechazar
              </button>
            </>
          )}

          {isApproved && !scheduling && (
            <>
              <button
                onClick={() => setScheduling(true)}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-600"
              >
                Programar
              </button>
              <button
                onClick={() => onAction("reject")}
                disabled={isPending}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                Rechazar
              </button>
            </>
          )}

          {isApproved && scheduling && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={schedDate}
                onChange={e => setSchedDate(e.target.value)}
                min={todayStr()}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="time"
                value={schedTime}
                onChange={e => setSchedTime(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={() => {
                  onAction("schedule", { scheduledAt: toScheduledAt(schedDate, schedTime) });
                  setScheduling(false);
                }}
                disabled={isPending || !schedDate}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
              >
                {isPending ? "…" : "Confirmar"}
              </button>
              <button onClick={() => setScheduling(false)} className="text-xs text-slate-400 hover:text-slate-600">
                Cancelar
              </button>
            </div>
          )}

          {isScheduled && (
            <span className="text-xs text-slate-400 italic">
              Será publicado automáticamente por el scheduler.
            </span>
          )}

          {isFailed && (
            <span className="text-xs font-medium text-rose-500">
              Publicación fallida — revisa la cuenta conectada.
            </span>
          )}
        </div>
      )}

      {isDone && post.externalPostId && (
        <div className="mt-2 border-t border-emerald-100 pt-2 text-xs text-emerald-600 font-medium">
          Publicado · ID externo: {post.externalPostId}
        </div>
      )}
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
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={p.onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">Nuevo post</div>
            <div className="mt-0.5 text-base font-black text-slate-900">Crear publicación</div>
          </div>
          <button
            onClick={p.onClose}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
          >
            <IconX />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-5">
          {/* Provider */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Red social
            </label>
            <select
              value={p.provider}
              onChange={e => p.onProviderChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="LINKEDIN">LinkedIn</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Contenido
            </label>
            <textarea
              value={p.content}
              onChange={e => p.onContentChange(e.target.value)}
              placeholder="Escribe el contenido del post aquí…"
              rows={5}
              maxLength={MAX}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="mt-1 text-right text-[10px] text-slate-400">
              {p.content.length}/{MAX}
            </div>
          </div>

          {/* Media */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              Imagen / Vídeo
              {p.provider === "INSTAGRAM" && <span className="text-rose-500">*</span>}
              {p.provider !== "INSTAGRAM" && <span className="font-normal normal-case text-slate-400">(opcional)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={p.imageUrl}
                onChange={e => p.onImageUrlChange(e.target.value)}
                placeholder="https://ejemplo.com/media.jpg"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <label className={[
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                p.imageUploading
                  ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-600",
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
                  onChange={e => { const f = e.target.files?.[0]; if (f) p.onFileSelect(f); e.target.value = ""; }}
                />
              </label>
            </div>
            {p.imageUrl.startsWith("http") && (
              <div className="mt-2 flex items-start gap-2">
                {/\.(mp4|mov)(\?|$)/i.test(p.imageUrl) ? (
                  <video src={p.imageUrl} className="h-20 w-20 rounded-xl border border-slate-200 object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="Preview" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => p.onImageUrlChange("")}
                  className="rounded-lg border border-slate-200 p-1 text-slate-400 transition hover:border-rose-200 hover:text-rose-500"
                >
                  <IconX />
                </button>
              </div>
            )}
            {p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http") && (
              <p className="mt-1.5 text-xs text-amber-600">
                Instagram requiere una imagen o vídeo público. Pega una URL o sube un archivo.
              </p>
            )}
          </div>

          {/* Schedule toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Publicación
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => p.onScheduleChange(false)}
                className={[
                  "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition",
                  !p.schedule
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
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
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                ].join(" ")}
              >
                Programar
              </button>
            </div>
          </div>

          {/* Date + time (when scheduling) */}
          {p.schedule && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Fecha
                </label>
                <input
                  type="date"
                  value={p.date}
                  min={todayStr()}
                  onChange={e => p.onDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Hora (UTC)
                </label>
                <input
                  type="time"
                  value={p.time}
                  onChange={e => p.onTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={p.onClose}
            disabled={p.saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={p.onSubmit}
            disabled={p.saving || !p.content.trim() || (p.provider === "INSTAGRAM" && !p.imageUrl.startsWith("http"))}
            className={[
              "flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0",
              p.schedule ? "bg-sky-500 shadow-sky-500/25 hover:bg-sky-600" : "bg-slate-900 shadow-slate-900/20 hover:bg-slate-800",
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
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [fContent, setFContent] = useState("");
  const [fProvider, setFProvider] = useState("LINKEDIN");
  const [fDate, setFDate] = useState(today);
  const [fTime, setFTime] = useState("09:00");
  const [fSchedule, setFSchedule] = useState(false);
  const [fImageUrl, setFImageUrl] = useState("");
  const [fImageUploading, setFImageUploading] = useState(false);
  const [fError, setFError] = useState<string | null>(null);
  const [fSaving, setFSaving] = useState(false);

  // Build calendar grid + post index
  const grid = buildGrid(viewYear, viewMonth);
  const byDate = new Map<string, SaasSocialPost[]>();
  for (const p of posts) {
    if (!p.scheduledAt) continue;
    const key = p.scheduledAt.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }

  const selectedPosts = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const backlog = posts.filter(
    p => !p.scheduledAt && !["POSTED", "PUBLISHED", "FAILED", "REJECTED"].includes(p.status)
  );

  // Month navigation
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // Open create form (optionally pre-filled with a date)
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
      if (!res.ok || !data.url) {
        setFError(data.message ?? data.error ?? "Error al subir el archivo.");
        return;
      }
      setFImageUrl(data.url);
    } catch {
      setFError("No se pudo subir el archivo. Pega la URL directamente.");
    } finally {
      setFImageUploading(false);
    }
  }

  // Submit new post
  async function submitCreate() {
    if (!fContent.trim()) { setFError("El contenido es requerido."); return; }
    if (fProvider === "INSTAGRAM" && !fImageUrl.trim().startsWith("http")) {
      setFError("Instagram requiere una URL de imagen o vídeo pública válida.");
      return;
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
      setPosts(prev => [data.post!, ...prev]);
      setShowCreate(false);
      if (fSchedule && fDate) setSelectedDate(fDate);
    } catch (e) {
      setFError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setFSaving(false);
    }
  }

  // Patch post (approve / reject / schedule / mark_posted)
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
          setPosts(prev => prev.map(p => p.id === postId ? data.post! : p));
        }
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <IconChevronLeft />
          </button>
          <h2 className="min-w-[190px] text-center text-xl font-black text-slate-900">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={nextMonth}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <IconChevronRight />
          </button>
          <button
            onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDate(today); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => openCreate()}
          className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:bg-sky-600"
        >
          + Nuevo post
        </button>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Day name headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAYS.map(d => (
            <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {grid.map((dateStr, idx) => {
            const isLastRow = idx >= grid.length - 7;
            const isLastCol = (idx + 1) % 7 === 0;

            if (!dateStr) {
              return (
                <div
                  key={`empty-${idx}`}
                  className={[
                    "min-h-[96px] bg-slate-50/50",
                    !isLastRow && "border-b border-slate-100",
                    !isLastCol && "border-r border-slate-100",
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
                  !isLastRow && "border-b border-slate-100",
                  !isLastCol && "border-r border-slate-100",
                  isSelected
                    ? "bg-sky-50 ring-1 ring-inset ring-sky-300"
                    : isPast && !isToday
                    ? "bg-slate-50/60 hover:bg-slate-50"
                    : "hover:bg-slate-50",
                ].filter(Boolean).join(" ")}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      isToday
                        ? "bg-sky-500 text-white"
                        : isSelected
                        ? "bg-sky-100 text-sky-700"
                        : isPast
                        ? "text-slate-300"
                        : "text-slate-600",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>
                  {!isPast && (
                    <button
                      onClick={e => { e.stopPropagation(); openCreate(dateStr); }}
                      className="rounded-md p-0.5 text-slate-300 opacity-0 transition hover:text-sky-500 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map(p => <PostChip key={p.id} post={p} />)}
                  {dayPosts.length > 3 && (
                    <div className="pl-1 text-[9px] font-bold text-slate-400">
                      +{dayPosts.length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Status legend ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        {(["DRAFT","APPROVED","SCHEDULED","PUBLISHED","FAILED"] as PostStatus[]).map(s => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cfg.dotBg}`} />
              <span className="text-xs text-slate-500">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Selected day panel ───────────────────────────────────────────── */}
      {selectedDate && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between">
            <div>
              {selectedDate === today && (
                <div className="mb-0.5 text-[11px] font-black uppercase tracking-widest text-sky-600">Hoy</div>
              )}
              <h3 className="text-xl font-black capitalize text-slate-900">
                {formatDateLong(selectedDate)}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {selectedPosts.length === 0
                  ? "Sin posts programados"
                  : `${selectedPosts.length} post${selectedPosts.length !== 1 ? "s" : ""} programado${selectedPosts.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => openCreate(selectedDate)}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
            >
              + Agregar
            </button>
          </div>

          {selectedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <div className="text-2xl mb-2">📅</div>
              <p className="text-sm text-slate-400">Sin publicaciones para este día.</p>
              <button
                onClick={() => openCreate(selectedDate)}
                className="mt-3 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:-translate-y-0.5 hover:bg-sky-600"
              >
                Crear el primer post
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedPosts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  campaigns={campaigns}
                  isPending={isPending && pendingId === p.id}
                  onAction={(action, extra) => patchPost(p.id, action, extra)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Backlog ──────────────────────────────────────────────────────── */}
      {backlog.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900">Sin programar</h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-700">
                {backlog.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Aprueba estos posts y asígnales una fecha para publicarlos.
            </p>
          </div>
          <div className="space-y-3">
            {backlog.map(p => (
              <PostCard
                key={p.id}
                post={p}
                campaigns={campaigns}
                isPending={isPending && pendingId === p.id}
                onAction={(action, extra) => patchPost(p.id, action, extra)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Create post modal ────────────────────────────────────────────── */}
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
    </div>
  );
}
