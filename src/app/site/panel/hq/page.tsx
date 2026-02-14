import { env } from '@/lib/cf';
import { getEmpireOverview } from '@/lib/os/overseer';
import Card from '@/components/ui/card';
import RoiRankingTable from './roi-ranking-table';
import { getDb } from '@/lib/db';



function StatCard({ label, value, trend, tone }: { label: string, value: string, trend?: string, tone?: 'brand' | 'danger' | 'success' }) {
    return (
        <Card tone={tone}>
            <div className="flex flex-col h-full justify-between">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">{label}</span>
                <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-black text-slate-800">{value}</span>
                    {trend && <span className="text-xs font-bold text-green-500">{trend}</span>}
                </div>
            </div>
        </Card>
    );
}

function PortfolioTable({ items }: { items: any[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b">
                    <tr>
                        <th className="px-6 py-3">SaaS Instance</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Pack</th>
                        <th className="px-6 py-3">MRR</th>
                        <th className="px-6 py-3">Margin</th>
                        <th className="px-6 py-3">Pulse</th>
                        <th className="px-6 py-3">Risk</th>
                        <th className="px-6 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-800">{item.name}</div>
                                <div className="text-xs text-slate-400 font-mono">{item.slug}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs font-mono text-slate-600">
                                    {item.custom_domain ? (
                                        <div className="flex flex-col">
                                            <span className="font-bold">{item.custom_domain}</span>
                                            <span className={`text-[10px] uppercase ${item.domain_status === 'active' ? 'text-green-600' : 'text-amber-500'
                                                }`}>
                                                {item.domain_status || 'pending'}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">---</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.status === 'active' ? 'bg-green-100 text-green-700' :
                                    item.status === 'trial_active' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {item.status.replace('_', ' ')}
                                </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs">
                                {item.current_pack || item.plan_tier}
                            </td>
                            <td className="px-6 py-4 font-mono">
                                €{item.mrr.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 font-mono">
                                <span className={item.margin < 0 ? "text-red-500 font-bold" : "text-green-600"}>
                                    {item.margin < 0 ? '-' : '+'}€{Math.abs(item.margin).toFixed(2)}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                    {(item.margin / (item.mrr || 1) * 100).toFixed(0)}%
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${item.sentiment_score > 60 ? 'bg-green-500' : item.sentiment_score < 40 ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                    <span className="text-xs font-bold">{item.sentiment_score}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`font-bold uppercase text-[10px] px-2 py-1 rounded ${item.risk_level === 'critical' ? 'bg-red-100 text-red-600' :
                                    item.risk_level === 'high' ? 'bg-orange-100 text-orange-600' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                    {item.risk_level}
                                </span>
                                {item.degraded_mode && <span className="ml-2 text-xs">⚠️</span>}
                            </td>
                            <td className="px-6 py-4">
                                {item.flags.includes('margin_alert') && (
                                    <span className="text-xs text-red-500 font-bold" title="Negative Margin">BURN!</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default async function HeadquartersPage() {
    let data;
    try {
        data = await getEmpireOverview();
    } catch (e) {
        return (
            <div className="p-10 text-center text-red-500">
                <h2 className="text-2xl font-bold">Connection Lost to Overseer</h2>
                <p>Ensure Database connection is active.</p>
            </div>
        );
    }


    const { stats, portfolio } = data;

    // Phase 19.2: Fetch MentorIA Stats
    const db = getDb();
    let mentoriaStats = { count: 0, revenue: 0, cost: 0 };
    if (db) {
        try {
            const { MentorSessionEngine } = await import('@/lib/mentoria/session-engine');
            const engine = new MentorSessionEngine(db);
            mentoriaStats = await engine.getStats(30);
        } catch (e) {
            console.error('Failed to load MentorIA stats', e);
        }
    }

    return (
        <div className="space-y-8 p-8 max-w-[1600px] mx-auto">
            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">DRAKO OVERSEER</h1>
                    <p className="text-slate-500 mt-2 font-mono text-sm">HOLDING ECONOMICS & AUTOPILOT ENABLED</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-slate-400">STATUS</div>
                        <div className="text-green-500 font-bold text-sm">● SYSTEMS NOMINAL</div>
                    </div>
                </div>
            </div>


            {/* 1. GLOBAL COMMAND */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <StatCard
                    label="Active Nodes"
                    value={stats.total_active_saas.toString()}
                    tone="brand"
                />
                <StatCard
                    label="Total MRR"
                    value={`€${stats.projected_revenue.toLocaleString()}`}
                    tone="brand"
                />
                <StatCard
                    label="Burn Rate/mo"
                    value={`€${stats.total_burn_rate.toFixed(2)}`}
                    tone={stats.total_burn_rate > 0 ? "danger" : undefined}
                />
                <StatCard
                    label="Avg Margin"
                    value={`€${stats.avg_margin.toFixed(2)}`}
                    tone={stats.avg_margin > 0 ? "success" : "danger"}
                />
                {/* MentorIA Specifics (Phase 19.2) */}
                <StatCard
                    label="Sessions (30d)"
                    value={mentoriaStats.count.toString()}
                    trend={`+€${mentoriaStats.revenue}`}
                    tone="brand"
                />
            </div>

            {/* 2. PORTFOLIO MATRIX */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Portfolio Matrix</h2>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 text-xs font-bold bg-slate-100 rounded hover:bg-slate-200">Filter: Active</button>
                        <button className="px-3 py-1 text-xs font-bold bg-slate-100 rounded hover:bg-slate-200">Filter: Risk</button>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <RoiRankingTable instances={portfolio} />
                </div>
            </div>

            {/* 3. RISK WATCH */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span>Risk Watch (Live Events)</span>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card tone="glass" title="CEO Intelligence">
                        <div className="space-y-3 mt-2">
                            {/* Auto-detected insights */}
                            {portfolio.some((p: any) => p.margin < 0) && (
                                <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded text-xs border border-red-100">
                                    <span>🔥</span>
                                    <span><b>Cash Burn Alert</b>: {portfolio.filter((p: any) => p.margin < 0).length} instance(s) are losing money.</span>
                                </div>
                            )}
                            {portfolio.some((p: any) => (p.margin / (p.mrr || 1)) < 0.2 && p.status === 'active') && (
                                <div className="flex items-center gap-2 p-2 bg-yellow-50 text-yellow-700 rounded text-xs border border-yellow-100">
                                    <span>⚠️</span>
                                    <span><b>Low Margin Alert</b>: Consider pricing review for active instances under 20% margin.</span>
                                </div>
                            )}
                            {portfolio.every((p: any) => p.margin >= 0) && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 text-green-700 rounded text-xs border border-green-100">
                                    <span>✅</span>
                                    <span><b>Healthy Empire</b>: No immediate risks detected.</span>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card tone="brand" title="Governance Log">
                        <div className="text-xs text-slate-400 italic p-4 text-center">
                            Recent Executive Actions will appear here.
                            <br />(Use Audit Table to view full history)
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
