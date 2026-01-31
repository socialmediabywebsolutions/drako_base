"use client";

import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import type { AgentRuntimeState } from "@/lib/owner/types";

export type RightPanelProps = {
    agents: AgentRuntimeState[];
};

const AGENT_META = {
    GROWTH: { label: "Growth Agent", icon: "📈" },
    ACCOUNTING: { label: "Accounting Agent", icon: "💰" },
    LEGAL: { label: "Legal & Fiscal", icon: "⚖️" },
    TECHOPS: { label: "Tech Operations", icon: "🔧" },
    SUPPORT: { label: "Customer Support", icon: "🎧" },
};

function AgentCard({ agent }: { agent: AgentRuntimeState }) {
    const meta = AGENT_META[agent.role];
    const statusColor =
        agent.status === 'WORKING' ? 'border-green-500/30 bg-green-500/5' :
            agent.status === 'BLOCKED' ? 'border-red-500/50 bg-red-950/20' :
                agent.status === 'ERROR' ? 'border-red-600 bg-red-950/30' :
                    'border-[var(--border)] bg-[var(--bg-surface)]';

    return (
        <div className={`rounded-lg border p-3 transition-colors ${statusColor}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <span className="text-sm font-semibold">{meta.label}</span>
                </div>
                <Badge variant={
                    agent.status === 'WORKING' ? 'ok' :
                        agent.status === 'BLOCKED' ? 'err' :
                            agent.status === 'ERROR' ? 'err' : 'neutral'
                } className="text-[10px]">
                    {agent.status}
                </Badge>
            </div>

            <div className="min-h-[24px]">
                {agent.status === 'IDLE' ? (
                    <p className="text-xs italic text-[var(--muted)]">Esperando órdenes...</p>
                ) : (
                    <p className="text-xs text-[var(--text)] font-mono line-clamp-2">
                        {">"} {agent.current_task || agent.last_error || "Procesando..."}
                    </p>
                )}
            </div>

            {agent.last_heartbeat && (
                <div className="mt-2 flex justify-between items-end">
                    <span className="text-[10px] text-[var(--muted)]">
                        Last: {new Date(agent.last_heartbeat * 1000).toLocaleTimeString()}
                    </span>
                    <Button size="sm" variant="outline" className="h-5 text-[9px] px-2">LOGS</Button>
                </div>
            )}
        </div>
    );
}

export default function CampamentoRightPanel({ agents = [] }: RightPanelProps) {
    return (
        <div className="flex h-full flex-col gap-4 overflow-y-auto pl-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">WORKFORCE (AGENTS)</h3>

            <div className="space-y-3">
                {agents.map((agent, idx) => (
                    <AgentCard key={agent.agent_id || idx} agent={agent} />
                ))}
                {agents.length === 0 && (
                    <p className="text-center text-xs text-[var(--muted)]">No active agents deployed.</p>
                )}
            </div>

            <div className="mt-auto rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
                <p className="text-xs text-[var(--muted)]">¿Necesitas más capacidad?</p>
                <Button size="sm" variant="outline" className="mt-2 w-full">Deploy New Agent</Button>
            </div>
        </div>
    );
}
