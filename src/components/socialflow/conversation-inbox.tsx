"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConversationSettings, ConversationThread } from "@/lib/socialflow/conversational/types";

type Props = {
  threads: ConversationThread[];
  settings: ConversationSettings;
  saasId: string;
};

const AUTO_SEND_PROVIDERS = ["INSTAGRAM", "FACEBOOK_PAGE", "LINKEDIN"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK_PAGE: "Facebook Page",
  LINKEDIN: "LinkedIn",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  AUTO_APPROVED: "Auto-approved",
  APPROVED: "Approved",
  SENT: "Sent",
  DISMISSED: "Dismissed",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  AUTO_APPROVED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-slate-100 text-slate-600",
  DISMISSED: "bg-rose-100 text-rose-600",
};

export default function ConversationInbox({ threads: initialThreads, settings: initialSettings, saasId }: Props) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [threads, setThreads] = useState(initialThreads);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testProvider, setTestProvider] = useState("INSTAGRAM");
  const [testThreadType, setTestThreadType] = useState<"DM" | "COMMENT">("DM");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [isPendingSettings, startSettingsTransition] = useTransition();
  const [isPendingTest, startTestTransition] = useTransition();
  const [isPendingAction, startActionTransition] = useTransition();

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
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: ConversationSettings; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to update settings");
        if (data.settings) setSettings(data.settings);
      } catch (e: unknown) {
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
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: ConversationSettings; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to update providers");
        if (data.settings) setSettings(data.settings);
      } catch (e: unknown) {
        setSettingsError(e instanceof Error ? e.message : "Failed to update providers");
      }
    });
  }

  function generateReply() {
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
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; suggestedReply?: string; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Generation failed");
        setTestResult(data.suggestedReply ?? "");
      } catch (e: unknown) {
        setTestError(e instanceof Error ? e.message : "Generation failed");
      }
    });
  }

  function saveToInbox() {
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
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; thread?: ConversationThread; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save");
        if (data.thread) setThreads((prev) => [data.thread!, ...prev]);
        setTestMessage("");
        setTestResult(null);
      } catch (e: unknown) {
        setTestError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function patchThread(threadId: string, status: ConversationThread["status"]) {
    setPendingThreadId(threadId);
    startActionTransition(async () => {
      try {
        const finalReply = editedReplies[threadId] ?? threads.find((t) => t.id === threadId)?.suggestedReply ?? null;
        const res = await fetch(`/api/socialflow/conversations/threads/${threadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, status, finalReply }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; thread?: ConversationThread; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || "Update failed");
        if (data.thread) {
          setThreads((prev) => prev.map((t) => (t.id === threadId ? data.thread! : t)));
        }
      } catch {
        // silently leave thread in place — page refresh recovers
        router.refresh();
      } finally {
        setPendingThreadId(null);
      }
    });
  }

  const visibleThreads = threads.filter((t) => t.status === "PENDING" || t.status === "AUTO_APPROVED");

  return (
    <div className="space-y-6">
      {/* Auto-send settings card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-bold text-slate-900">Auto-send</div>
            <p className="mt-1 text-sm text-slate-500">
              When enabled, AI replies are published automatically without human review.
            </p>
          </div>
          <button
            onClick={toggleAutoSend}
            disabled={isPendingSettings}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
              settings.autoSendEnabled ? "bg-sky-500" : "bg-slate-200",
              isPendingSettings ? "opacity-50" : "",
            ].join(" ")}
            role="switch"
            aria-checked={settings.autoSendEnabled}
          >
            <span
              className={[
                "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                settings.autoSendEnabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {settings.autoSendEnabled && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Auto-send will publish replies without human review. Make sure your brand profile is complete and accurate.
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Enable for these providers
              </div>
              {AUTO_SEND_PROVIDERS.map((provider) => (
                <label key={provider} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.autoSendProviders.includes(provider)}
                    onChange={() => toggleProvider(provider)}
                    disabled={isPendingSettings}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{PROVIDER_LABELS[provider]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {settingsError && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {settingsError}
          </div>
        )}
      </div>

      {/* Manual test panel */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-base font-bold text-slate-900">Test reply generator</div>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Paste a DM or comment to preview how the AI would respond using your brand knowledge.
        </p>

        <div className="space-y-3">
          <div className="flex gap-3">
            <select
              value={testProvider}
              onChange={(e) => setTestProvider(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {AUTO_SEND_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            <select
              value={testThreadType}
              onChange={(e) => setTestThreadType(e.target.value as "DM" | "COMMENT")}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="DM">DM</option>
              <option value="COMMENT">Comment</option>
            </select>
          </div>

          <textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Paste the incoming message here…"
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          {testResult !== null && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 whitespace-pre-wrap">
              {testResult}
            </div>
          )}

          {testError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {testError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={generateReply}
              disabled={isPendingTest || !testMessage.trim()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:-translate-y-0.5 hover:bg-sky-600 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isPendingTest ? "Generating…" : "Generate reply"}
            </button>
            {testResult !== null && (
              <button
                onClick={saveToInbox}
                disabled={isPendingTest || !testMessage.trim()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Save to inbox
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inbox */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-bold text-slate-900">
            Inbox
            {visibleThreads.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {visibleThreads.length}
              </span>
            )}
          </div>
        </div>

        {visibleThreads.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No pending replies. Messages will appear here when they arrive via webhook or manual test.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleThreads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">
                    {thread.senderName ?? thread.senderHandle ?? "Anonymous"}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {PROVIDER_LABELS[thread.provider] ?? thread.provider}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize">
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_COLORS[thread.status] ?? "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {STATUS_LABELS[thread.status] ?? thread.status}
                    </span>
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  {thread.incomingMessage}
                </div>

                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    AI suggested reply
                  </div>
                  <textarea
                    value={editedReplies[thread.id] ?? thread.suggestedReply ?? ""}
                    onChange={(e) =>
                      setEditedReplies((prev) => ({ ...prev, [thread.id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => patchThread(thread.id, "APPROVED")}
                    disabled={isPendingAction && pendingThreadId === thread.id}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {isPendingAction && pendingThreadId === thread.id ? "Saving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => patchThread(thread.id, "DISMISSED")}
                    disabled={isPendingAction && pendingThreadId === thread.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
