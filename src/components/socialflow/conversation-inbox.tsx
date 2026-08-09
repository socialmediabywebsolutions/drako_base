"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSettings, ConversationThread } from "@/lib/socialflow/conversational/types";
import type { LeadTemperature } from "@/lib/socialflow/leads/types";
import { TEMP_META } from "./leads-panel";
import KeywordDmAutomationPanel from "./keyword-dm-panel";

type Props = {
  threads: ConversationThread[];
  settings: ConversationSettings;
  saasId: string;
  leadTemperatureByThreadId?: Record<string, LeadTemperature>;
};

type Tab = "inbox" | "needs_human" | "toxic" | "history" | "automation";

const AUTO_SEND_PROVIDERS = ["INSTAGRAM", "FACEBOOK_PAGE", "LINKEDIN"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

const PROVIDER_BG: Record<string, string> = {
  INSTAGRAM: "bg-pink-500/15 text-pink-300",
  FACEBOOK_PAGE: "bg-blue-500/15 text-blue-300",
  LINKEDIN: "bg-sky-500/15 text-sky-300",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  AUTO_APPROVED: "Auto-aprobado",
  APPROVED: "Aprobado",
  SENT: "Enviado",
  DISMISSED: "Descartado",
  NEEDS_HUMAN: "Requiere revisión",
};

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-300",
  AUTO_APPROVED: "bg-sky-500/15 text-sky-300",
  APPROVED: "bg-emerald-500/15 text-emerald-300",
  SENT: "bg-white/8 text-white/50",
  DISMISSED: "bg-rose-500/10 text-rose-400",
  NEEDS_HUMAN: "bg-orange-500/15 text-orange-300",
};

const SENTIMENT_BG: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-300",
  negative: "bg-red-500/15 text-red-300",
  neutral: "bg-white/8 text-white/50",
  lead: "bg-violet-500/15 text-violet-300",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
  lead: "Lead",
};

function getSentiment(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const s = meta.sentiment;
  return typeof s === "string" ? s : null;
}

function getSentimentReason(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const r = meta.reason;
  return typeof r === "string" && r ? r : null;
}

