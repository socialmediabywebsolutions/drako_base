"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSettings, ConversationThread } from "@/lib/socialflow/conversational/types";

type Props = {
  threads: ConversationThread[];
  settings: ConversationSettings;
  saasId: string;
  hotLeadThreadIds?: string[];
};

type Tab = "inbox" | "needs_human" | "history";

const AUTO_SEND_PROVIDERS = ["INSTAGRAM", "FACEBOOK_PAGE", "LINKEDIN"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook",
  LINKEDIN: "LinkedIn",
};

const PROVIDER_BG: Record<string, string> = {
  INSTAGRAM: "bg-pink-100 text-pink-700",
  FACEBOOK_PAGE: "bg-blue-100 text-blue-700",
  LINKEDIN: "bg-sky-100 text-sky-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  AUTO_APPROVED: "Auto-approved",
  APPROVED: "Approved",
  SENT: "Sent",
  DISMISSED: "Dismissed",
  NEEDS_HUMAN: "Needs review",
};

const STATUS_BG: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  AUTO_APPROVED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-slate-100 text-slate-600",
  DISMISSED: "bg-rose-50 text-rose-500",
  NEEDS_HUMAN: "bg-orange-100 text-orange-700",
};

const SENTIMENT_BG: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
  lead: "bg-violet-100 text-violet-700",
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConversationInbox({
  threads: initialThreads,
  settings: initialSettings,
  saasId,
  hotLeadThreadIds = [],
}: Props) {
  const hotLeadSet = new Set(hotLeadThreadIds);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("inbox");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [threads, setThreads] = useState(initialThreads);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Test panel state
  const [testMessage, setTestMessage] = useState("");
  const [testProvider, setTestProvider] = useState("INSTAGRAM");
  const [testThreadType, setTestThreadType] = useState<"DM" | "COMMENT">("DM");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Per-thread editing + override state
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [overriding, setOverriding] = useState<Record<string, boolean>>({});
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);

  const [isPendingSettings, startSettingsTransition] = useTransition();
  const [isPendingTest, startTestTransition] = useTransition();
  const [isPendingAction, startActionTransition] = useTransition();

  // ── Tab bucketing ──────────────────────────────────────────────────────────
  const inboxThreads = threads.filter((t) => t.status === "PENDING" || t.status === "AUTO_APPROVED");
  const needsHumanThreads = threads.filter((t) => t.status === "NEEDS_HUMAN");
  const historyThreads = threads.filter(
    (t) => t.status === "SENT" || t.status === "APPROVED" || t.status === "DISMISSED",
  );

  const activeThreads =
    tab === "inbox" ? inboxThreads : tab === "needs_human" ? needsHumanThreads : historyThreads;

  // ── Settings ───────────────────────────────────────────────────────────────
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
        setSettingsError(e instanceof Error ? e.message : "Failed to update settings");
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
        setSettingsError(e instanceof Error ? e.message : "Failed to update providers");
      }
    });
  }

  // ── Test panel ─────────────────────────────────────────────────────────────
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
        setTestError(e instanceof Error ? e.message : "Generation failed");
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
        setTestError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  // ── Thread actions ─────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="In inbox" value={inboxThreads.length} accent="amber" />
        <StatCard label="Needs review" value={needsHumanThreads.length} accent="orange" />
        <StatCard label="Sent / approved" value={historyThreads.filter((t) => t.status === "SENT" || t.status === "APPROVED").length} accent="emerald" />
      </div>

      {/* Settings card (collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">Auto-send settings</span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-medium",
                settings.autoSendEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {settings.autoSendEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <ChevronIcon open={settingsOpen} />
        </button>

        {settingsOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Auto-send replies</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When on, AI replies are sent automatically without human approval.
                </p>
              </div>
              <Toggle checked={settings.autoSendEnabled} onChange={toggleAutoSend} disabled={isPendingSettings} />
            </div>

            {settings.autoSendEnabled && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active for</p>
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
                            ? "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                        ].join(" ")}
                      >
                        {PROVIDER_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Replies will be sent without approval. Keep your brand profile up to date.
                </p>
              </div>
            )}

            {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
          </div>
        )}
      </div>

      {/* Test panel (collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setTestOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-slate-800">Test AI reply generator</span>
          <ChevronIcon open={testOpen} />
        </button>

        {testOpen && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-3">
            <div className="flex gap-2">
              <select
                value={testProvider}
                onChange={(e) => setTestProvider(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none"
              >
                {AUTO_SEND_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
              <select
                value={testThreadType}
                onChange={(e) => setTestThreadType(e.target.value as "DM" | "COMMENT")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none"
              >
                <option value="DM">DM</option>
                <option value="COMMENT">Comment</option>
              </select>
            </div>

            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Paste an incoming message…"
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />

            {testResult !== null && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 whitespace-pre-wrap">
                {testResult}
              </div>
            )}
            {testError && <p className="text-xs text-red-600">{testError}</p>}

            <div className="flex gap-2">
              <Btn
                onClick={generateTestReply}
                disabled={isPendingTest || !testMessage.trim()}
                variant="primary"
              >
                {isPendingTest ? "Generating…" : "Generate reply"}
              </Btn>
              {testResult !== null && (
                <Btn onClick={saveTestToInbox} disabled={isPendingTest} variant="secondary">
                  Save to inbox
                </Btn>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {(
          [
            { id: "inbox" as Tab, label: "Inbox", count: inboxThreads.length },
            { id: "needs_human" as Tab, label: "Needs review", count: needsHumanThreads.length },
            { id: "history" as Tab, label: "History", count: historyThreads.length },
          ] as { id: Tab; label: string; count: number }[]
        ).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {label}
            {count > 0 && (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-xs font-bold leading-none",
                  tab === id ? "bg-slate-900 text-white" : "bg-slate-300 text-slate-600",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="space-y-3">
        {activeThreads.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          activeThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isHotLead={hotLeadSet.has(thread.id)}
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
    </div>
  );
}

// ── Thread card ───────────────────────────────────────────────────────────────

type ThreadCardProps = {
  thread: ConversationThread;
  isHotLead: boolean;
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
  isHotLead,
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
        "rounded-xl border bg-white shadow-sm transition",
        thread.status === "DISMISSED" ? "opacity-60" : "",
        thread.status === "NEEDS_HUMAN" ? "border-orange-200" : "border-slate-200",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          {thread.senderName ?? thread.senderHandle ?? "Anonymous"}
        </span>
        {thread.senderHandle && thread.senderHandle !== thread.senderName && (
          <span className="text-xs text-slate-400">@{thread.senderHandle}</span>
        )}
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            PROVIDER_BG[thread.provider] ?? "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {PROVIDER_LABELS[thread.provider] ?? thread.provider}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {thread.threadType === "COMMENT" ? "Comment" : "DM"}
        </span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BG[thread.status] ?? "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {STATUS_LABEL[thread.status] ?? thread.status}
        </span>
        {sentiment && (
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              SENTIMENT_BG[sentiment] ?? "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {SENTIMENT_LABEL[sentiment] ?? sentiment}
            {confidence !== null && ` · ${Math.round(confidence * 100)}%`}
          </span>
        )}
        {isHotLead && (
          <span className="rounded-full border border-rose-200 bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-rose-700">
            HOT LEAD
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">{relativeTime(thread.createdAt)}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Incoming message */}
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {thread.incomingMessage}
        </div>

        {/* NEEDS_HUMAN reason */}
        {thread.status === "NEEDS_HUMAN" && reason && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{reason}</span>
          </div>
        )}

        {/* Reply area */}
        {!isHistory && (thread.suggestedReply || isOverriding) && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {thread.status === "NEEDS_HUMAN" && !isOverriding ? "No auto-reply generated" : "AI suggested reply"}
            </p>
            <textarea
              value={displayReply}
              onChange={(e) => onReplyChange(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        )}

        {/* History: final reply */}
        {isHistory && finalReplyText && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reply sent</p>
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
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
                  {isGenerating ? "Generating…" : "Generate reply"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Dismiss
                </Btn>
              </>
            )}
            {thread.status === "NEEDS_HUMAN" && isOverriding && (
              <>
                <Btn onClick={onApproveOverride} disabled={isPending} variant="primary">
                  {isPending ? "Saving…" : "Approve & save"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Dismiss
                </Btn>
              </>
            )}
            {(thread.status === "PENDING" || thread.status === "AUTO_APPROVED") && (
              <>
                <Btn onClick={onApprove} disabled={isPending} variant="primary">
                  {isPending ? "Saving…" : "Approve"}
                </Btn>
                <Btn onClick={onDismiss} disabled={isPending} variant="ghost">
                  Dismiss
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className={["text-2xl font-black tabular-nums", accentCls].join(" ")}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
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
        checked ? "bg-sky-500" : "bg-slate-200",
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
      className={["text-slate-400 transition-transform", open ? "rotate-180" : ""].join(" ")}
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
      "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    secondary:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost:
      "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
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
    inbox: "No pending replies. Messages will appear here when they arrive via webhook or the test panel.",
    needs_human: "No escalated threads. The AI handles negative sentiment and low-confidence comments automatically.",
    history: "No history yet. Approved and dismissed threads appear here.",
  };
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
      <p className="text-sm text-slate-400">{messages[tab]}</p>
    </div>
  );
}
