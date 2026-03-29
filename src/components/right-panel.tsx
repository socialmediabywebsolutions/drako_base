"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { getOrchestratorContext, setOrchestratorContext, subscribeOrchestratorContext, type DevArchitectContext, type DevArchitectMode, type OrchestratorContextPayload } from "@/lib/orchestrator-context";
import { DEV_ARCHITECT_AGENT } from "@/lib/dev-architects/agent";
import { DEV_ARCHITECT_MODES } from "@/lib/dev-architects/data";
import { Mail, MessageCircle, LayoutDashboard, Loader2, Bot, AlertCircle, RefreshCcw, Code2 } from "lucide-react";

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

const IS_DEMO_ENV = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const defaultActions = [
  { label: "Estado fábrica", text: "Resume los SaaS activos, jobs degradados y el siguiente riesgo operativo del factory." },
  { label: "Crear SaaS", text: "Prepárame los pasos para crear un nuevo SaaS por la ruta canónica y qué debo revisar al terminar." },
  { label: "Revisar dominios", text: "Dime qué revisar en dominios, runtime y bootstrap antes de dar un SaaS por listo." },
  { label: "Workspace health", text: "Resume billing, onboarding y señales de salud del workspace actual." },
];

export default function RightPanel() {
  const pathname = usePathname() ?? "/";
  const isDevArchitectRoute = pathname.startsWith("/dev-architects");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [contextPayload, setContextPayload] = useState<OrchestratorContextPayload>(null);

  const devArchitectContext = contextPayload?.scope === "devarchitect" ? (contextPayload as DevArchitectContext) : null;
  const devProjects = devArchitectContext?.devArchitect.projects ?? [];
  const devActiveProjectId = devArchitectContext?.devArchitect.activeProjectId ?? devProjects[0]?.id ?? "";
  const devMode = devArchitectContext?.devArchitect.mode ?? DEV_ARCHITECT_MODES[0];

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

  const updateDevArchitectContext = useCallback((updates: Partial<DevArchitectContext["devArchitect"]>) => {
    const base: DevArchitectContext = devArchitectContext ?? {
      scope: "devarchitect",
      agentId: "devarchitect",
      devArchitect: {
        projects: [],
        sessions: [],
        checklists: [],
        metrics: [],
        tasks: [],
        taskCounts: { todo: 0, in_progress: 0, done: 0, blocked: 0 },
        activeProjectId: "",
        mode: DEV_ARCHITECT_MODES[0],
      },
    };
    setOrchestratorContext({
      ...base,
      devArchitect: {
        ...base.devArchitect,
        ...updates,
      },
    });
  }, [devArchitectContext]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const rawMessage = typeof messageOverride === "string" ? messageOverride : input;
    const trimmed = rawMessage.trim();
    if (!trimmed) return;
    setIsSending(true);
    setError(null);
    try {
      const mergedContext = contextPayload ? { path: pathname, ...contextPayload } : { path: pathname };
      if (isDevArchitectRoute) {
        (mergedContext as { scope?: string }).scope = "devarchitect";
        (mergedContext as { agentId?: string }).agentId = "devarchitect";
      }
      const requestBody: Record<string, unknown> & {
        scope?: string;
        agentId?: string;
        devarchitectProjectId?: string;
        devarchitectMode?: DevArchitectMode;
      } = {
        thread_id: threadId ?? undefined,
        message: trimmed,
        context: mergedContext,
      };
      if (isDevArchitectRoute) {
        requestBody.scope = "devarchitect";
        requestBody.agentId = "devarchitect";
        requestBody.devarchitectProjectId = devActiveProjectId;
        requestBody.devarchitectMode = devMode;
      } else if (contextPayload?.scope) {
        requestBody.scope = contextPayload.scope;
      }
      if ((contextPayload as { agentId?: string })?.agentId && !requestBody.agentId) {
        requestBody.agentId = (contextPayload as { agentId?: string }).agentId;
      }
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        thread_id?: string;
        items?: Message[];
        error?: string;
        saasSlug?: string;
      };

      if (data.ok === false || !res.ok || !data.thread_id) {
        const rawError = data.error ?? "No se pudo enviar el mensaje";
        const isSessionRequired = rawError === "SESSION_REQUIRED";
        if (isSessionRequired) {
          const isProd = typeof process !== "undefined" && process.env.NODE_ENV === "production";
          const friendly = isProd
            ? "Inicia sesión para usar el chat orquestador de DRĀKO."
            : "No hay sesión activa. En desarrollo puedes habilitar una sesión demo o configurar el login antes de usar el chat orquestador.";
          throw new Error(friendly);
        }
        throw new Error(rawError);
      }

      setThreadId(data.thread_id);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(storageKey, data.thread_id);
      }
      if (data.mode === "provisioning_playbook_executed" && data.saasSlug) {
        const systemMessage: Message = {
          id: `${data.thread_id}-provisioning-${Date.now()}`,
          role: "assistant",
          content: `He registrado los pasos de DNS + SSL, Workers custom domains y verificación de certificados para el SaaS con slug ${data.saasSlug}. Puedes verlos en la timeline de provisión.`,
          created_at: new Date().toISOString(),
        };
        setMessages([...(data.items ?? []), systemMessage]);
      } else {
        setMessages(data.items ?? []);
      }
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comunicar con el orquestador");
    } finally {
      setIsSending(false);
    }
  }, [contextPayload, devActiveProjectId, devMode, input, isDevArchitectRoute, pathname, storageKey, threadId]);

  const handleSubmit = useCallback((evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    void handleSend();
  }, [handleSend]);

  const handleQuickPrompt = useCallback((text: string) => {
    if (!text || isSending) return;
    setInput(text);
    setTimeout(() => {
      void handleSend(text);
    }, 0);
  }, [handleSend, isSending]);

  const assistantBadgeLabel = isDevArchitectRoute ? DEV_ARCHITECT_AGENT.name : "Orquestador";

  const quickPrompts = useMemo(() => {
    if (contextPayload?.scope === "devarchitect") {
      return [
        { label: "Priorizar backlog", text: "Revisa el backlog técnico del proyecto activo y propón el siguiente paso concreto." },
        { label: "Plan refactor 3 pasos", text: "Dame un plan de refactor en 3 pasos para mejorar la estabilidad del proyecto activo." },
        { label: "Ordenar alertas", text: "Analiza las alertas técnicas abiertas y sugiere el orden de resolución." },
        { label: "Reglas OLIMPO pendientes", text: "Revisa las reglas OLIMPO pendientes y dime en qué archivos deberíamos empezar." },
      ];
    }
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
    if (contextPayload?.scope === "devarchitect" && (contextPayload as DevArchitectContext).devArchitect) {
      const ctx = contextPayload as DevArchitectContext;
      const projects = ctx.devArchitect.projects ?? [];
      const activeProject = projects.find((project) => project.id === ctx.devArchitect.activeProjectId) ?? projects[0];
      return (
        <div className="rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 mb-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">DevArchitect activo</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] border border-[var(--border)] text-[var(--brand)]">
              <Code2 className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-1">{activeProject?.name ?? "Sin proyecto asignado"}</p>
              <p className="text-xs text-[var(--muted)]">Rama {activeProject?.branch_name ?? "N/D"} • Modo {ctx.devArchitect.mode}</p>
            </div>
          </div>
        </div>
      );
    }
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
        <p className="text-xs text-[var(--muted)]">
          {isDevArchitectRoute ? "Configura un proyecto activo para chatear con DevArchitect." : "Selecciona un SaaS o mensaje para activar contexto."}
        </p>
      </div>
    );
  }, [contextPayload, isDevArchitectRoute]);
  return (
    <aside className="flex w-full shrink-0 flex-col bg-white p-5 gap-4 overflow-hidden">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
            {isDevArchitectRoute ? "Staff técnico" : "IA operacional"}
          </p>
          {IS_DEMO_ENV && (
            <span className="rounded-full border border-[var(--border)]/60 bg-[var(--background)]/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.25em] text-[var(--muted)]">
              Demo
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{isDevArchitectRoute ? "Chat DevArchitect" : "Chat Orquestador"}</h2>
            <p className="text-xs text-[var(--muted)] line-clamp-1">
              {isDevArchitectRoute ? `Agente: ${DEV_ARCHITECT_AGENT.name}` : pathname.startsWith("/socialflow") ? "Ayuda operativa para operator, factory y workspace" : `Ruta activa: ${pathname}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--border)]/60 px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => threadId && loadHistory(threadId)}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        {isDevArchitectRoute && <p className="text-xs text-[var(--muted)] line-clamp-1">Ruta activa: {pathname}</p>}
      </header>

      {contextSummary}

      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((q) => (
          <button
            key={q.label}
            type="button"
            className="rounded-full border border-[var(--border)]/60 bg-[var(--background)]/50 px-3 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--brand)]/50"
            onClick={() => handleQuickPrompt(q.text)}
          >
            {q.label}
          </button>
        ))}
      </div>

      {isDevArchitectRoute && devProjects.length > 0 && (
        <div className="rounded-3xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-4 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-1">Proyecto activo</p>
            <Select
              value={devActiveProjectId}
              onChange={(event) => updateDevArchitectContext({ activeProjectId: event.target.value })}
              className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
            >
              {devProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-1">Modo de trabajo</p>
            <Select
              value={devMode}
              onChange={(event) => updateDevArchitectContext({ mode: event.target.value as DevArchitectMode })}
              className="w-full rounded-2xl border border-[var(--border)]/70 bg-[var(--background)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
            >
              {DEV_ARCHITECT_MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto rounded-3xl border border-[var(--border)]/70 bg-[var(--background)]/80 p-4 space-y-3 scroll-smooth"
        role="log"
        aria-live="polite"
      >
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Recuperando contexto...</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">
            {pathname.startsWith("/socialflow")
              ? "Todavía no hay conversación. Usa los accesos rápidos para revisar el factory, dominios o readiness del workspace."
              : "Aún no hay conversación. Envía tu primera instrucción."}
          </div>
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
                    {msg.role === "assistant"
                      ? isDevArchitectRoute
                        ? <Code2 className="h-3.5 w-3.5" />
                        : <Bot className="h-3.5 w-3.5" />
                      : <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />}
                    {msg.role === "assistant" ? assistantBadgeLabel : "Operador"}
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
