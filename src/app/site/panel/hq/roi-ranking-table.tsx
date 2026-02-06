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

    const handleAction = async (tenantId: string, slug: string, action: 'FREEZE' | 'BONUS' | 'UPGRADE' | 'KILL') => {
        if (!confirm(`CONFIRM CEO COMMAND: ${action} on ${slug}?`)) return;

        setLoading(tenantId);
        await executeGovernanceAction({
            tenantId,
            slug,
            action,
            reason: 'CEO Manual Override'
        });
        setLoading(null);
        // In real execution, we might trigger a toast or router.refresh()
        // But revalidatePath on server action handles data refresh.
    };

    return (
        <Card title="ROI Ranking (Real-Time)" tone="brand">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-mono uppercase tracking-wider">
                            <th className="p-3">SaaS / Tenant</th>
                            <th className="p-3 text-right">MRR</th>
                            <th className="p-3 text-right">Cost</th>
                            <th className="p-3 text-right">Margin</th>
                            <th className="p-3 text-center">Pulse</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Governance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sorted.map((inst) => (
                            <tr key={inst.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-3">
                                    <div className="font-bold text-slate-800">{inst.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{inst.slug}</div>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-700">
                                    €{inst.mrr_eur?.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-mono text-red-400">
                                    -€{inst.cost_eur?.toFixed(2)}
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
                                <td className="p-3 text-center">
                                    {inst.status === 'active' ? '🟢' :
                                        inst.status === 'suspended' ? '🔴' :
                                            inst.degraded_mode ? '⚠️' : '🔵'}
                                </td>
                                <td className="p-3 text-right">
                                    {loading === inst.tenant_id ? (
                                        <span className="text-slate-400 italic">Executing...</span>
                                    ) : (
                                        <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleAction(inst.tenant_id, inst.slug, 'FREEZE')}
                                                className="p-1 hover:bg-red-100 hover:text-red-600 rounded" title="Freeze Expansion"
                                            >❄️</button>
                                            <button
                                                onClick={() => handleAction(inst.tenant_id, inst.slug, 'BONUS')}
                                                className="p-1 hover:bg-green-100 hover:text-green-600 rounded" title="Authorize Bonus"
                                            >🚀</button>
                                            <button
                                                onClick={() => handleAction(inst.tenant_id, inst.slug, 'UPGRADE')}
                                                className="p-1 hover:bg-blue-100 hover:text-blue-600 rounded" title="Force Upgrade"
                                            >🔼</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {sorted.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-slate-400 italic">
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
