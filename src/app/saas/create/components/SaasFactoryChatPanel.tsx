"use client";

import type { ReactNode } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextArea } from "@/components/ui/input";

export type SaasFactoryChatMessage = { role: "user" | "campamento-base"; content: string };

export default function SaasFactoryChatPanel({
  messages,
  input,
  loading,
  onInputChange,
  onSend,
  footer,
}: {
  messages: SaasFactoryChatMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  footer?: ReactNode;
}) {
  return (
    <Card tone="glass" title="Chat Campamento Base" subtitle="Creador de SaaS conversacional">
      <div className="flex h-full flex-col gap-3 text-sm text-[var(--muted)]">
        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/60 p-3">
          {messages.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} className={msg.role === "user" ? "text-right" : "text-left"}>
              <p className={msg.role === "user" ? "inline-block rounded-2xl bg-[var(--brand)] px-3 py-2 text-white" : "inline-block rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/80 px-3 py-2 text-[var(--text)]"}>
                {msg.content}
              </p>
            </div>
          ))}
        </div>
        <TextArea
          placeholder="Ej: Peluqueria en Bilbao con marketing BASIC y contabilidad FULL."
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={3}
        />
        <Button onClick={onSend} disabled={loading || !input.trim()}>
          {loading ? "Pensando..." : "Enviar"}
        </Button>
        {footer}
      </div>
    </Card>
  );
}
