import { headers } from 'next/headers';
import { env } from '@/lib/cf';
import type { StrategicDossier } from '@/lib/orchestrator/types';
import Card from '@/components/ui/card';
import DomainSettings from '@/components/saas/domain-settings';
import AgentWorkFeed from '@/components/saas/agent-work-feed';

async function getDossier(tenantId: string): Promise<StrategicDossier | null> {
    const bindings = env();
    if (!bindings?.DRACO_DB) return null;
    try {
        const row = await bindings.DRACO_DB.prepare(
            `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`
        ).bind(tenantId).first<any>();
        if (!row) return null;
        return {
            ...row,
            form_data: JSON.parse(row.form_data as string),
            analysis_data: row.analysis_data ? JSON.parse(row.analysis_data as string) : undefined,
            plan_data: row.plan_data ? JSON.parse(row.plan_data as string) : undefined,
        };
    } catch {
        return null;
    }
}

async function getSaaSInstance(tenantId: string) {
    const bindings = env();
    if (!bindings?.DRACO_DB) return null;
    try {
        return await bindings.DRACO_DB.prepare(
            `SELECT * FROM saas_instances WHERE tenant_id = ? AND status = 'trial_active'`
        ).bind(tenantId).first<any>();
    } catch {
        return null;
    }
}

import { getAgentWorkLogs } from './agent-actions';

