'use client';

import React, { useState } from 'react';

interface AgentWorkFeedProps {
    logs: any[];
}

export default function AgentWorkFeed({ logs }: AgentWorkFeedProps) {
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    if (!logs || logs.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trabajo Realizado (Proof of Work)</h3>
            <p className="text-sm text-slate-500">The &quot;Agent Feed&quot; shows real-time actions performed by your AI employees.</p>

            <div className="grid gap-3">
                {logs.map(log => {
                    const isMarketing = log.agent_name === 'MARKETING_BOT';
                    const isExpanded = expandedIds.includes(log.id);

                    return (
                        <div key={log.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header */}
                            <div
                                onClick={() => toggleExpand(log.id)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded flex items-center justify-center text-xs ${isMarketing ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {isMarketing ? '📣' : '🔍'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">
                                            {isMarketing ? 'Marketing Assets Generados' : 'Oportunidades SEO Detectadas'}
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            {new Date(log.created_at).toLocaleDateString()} • {log.status}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-slate-400">Value: €{log.cost_eur.toFixed(2)}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${log.status === 'EXECUTED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {log.status === 'EXECUTED' ? 'EJECUTADO' : 'PAUSADO'}
                                    </span>
                                    <span className="text-slate-400 text-xs">
                                        {isExpanded ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Details (Accordion) */}
                            {isExpanded && (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs space-y-2 font-mono text-slate-600">
                                    {isMarketing ? (
                                        // Marketing Output View
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {log.output_json.map((post: any) => (
                                                <div key={post.id} className="bg-white p-3 rounded border border-slate-200">
                                                    <div className="font-bold text-purple-600 mb-1">{post.type}</div>
                                                    <div className="mb-2 italic opacity-80">&quot;{post.caption}&quot;</div>
                                                    <div className="text-[10px] bg-slate-100 p-1 rounded text-slate-500">
                                                        Prompt: {post.image_prompt}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // SEO Output View
                                        <div className="space-y-2">
                                            {log.output_json.top_opportunities.map((k: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                                                    <div>
                                                        <span className="font-bold text-slate-800">{k.keyword}</span>
                                                        <span className="ml-2 text-[10px] bg-orange-100 text-orange-700 px-1 rounded">{k.volume}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{k.opportunity}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