function getConfidence(meta: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const c = meta.confidence;
  return typeof c === "number" ? c : null;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConversationInbox({
  threads: initialThreads,
  settings: initialSettings,
  saasId,
  leadTemperatureByThreadId = {},
}: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("inbox");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [threads, setThreads] = useState(initialThreads);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [testMessage, setTestMessage] = useState("");
  const [testProvider, setTestProvider] = useState("INSTAGRAM");
  const [testThreadType, setTestThreadType] = useState<"DM" | "COMMENT">("DM");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [overriding, setOverriding] = useState<Record<string, boolean>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);

  const [isPendingSettings, startSettingsTransition] = useTransition();
  const [isPendingTest, startTestTransition] = useTransition();
  const [isPendingAction, startActionTransition] = useTransition();

  const inboxThreads = threads.filter((t) => t.status === "PENDING" || t.status === "AUTO_APPROVED");
  const needsHumanThreads = threads.filter((t) => t.status === "NEEDS_HUMAN");
  const toxicThreads = threads.filter((t) => getSentiment(t.aiMetadata) === "negative");
  const historyThreads = threads.filter(
    (t) => t.status === "SENT" || t.status === "APPROVED" || t.status === "DISMISSED",
  );

  const activeThreads =
    tab === "inbox" ? inboxThreads
    : tab === "needs_human" ? needsHumanThreads
    : tab === "toxic" ? toxicThreads
    : historyThreads;

  function toggleAutoSend() {
    setSettingsError(null);
    startSettingsTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/conversations/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saasId,
            autoSendEnabled: !settings.autoSendEnabled,
            autoSendProviders: settings.autoSendProviders,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          settings?: ConversationSettings;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update");
        if (data.settings) setSettings(data.settings);
      } catch (e) {
        setSettingsError(e instanceof Error ? e.message : "Error al actualizar configuración");
      }
    });
  }

  function toggleProvider(provider: string) {
    setSettingsError(null);
    startSettingsTransition(async () => {
      try {
        const next = settings.autoSendProviders.includes(provider)
          ? settings.autoSendProviders.filter((p) => p !== provider)
          : [...settings.autoSendProviders, provider];
        const res = await fetch("/api/socialflow/conversations/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, autoSendEnabled: settings.autoSendEnabled, autoSendProviders: next }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          settings?: ConversationSettings;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update providers");
        if (data.settings) setSettings(data.settings);
      } catch (e) {
        setSettingsError(e instanceof Error ? e.message : "Error al actualizar proveedores");
      }
    });
  }

  function generateTestReply() {
    if (!testMessage.trim()) return;
    setTestResult(null);
    setTestError(null);
    startTestTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/conversations/reply-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, message: testMessage, threadType: testThreadType }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          suggestedReply?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Generation failed");
        setTestResult(data.suggestedReply ?? "");
      } catch (e) {
        setTestError(e instanceof Error ? e.message : "Error al generar respuesta");
      }
    });
  }

  function saveTestToInbox() {
    if (!testMessage.trim()) return;
    startTestTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/conversations/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saasId,
            provider: testProvider,
            thread_type: testThreadType,
            incoming_message: testMessage,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          thread?: ConversationThread;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save");
        if (data.thread) {
          setThreads((prev) => [data.thread!, ...prev]);
          setTab("inbox");
        }
        setTestMessage("");
        setTestResult(null);
      } catch (e) {
        setTestError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function patchThread(threadId: string, status: ConversationThread["status"], finalReply?: string | null) {
    setPendingThreadId(threadId);
    startActionTransition(async () => {
      try {
        const reply = finalReply !== undefined
          ? finalReply
          : (editedReplies[threadId] ?? threads.find((t) => t.id === threadId)?.suggestedReply ?? null);
        const res = await fetch(`/api/socialflow/conversations/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, status, finalReply: reply }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          thread?: ConversationThread;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed");
        if (data.thread) setThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread! : t)));
      } catch {
        router.refresh();
      } finally {
        setPendingThreadId(null);
      }
    });
  }

  async function generateOverrideReply(thread: ConversationThread) {
    setGeneratingFor(thread.id);
    try {
      const res = await fetch("/api/socialflow/conversations/reply-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId, message: thread.incomingMessage, threadType: thread.threadType }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        suggestedReply?: string;
        error?: string;
      };
      if (data.ok && data.suggestedReply) {
        setEditedReplies((prev) => ({ ...prev, [thread.id]: data.suggestedReply! }));
        setOverriding((prev) => ({ ...prev, [thread.id]: true }));
      }
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <div className="space-y-4">

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Comentarios" value={inboxThreads.length} accent="amber" />
        <StatCard label="DMs" value={needsHumanThreads.length} accent="orange" />
        <StatCard label="Leads detectados" value={historyThreads.filter((t) => t.status === "SENT" || t.status === "APPROVED").length} accent="emerald" />
      </div>

      {/* Settings card */}
      <div className="rounded-xl border border-white/8 bg-white/4">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Envío automático</span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-medium",
                settings.autoSendEnabled
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-white/8 text-white/40",
              ].join(" ")}
            >
              {settings.autoSendEnabled ? "Activado" : "Desactivado"}
            </span>
          </div>
          <ChevronIcon open={settingsOpen} />
        </button>

        {settingsOpen && (
          <div className="border-t border-white/8 px-5 pb-5 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Respuestas automáticas</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Si está activo, las respuestas de IA se envían sin aprobación humana.
                </p>
              </div>
              <Toggle checked={settings.autoSendEnabled} onChange={toggleAutoSend} disabled={isPendingSettings} />
            </div>

            {settings.autoSendEnabled && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Activo para</p>
                <div className="flex flex-wrap gap-2">
                  {AUTO_SEND_PROVIDERS.map((p) => {
                    const on = settings.autoSendProviders.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleProvider(p)}
                        disabled={isPendingSettings}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                          on
                            ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                            : "border-white/10 bg-white/4 text-white/45 hover:border-white/20",
                        ].join(" ")}
                      >
                        {PROVIDER_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-300/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                  Las respuestas se envían sin aprobación. Mantén actualizado el perfil de marca.
                </p>
              </div>
            )}

            {settingsError && <p className="text-xs text-red-400">{settingsError}</p>}
          </div>
        )}
      </div>

      {/* Test panel */}
      <div className="rounded-xl border border-white/8 bg-white/4">
        <button
          type="button"
          onClick={() => setTestOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-white">Probar generador de respuestas IA</span>
          <ChevronIcon open={testOpen} />
        </button>

        {testOpen && (
          <div className="border-t border-white/8 px-5 pb-5 pt-4 space-y-3">
            <div className="flex gap-2">
              <select
                value={testProvider}
                onChange={(e) => setTestProvider(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0d0d1e] px-2 py-1.5 text-sm text-white/70 focus:outline-none"
              >
                {AUTO_SEND_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
              <select
                value={testThreadType}
                onChange={(e) => setTestThreadType(e.target.value as "DM" | "COMMENT")}
                className="rounded-lg border border-white/10 bg-[#0d0d1e] px-2 py-1.5 text-sm text-white/70 focus:outline-none"
              >
                <option value="DM">DM</option>
                <option value="COMMENT">Comentario</option>
              </select>
            </div>

            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Pega aquí un mensaje entrante…"
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />

            {testResult !== null && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5 text-sm text-emerald-300 whitespace-pre-wrap">
                {testResult}
              </div>
            )}
            {testError && <p className="text-xs text-red-400">{testError}</p>}

            <div className="flex gap-2">
              <Btn onClick={generateTestReply} disabled={isPendingTest || !testMessage.trim()} variant="primary">
                {isPendingTest ? "Generando…" : "Generar respuesta"}
              </Btn>
              {testResult !== null && (
                <Btn onClick={saveTestToInbox} disabled={isPendingTest} variant="secondary">
                  Guardar en bandeja
                </Btn>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-white/8 bg-white/4 p-1">
        {(
          [
            { id: "inbox" as Tab, label: "Todos", count: inboxThreads.length },
            { id: "needs_human" as Tab, label: "Leads 🔥", count: needsHumanThreads.length },
            { id: "toxic" as Tab, label: "Tóxicos ⚠️", count: toxicThreads.length },
            { id: "history" as Tab, label: "Respondidos", count: historyThreads.length },
            { id: "automation" as Tab, label: "Automatización", count: 0 },
          ] as { id: Tab; label: string; count: number }[]
        ).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === id
                ? "bg-white/8 text-white shadow-sm"
                : "text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            {label}
            {count > 0 && (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs font-bold leading-none",
                  tab === id ? "bg-violet-500 text-white" : "bg-white/10 text-white/50",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "automation" ? (
        <KeywordDmAutomationPanel saasId={saasId} />
      ) : (
        <div className="space-y-3">
          {activeThreads.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            activeThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                leadTemperature={leadTemperatureByThreadId[thread.id] ?? null}
                editedReply={editedReplies[thread.id]}
                isOverriding={overriding[thread.id] ?? false}
                isGenerating={generatingFor === thread.id}
                isPending={isPendingAction && pendingThreadId === thread.id}
                onReplyChange={(v) => setEditedReplies((prev) => ({ ...prev, [thread.id]: v }))}
                onApprove={() => patchThread(thread.id, "APPROVED")}
                onDismiss={() => patchThread(thread.id, "DISMISSED")}
                onOverride={() => generateOverrideReply(thread)}
                onApproveOverride={() => {
                  const r = editedReplies[thread.id] ?? "";
                  patchThread(thread.id, "APPROVED", r);
                  setOverriding((prev) => ({ ...prev, [thread.id]: false }));
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Thread card ───────────────────────────────────────────────────────────────

type ThreadCardProps = {
  thread: ConversationThread;
  leadTemperature: LeadTemperature | null;
  editedReply: string | undefined;
  isOverriding: boolean;
  isGenerating: boolean;
  isPending: boolean;
  onReplyChange: (v: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onOverride: () => void;
  onApproveOverride: () => void;
};

function ThreadCard({
  thread,
  leadTemperature,
  editedReply,
  isOverriding,
  isGenerating,
  isPending,
  onReplyChange,
  onApprove,
  onDismiss,
  onOverride,
  onApproveOverride,
}: ThreadCardProps) {
  const sentiment = getSentiment(thread.aiMetadata);
  const reason = getSentimentReason(thread.aiMetadata);
  const confidence = getConfidence(thread.aiMetadata);
  const isHistory = thread.status === "SENT" || thread.status === "APPROVED" || thread.status === "DISMISSED";
  const displayReply = editedReply ?? thread.suggestedReply ?? "";
  const finalReplyText = thread.finalReply ?? thread.suggestedReply ?? "";

  return (
    <div
      className={[
        "rounded-xl border bg-white/4 transition",
        thread.status === "DISMISSED" ? "opacity-60" : "",
        thread.status === "NEEDS_HUMAN" ? "border-orange-500/30" : "border-white/8",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="text-sm font-semibold text-white">
          {thread.senderName ?? thread.senderHandle ?? "Anónimo"}
        </span>
        {thread.senderHandle && thread.senderHandle !== thread.senderName && (
          <span className="text-xs text-white/35">@{thread.senderHandle}</span>
        )}
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            PROVIDER_BG[thread.provider] ?? "bg-white/8 text-white/50",
          ].join(" ")}
        >
          {PROVIDER_LABELS[thread.provider] ?? thread.provider}
        </span>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/50">
          {thread.threadType === "COMMENT" ? "Comentario" : "DM"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BG[thread.status] ?? "bg-white/8 text-white/40",
          ].join(" ")}
        >
          {STATUS_LABEL[thread.status] ?? thread.status}
        </span>
        {sentiment && (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              SENTIMENT_BG[sentiment] ?? "bg-white/8 text-white/50",
            ].join(" ")}
          >
            {SENTIMENT_LABEL[sentiment] ?? sentiment}
            {confidence !== null && ` · ${Math.round(confidence * 100)}%`}
          </span>
        )}
        {leadTemperature && (
          <span
            className={[
              "rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
              TEMP_META[leadTemperature].border,
              TEMP_META[leadTemperature].bg,
            ].join(" ")}
          >
            {TEMP_META[leadTemperature].label} LEAD
          </span>
        )}
        <span className="ml-auto text-[11px] text-white/25">{relativeTime(thread.createdAt)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Incoming message */}
        <div className="rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white/70">
          {thread.incomingMessage}
        </div>

        {/* NEEDS_HUMAN reason */}
        {thread.status === "NEEDS_HUMAN" && reason && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/8 px-3 py-2 text-xs text-orange-300">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{reason}</span>
          </div>
        )}

        {/* Reply area */}
        {!isHistory && (thread.suggestedReply || isOverriding) && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
              {thread.status === "NEEDS_HUMAN" && !isOverriding ? "Sin respuesta automática generada" : "Respuesta sugerida por IA"}
            </p>
            <textarea
              value={displayReply}
              onChange={(e) => onReplyChange(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
        )}

        {/* History: final reply */}
        {isHistory && finalReplyText && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Respuesta enviada</p>
            <p className="rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-sm text-white/55">
              {finalReplyText}
            </p>
          </div>
        )}

        {/* Actions */}
        {!isHistory && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {thread.status === "NEEDS_HUMAN" && !isOverriding && (
              <>
                <Btn onClick={onOverride} disabled={isPending || isGenerating} variant="secondary">
                  {isGenerating ? "Generando…" : "Generar respuesta"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Descartar
                </Btn>
              </>
            )}
            {thread.status === "NEEDS_HUMAN" && isOverriding && (
              <>
                <Btn onClick={onApproveOverride} disabled={isPending} variant="primary">
                  {isPending ? "Guardando…" : "Aprobar y enviar"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Descartar
                </Btn>
              </>
            )}
            {(thread.status === "PENDING" || thread.status === "AUTO_APPROVED") && (
              <>
                <Btn onClick={onApprove} disabled={isPending} variant="primary">
                  {isPending ? "Guardando…" : "Aprobar"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Descartar
                </Btn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "amber" | "orange" | "emerald";
}) {
  const accentCls = {
    amber: "text-amber-400",
    orange: "text-orange-400",
    emerald: "text-emerald-400",
  }[accent];

  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
      <p className={["text-2xl font-black tabular-nums", accentCls].join(" ")}>{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{label}</p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-violet-500" : "bg-white/15",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["text-white/30 transition-transform", open ? "rotate-180" : ""].join(" ")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "ghost";
}) {
  const cls = {
    primary:
      "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 hover:brightness-110",
    secondary:
      "border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white",
    ghost:
      "text-white/35 hover:text-white/60 hover:bg-white/6",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40",
        cls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, string> = {
    inbox: "Aún no hay actividad. Cuando tus seguidores comenten o envíen DMs, aparecerán aquí.",
    needs_human: "Sin conversaciones escaladas. La IA gestiona automáticamente los comentarios negativos y de baja confianza.",
    toxic: "Sin mensajes tóxicos detectados. La IA identifica automáticamente contenido negativo o dañino.",
    history: "Sin historial aún. Los hilos aprobados y descartados aparecen aquí.",
    automation: "",
  };
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
      <p className="text-sm text-white/35">{messages[tab]}</p>
    </div>
  );
}
