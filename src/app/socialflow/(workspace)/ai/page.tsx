"use client";
// API routes: /api/socialflow/ai/generate /api/socialflow/ai/regenerate

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SocialPost = {
  id: string;
  title: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  imageHint?: string | null;
  metadata?: {
    hashtags?: string[];
    angle?: string;
    hook?: string;
    callToAction?: string;
    cta?: string;
  } | null;
};

type CampaignParams = {
  topic?: string;
  frequencyPerWeek?: number;
  provider?: string;
  dateLabel?: string;
  startDate?: string;
  endDate?: string;
};

type IdeaFormat = "reel" | "carrusel" | "post";

type IdeaSuggestion = {
  hook: string;
  format: IdeaFormat;
  whyViral: string;
};

type ActionCard = {
  icon: string;
  label: string;
  message: string;
};

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
  campaignId?: string;
  posts?: SocialPost[];
  generatingStatus?: "polling" | "done" | "error";
  params?: CampaignParams;
  actionCards?: ActionCard[];
  attachment?: { url: string; type: "image" | "video" };
  publishOptions?: { title: string; body: string; imageHint: string; contentType: "FEED" | "REEL" | "STORY" };
  publishState?: "idle" | "working" | "error";
  publishResult?: { action: "published" | "scheduled"; reply: string };
};

// Conversación activa sobre UNA imagen/vídeo subido desde el chat — se mantiene en
// memoria de cliente (mismo patrón que lastIdeas) y se reenvía en cada mensaje mientras
// esté activa, para que "hazlo más corto" ajuste el caption sin re-subir el archivo.
type ImageChatContext = {
  imageKey: string;
  imageUrl: string;
  imageAnalysis: ImageAnalysis;
  conversation: { role: "user" | "assistant"; content: string }[];
  // Caption limpio más reciente (sin la pregunta de seguimiento) — es lo único que se
  // publica; `conversation` guarda el texto completo tal como lo vio el usuario.
  lastCaption: string;
};

