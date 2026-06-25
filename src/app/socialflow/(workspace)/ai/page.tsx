"use client";

import { useEffect, useRef, useState } from "react";

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

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
  campaignId?: string;
  posts?: SocialPost[];
  generatingStatus?: "polling" | "done" | "error";
};

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
  // "cambia el post 3 hazlo...", "modifica el post número 3", "cambia el 3 a..."
  const m1 = text.match(/(?:cambia|modifica|mejora|actualiza|hazlo|hazla|regenera)\s+(?:el\s+)?(?:post\s+)?(?:n[uú]mero\s+)?#?(\d+)/i);
  if (m1) return { postNumber: parseInt(m1[1]), instruction: text };
  // "post 3: hazlo...", "post #3, ponlo..."
  const m2 = text.match(/post\s+#?(\d+)\s*[,:]/i);
  if (m2) return { postNumber: parseInt(m2[1]), instruction: text };
  return null;
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------

function PostCard({
  post,
  isRegenerating,
  onAction,
  onRegenerate,
  onRequestChange,
}: {
  post: SocialPost;
  isRegenerating: boolean;
  onAction: (action: "approve" | "reject" | "schedule", id: string, scheduledAt?: string) => void;
  onRegenerate: (id: string) => Promise<void>;
  onRequestChange: (id: string, instruction: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [changing, setChanging] = useState(false);
  const [regening, setRegening] = useState(false);
  const [draft, setDraft] = useState<EditDraft>({
    title: post.title ?? "",
    body: post.body ?? "",
    hook: post.metadata?.angle ?? post.metadata?.hook ?? "",
    cta: post.metadata?.callToAction ?? post.metadata?.cta ?? "",
    hashtags: (post.metadata?.hashtags ?? []).join(" "),
    scheduledAt: post.scheduledAt ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageHint ?? null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const hashtags = post.metadata?.hashtags ?? [];

  const statusColors: Record<string, string> = {
    IDEA: "bg-white/8 text-white/40",
    DRAFT: "bg-white/8 text-white/40",
    IN_REVIEW: "bg-amber-500/15 text-amber-300",
    SCHEDULED: "bg-amber-500/15 text-amber-300",
    APPROVED: "bg-emerald-500/15 text-emerald-300",
    REJECTED: "bg-rose-500/15 text-rose-300",
    POSTED: "bg-violet-500/15 text-violet-300",
    PUBLISHED: "bg-violet-500/15 text-violet-300",
  };
  const statusLabel: Record<string, string> = {
    IDEA: "Idea",
    DRAFT: "Borrador",
    IN_REVIEW: "En revisión",
    SCHEDULED: "Programado",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    POSTED: "Publicado",
    PUBLISHED: "Publicado",
  };

  const isBusy = isRegenerating || regening || saving || changing || generatingImage;
  const isFinished = ["POSTED", "PUBLISHED"].includes(post.status);

  async function saveEdits() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId: "socialflow",
          id: post.id,
          title: draft.title,
          body: draft.body,
          metadata: {
            angle: draft.hook,
            callToAction: draft.cta,
            hashtags: draft.hashtags.split(/[,#\s]+/).map((t) => t.trim()).filter(Boolean),
          },
          scheduledAt: draft.scheduledAt || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? "No se pudo guardar");
      }
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
      if (json.ok && json.imageUrl) setImageUrl(json.imageUrl);
    } catch {
      // non-critical
    } finally {
      setGeneratingImage(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-semibold text-white/90 leading-snug">{post.title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[post.status] ?? "bg-white/8 text-white/40"}`}>
          {statusLabel[post.status] ?? post.status}
        </span>
      </div>

      {/* Image preview */}
      <div className="mb-2 overflow-hidden rounded-lg">
        {imageUrl && !imageLoadError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="AI generada"
            className="h-40 w-full object-cover"
            loading="lazy"
            onError={() => setImageLoadError(true)}
          />
        ) : (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-white/5">
            {generatingImage ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
                <span className="text-[11px] text-white/30">Generando imagen…</span>
              </>
            ) : (
              <button
                type="button"
                disabled={isRegenerating || regening || saving || changing}
                onClick={() => void handleGenerateImage()}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] text-white/40 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300 disabled:opacity-40"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Generar imagen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Regen overlay */}
      {(isRegenerating || regening) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-violet-500/10 px-2 py-1.5 text-xs text-violet-300">
          <span className="h-3 w-3 animate-spin rounded-full border border-violet-400/40 border-t-violet-400" />
          Regenerando post…
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="space-y-2">
          <input
            className={inputCls + " text-xs"}
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Título"
          />
          <textarea
            className={inputCls + " text-xs"}
            rows={4}
            value={draft.body}
            onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
            placeholder="Texto del post"
          />
          <input
            className={inputCls + " text-xs"}
            value={draft.hook}
            onChange={(e) => setDraft((p) => ({ ...p, hook: e.target.value }))}
            placeholder="Ángulo / Hook"
          />
          <input
            className={inputCls + " text-xs"}
            value={draft.cta}
            onChange={(e) => setDraft((p) => ({ ...p, cta: e.target.value }))}
            placeholder="CTA"
          />
          <input
            className={inputCls + " text-xs"}
            value={draft.hashtags}
            onChange={(e) => setDraft((p) => ({ ...p, hashtags: e.target.value }))}
            placeholder="Hashtags separados por espacio o coma"
          />
          <input
            type="datetime-local"
            className={inputCls + " text-xs"}
            value={draft.scheduledAt}
            onChange={(e) => setDraft((p) => ({ ...p, scheduledAt: e.target.value }))}
          />
          {saveError && <p className="text-xs text-red-300">{saveError}</p>}
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/70">{post.body}</p>
          {hashtags.length > 0 && (
            <p className="mt-1.5 text-[11px] text-white/35">
              {hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
            </p>
          )}
          {post.scheduledAt && (
            <p className="mt-1 text-[11px] text-white/30">
              Programado: {new Date(post.scheduledAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </>
      )}

      {/* Change request panel */}
      {changeMode && !editing && (
        <div className="mt-2 space-y-1.5">
          <textarea
            rows={2}
            autoFocus
            className={inputCls + " text-xs"}
            placeholder='ej. "hazlo más motivacional" o "acórtalo a 3 líneas"'
            value={changeText}
            onChange={(e) => setChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitChange();
              }
            }}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!changeText.trim() || changing}
              onClick={() => void submitChange()}
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50"
            >
              {changing ? "Aplicando…" : "Aplicar cambio"}
            </button>
            <button
              type="button"
              onClick={() => { setChangeMode(false); setChangeText(""); }}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/40 transition hover:text-white/60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {editing ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveEdits()}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/40 transition hover:text-white/60"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          {/* Secondary actions */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {!["REJECTED", "POSTED", "PUBLISHED"].includes(post.status) && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onAction("reject", post.id)}
                className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
              >
                Rechazar
              </button>
            )}
            {!isFinished && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => { setEditing(true); setChangeMode(false); }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50 transition hover:border-violet-500/25 hover:text-violet-300 disabled:opacity-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => { setChangeMode((v) => !v); setEditing(false); }}
                  className={`rounded-lg border px-2 py-0.5 text-[11px] transition disabled:opacity-50 ${
                    changeMode
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                      : "border-white/10 bg-white/5 text-white/50 hover:border-violet-500/25 hover:text-violet-300"
                  }`}
                >
                  Pedir cambio
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleRegen()}
                  className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-50"
                >
                  {regening ? "…" : "Regenerar"}
                </button>
              </>
            )}
          </div>

          {/* Primary action: Aprobar */}
          {!["APPROVED", "SCHEDULED", "POSTED", "PUBLISHED", "REJECTED"].includes(post.status) && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAction("approve", post.id)}
              className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/20 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 active:scale-[0.99] disabled:opacity-50"
            >
              ✓ Aprobar
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SocialFlowAIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Hola, soy tu asistente de marketing con IA. He cargado tu Knowledge Base y perfil de marca.\n\nCuéntame qué campaña necesitas. Por ejemplo: \"Quiero 7 posts para esta semana\" o \"Crea contenido para atraer nuevos clientes\".\n\nCuando veas los posts generados, puedes pedirme cambios específicos escribiendo: \"cambia el post 3, hazlo más motivacional\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [regenLoading, setRegenLoading] = useState<Set<string>>(new Set());
  const [publishingMsgId, setPublishingMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

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

  async function pollCampaign(campaignId: string, messageId: string) {
    try {
      const [campaignRes, postsRes] = await Promise.all([
        fetch(`/api/socialflow/campaigns?saasId=socialflow`),
        fetch(`/api/socialflow/posts?saasId=socialflow&campaignId=${campaignId}`),
      ]);
      const campaignJson = (await campaignRes.json()) as {
        items?: { id: string; status: string; notes: string | null }[];
      };
      const postsJson = (await postsRes.json()) as { items?: SocialPost[] };
      const campaign = campaignJson.items?.find((c) => c.id === campaignId);
      if (!campaign) return;

      const posts = postsJson.items ?? [];

      if (campaign.status === "ACTIVE" && posts.length > 0) {
        stopPoll(campaignId);
        updateMessage(messageId, {
          content: `✅ Campaña lista con ${posts.length} post${posts.length !== 1 ? "s" : ""}. Apruébalos o escribe "cambia el post 1, hazlo más formal".`,
          posts,
          generatingStatus: "done",
        });
        // If ACTIVE but posts.length === 0, keep polling — campaign is marked ACTIVE before posts are persisted
      } else if (campaign.status === "FAILED") {
        stopPoll(campaignId);
        updateMessage(messageId, {
          content: `❌ La generación falló: ${campaign.notes ?? "Error desconocido"}. Inténtalo de nuevo.`,
          generatingStatus: "error",
        });
      }
    } catch {
      // transient network error — keep polling
    }
  }

  function startPoll(campaignId: string, messageId: string) {
    stopPoll(campaignId);
    void pollCampaign(campaignId, messageId);
    pollRefs.current[campaignId] = setInterval(() => void pollCampaign(campaignId, messageId), 5000);
  }

  async function handlePostAction(
    action: "approve" | "reject" | "schedule",
    postId: string,
    scheduledAt?: string,
  ) {
    try {
      await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", id: postId, action, scheduledAt: scheduledAt ?? null }),
      });
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.posts?.some((p) => p.id === postId)) return m;
          return {
            ...m,
            posts: m.posts.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    status:
                      action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "SCHEDULED",
                  }
                : p,
            ),
          };
        }),
      );
    } catch {
      // non-critical — status badge stays but action failed silently
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
      if (json.ok && json.post) {
        const updated = json.post;
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.posts?.some((p) => p.id === postId)) return m;
            return { ...m, posts: m.posts.map((p) => (p.id === postId ? updated : p)) };
          }),
        );
      }
    } catch {
      // non-critical
    } finally {
      setRegenLoading((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
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
      if (json.ok && json.post) {
        const updated = json.post;
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.posts?.some((p) => p.id === postId)) return m;
            return { ...m, posts: m.posts.map((p) => (p.id === postId ? updated : p)) };
          }),
        );
      }
    } catch {
      // non-critical
    } finally {
      setRegenLoading((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
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
          const scheduledAt =
            post.scheduledAt ??
            new Date(nowMs + dayOffset++ * MS_PER_DAY).toISOString().slice(0, 16) + ":00";
          await fetch("/api/socialflow/posts", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              saasId: "socialflow",
              id: post.id,
              action: "schedule",
              scheduledAt,
            }),
          });
        }),
      );
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.posts) return m;
          return {
            ...m,
            posts: m.posts.map((p) => (p.status === "APPROVED" ? { ...p, status: "SCHEDULED" } : p)),
          };
        }),
      );
    } finally {
      setPublishingMsgId(null);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;

    // Client-side detect "cambia el post N" before hitting the chat API
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
            {
              id: botMsgId,
              role: "bot",
              content: `Aplicando cambio al post ${postNumber}…`,
              generatingStatus: "polling",
            },
          ]);
          try {
            await handleRequestChange(targetPost.id, instruction);
            updateMessage(botMsgId, {
              content: `✅ Post ${postNumber} actualizado con tu instrucción.`,
              generatingStatus: "done",
            });
          } finally {
            setThinking(false);
          }
          return;
        }
      }
    }

    const userMsgId = `u_${Date.now()}`;
    const botMsgId = `b_${Date.now()}`;
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
        body: JSON.stringify({ message: text, saasId: "socialflow" }),
      });

      const json = (await res.json()) as {
        ok: boolean;
        action?: string;
        reply?: string;
        campaignId?: string;
        error?: string;
        message?: string;
      };

      if (!json.ok) {
        updateMessage(botMsgId, {
          content: json.message ?? json.error ?? "Ocurrió un error. Inténtalo de nuevo.",
          generatingStatus: "error",
        });
        return;
      }

      if (json.action === "generating" && json.campaignId) {
        updateMessage(botMsgId, {
          content: json.reply ?? "Generando tu campaña… te aviso cuando esté lista.",
          campaignId: json.campaignId,
          generatingStatus: "polling",
        });
        startPoll(json.campaignId, botMsgId);
      } else {
        updateMessage(botMsgId, {
          content: json.reply ?? "¿En qué más puedo ayudarte?",
          generatingStatus: "done",
        });
      }
    } catch {
      updateMessage(botMsgId, {
        content: "Error de conexión. Por favor inténtalo de nuevo.",
        generatingStatus: "error",
      });
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

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · Asistente IA</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Generador de campañas</h1>
      </div>

      {/* Chat area */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-white/3 p-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => {
            const approvedPosts = msg.posts?.filter((p) => p.status === "APPROVED") ?? [];
            const canPublish = approvedPosts.length > 0 && msg.generatingStatus === "done";

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    msg.role === "bot"
                      ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {msg.role === "bot" ? "SF" : "Tú"}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.posts && msg.posts.length > 0
                      ? "w-full"
                      : "max-w-[82%]"
                  } ${
                    msg.role === "user"
                      ? "bg-violet-500/15 text-white/90"
                      : "border border-white/8 bg-white/5 text-white/80"
                  }`}
                >
                  {/* Typing indicator */}
                  {msg.generatingStatus === "polling" && msg.content === "…" ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Background generation spinner */}
                      {msg.generatingStatus === "polling" && msg.content !== "…" && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                          <span className="h-3 w-3 animate-spin rounded-full border border-violet-400/40 border-t-violet-400" />
                          Generando en segundo plano…
                        </div>
                      )}

                      {/* Posts grid */}
                      {msg.posts && msg.posts.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {msg.posts.map((post) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              isRegenerating={regenLoading.has(post.id)}
                              onAction={handlePostAction}
                              onRegenerate={handleRegenerate}
                              onRequestChange={handleRequestChange}
                            />
                          ))}
                        </div>
                      )}

                      {/* Publish approved campaign button */}
                      {canPublish && (
                        <div className="mt-3 border-t border-white/8 pt-3">
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
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                Publicar campaña aprobada ({approvedPosts.length} post
                                {approvedPosts.length !== 1 ? "s" : ""})
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="mt-3 shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20">
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/25 outline-none"
            placeholder='Escribe tu solicitud… o "cambia el post 3, hazlo más motivacional"'
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
          El asistente lee tu Knowledge Base automáticamente · Enter para enviar
        </p>
      </div>
    </div>
  );
}
