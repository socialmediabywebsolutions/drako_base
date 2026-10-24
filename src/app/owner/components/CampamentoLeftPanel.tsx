"use client";

import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { TextInput } from "@/components/ui/input";
import type { TechIncident } from "@/lib/owner/types";

// Types for the Left Panel (Executive)
export type LeftPanelProps = {
    criticalEvents: Array<{
        id: string;
        severity: "CRITICAL" | "HIGH";
        message: string;
        timestamp: string;
    }>;
    pendingDecisions: Array<{
        id: string;
        title: string;
        priority: "CRITICAL" | "HIGH" | "NORMAL";
    }>;
    techIncidents: TechIncident[];
};

export default function CampamentoLeftPanel({ criticalEvents = [], pendingDecisions = [], techIncidents = [] }: LeftPanelProps) {
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "system"; text: string }>>([
        { role: "system", text: "System ready. Monitoring holding status..." }
    ]);

    const handleCommand = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim()) return;

        const cmd = chatInput.trim();
        setChatHistory(prev => [...prev, { role: "user", text: cmd }]);
        setChatInput("");

        try {
            const res = await fetch("/api/operator/orchestrator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: cmd }),
            });

            const data = await res.json() as { ok: boolean; reply: string };

            setChatHistory(prev => [
                ...prev,
                { role: "system", text: data.ok ? data.reply : "❌ Error procesando comando" }
            ]);
        } catch (error) {
            console.error("Orchestrator error:", error);
            setChatHistory(prev => [...prev, { role: "system", text: "⚠️ Error de conexión" }]);
        }
    };

    return (
        <div className="flex h-full flex-col gap-4 overflow-hidden">
            {/* 1. ORCHESTRATOR CHAT */}
            <Card tone="glass" className="flex-shrink-0 flex flex-col h-1/3 min-h-[250px]">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--brand)]">Orchestrator</h3>
                    <div className="flex gap-2">
                        {techIncidents.length > 0 && (
                            <Badge variant="err" className="text-[10px] animate-pulse">
                                {techIncidents.length} TECH ALERTS
                            </Badge>
                        )}
                        <Badge variant="neutral" className="text-[10px]">ONLINE</Badge>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto rounded bg-black/20 p-2 text-xs space-y-2 mb-2">
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`${msg.role === "system" ? "text-[var(--muted)]" : "text-[var(--text)] font-semibold text-right"}`}>
                            {msg.role === "system" && <span className="mr-1 opacity-50">{">"}</span>}
                            {msg.text}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleCommand} className="flex gap-2">
                    <TextInput
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="/brief, /alerts, /actions..."
                        className="h-8 text-xs font-mono"
                    />
                    <Button type="submit" size="sm" variant="brand" className="h-8 w-8 p-0">→</Button>
                </form>
            </Card>

            {/* 2. CRITICAL ALARMS */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {criticalEvents.length > 0 && (
                    <Card tone="glass" title="FUEGO / ALERTAS" className="animate-pulse border-red-500/50 bg-red-950/20">
                        <div className="space-y-2">
                            {criticalEvents.map((event) => (
                                <div key={event.id} className="flex gap-2 text-xs text-red-200">
                                    <span className="font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                    <span>{event.message}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {techIncidents.length > 0 && (
                    <Card tone="glass" title="Technical Incidents">
                        <div className="space-y-2">
                            {techIncidents.map((inc) => (
                                <div key={inc.id} className="flex flex-col gap-1 rounded bg-black/20 p-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-red-400">{inc.service}</span>
                                        <Badge variant="err" className="text-[9px]">{inc.severity}</Badge>
                                    </div>
                                    <p>{inc.title}</p>
                                    <p className="text-[var(--muted)] italic">{inc.status}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* 3. DECISION QUEUE */}
                <Card tone="glass" title="Decisiones Pendientes" subtitle="Bloqueantes para el holding">
                    {pendingDecisions.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">Nada pendiente. Todo fluye.</p>
                    ) : (
                        <div className="space-y-2">
                            {pendingDecisions.map((decision) => (
                                <div key={decision.id} className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-medium leading-tight">{decision.title}</p>
                                        <Badge variant={decision.priority === 'CRITICAL' ? 'err' : 'warn'} className="text-[10px]">{decision.priority}</Badge>
                                    </div>
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            size="xs"
                                            variant="brand"
                                            className="w-full"
                                            onClick={async () => {
                                                try {
                                                    await fetch(`/api/operator/actions/${decision.id}/decision`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ decision: "APPROVE" }),
                                                    });
                                                    window.location.reload();
                                                } catch (error) {
                                                    console.error("Approve error:", error);
                                                }
                                            }}
                                        >
                                            Aprobar
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            className="w-full"
                                            onClick={async () => {
                                                try {
                                                    await fetch(`/api/operator/actions/${decision.id}/decision`, {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ decision: "REJECT" }),
                                                    });
                                                    window.location.reload();
                                                } catch (error) {
                                                    console.error("Reject error:", error);
                                                }
                                            }}
                                        >
                                            Rechazar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
