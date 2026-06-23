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
    callToAction?: string;
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
// Styles
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";

// ---------------------------------------------------------------------------
// Post card component
// ---------------------------------------------------------------------------

function PostCard({
  post,
  onAction,
  onRegenerate,
}: {
  post: SocialPost;
  onAction: (action: "approve" | "reject" | "schedule", id: string, scheduledAt?: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>({
    title: post.title ?? "",
    body: post.body ?? "",
    hook: post.metadata?.angle ?? "",
    cta: post.metadata?.callToAction ?? "",
    hashtags: (post.metadata?.hashtags ?? []).join(" "),
    scheduledAt: post.scheduledAt ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hashtags = post.metadata?.hashtags ?? [];

  const statusColors: Record<string, string> = {
    DRAFT: "bg-white/8 text-white/40",
    SCHEDULED: "bg-amber-500/15 text-amber-300",
    APPROVED: "bg-emerald-500/15 text-emerald-300",
    REJECTED: "bg-rose-500/15 text-rose-300",
    POSTED: "bg-violet-500/15 text-violet-300",
  };
  const statusLabel: Record<string, string> = {
    DRAFT: "Borrador",
    SCHEDULED: "Programado",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    POSTED: "Publicado",
  };

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

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-white/90 leading-snug">{post.title}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColors[post.status] ?? "bg-white/8 text-white/40"}`}>
          {statusLabel[post.status] ?? post.status}
        </span>
      </div>

      {/* Image hint preview */}
      {post.imageHint && (
        <div className="mb-2 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageHint}
            alt="AI generated"
            className="h-32 w-full object-cover"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
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

      {/* Actions */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {editing ? (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={saveEdits}
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/15 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/40 transition hover:text-white/60"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onAction("approve", post.id)}
              className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 transition hover:bg-emerald-500/20"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => onAction("reject", post.id)}
              className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 transition hover:bg-rose-500/20"
            >
              Rechazar
            </button>
            {post.scheduledAt && (
              <button
                type="button"
                onClick={() => onAction("schedule", post.id, post.scheduledAt ?? undefined)}
                className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300 transition hover:bg-sky-500/20"
              >
                Reprogramar
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50 transition hover:border-violet-500/25 hover:text-violet-300"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRegenerate(post.id)}
              className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300 transition hover:bg-indigo-500/20"
            >
              Regenerar
            </button>
          </>
        )}
      </div>
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
        "Hola, soy tu asistente de marketing con IA. He cargado tu Knowledge Base y perfil de marca.\n\nCuéntame qué campaña necesitas. Por ejemplo: \"Quiero 7 posts para mi nueva colección de otoño\" o \"Crea contenido semanal para atraer nuevos clientes\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Auto-scroll to bottom when messages change
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
    return () => {
      Object.keys(refs).forEach((id) => {
        clearInterval(refs[id]);
      });
    };
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

      const campaignJson = (await campaignRes.json()) as { items?: { id: string; status: string; notes: string | null }[] };
      const postsJson = (await postsRes.json()) as { items?: SocialPost[] };

      const campaign = campaignJson.items?.find((c) => c.id === campaignId);
      if (!campaign) return;

      if (campaign.status === "ACTIVE") {
        stopPoll(campaignId);
        const posts = postsJson.items ?? [];
        updateMessage(messageId, {
          content: posts.length > 0
            ? `✅ Campaña lista. Aquí tienes ${posts.length} post${posts.length !== 1 ? "s" : ""} generado${posts.length !== 1 ? "s" : ""}. Puedes editarlos, aprobarlos o pedirme cambios.`
            : "✅ Campaña generada, pero sin posts disponibles. Inténtalo de nuevo.",
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
      // transient error, keep polling
    }
  }

  function startPoll(campaignId: string, messageId: string) {
    stopPoll(campaignId);
    void pollCampaign(campaignId, messageId);
    pollRefs.current[campaignId] = setInterval(() => void pollCampaign(campaignId, messageId), 5000);
  }

  async function handlePostAction(action: "approve" | "reject" | "schedule", postId: string, scheduledAt?: string) {
    try {
      await fetch("/api/socialflow/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", id: postId, action, scheduledAt: scheduledAt ?? null }),
      });
      // Refresh all messages that contain this post
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
      // non-critical — user can try again
    }
  }

  async function handleRegenerate(postId: string) {
    try {
      await fetch("/api/socialflow/ai/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "socialflow", postId }),
      });
    } catch {
      // non-critical
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;

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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · Asistente IA</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">Generador de campañas</h1>
      </div>

      {/* Chat area */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-white/3 p-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
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
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

                    {/* Generating spinner */}
                    {msg.generatingStatus === "polling" && msg.content !== "…" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
                        <span className="h-3 w-3 animate-spin rounded-full border border-violet-400/40 border-t-violet-400" />
                        Generando en segundo plano…
                      </div>
                    )}

                    {/* Posts grid */}
                    {msg.posts && msg.posts.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {msg.posts.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onAction={handlePostAction}
                            onRegenerate={handleRegenerate}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
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
            placeholder="Escribe tu solicitud… (Enter para enviar, Shift+Enter para nueva línea)"
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
