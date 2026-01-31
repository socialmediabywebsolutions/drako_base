"use client";

import Badge from "@/components/ui/badge";
import CampamentoProfile from "./CampamentoProfile";
import type { OwnerProfile } from "@/lib/owner/types";

// Types for the Center Panel (Reality)
export type CenterPanelProps = {
    profile: OwnerProfile | null;
    onSaveProfile: (data: Partial<OwnerProfile>) => Promise<void>;
    financials: {
        totalMrr: number;
        netProfit: number;
        runwayMonths: number;
        burnRate: number;
    } | null;
    saasMatrix: Array<{
        id: string;
        name: string;
        vertical: string;
        status: "HEALTHY" | "AT_RISK" | "CRITICAL" | "OFFLINE";
        mrr: number;
        agentsActive: number;
    }>;
};

function formatMoney(amount: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

export default function CampamentoCenterPanel({ profile, onSaveProfile, financials, saasMatrix }: CenterPanelProps) {
    return (
        <div className="flex h-full flex-col gap-4 overflow-y-auto pr-2">

            {/* 1. FINANCIAL TRUTH */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">MRR Holding</p>
                    <p className="text-2xl font-bold text-[var(--text)]">
                        {financials ? formatMoney(financials.totalMrr) : "—"}
                    </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Beneficio Neto</p>
                    <p className={`text-2xl font-bold ${financials && financials.netProfit < 0 ? "text-red-400" : "text-green-400"}`}>
                        {financials ? formatMoney(financials.netProfit) : "—"}
                    </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Burn Rate</p>
                    <p className="text-xl font-medium text-[var(--text)]">
                        {financials ? formatMoney(financials.burnRate) : "—"}
                    </p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Runway</p>
                    <p className="text-xl font-medium text-[var(--text)]">
                        {financials ? `${financials.runwayMonths} meses` : "—"}
                    </p>
                </div>
            </div>

            {/* 2. OWNER PROFILE */}
            <CampamentoProfile profile={profile} onSave={onSaveProfile} />

            {/* 3. SAAS MATRIX */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Matriz de Realidad (SaaS)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] text-[10px] uppercase text-[var(--muted)]">
                                <th className="pb-2 font-medium">Unidad</th>
                                <th className="pb-2 font-medium">Vertical</th>
                                <th className="pb-2 font-medium">Estado</th>
                                <th className="pb-2 font-medium text-right">MRR</th>
                                <th className="pb-2 font-medium text-right">Agentes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]/50">
                            {saasMatrix.map(saas => (
                                <tr key={saas.id} className="group">
                                    <td className="py-3 font-semibold text-[var(--text)]">{saas.name}</td>
                                    <td className="py-3 text-[var(--muted)]">{saas.vertical}</td>
                                    <td className="py-3">
                                        <Badge variant={
                                            saas.status === 'HEALTHY' ? 'ok' :
                                                saas.status === 'CRITICAL' ? 'err' :
                                                    saas.status === 'AT_RISK' ? 'warn' : 'neutral'
                                        }>
                                            {saas.status}
                                        </Badge>
                                    </td>
                                    <td className="py-3 text-right font-mono">{formatMoney(saas.mrr)}</td>
                                    <td className="py-3 text-right">
                                        {saas.agentsActive > 0 ? (
                                            <span className="text-green-400 font-bold">{saas.agentsActive} ON</span>
                                        ) : (
                                            <span className="text-[var(--muted)]">OFF</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. INFRA HEALTH (Placeholder) */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Infraestructura Global</h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-center">
                        <p className="text-[var(--muted)]">Databases</p>
                        <p className="font-bold text-green-400">HEALTHY</p>
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-center">
                        <p className="text-[var(--muted)]">API Latency</p>
                        <p className="font-bold text-[var(--text)]">45ms</p>
                    </div>
                    <div className="rounded border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-center">
                        <p className="text-[var(--muted)]">Error Rate</p>
                        <p className="font-bold text-[var(--text)]">0.01%</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