export default async function ClientDashboard() {

    const headersList = await headers();
    const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');
    const dossier = tenantId ? await getDossier(tenantId) : null;
    const instance = tenantId ? await getSaaSInstance(tenantId) : null;
    const logs = tenantId ? await getAgentWorkLogs(tenantId) : [];

    if (!dossier) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="text-3xl">🚀</div>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900">Activa tu perfil estratégico</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Aún no hay un dossier para tu cuenta. Completa el formulario para iniciar análisis de competencia y materialización.
                    </p>
                    <a href="/client/setup" className="mt-6 inline-block rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white hover:bg-sky-500">
                        Completar formulario
                    </a>
                </div>
            </div>
        );
    }

    if (!dossier.analysis_data || dossier.status === "draft") {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="animate-pulse text-3xl">⏳</div>
                    <h1 className="mt-3 text-2xl font-bold text-slate-900">Análisis pendiente</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Tu formulario ya está guardado. Ejecuta el motor de análisis para construir el dossier y detectar competidores.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <a href="/client/analysis" className="inline-block rounded-full bg-sky-600 px-6 py-3 text-sm font-bold text-white hover:bg-sky-500">
                            Ejecutar análisis
                        </a>
                        <a href="/client/setup" className="inline-block rounded-full border border-slate-300 px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                            Editar formulario
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const { web_score, swot, verified_maps, recommended_strategy } = dossier.analysis_data;

    // ACTIVE MODE: REALITY CHECK STARTS
    if (instance) {
        const daysLeft = Math.ceil((new Date(instance.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

        return (
            <div className="space-y-8">
                {/* HERO ACTIVE */}
                <div className="flex justify-between items-center bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="z-10 relative">
                        <h1 className="text-2xl font-bold">{instance.name}</h1>
                        <p className="text-sky-300 text-sm font-mono mt-1">
                            {instance.slug}.drako.systems
                        </p>
                        <div className="flex items-center gap-3 mt-4">
                            <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                                ✅ SYSTEM ACTIVE
                            </div>
                            <div className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30 animate-pulse">
                                ⏳ TRIAL: {daysLeft} DÍAS
                            </div>
                        </div>
                    </div>
                    <div className="text-8xl absolute -right-4 -bottom-8 opacity-10 grayscale">🏭</div>
                </div>

                {/* REALITY CHECK - METRICS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card title="Consumo IA (Real Time)">
                        <div className="h-32 flex flex-col justify-end p-2 relative">
                            <div className="absolute top-0 right-0 text-[10px] bg-slate-100 px-2 rounded text-slate-500">GRATIS EN TRIAL</div>
                            <span className="text-4xl font-mono font-bold text-slate-800">€0.00</span>
                            <span className="text-xs text-slate-400">Tokens procesados: 0</span>
                        </div>
                    </Card>
                    <Card title="Infraestructura Worker">
                        <div className="h-32 flex flex-col justify-end p-2 relative">
                            <div className="absolute top-0 right-0 text-[10px] bg-slate-100 px-2 rounded text-slate-500">GRATIS EN TRIAL</div>
                            <span className="text-4xl font-mono font-bold text-slate-800">€0.00</span>
                            <span className="text-xs text-slate-400">Peticiones: 0</span>
                        </div>
                    </Card>
                    <Card title="Valor Generado (Est.)" tone="brand">
                        <div className="h-32 flex flex-col justify-end p-2">
                            <span className="text-4xl font-mono font-bold text-sky-600">€0.00</span>
                            <span className="text-xs text-sky-300">Ahorro en personal/herramientas</span>
                        </div>
                    </Card>
                </div>

                {/* BLUEPRINT SUMMARY */}
                <div className="grid grid-cols-2 gap-6">
                    <Card title="Agentes Activos">
                        <ul className="space-y-2 text-sm text-slate-600 mt-2">
                            <li>🤖 <b>Orchestrator Core</b>: Online</li>
                            <li>🧠 <b>Strategy Engine</b>: Online</li>
                            {dossier.plan_data?.modules.some((m: any) => m.name.toLowerCase().includes('marketing')) && (
                                <li>📣 <b>Growth Bot</b>: Booting...</li>
                            )}
                            {dossier.plan_data?.modules.some((m: any) => m.name.toLowerCase().includes('crm')) && (
                                <li>🤝 <b>Sales AI</b>: Booting...</li>
                            )}
                        </ul>
                    </Card>
                    <Card title="Siguientes Pasos">
                        <ul className="space-y-2 text-sm mt-2">
                            <li className="flex gap-2">
                                <span>1️⃣</span> <span className="text-slate-600">Interactúa con el Chat (derecha)</span>
                            </li>
                            <li className="flex gap-2">
                                <span>2️⃣</span> <span className="text-slate-600">Pide tu primera Landing Page</span>
                            </li>
                            <li className="flex gap-2">
                                <span>3️⃣</span> <span className="text-slate-600">Revisa tu dominio temporal</span>
                            </li>
                        </ul>
                    </Card>
                </div>

                {/* DOMAIN LOCK (Feature Lock) */}
                <DomainSettings instance={instance} />

                {/* AGENT WORK FEED (Proof of Work) */}
                <div className="mt-8">
                    <AgentWorkFeed logs={logs} />
                </div>
            </div>
        );
    }

    // PRE-ACTIVE MODE (Analysis Only)
    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Tu Estrategia Digital</h1>
                <p className="text-slate-500">Diagnóstico generado por Drako Intelligence</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Web Score */}
                <Card title="Nivel de Madurez" tone={web_score > 70 ? 'brand' : 'danger'}>
                    <div className="flex flex-col items-center justify-center h-40">
                        <span className="text-6xl font-black text-slate-800">{web_score}</span>
                        <span className="text-xs uppercase tracking-widest text-slate-400 mt-2">Drako Score</span>
                    </div>
                </Card>

                {/* 2. Strategy */}
                <Card title="Estrategia Recomendada" tone="glass">
                    <div className="flex flex-col items-center justify-center h-40">
                        <span className="text-4xl font-bold text-sky-600">{recommended_strategy}</span>
                        <span className="text-xs text-center text-slate-500 px-4 mt-2">
                            Basado en tu sector ({dossier.form_data.business.sector}) y objetivos.
                        </span>
                    </div>
                </Card>

                {/* 3. Assets */}
                <Card title="Activos Digitales">
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-sm font-medium">Google Maps</span>
                            <span className={verified_maps ? "text-green-500 font-bold text-xs" : "text-red-500 font-bold text-xs"}>
                                {verified_maps ? "VERIFICADO" : "NO DETECTADO"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-sm font-medium">Competidores</span>
                            <span className="text-slate-600 font-bold text-xs">
                                {dossier.analysis_data.competitors_found} Identificados (radio {dossier.analysis_data.competitors_data?.radius_km ?? 5}km)
                            </span>
                        </div>
                    </div>
                </Card>
            </div>

            {dossier.analysis_data.competitors_data?.items?.length ? (
                <Card title="Competidores Detectados" subtitle="Geo-Agent por dirección + fallback por nicho/sector">
                    <div className="space-y-3">
                        {dossier.analysis_data.competitors_data.items.slice(0, 8).map((competitor, index) => (
                            <div key={`${competitor.name}-${index}`} className="rounded-lg border border-slate-200 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-slate-800">{competitor.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {competitor.distance_km == null ? "Distancia no disponible" : `${competitor.distance_km.toFixed(2)} km`}
                                    </div>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    Categoria: {competitor.category} · Fuente: {competitor.source}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                    Web: {competitor.website ? competitor.website : "No detectada"}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                    Redes: {competitor.social_urls.length > 0 ? competitor.social_urls.join(", ") : "No detectadas"}
                                </div>
                            </div>
                        ))}
                        {dossier.analysis_data.competitors_data.warnings?.length ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                {dossier.analysis_data.competitors_data.warnings.join(" · ")}
                            </div>
                        ) : null}
                    </div>
                </Card>
            ) : (
                <Card title="Competidores Detectados" subtitle="Geo-Agent por dirección + fallback por nicho/sector">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        No se encontraron competidores con datos suficientes todavía. Revisa dirección/sector o vuelve a ejecutar análisis.
                    </div>
                </Card>
            )}

            {/* SWOT Matrix */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card title="Fortalezas Internal" subtitle="Capitaliza esto">
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                        {swot.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </Card>
                <Card title="Debilidades Internal" subtitle="Mejora urgente" tone="danger">
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                        {swot.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </Card>
                <Card title="Oportunidades External" subtitle="Potencial de crecimiento" tone="success">
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                        {swot.opportunities.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </Card>
                <Card title="Amenazas External" subtitle="Riesgos de mercado">
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                        {swot.threats.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                </Card>
            </div>

            <div className="text-center py-8">
                {/* This button logic is now handled in /client/plan, but we keep a link here */}
                <a href="/client/plan" className="px-8 py-3 bg-sky-600 text-white font-bold rounded-full shadow-lg hover:bg-sky-500 transition-all hover:scale-105 inline-block">
                    Ver Plan de Materialización
                </a>
            </div>
        </div>
    );
}
