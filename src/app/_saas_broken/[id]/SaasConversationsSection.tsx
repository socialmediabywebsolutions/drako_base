"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { TextArea } from "@/components/ui/input";
import type { ConversationListActorItem, SaasConversation, SaasConversationMessage } from "@/lib/conversations/types";

type Props = {
  saasId: string | null;
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function SaasConversationsSection({ saasId }: Props) {
  const [conversations, setConversations] = useState<ConversationListActorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ conversation: SaasConversation; messages: SaasConversationMessage[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [taskStatus, setTaskStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const loadConversations = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        saasId,
        actorType: "OWNER",
      });
      if (unreadOnly) params.set("unreadOnly", "true");
      const res = await fetch(`/api/conversations?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { conversations?: ConversationListActorItem[] } | null;
      const items = data?.conversations ?? [];
      setConversations(items);
      setSelectedId((prev) => prev ?? items[0]?.conversation.id ?? null);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [saasId, unreadOnly]);

  const unreadCount = useMemo(() => conversations.filter((item) => item.unreadForActor).length, [conversations]);

  const loadDetail = useCallback(async () => {
    if (!saasId || !selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        saasId,
        actorType: "OWNER",
        markAsRead: "true",
      });
      const res = await fetch(`/api/conversations/${encodeURIComponent(selectedId)}/messages?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        conversation?: SaasConversation;
        messages?: SaasConversationMessage[];
      } | null;
      if (data?.conversation) {
        setDetail({ conversation: data.conversation, messages: data.messages ?? [] });
      } else {
        setDetail(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [saasId, selectedId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, unreadOnly]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function sendMessage() {
    if (!saasId || !selectedId || !message.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          actorType: "OWNER",
          content: message.trim(),
        }),
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      setMessage("");
      await loadConversations();
      await loadDetail();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  async function createTaskFromConversation() {
    if (!saasId || !detail?.conversation) return;
    setTaskStatus("saving");
    try {
      const title = `Follow-up: ${detail.conversation.subject ?? "Conversacion"}`;
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          title,
          description: `Revisar y responder lo hablado en la conversacion ${detail.conversation.id}.`,
          status: "OPEN",
          category: "OTHER",
          severity: "INFO",
          metadata: {
            conversationId: detail.conversation.id,
            source: "CONVERSATION",
            taskType: "FOLLOW_UP",
          },
        }),
      });
      if (!res.ok) throw new Error("No se pudo crear la tarea");
      setTaskStatus("done");
      setTimeout(() => setTaskStatus("idle"), 2500);
    } catch {
      setTaskStatus("error");
    }
  }

  return (
    <Card title="Conversaciones" subtitle="Inbox unificado para emails y contactos">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Badge variant="neutral">Total: {conversations.length}</Badge>
          <Badge variant="warn">No leidas: {unreadCount}</Badge>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Solo no leidas
        </label>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando conversaciones...</p>
      ) : conversations.length === 0 ? (
        <EmptyState title="Sin conversaciones" subtitle="Cuando lleguen emails o mensajes apareceran aqui." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
          <div className="space-y-3">
            {conversations.map((item) => {
              const isActive = item.conversation.id === selectedId;
              return (
                <button
                  key={item.conversation.id}
                  className={`w-full rounded-2xl border border-[var(--border)]/60 p-3 text-left transition ${
                    isActive ? "bg-[var(--panel)]" : "bg-[var(--panel)]/40 hover:bg-[var(--panel)]"
                  }`}
                  onClick={() => setSelectedId(item.conversation.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.conversation.subject ?? "Conversacion"}</p>
                    {item.unreadForActor && <Badge variant="warn">{item.unreadCountForActor}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.lastMessagePreview || "Sin mensajes"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)]">
                    <span>{item.type ?? "OTHER"}</span>
                    <span>•</span>
                    <span>{item.source ?? "EMAIL"}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/40 p-4">
            {detailLoading || !detail ? (
              <p className="text-sm text-[var(--muted)]">Selecciona una conversacion.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold">{detail.conversation.subject ?? "Conversacion"}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {detail.conversation.channel ?? "EMAIL"} · {detail.conversation.status ?? "OPEN"}
                  </p>
                </div>
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-2">
                  {detail.messages.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Aun no hay mensajes en esta conversacion.</p>
                  ) : (
                    detail.messages.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{item.senderType}</p>
                          <p className="text-[10px] text-[var(--muted)]">{formatDate(item.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text)]">{item.body}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={createTaskFromConversation} disabled={taskStatus === "saving"}>
                    {taskStatus === "saving" ? "Creando tarea..." : "Crear tarea desde esta conversacion"}
                  </Button>
                  {taskStatus === "done" && <span className="text-xs text-[var(--muted)]">Tarea creada.</span>}
                  {taskStatus === "error" && <span className="text-xs text-[var(--danger)]">No se pudo crear la tarea.</span>}
                </div>
                <div className="space-y-2">
                  <TextArea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Responder desde el Owner Inbox..."
                    rows={3}
                  />
                  {sendError && <p className="text-xs text-[var(--danger)]">{sendError}</p>}
                  <div className="flex justify-end">
                    <Button onClick={sendMessage} disabled={sending || !message.trim()}>
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
