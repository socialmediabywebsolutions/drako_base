'use client';

import React, { useState } from 'react';
import Card from '@/components/ui/card';
import { executeGovernanceAction } from './actions';

interface RoiRankingTableProps {
    instances: any[]; // Extended with metrics
}

export default function RoiRankingTable({ instances }: RoiRankingTableProps) {
    const [loading, setLoading] = useState<string | null>(null);

    // Sort by Margin DESC
    const sorted = [...instances].sort((a, b) => (b.margin_eur || 0) - (a.margin_eur || 0));

    const handleAction = async (tenantId: string, slug: string, action: 'FREEZE' | 'BONUS' | 'UPGRADE' | 'KILL' | 'FORCE_ACTIVE' | 'ARCHIVE', currentStatus: string, stripeStatus?: string) => {

        // 1. Governance Safety Checks
        if (action === 'FORCE_ACTIVE') {
            if (stripeStatus !== 'active' && stripeStatus !== 'paid') {
                if (!confirm(`WARNING: Stripe status is '${stripeStatus}'. Force Active might grant free access. Continue?`)) return;
            }
        }

        if (!confirm(`CONFIRM CEO COMMAND: ${action} on ${slug}?`)) return;

        setLoading(tenantId);
        await executeGovernanceAction({
            tenantId,
            slug,
            action,
            reason: 'CEO Manual Override'
        });
        setLoading(null);
    };

    return (
        <Card title="ROI Ranking (Real-Time)" tone="brand">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-mono uppercase tracking-wider">
                            <th className="p-3">SaaS / Tenant</th>
                            <th className="p-3 text-center">Lifecycle</th>
                            <th className="p-3 text-right">MRR</th>
                            <th className="p-3 text-right">Margin</th>
                            <th className="p-3 text-center">Pulse</th>
                            <th className="p-3 text-right">Governance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sorted.map((inst) => {
                            const isPaused = inst.lifecycle_status === 'paused';
                            const isPastDue = inst.lifecycle_status === 'past_due';
                            const isArchived = inst.lifecycle_status === 'archived';

                            return (
                                <tr key={inst.id} className={`hover:bg-slate-50 transition-colors group ${isPaused ? 'bg-slate-50 opacity-75' : ''}`}>
                                    <td className="p-3">
                                        <div className="font-bold text-slate-800 flex items-center gap-2">
                                            {inst.name}
                                            {inst.paused_at && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">PAUSED</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">{inst.slug}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${inst.lifecycle_status === 'active' ? 'bg-green-100 text-green-700' :
                                                inst.lifecycle_status === 'past_due' ? 'bg-amber-100 text-amber-700' :
                                                    inst.lifecycle_status === 'paused' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-500'
                                            }`}>
                                            {inst.lifecycle_status || 'unknown'}
                                        </span>
                                        {inst.past_due_since && (
                                            <div className="text-[9px] text-amber-600 mt-1 font-mono">
                                                {Math.floor((new Date().getTime() - new Date(inst.past_due_since).getTime()) / (1000 * 60 * 60 * 24))}d overdue
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-700">
                                        €{inst.mrr_eur?.toFixed(2)}
                                    </td>
                                    <td className={`p-3 text-right font-mono font-black ${(inst.margin_eur || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        €{inst.margin_eur?.toFixed(2)}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${(inst.sentiment_score || 0) > 70 ? 'bg-green-100 text-green-700' :
                                            (inst.sentiment_score || 0) < 30 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {inst.sentiment_score || 0}%
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        {loading === inst.tenant_id ? (
                                            <span className="text-slate-400 italic">Executing...</span>
                                        ) : (
                                            <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                                {/* ACTIONS BASED ON LIFECYCLE */}

                                                {/* 1. PAUSED -> ALLOW RESUME */}
                                                {isPaused && (
                                                    <button
                                                        onClick={() => handleAction(inst.tenant_id, inst.slug, 'FORCE_ACTIVE', inst.lifecycle_status, inst.stripe_status)}
                                                        className="p-1 hover:bg-green-100 hover:text-green-600 rounded" title="Force Resume (Check Stripe!)"
                                                    >▶️</button>
                                                )}

                                                {/* 2. ACTIVE -> ALLOW PAUSE/FREEZE */}
                                                {!isPaused && !isArchived && (
                                                    <button
                                                        onClick={() => handleAction(inst.tenant_id, inst.slug, 'FREEZE', inst.lifecycle_status)}
                                                        className="p-1 hover:bg-red-100 hover:text-red-600 rounded" title="Pause / Freeze"
                                                    >⏸️</button>
                                                )}

                                                {/* 3. PAST DUE -> NUDGE */}
                                                {isPastDue && (
                                                    <a
                                                        href={`/api/billing/portal?saasId=${inst.id}`}
                                                        target="_blank"
                                                        className="p-1 hover:bg-amber-100 hover:text-amber-600 rounded block" title="Open Billing Portal"
                                                    >💳</a>
                                                )}

                                                {!isArchived && (
                                                    <button
                                                        onClick={() => handleAction(inst.tenant_id, inst.slug, 'ARCHIVE', inst.lifecycle_status)}
                                                        className="p-1 hover:bg-slate-200 hover:text-slate-600 rounded" title="Archive Instance"
                                                    >📦</button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {sorted.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                    No active tenants found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