function deriveTitleFromCaption(caption: string): string {
  return caption.split("\n")[0]?.replace(/^#+\s*/, "").trim().slice(0, 72) || "Post";
}

type EditDraft = {
  title: string;
  body: string;
  hook: string;
  cta: string;
  hashtags: string;
  scheduledAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";

function extractModifyRequest(text: string): { postNumber: number; instruction: string } | null {
  const m1 = text.match(/(?:cambia|modifica|mejora|actualiza|hazlo|hazla|regenera)\s+(?:el\s+)?(?:post\s+)?(?:n[uú]mero\s+)?#?(\d+)/i);
  if (m1) return { postNumber: parseInt(m1[1]), instruction: text };
  const m2 = text.match(/post\s+#?(\d+)\s*[,:]/i);
  if (m2) return { postNumber: parseInt(m2[1]), instruction: text };
  return null;
}

// Minimal markdown-lite renderer for bot replies: **bold** + numbered lists (1. 2. 3.).
// No remark/react-markdown in the project — keep this dependency-free.
function renderInlineBold(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

function renderLiteMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let currentList: string[] = [];
  let textLines: string[] = [];

  const flushList = () => {
    if (currentList.length === 0) return;
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="my-1 ml-4 list-decimal space-y-0.5">
        {currentList.map((item, i) => (
          <li key={i}>{renderInlineBold(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ol>,
    );
    currentList = [];
  };

  const flushText = () => {
    if (textLines.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="whitespace-pre-wrap">
        {renderInlineBold(textLines.join("\n"), `p-${blocks.length}`)}
      </p>,
    );
    textLines = [];
  };

  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s+(.*)$/);
    if (match) {
      flushText();
      currentList.push(match[1]);
    } else {
      flushList();
      textLines.push(line);
    }
  }
  flushText();
  flushList();

  return <>{blocks}</>;
}

// ---------------------------------------------------------------------------
// GeneratingProgress
// ---------------------------------------------------------------------------

const PROGRESS_STEPS = [
  { at:  0, label: "Analizando tu Knowledge Base…",    dot: "bg-violet-400" },
  { at: 17, label: "Creando estrategia de contenido…", dot: "bg-indigo-400" },
  { at: 34, label: "Generando posts…",                 dot: "bg-blue-400"   },
  { at: 52, label: "Optimizando hashtags y CTAs…",     dot: "bg-fuchsia-400"},
  { at: 70, label: "Generando imágenes con IA…",       dot: "bg-pink-400"   },
  { at: 87, label: "Preparando tu campaña…",           dot: "bg-emerald-400"},
] as const;

const PROVIDER_ICON: Record<string, string> = {
  INSTAGRAM: "IG",
  LINKEDIN: "LI",
  FACEBOOK_PAGE: "FB",
  TIKTOK: "TT",
};

const PROVIDER_COLOR: Record<string, string> = {
  INSTAGRAM: "bg-rose-500/20 text-rose-300",
  LINKEDIN: "bg-sky-500/20 text-sky-300",
  FACEBOOK_PAGE: "bg-blue-500/20 text-blue-300",
  TIKTOK: "bg-white/10 text-white/60",
};

function GeneratingProgress({ params }: { params?: CampaignParams }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const totalMs = 62_000;
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / totalMs, 1);
      setProgress(Math.min((1 - Math.pow(1 - t, 2.4)) * 95, 95));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const step = [...PROGRESS_STEPS].reverse().find((s) => progress >= s.at) ?? PROGRESS_STEPS[0];
  const pct = Math.round(progress);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-fuchsia-500/5 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
          <svg className="h-[18px] w-[18px] animate-spin text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90">{step.label}</p>
          {params?.dateLabel || params?.provider ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {params.provider && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${PROVIDER_COLOR[params.provider] ?? "bg-white/10 text-white/60"}`}>
                  {PROVIDER_ICON[params.provider] ?? params.provider} · {params.frequencyPerWeek ?? "?"} posts
                </span>
              )}
              {params.dateLabel && (
                <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] text-white/40">
                  {params.dateLabel}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/35">La IA está trabajando en tu campaña personalizada</p>
          )}
        </div>
        <span className="shrink-0 font-mono text-lg font-bold text-white/50">{pct}%</span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-400 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {progress > 0 && (
          <div className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${progress}%` }}>
            <div className="progress-sweep h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-1">
        {PROGRESS_STEPS.map((s, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${progress >= s.at ? s.dot + " shadow-[0_0_4px_1px_currentColor]" : "bg-white/12"}`} />
            <span className={`hidden text-[9px] leading-none sm:block transition-colors duration-300 ${progress >= s.at ? "text-white/50" : "text-white/15"}`}>
              {s.label.replace("…", "").split(" ").slice(-1)[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostThumbnail — Instagram-style square tile
// ---------------------------------------------------------------------------

// Hardcoded so Tailwind's scanner sees the full class names
const THUMB_GRADIENTS = [
  "from-violet-900 to-fuchsia-900",
  "from-blue-900 to-indigo-900",
  "from-rose-900 to-pink-900",
  "from-emerald-900 to-teal-900",
  "from-amber-900 to-orange-900",
  "from-sky-900 to-cyan-900",
] as const;

const STATUS_RING: Record<string, string> = {
  APPROVED:  "ring-emerald-400/70",
  SCHEDULED: "ring-amber-400/60",
  IN_REVIEW: "ring-amber-400/50",
  REJECTED:  "ring-rose-400/60",
  POSTED:    "ring-violet-400/70",
  PUBLISHED: "ring-violet-400/70",
  IDEA:      "ring-white/8",
  DRAFT:     "ring-white/8",
};

const STATUS_DOT: Record<string, string> = {
  APPROVED:  "bg-emerald-400",
  SCHEDULED: "bg-amber-400",
  IN_REVIEW: "bg-amber-300",
  REJECTED:  "bg-rose-400",
  POSTED:    "bg-violet-400",
  PUBLISHED: "bg-violet-400",
  IDEA:      "bg-white/20",
  DRAFT:     "bg-white/20",
};

function PostThumbnail({ post, index, onClick }: { post: SocialPost; index: number; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const hasImage = !!post.imageHint && !imageError;
  const gradient = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
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
        <div className={`h-full w-full bg-gradient-to-br ${gradient} flex flex-col items-start justify-end p-2.5`}>
          <p className="line-clamp-3 text-left text-[10px] leading-snug text-white/55">{post.title}</p>
        </div>
      )}
      {/* Post number */}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm">
        {index + 1}
      </span>
      {/* Status dot */}
      <span className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ${dot} ring-1 ring-black/40`} />
      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-150 group-hover:bg-black/45">
        <svg className="h-7 w-7 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// PostModal — full-screen overlay with image + content + actions
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  IDEA:      "bg-white/8 text-white/40",
  DRAFT:     "bg-white/8 text-white/40",
  IN_REVIEW: "bg-amber-500/15 text-amber-300",
  SCHEDULED: "bg-amber-500/15 text-amber-300",
  APPROVED:  "bg-emerald-500/15 text-emerald-300",
  REJECTED:  "bg-rose-500/15 text-rose-300",
  POSTED:    "bg-violet-500/15 text-violet-300",
  PUBLISHED: "bg-violet-500/15 text-violet-300",
};

const STATUS_LABEL: Record<string, string> = {
  IDEA:      "Idea",
  DRAFT:     "Borrador",
  IN_REVIEW: "En revisión",
  SCHEDULED: "Programado",
  APPROVED:  "Aprobado",
  REJECTED:  "Rechazado",
  POSTED:    "Publicado",
  PUBLISHED: "Publicado",
};

function PostModal({
  post,
  index,
  isRegenerating,
  onClose,
  onPostUpdate,
  onAction,
  onRegenerate,
  onRequestChange,
}: {
  post: SocialPost;
  index: number;
  isRegenerating: boolean;
  onClose: () => void;
  onPostUpdate: (post: SocialPost) => void;
  onAction: (action: "approve" | "reject" | "schedule", id: string, scheduledAt?: string) => void;
  onRegenerate: (id: string) => Promise<void>;
  onRequestChange: (id: string, instruction: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [changing, setChanging] = useState(false);
  const [regening, setRegening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageHint ?? null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [draft, setDraft] = useState<EditDraft>({
    title: post.title ?? "",
    body: post.body ?? "",
    hook: post.metadata?.angle ?? post.metadata?.hook ?? "",
    cta: post.metadata?.callToAction ?? post.metadata?.cta ?? "",
    hashtags: (post.metadata?.hashtags ?? []).join(" "),
    scheduledAt: post.scheduledAt ?? "",
  });

  const hashtags = post.metadata?.hashtags ?? [];
  const isBusy = isRegenerating || regening || saving || changing || generatingImage;
  const isFinished = ["POSTED", "PUBLISHED"].includes(post.status);

  // Sync draft when post updates externally (e.g. after regeneration)
  useEffect(() => {
    if (!editing) {
      setDraft({
        title: post.title ?? "",
        body: post.body ?? "",
        hook: post.metadata?.angle ?? post.metadata?.hook ?? "",
        cta: post.metadata?.callToAction ?? post.metadata?.cta ?? "",
        hashtags: (post.metadata?.hashtags ?? []).join(" "),
        scheduledAt: post.scheduledAt ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

  // Sync image when post imageHint changes
  useEffect(() => {
    if (post.imageHint) {
      setImageUrl(post.imageHint);
      setImageLoadError(false);
    }
  }, [post.imageHint]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function saveEdits() {
    setSaving(true);
    setSaveError(null);
    try {
      const newHashtags = draft.hashtags.split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "socialflow",
          id: post.id,
          title: draft.title,
          body: draft.body,
          metadata: { angle: draft.hook, callToAction: draft.cta, hashtags: newHashtags },
          scheduledAt: draft.scheduledAt || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "No se pudo guardar");
      }
      onPostUpdate({
        ...post,
        title: draft.title,
        body: draft.body,
        scheduledAt: draft.scheduledAt || null,
        metadata: { ...post.metadata, angle: draft.hook, callToAction: draft.cta, hashtags: newHashtags },
      });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function submitChange() {
    if (!changeText.trim() || changing) return;
    setChanging(true);
    try {
      await onRequestChange(post.id, changeText.trim());
      setChangeMode(false);
      setChangeText("");
    } finally {
      setChanging(false);
    }
  }

  async function handleRegen() {
    setRegening(true);
    try {
      await onRegenerate(post.id);
    } finally {
      setRegening(false);
    }
  }

  async function handleGenerateImage() {
    setGeneratingImage(true);
    setImageLoadError(false);
    try {
      const res = await fetch(`/api/socialflow/posts/${post.id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow" }),
      });
      const json = (await res.json()) as { ok: boolean; imageUrl?: string };
      if (json.ok && json.imageUrl) {
        setImageUrl(json.imageUrl);
        onPostUpdate({ ...post, imageHint: json.imageUrl });
      }
    } catch {
      // non-critical
    } finally {
      setGeneratingImage(false);
    }
  }

  const hasImage = !!imageUrl && !imageLoadError;

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
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Two-column layout on md+ */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">

          {/* Left: image */}
          <div className="relative flex h-52 shrink-0 items-center justify-center bg-black/30 md:h-auto md:w-5/12">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl!} alt={post.title} className="h-full w-full object-cover" onError={() => setImageLoadError(true)} />
            ) : (
              <div className="flex flex-col items-center gap-3 p-6">
                {generatingImage ? (
                  <>
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
                    <span className="text-xs text-white/30">Generando imagen…</span>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy && !generatingImage}
                    onClick={() => void handleGenerateImage()}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/40 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-40"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Generar imagen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: content + footer */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* Header */}
              <div className="mb-3 flex items-start gap-2 pr-8">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Post {index + 1}</p>
                  {editing ? (
                    <input
                      className={inputCls + " mt-1"}
                      value={draft.title}
                      onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Título"
                    />
                  ) : (
                    <h2 className="mt-0.5 text-base font-semibold leading-snug text-white/90">{post.title}</h2>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[post.status] ?? "bg-white/8 text-white/40"}`}>
                  {STATUS_LABEL[post.status] ?? post.status}
                </span>
              </div>

              {/* Regen indicator */}
              {(isRegenerating || regening) && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                  <span className="h-3 w-3 animate-spin rounded-full border border-violet-400/40 border-t-violet-400" />
                  Regenerando post…
                </div>
              )}

              {/* Body */}
              {editing ? (
                <div className="space-y-2.5">
                  <textarea className={inputCls} rows={6} value={draft.body} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} placeholder="Texto del post" />
                  <input className={inputCls} value={draft.hook} onChange={(e) => setDraft((p) => ({ ...p, hook: e.target.value }))} placeholder="Ángulo / Hook" />
                  <input className={inputCls} value={draft.cta} onChange={(e) => setDraft((p) => ({ ...p, cta: e.target.value }))} placeholder="CTA" />
                  <input className={inputCls} value={draft.hashtags} onChange={(e) => setDraft((p) => ({ ...p, hashtags: e.target.value }))} placeholder="Hashtags separados por espacio o coma" />
                  <input type="datetime-local" className={inputCls} value={draft.scheduledAt} onChange={(e) => setDraft((p) => ({ ...p, scheduledAt: e.target.value }))} />
                  {saveError && <p className="text-xs text-red-300">{saveError}</p>}
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{post.body}</p>
                  {hashtags.length > 0 && (
                    <p className="mt-3 text-xs leading-relaxed text-violet-300/70">
                      {hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                    </p>
                  )}
                  {post.scheduledAt && (
                    <p className="mt-2 text-[11px] text-white/30">
                      Programado: {new Date(post.scheduledAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </>
              )}

              {/* Change-request panel */}
              {changeMode && !editing && (
                <div className="mt-4 space-y-2">
                  <textarea
                    rows={2}
                    autoFocus
                    className={inputCls}
                    placeholder='ej. "hazlo más motivacional" o "acórtalo a 3 líneas"'
                    value={changeText}
                    onChange={(e) => setChangeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitChange(); }
                    }}
                  />
                  <div className="flex gap-2">
                    <button type="button" disabled={!changeText.trim() || changing} onClick={() => void submitChange()} className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50">
                      {changing ? "Aplicando…" : "Aplicar cambio"}
                    </button>
                    <button type="button" onClick={() => { setChangeMode(false); setChangeText(""); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition hover:text-white/60">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="shrink-0 border-t border-white/8 px-5 py-4">
              {editing ? (
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => void saveEdits()} className="flex-1 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50">
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/40 transition hover:text-white/60">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Primary CTA — always visible */}
                  {["APPROVED", "SCHEDULED"].includes(post.status) ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 py-2.5 text-sm font-bold text-emerald-400/60">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {post.status === "SCHEDULED" ? "Programado" : "Aprobado"}
                    </div>
                  ) : ["POSTED", "PUBLISHED"].includes(post.status) ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/8 py-2.5 text-sm font-bold text-violet-400/60">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Publicado
                    </div>
                  ) : post.status !== "REJECTED" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onAction("approve", post.id)}
                      className="w-full rounded-xl border border-emerald-500/50 bg-emerald-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isBusy ? "…" : "✓ Aprobar"}
                    </button>
                  ) : null}

                  {/* Secondary actions */}
                  <div className="flex flex-wrap gap-2">
                    {!["REJECTED", "POSTED", "PUBLISHED"].includes(post.status) && (
                      <button type="button" disabled={isBusy} onClick={() => onAction("reject", post.id)} className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50">
                        Rechazar
                      </button>
                    )}
                    {!isFinished && (
                      <>
                        <button type="button" disabled={isBusy} onClick={() => { setEditing(true); setChangeMode(false); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition hover:border-violet-500/25 hover:text-violet-300 disabled:opacity-50">
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => { setChangeMode((v) => !v); setEditing(false); }}
                          className={`rounded-xl border px-3 py-1.5 text-xs transition disabled:opacity-50 ${changeMode ? "border-violet-500/30 bg-violet-500/10 text-violet-300" : "border-white/10 bg-white/5 text-white/50 hover:border-violet-500/25 hover:text-violet-300"}`}
                        >
                          Pedir cambio
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => void handleRegen()} className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50">
                          {regening ? "…" : "Regenerar"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const WELCOME_CARDS: ActionCard[] = [
  { icon: "🔥", label: "Ver qué está viral en mi nicho ahora", message: "Ver qué está viral en mi nicho ahora" },
  { icon: "💡", label: "Dame 3 ideas para crear hoy", message: "Dame 3 ideas para crear hoy" },
  // El texto que se envía (no el label visible) evita a propósito las palabras de
  // GENERATE_KEYWORDS_ES ("crea"/"crear") — si no, estas dos tarjetas disparaban una
  // campaña semanal completa en vez de la intención "ideas" (una sola pieza puntual).
  { icon: "🎬", label: "Crear un vídeo con guion incluido", message: "dame ideas para un vídeo viral hoy" },
  { icon: "📸", label: "Crear una imagen con texto", message: "dame ideas para una imagen con texto hoy" },
];

export default function SocialFlowAIPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hola, soy tu asistente creativo. He cargado tu Knowledge Base y perfil de marca.\n\n¿Qué creamos hoy?",
      actionCards: WELCOME_CARDS,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lastIdeas, setLastIdeas] = useState<IdeaSuggestion[] | null>(null);
  const [regenLoading, setRegenLoading] = useState<Set<string>>(new Set());
  const [publishingMsgId, setPublishingMsgId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeImageContext, setActiveImageContext] = useState<ImageChatContext | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Load last ACTIVE or GENERATING campaign on mount
  useEffect(() => {
    async function loadLastCampaign() {
      try {
        const res = await fetch("/api/socialflow/campaigns?saasId=socialflow");
        const json = (await res.json()) as { items?: { id: string; status: string; name: string; notes: string | null }[] };
        const campaigns = json.items ?? [];
        const last = campaigns.find((c) => c.status === "ACTIVE" || c.status === "GENERATING");
        if (!last) return;

        const msgId = `restore_${last.id}`;

        if (last.status === "ACTIVE") {
          const postsRes = await fetch(`/api/socialflow/posts?saasId=socialflow&campaignId=${last.id}`);
          const postsJson = (await postsRes.json()) as { items?: SocialPost[] };
          const posts = postsJson.items ?? [];
          if (posts.length === 0) return;
          setMessages((prev) => [
            ...prev,
            {
              id: msgId,
              role: "bot" as const,
              content: `📂 Campaña restaurada: ${last.name} — ${posts.length} post${posts.length !== 1 ? "s" : ""} listos para revisar.`,
              campaignId: last.id,
              posts,
              generatingStatus: "done" as const,
            },
          ]);
        } else {
          // GENERATING — show progress and resume polling
          setMessages((prev) => [
            ...prev,
            {
              id: msgId,
              role: "bot" as const,
              content: `Retomando generación de "${last.name}"…`,
              campaignId: last.id,
              generatingStatus: "polling" as const,
            },
          ]);

          const poll = async () => {
            try {
              const [cRes, pRes] = await Promise.all([
                fetch("/api/socialflow/campaigns?saasId=socialflow"),
                fetch(`/api/socialflow/posts?saasId=socialflow&campaignId=${last.id}`),
              ]);
              const cJson = (await cRes.json()) as { items?: { id: string; status: string; notes: string | null }[] };
              const pJson = (await pRes.json()) as { items?: SocialPost[] };
              const campaign = cJson.items?.find((c) => c.id === last.id);
              if (!campaign) return;
              const posts = pJson.items ?? [];
              if (campaign.status === "ACTIVE" && posts.length > 0) {
                clearInterval(pollRefs.current[last.id]);
                delete pollRefs.current[last.id];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id !== msgId ? m : {
                      ...m,
                      content: `✅ Campaña lista con ${posts.length} post${posts.length !== 1 ? "s" : ""}.`,
                      posts,
                      generatingStatus: "done" as const,
                    },
                  ),
                );
              } else if (campaign.status === "FAILED") {
                clearInterval(pollRefs.current[last.id]);
                delete pollRefs.current[last.id];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id !== msgId ? m : {
                      ...m,
                      content: `❌ La generación falló: ${campaign.notes ?? "Error desconocido"}.`,
                      generatingStatus: "error" as const,
                    },
                  ),
                );
              }
            } catch {
              // keep polling
            }
          };

          void poll();
          pollRefs.current[last.id] = setInterval(() => void poll(), 5000);
        }
      } catch {
        // non-critical
      }
    }
    void loadLastCampaign();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function stopPoll(campaignId: string) {
    if (pollRefs.current[campaignId]) {
      clearInterval(pollRefs.current[campaignId]);
      delete pollRefs.current[campaignId];
    }
  }

  useEffect(() => {
    const refs = pollRefs.current;
    return () => { Object.keys(refs).forEach((id) => clearInterval(refs[id])); };
  }, []);

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function updatePostInMessages(updatedPost: SocialPost) {
    setMessages((prev) =>
      prev.map((m) => {
        if (!m.posts?.some((p) => p.id === updatedPost.id)) return m;
        return { ...m, posts: m.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p)) };
      }),
    );
  }

  async function pollCampaign(campaignId: string, messageId: string) {
    try {
      const [campaignRes, postsRes] = await Promise.all([
        fetch(`/api/socialflow/campaigns?saasId=socialflow`),
        fetch(`/api/socialflow/posts?saasId=socialflow&campaignId=${campaignId}`),
      ]);
      const campaignJson = (await campaignRes.json()) as { items?: { id: string; status: string; notes: string | null }[] };
      const postsJson = (await postsRes.json()) as { items?: SocialPost[] };
      const campaign = campaignJson.items?.find((c) => c.id === campaignId);
      if (!campaign) return;
      const posts = postsJson.items ?? [];
      if (campaign.status === "ACTIVE" && posts.length > 0) {
        stopPoll(campaignId);
        updateMessage(messageId, {
          content: `✅ Campaña lista con ${posts.length} post${posts.length !== 1 ? "s" : ""}. Toca un post para ver detalles y acciones.`,
          posts,
          generatingStatus: "done",
        });
      } else if (campaign.status === "FAILED") {
        stopPoll(campaignId);
        updateMessage(messageId, {
          content: `❌ La generación falló: ${campaign.notes ?? "Error desconocido"}. Inténtalo de nuevo.`,
          generatingStatus: "error",
        });
      }
    } catch {
      // transient — keep polling
    }
  }

  function startPoll(campaignId: string, messageId: string) {
    stopPoll(campaignId);
    void pollCampaign(campaignId, messageId);
    pollRefs.current[campaignId] = setInterval(() => void pollCampaign(campaignId, messageId), 5000);
  }

  async function handlePostAction(action: "approve" | "reject" | "schedule", postId: string, scheduledAt?: string) {
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", id: postId, action, scheduledAt: scheduledAt ?? null }),
      });
      const json = (await res.json().catch(() => null)) as { post?: SocialPost } | null;
      if (json?.post) {
        updatePostInMessages(json.post);
      } else {
        const newStatus = action === "approve" ? "SCHEDULED" : action === "reject" ? "REJECTED" : "SCHEDULED";
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.posts?.some((p) => p.id === postId)) return m;
            return { ...m, posts: m.posts.map((p) => (p.id === postId ? { ...p, status: newStatus } : p)) };
          }),
        );
      }
    } catch {
      // non-critical
    }
  }

  async function handleRegenerate(postId: string): Promise<void> {
    setRegenLoading((prev) => new Set([...prev, postId]));
    try {
      const res = await fetch("/api/socialflow/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", postId }),
      });
      const json = (await res.json()) as { ok: boolean; post?: SocialPost };
      if (json.ok && json.post) updatePostInMessages(json.post);
    } catch {
      // non-critical
    } finally {
      setRegenLoading((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    }
  }

  async function handleRequestChange(postId: string, instruction: string): Promise<void> {
    setRegenLoading((prev) => new Set([...prev, postId]));
    try {
      const res = await fetch("/api/socialflow/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", postId, instruction }),
      });
      const json = (await res.json()) as { ok: boolean; post?: SocialPost };
      if (json.ok && json.post) updatePostInMessages(json.post);
    } catch {
      // non-critical
    } finally {
      setRegenLoading((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    }
  }

  async function handlePublishApproved(messageId: string, posts: SocialPost[]) {
    const approved = posts.filter((p) => p.status === "APPROVED");
    if (approved.length === 0) return;
    setPublishingMsgId(messageId);
    const nowMs = Date.now();
    const MS_PER_DAY = 86_400_000;
    let dayOffset = 1;
    try {
      await Promise.allSettled(
        approved.map(async (post) => {
          const scheduledAt = post.scheduledAt ?? new Date(nowMs + dayOffset++ * MS_PER_DAY).toISOString().slice(0, 16) + ":00";
          await fetch("/api/socialflow/posts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ saasId: "socialflow", id: post.id, action: "schedule", scheduledAt }),
          });
        }),
      );
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.posts) return m;
          return { ...m, posts: m.posts.map((p) => (p.status === "APPROVED" ? { ...p, status: "SCHEDULED" } : p)) };
        }),
      );
    } finally {
      setPublishingMsgId(null);
    }
  }

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || thinking) return;

    const modifyMatch = extractModifyRequest(text);
    if (modifyMatch) {
      const { postNumber, instruction } = modifyMatch;
      const targetMsg = [...messages].reverse().find((m) => m.posts && m.posts.length >= postNumber);
      if (targetMsg?.posts) {
        const targetPost = targetMsg.posts[postNumber - 1];
        if (targetPost) {
          const userMsgId = `u_${Date.now()}`;
          const botMsgId = `b_${Date.now()}`;
          setInput("");
          setThinking(true);
          setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: "user", content: text },
            { id: botMsgId, role: "bot", content: `Aplicando cambio al post ${postNumber}…`, generatingStatus: "polling" },
          ]);
          try {
            await handleRequestChange(targetPost.id, instruction);
            updateMessage(botMsgId, { content: `✅ Post ${postNumber} actualizado.`, generatingStatus: "done" });
          } finally {
            setThinking(false);
          }
          return;
        }
      }
    }

    const userMsgId = `u_${Date.now()}`;
    const botMsgId = `b_${Date.now()}`;
    const imgCtxAtSend = activeImageContext;
    setInput("");
    setThinking(true);
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
      { id: botMsgId, role: "bot", content: "…", generatingStatus: "polling" },
    ]);

    try {
      const res = await fetch("/api/socialflow/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          saasId: "socialflow",
          lastIdeas,
          ...(imgCtxAtSend
            ? {
                imageKey: imgCtxAtSend.imageKey,
                imageAnalysis: imgCtxAtSend.imageAnalysis,
                imageConversation: imgCtxAtSend.conversation,
              }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        action?: string;
        reply?: string;
        caption?: string;
        campaignId?: string;
        error?: string;
        message?: string;
        params?: CampaignParams;
        ideas?: IdeaSuggestion[];
        handoff?: { href: string };
      };
      if (!json.ok) {
        updateMessage(botMsgId, { content: json.message ?? json.error ?? "Ocurrió un error. Inténtalo de nuevo.", generatingStatus: "error" });
        return;
      }
      if (imgCtxAtSend) {
        // Conversación sobre una imagen adjunta — el turno se acumula en el contexto
        // en vez de tocar lastIdeas/campaignId, para que el siguiente ajuste ("más
        // corto", "cambia el emoji") siga teniendo el análisis visual disponible.
        const reply = json.reply ?? "¿Qué más te gustaría ajustar?";
        const caption = json.caption ?? reply;
        updateMessage(botMsgId, {
          content: reply,
          generatingStatus: "done",
          publishOptions: {
            title: deriveTitleFromCaption(caption),
            body: caption,
            imageHint: imgCtxAtSend.imageUrl,
            contentType: imgCtxAtSend.imageAnalysis.recommendedPostType,
          },
          publishState: "idle",
        });
        setActiveImageContext((prev) =>
          prev && prev.imageKey === imgCtxAtSend.imageKey
            ? { ...prev, lastCaption: caption, conversation: [...prev.conversation, { role: "user", content: text }, { role: "assistant", content: reply }] }
            : prev,
        );
      } else if (json.action === "generating" && json.campaignId) {
        setLastIdeas(null);
        updateMessage(botMsgId, { content: json.reply ?? "Generando tu campaña… te aviso cuando esté lista.", campaignId: json.campaignId, generatingStatus: "polling", params: json.params });
        startPoll(json.campaignId, botMsgId);
      } else if (json.action === "ideas") {
        setLastIdeas(json.ideas ?? null);
        updateMessage(botMsgId, { content: json.reply ?? "¿En qué más puedo ayudarte?", generatingStatus: "done" });
      } else if (json.action === "handoff_carousel" && json.handoff?.href) {
        setLastIdeas(null);
        updateMessage(botMsgId, { content: json.reply ?? "Te llevo a Crear Carrusel…", generatingStatus: "done" });
        router.push(json.handoff.href);
      } else {
        setLastIdeas(null);
        updateMessage(botMsgId, { content: json.reply ?? "¿En qué más puedo ayudarte?", generatingStatus: "done" });
      }
    } catch {
      updateMessage(botMsgId, { content: "Error de conexión. Por favor inténtalo de nuevo.", generatingStatus: "error" });
    } finally {
      setThinking(false);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || thinking || uploadingAttachment) return;

    const attachmentType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    const previewUrl = URL.createObjectURL(file);
    const userMsgId = `u_${Date.now()}`;
    const botMsgId = `b_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: "", attachment: { url: previewUrl, type: attachmentType } },
      { id: botMsgId, role: "bot", content: "Subiendo archivo…", generatingStatus: "polling" },
    ]);
    setUploadingAttachment(true);
    setThinking(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const uploadJson = (await uploadRes.json().catch(() => null)) as
        | { url?: string; key?: string; error?: string; message?: string }
        | null;
      if (!uploadRes.ok || !uploadJson?.url || !uploadJson.key) {
        updateMessage(botMsgId, { content: uploadJson?.message ?? "No se pudo subir el archivo. Inténtalo de nuevo.", generatingStatus: "error" });
        return;
      }

      updateMessage(botMsgId, { content: "Analizando imagen…" });

      const analyzeRes = await fetch("/api/socialflow/posts/generate-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadJson.url, imageKey: uploadJson.key, saasId: "socialflow", mode: "analyze" }),
      });
      const analyzeJson = (await analyzeRes.json().catch(() => null)) as
        | { imageAnalysis?: ImageAnalysis; message?: string }
        | null;
      if (!analyzeRes.ok || !analyzeJson?.imageAnalysis) {
        updateMessage(botMsgId, { content: analyzeJson?.message ?? "No se pudo analizar la imagen. Inténtalo de nuevo.", generatingStatus: "error" });
        return;
      }

      const newContext: ImageChatContext = {
        imageKey: uploadJson.key,
        imageUrl: uploadJson.url,
        imageAnalysis: analyzeJson.imageAnalysis,
        conversation: [],
        lastCaption: "",
      };

      const autoMessage = "Analiza esta imagen y dime qué contenido puedo crear.";
      const chatRes = await fetch("/api/socialflow/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: autoMessage,
          saasId: "socialflow",
          imageKey: newContext.imageKey,
          imageAnalysis: newContext.imageAnalysis,
          imageConversation: [],
        }),
      });
      const chatJson = (await chatRes.json().catch(() => null)) as
        | { ok?: boolean; reply?: string; caption?: string; message?: string; error?: string }
        | null;
      if (!chatJson?.ok) {
        updateMessage(botMsgId, { content: chatJson?.message ?? chatJson?.error ?? "No se pudo generar el texto para esta imagen.", generatingStatus: "error" });
        return;
      }

      const reply = chatJson.reply ?? "¿Qué te gustaría publicar con esta imagen?";
      const caption = chatJson.caption ?? reply;
      updateMessage(botMsgId, {
        content: reply,
        generatingStatus: "done",
        publishOptions: {
          title: deriveTitleFromCaption(caption),
          body: caption,
          imageHint: newContext.imageUrl,
          contentType: newContext.imageAnalysis.recommendedPostType,
        },
        publishState: "idle",
      });
      setActiveImageContext({
        ...newContext,
        lastCaption: caption,
        conversation: [{ role: "user", content: autoMessage }, { role: "assistant", content: reply }],
      });
    } catch {
      updateMessage(botMsgId, { content: "Error de conexión al subir el archivo. Inténtalo de nuevo.", generatingStatus: "error" });
    } finally {
      setUploadingAttachment(false);
      setThinking(false);
    }
  }

  async function handlePublishAction(msgId: string, publishAction: "now" | "schedule") {
    const target = messages.find((m) => m.id === msgId);
    if (!target?.publishOptions || target.publishState === "working" || thinking) return;

    updateMessage(msgId, { publishState: "working" });
    setThinking(true);
    try {
      const res = await fetch("/api/socialflow/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: publishAction === "now" ? "Publicar ahora" : "Programar en el mejor momento",
          saasId: "socialflow",
          publishAction,
          pendingPost: target.publishOptions,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; action?: string; reply?: string; message?: string; error?: string }
        | null;
      if (!json?.ok) {
        updateMessage(msgId, { publishState: "error" });
        setMessages((prev) => [
          ...prev,
          {
            id: `b_${Date.now()}`,
            role: "bot",
            content: json?.message ?? json?.error ?? "No se pudo completar la acción. Inténtalo de nuevo.",
            generatingStatus: "error",
          },
        ]);
        return;
      }
      updateMessage(msgId, {
        publishState: "idle",
        publishResult: {
          action: json.action === "scheduled" ? "scheduled" : "published",
          reply: json.reply ?? "Listo.",
        },
      });
      setActiveImageContext(null);
    } catch {
      updateMessage(msgId, { publishState: "error" });
      setMessages((prev) => [
        ...prev,
        { id: `b_${Date.now()}`, role: "bot", content: "Error de conexión. Inténtalo de nuevo.", generatingStatus: "error" },
      ]);
    } finally {
      setThinking(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  // Solo el mensaje con publishOptions MÁS RECIENTE muestra los botones de publicar —
  // evita botones obsoletos en turnos anteriores de la misma conversación de imagen.
  const latestPublishableId = [...messages].reverse().find((m) => m.publishOptions)?.id;

  // Derive selected post + its index from messages
  let selectedPost: SocialPost | null = null;
  let selectedPostIndex = 0;
  if (selectedPostId) {
    outer: for (const m of messages) {
      if (!m.posts) continue;
      for (let i = 0; i < m.posts.length; i++) {
        if (m.posts[i].id === selectedPostId) {
          selectedPost = m.posts[i];
          selectedPostIndex = i;
          break outer;
        }
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 border-b border-white/5 px-5 py-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-black text-white">
          SF
        </div>
        <span className="text-sm font-medium text-white/50">¿Qué creo hoy?</span>
      </div>

      {/* Messages — scrollable */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="py-8">
          {messages.map((msg) => {
            const approvedPosts = msg.posts?.filter((p) => p.status === "APPROVED") ?? [];
            const canPublish = approvedPosts.length > 0 && msg.generatingStatus === "done";

            if (msg.role === "user") {
              return (
                <div key={msg.id} className="mb-6 flex justify-end px-4 md:px-8">
                  <div className="max-w-[72%] space-y-2">
                    {msg.attachment && (
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        {msg.attachment.type === "video" ? (
                          <video src={msg.attachment.url} className="max-h-64 w-full object-cover" controls />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={msg.attachment.url} alt="Adjunto" className="max-h-64 w-full object-cover" />
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="rounded-2xl bg-violet-500/15 px-4 py-3 text-sm leading-relaxed text-white/90">
                        {msg.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="mb-8">
                <div className="flex items-start gap-3 px-4 md:px-8">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-black text-white">
                    SF
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {msg.content === "…" && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                      </div>
                    )}
                    {msg.content !== "…" && (
                      <div className="text-sm leading-relaxed text-white/80">{renderLiteMarkdown(msg.content)}</div>
                    )}
                    {msg.actionCards && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {msg.actionCards.map((card) => (
                          <button
                            key={card.label}
                            type="button"
                            disabled={thinking}
                            onClick={() => void sendMessage(card.message)}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white/80 transition hover:border-violet-500/40 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="text-base">{card.icon}</span>
                            {card.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.generatingStatus === "polling" && msg.content !== "…" && (
                      <GeneratingProgress key={msg.id} params={msg.params} />
                    )}
                    {msg.publishOptions && msg.id === latestPublishableId && !msg.publishResult && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={thinking || msg.publishState === "working"}
                          onClick={() => void handlePublishAction(msg.id, "now")}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {msg.publishState === "working" ? "…" : "📤 Publicar ahora"}
                        </button>
                        <button
                          type="button"
                          disabled={thinking || msg.publishState === "working"}
                          onClick={() => void handlePublishAction(msg.id, "schedule")}
                          className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          📅 Programar en el mejor momento
                        </button>
                        {msg.publishState === "error" && (
                          <span className="flex items-center text-xs text-rose-300">No se pudo completar. Reintenta.</span>
                        )}
                      </div>
                    )}
                    {msg.publishResult && (
                      <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-200">
                        <p>{msg.publishResult.reply}</p>
                        <Link href="/socialflow/plan" className="mt-1 inline-block font-semibold text-emerald-300 underline hover:text-emerald-200">
                          Ver en el calendario
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Instagram-style grid */}
                {msg.posts && msg.posts.length > 0 && (
                  <div className="mt-4 px-4 md:px-8">
                    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:gap-1.5">
                      {msg.posts.map((post, idx) => (
                        <PostThumbnail
                          key={post.id}
                          post={post}
                          index={idx}
                          onClick={() => setSelectedPostId(post.id)}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[10px] text-white/25">
                      Toca un post para ver detalles y acciones
                    </p>
                  </div>
                )}

                {/* Publish approved */}
                {canPublish && (
                  <div className="mt-3 px-4 md:px-8">
                    <button
                      type="button"
                      disabled={publishingMsgId === msg.id}
                      onClick={() => void handlePublishApproved(msg.id, msg.posts ?? [])}
                      className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {publishingMsgId === msg.id ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-400/40 border-t-emerald-400" />
                          Programando…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Publicar campaña aprobada ({approvedPosts.length} post{approvedPosts.length !== 1 ? "s" : ""})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/5 px-4 py-4 md:px-8">
        <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/15">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4"
            hidden
            onChange={(e) => void handleFileSelected(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={thinking || uploadingAttachment}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:border-violet-500/30 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Adjuntar foto o vídeo"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/25 outline-none"
            placeholder='Escribe tu solicitud… ej. "Crea 5 posts sobre fitness esta semana"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!input.trim() || thinking}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/20">
          El asistente lee tu Knowledge Base · Enter para enviar
        </p>
      </div>

      {/* Post detail modal */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          index={selectedPostIndex}
          isRegenerating={regenLoading.has(selectedPost.id)}
          onClose={() => setSelectedPostId(null)}
          onPostUpdate={updatePostInMessages}
          onAction={handlePostAction}
          onRegenerate={handleRegenerate}
          onRequestChange={handleRequestChange}
        />
      )}
    </div>
  );
}
