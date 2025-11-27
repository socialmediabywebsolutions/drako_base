"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import Button from "@/components/ui/button";
import { getOrchestratorContext, setOrchestratorContext, subscribeOrchestratorContext, type OrchestratorContextPayload } from "@/lib/orchestrator-context";
import { Mail, MessageCircle, LayoutDashboard, Loader2, Bot, AlertCircle, RefreshCcw } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

const statusLabelMap: Record<string, string> = {
  nuevo: "pendiente",
  en_proceso: "en proceso",
  resuelto: "resuelto",
  archivado: "archivado",
  error: "en error",
};

const statusLabel = (value: string) => statusLabelMap[value] ?? value;

const defaultActions = [
  { label: "Resumen alertas", text: "Dame un resumen de alertas críticas y acciones sugeridas." },
  { label: "Provisionar SaaS", text: "Coordina los pasos para provisionar un nuevo SaaS con Cloudflare." },
  { label: "Estado bandeja", text: "¿Cómo va la bandeja unificada?" },
];

export default function RightPanel() {
  const pathname = usePathname() ?? "/";
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextPayload, setContextPayload] = useState<OrchestratorContextPayload>(null);

  const storageKey = useMemo(() => `orchestrator:thread:${pathname}`, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      setThreadId(saved);
    } else {
      setThreadId(null);
      setMessages([]);
    }
  }, [storageKey]);

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/orchestrator?thread_id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("No se pudo recuperar la conversación");
      }
      const data = (await res.json()) as { items?: Message[] };
      setMessages(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado cargando historial");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!threadId) return;
    loadHistory(threadId);
  }, [loadHistory, threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setContextPayload(getOrchestratorContext());
    const unsub = subscribeOrchestratorContext((payload) => setContextPayload(payload));
    return () => {
      unsub();
      setOrchestratorContext(null);
    };
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setIsSending(true);
    setError(null);
    try {
      const mergedContext = contextPayload ? { path: pathname, ...contextPayload } : { path: pathname };
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId ?? undefined,
          message: trimmed,
          context: mergedContext,
        }),
      });
      const data = (await res.json()) as { thread_id?: string; items?: Message[]; error?: string };
      if (!res.ok || !data.thread_id) {
        throw new Error(data.error ?? "No se pudo enviar el mensaje");
      }
      setThreadId(data.thread_id);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, data.thread_id);
      }
      setMessages(data.items ?? []);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comunicar con el orquestador");
    } finally {
      setIsSending(false);
    }
  }, [contextPayload, input, pathname, storageKey, threadId]);

  const handleSubmit = useCallback((evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    void handleSend();
  }, [handleSend]);

  const quickPrompts = useMemo(() => {
    if (contextPayload?.scope === "inbox") {
      return [
        { label: "Redactar respuesta al cliente", text: "Redacta una respuesta concreta para el cliente usando el tono del departamento actual." },
        { label: "Reclasificar este mensaje", text: "Analiza el contenido y dime si debemos cambiar de departamento o estado." },
        { label: "Resolver y cerrar incidencia", text: "Propón los pasos para cerrar este ticket y qué dejar documentado." },
        { label: "Escalar a otro departamento", text: "Indica qué departamento debería asumir este caso y cómo notificarlo." },
      ];
    }
    if (contextPayload?.scope === "saas") {
      return [
        { label: "Revisar agentes", text: "Revisa los agentes asignados y dime si falta algún departamento crítico." },
        { label: "Siguiente paso de provisión", text: "Indica cuál debería ser el próximo paso del timeline de provisión y cómo registrarlo." },
        { label: "Revisar métricas", text: "Analiza las métricas de tokens, coste y ROI y sugiere acciones." },
        { label: "Analizar alertas", text: "Evalúa las alertas del SaaS y prioriza acciones para mitigarlas." },
      ];
    }
    return defaultActions;
  }, [contextPayload]);

  const contextSummary = useMemo(() => {
    if (contextPayload?.scope === "inbox" && contextPayload.inbox) {
      const inbox = contextPayload.inbox;
      const deptLabel = inbox.department_label ?? inbox.department_id ?? "Sin asignar";
      return (
        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 mb-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">Mensaje en foco</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] border border-[var(--border)] text-[var(--brand)]">
              {inbox.channel === "whatsapp" ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-1">{inbox.subject ?? inbox.preview}</p>
              <p className="text-xs text-[var(--muted)]">Estado {statusLabel(inbox.status)} • {deptLabel}</p>
            </div>
          </div>
          {inbox.saas_name && (
            <p className="mt-2 text-xs text-[var(--muted)]">Vinculado al SaaS {inbox.saas_name}</p>
          )}
        </div>
      );
    }
    if (contextPayload?.scope === "saas" && contextPayload.saas) {
      const saas = contextPayload.saas;
      const detalle = contextPayload.detalle;
      return (
        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 mb-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">SaaS seleccionado</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] border border-[var(--border)] text-[var(--brand)]">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-1">{saas.name}</p>
              <p className="text-xs text-[var(--muted)]">Slug {saas.slug} • Estado {saas.status}</p>
            </div>
          </div>
          {detalle?.provisiones && detalle.provisiones.length > 0 && (
            <div className="mt-3 text-xs text-[var(--muted)]">
              Último paso: {detalle.provisiones[0]?.paso ?? "-"} • {detalle.provisiones[0]?.estado ?? "-"}
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)]/50 p-4 mb-4">
        <p className="text-xs text-[var(--muted)]">Selecciona un SaaS o mensaje para activar contexto.</p>
      </div>
    );
  }, [contextPayload]);

  return (
    <aside className="hidden xl:flex w-[26rem] shrink-0 flex-col border-l border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[var(--panel)]/85 backdrop-blur-2xl p-5 gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">IA operacional</p>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chat Orquestador</h2>
          <button
            type="button"
            className="rounded-full border border-[var(--border)]/60 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => threadId && loadHistory(threadId)}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] line-clamp-1">Ruta activa: {pathname}</p>
      </header>

      {contextSummary}

      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((q) => (
          <button
            key={q.label}
            type="button"
            className="rounded-full border border-[var(--border)]/60 bg-[var(--background)]/50 px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--brand)]/50"
            onClick={() => setInput(q.text)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-3xl border border-[var(--border)]/70 bg-[var(--background)]/80 p-4 space-y-3 scroll-smooth"
        role="log"
        aria-live="polite"
      >
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recuperando contexto...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">Aún no hay conversación. Envía tu primera instrucción.</div>
        ) : (
          <ul className="space-y-3">
            {messages.map((msg) => (
              <li key={msg.id} className="text-sm">
                <div
                  className={clsx(
                    "rounded-2xl px-4 py-3 shadow-[0_15px_30px_rgba(15,23,42,0.08)]",
                    msg.role === "assistant"
                      ? "bg-[var(--brand-quiet)]/85 border border-[var(--brand)]/40 text-[var(--foreground)]"
                      : "bg-[var(--panel)]/90 border border-[var(--border)]/70"
                  )}
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1">
                    {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />}
                    {msg.role === "assistant" ? "Orquestador" : "Operador"}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed text-sm">{msg.content}</p>
                </div>
                <span className="mt-1 block text-[10px] text-[var(--muted)]">{new Date(msg.created_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          className="w-full resize-none rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          rows={3}
          placeholder="Describe la acción que necesitas..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
          <span>Respuestas deterministas dentro de DRĀKO</span>
          <Button type="submit" variant="primary" size="sm" loading={isSending}>
            {isSending ? "Enviando" : "Enviar"}
          </Button>
        </div>
      </form>
    </aside>
  );
}
