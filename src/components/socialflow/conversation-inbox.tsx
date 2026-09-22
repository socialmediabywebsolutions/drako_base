"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSettings, ConversationThread } from "@/lib/socialflow/conversational/types";
import type { LeadTemperature } from "@/lib/socialflow/leads/types";
import { TEMP_META } from "./leads-panel";
import KeywordDmAutomationPanel from "./keyword-dm-panel";
import AgentSchedulePanel from "./agent-schedule-panel";

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
  INSTAGRAM: "bg-pink-50 text-pink-700",
  FACEBOOK_PAGE: "bg-blue-50 text-blue-700",
  LINKEDIN: "bg-sky-50 text-sky-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  AUTO_APPROVED: "Auto-aprobado",
  APPROVED: "Aprobado",
  SENT: "Enviado",
  DISMISSED: "Descartado",
  NEEDS_HUMAN: "Requiere revisión",
  DELIVERY_FAILED: "Envío fallido",
};

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  AUTO_APPROVED: "bg-sky-50 text-sky-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  SENT: "bg-gray-100 text-gray-500",
  DISMISSED: "bg-rose-50 text-rose-600",
  NEEDS_HUMAN: "bg-orange-50 text-orange-700",
  DELIVERY_FAILED: "bg-red-50 text-red-700",
};

const SENTIMENT_BG: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700",
  negative: "bg-red-50 text-red-700",
  neutral: "bg-gray-100 text-gray-500",
  lead: "bg-blue-50 text-blue-700",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positivo",
  negative: "Negativo",
  neutral: "Neutro",
  lead: "Lead",
};

// Fallback legible cuando el PATCH de threads/[id] falla sin `message` (ej. una
// excepción no relacionada con Meta) — si el backend sí trae `message` (el motivo
// real que devuelve la API de Instagram), ese texto se usa tal cual en su lugar.
const ACTION_ERROR_LABEL: Record<string, string> = {
  INSTAGRAM_DM_FAILED: "Instagram rechazó el envío del DM.",
  INSTAGRAM_REPLY_FAILED: "Instagram rechazó la respuesta al comentario.",
  INSTAGRAM_ACCOUNT_NOT_CONNECTED: "No hay una cuenta de Instagram conectada.",
  MISSING_REPLY_OR_COMMENT_ID: "Falta la respuesta o el identificador del hilo.",
  THREAD_NOT_FOUND: "El hilo ya no existe.",
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
  const [settings, setSettings] = useState(initialSettings);
  const [threads, setThreads] = useState(initialThreads);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [overriding, setOverriding] = useState<Record<string, boolean>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const [isPendingSettings, startSettingsTransition] = useTransition();
  const [isPendingAction, startActionTransition] = useTransition();

  const inboxThreads = threads.filter(
    (t) => t.status === "PENDING" || t.status === "AUTO_APPROVED" || t.status === "DELIVERY_FAILED",
  );
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

  function patchThread(threadId: string, status: ConversationThread["status"], finalReply?: string | null) {
    setPendingThreadId(threadId);
    // Limpia el error de un intento previo sobre este mismo hilo — si este intento
    // también falla, se vuelve a poblar más abajo; si tiene éxito, no debe quedar
    // pegado el mensaje del intento anterior.
    setActionErrors((prev) => {
      if (!(threadId in prev)) return prev;
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
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
          message?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.message || (data.error ? ACTION_ERROR_LABEL[data.error] : undefined) || data.error || "No se pudo actualizar el hilo.");
        }
        if (data.thread) setThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread! : t)));
      } catch (e) {
        setActionErrors((prev) => ({
          ...prev,
          [threadId]: e instanceof Error ? e.message : "No se pudo enviar. Inténtalo de nuevo.",
        }));
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
        body: JSON.stringify({ saasId, message: thread.incomingMessage, threadType: thread.threadType, provider: thread.provider }),
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">Envío automático</span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-medium",
                settings.autoSendEnabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-400",
              ].join(" ")}
            >
              {settings.autoSendEnabled ? "Activado" : "Desactivado"}
            </span>
          </div>
          <ChevronIcon open={settingsOpen} />
        </button>

        {settingsOpen && (
          <div className="border-t border-gray-200 px-5 pb-5 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Respuestas automáticas</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Si está activo, las respuestas de IA se envían sin aprobación humana.
                </p>
              </div>
              <Toggle checked={settings.autoSendEnabled} onChange={toggleAutoSend} disabled={isPendingSettings} />
            </div>

            {settings.autoSendEnabled && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Activo para</p>
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
                            ? "border-blue-400 bg-blue-100 text-blue-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
                        ].join(" ")}
                      >
                        {PROVIDER_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Las respuestas se envían sin aprobación. Mantén actualizado el perfil de marca.
                </p>
              </div>
            )}

            {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
          </div>
        )}
      </div>

      {/* Horario del Agente */}
      <AgentSchedulePanel
        saasId={saasId}
        autoSendEnabled={settings.autoSendEnabled}
        initialActiveHoursJson={settings.activeHoursJson}
        onSaved={setSettings}
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
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
                ? "bg-gray-100 text-gray-900 shadow-sm"
                : "text-gray-400 hover:text-gray-700",
            ].join(" ")}
          >
            {label}
            {count > 0 && (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs font-bold leading-none",
                  tab === id ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500",
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
                error={actionErrors[thread.id] ?? null}
                onReplyChange={(v) => setEditedReplies((prev) => ({ ...prev, [thread.id]: v }))}
                onApprove={() => patchThread(thread.id, "APPROVED")}
                onRetry={() => patchThread(thread.id, "APPROVED", thread.finalReply ?? thread.suggestedReply ?? null)}
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
  error: string | null;
  onReplyChange: (v: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
  onOverride: () => void;
  onApproveOverride: () => void;
  onRetry: () => void;
};

function ThreadCard({
  thread,
  leadTemperature,
  editedReply,
  isOverriding,
  isGenerating,
  isPending,
  error,
  onReplyChange,
  onApprove,
  onDismiss,
  onOverride,
  onApproveOverride,
  onRetry,
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
        "rounded-xl border bg-white shadow-sm transition",
        thread.status === "DISMISSED" ? "opacity-60" : "",
        thread.status === "NEEDS_HUMAN" ? "border-orange-300"
          : thread.status === "DELIVERY_FAILED" ? "border-red-300"
          : "border-gray-200",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">
          {thread.senderName ?? thread.senderHandle ?? "Anónimo"}
        </span>
        {thread.senderHandle && thread.senderHandle !== thread.senderName && (
          <span className="text-xs text-gray-400">@{thread.senderHandle}</span>
        )}
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            PROVIDER_BG[thread.provider] ?? "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {PROVIDER_LABELS[thread.provider] ?? thread.provider}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {thread.threadType === "COMMENT" ? "Comentario" : "DM"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BG[thread.status] ?? "bg-gray-100 text-gray-400",
          ].join(" ")}
        >
          {STATUS_LABEL[thread.status] ?? thread.status}
        </span>
        {sentiment && (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              SENTIMENT_BG[sentiment] ?? "bg-gray-100 text-gray-500",
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
        <span className="ml-auto text-[11px] text-gray-400">{relativeTime(thread.createdAt)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Incoming message */}
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          {thread.incomingMessage}
        </div>

        {/* NEEDS_HUMAN reason */}
        {thread.status === "NEEDS_HUMAN" && reason && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{reason}</span>
          </div>
        )}

        {/* DELIVERY_FAILED: se aprobó pero Meta rechazó el envío real — distinto de
            actionErrors (fallo del PATCH en sí), este es un fallo de entrega ya
            persistido en el hilo. */}
        {thread.status === "DELIVERY_FAILED" && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>Se aprobó pero Instagram rechazó el envío. El mensaje NO llegó al destinatario.</span>
          </div>
        )}

        {/* Reply area */}
        {!isHistory && (thread.suggestedReply || isOverriding) && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {thread.status === "NEEDS_HUMAN" && !isOverriding ? "Sin respuesta automática generada" : "Respuesta sugerida por IA"}
            </p>
            <textarea
              value={displayReply}
              onChange={(e) => onReplyChange(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {/* History: final reply */}
        {isHistory && finalReplyText && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Respuesta enviada</p>
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {finalReplyText}
            </p>
          </div>
        )}

        {/* Envío fallido — no se marcó APPROVED, el hilo sigue pendiente para reintentar */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>No se pudo enviar: {error}</span>
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
            {thread.status === "DELIVERY_FAILED" && (
              <>
                <Btn onClick={onRetry} disabled={isPending} variant="primary">
                  {isPending ? "Reintentando…" : "Reintentar envío"}
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
    amber: "text-amber-600",
    orange: "text-orange-600",
    emerald: "text-emerald-600",
  }[accent];

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className={["text-2xl font-black tabular-nums", accentCls].join(" ")}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{label}</p>
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
        checked ? "bg-blue-500" : "bg-gray-300",
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
      className={["text-gray-400 transition-transform", open ? "rotate-180" : ""].join(" ")}
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
      "bg-blue-500 text-white shadow-md hover:bg-blue-600",
    secondary:
      "border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    ghost:
      "text-gray-400 hover:text-gray-600 hover:bg-gray-50",
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
    <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
      <p className="text-sm text-gray-400">{messages[tab]}</p>
    </div>
  );
}
