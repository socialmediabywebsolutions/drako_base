'use client';

import React, { useMemo } from 'react';
import type { StrategicDossier } from '@/lib/orchestrator/types';
import { secureSaaS } from '@/app/client/actions';

interface ClientShellProps {
    children: React.ReactNode;
    dossier?: StrategicDossier;
    instance?: any;
}

export default function ClientShell({ children, dossier, instance }: ClientShellProps) {
    const { daysLeft, trialState, trialProgress } = useMemo(() => {
        if (!instance || !instance.trial_started_at) {
            return { daysLeft: 30, trialState: 'CALM', trialProgress: 0 };
        }
        const start = new Date(instance.trial_started_at).getTime();
        const now = Date.now();
        const used = Math.floor((now - start) / (1000 * 3600 * 24));
        const left = Math.max(0, 30 - used);

        // Define States
        let state = 'CALM';
        if (left <= 7) state = 'ALERT';
        if (left === 0) state = 'EXPIRED'; // Soft Block
        if (instance.status === 'active') state = 'SECURED'; // Paid

        return { daysLeft: left, trialState: state, trialProgress: (used / 30) * 100 };
    }, [instance]);

    // Value Messaging (The Reality Check)
    const REAL_VALUE = 450;
    const FOUNDER_PRICE = 99;

    const handleSecure = async () => {
        // This would trigger a server action to get Stripe Link
        // For now we simulate the intention or log it.
        // Real imp: await secureSaaS(instance.id);
        alert("Redirigiendo a Pasarela Segura Drako...");
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden" data-shell="client-shielded">

            {/* COLUMN 1: LEFT - Progress & Reports (20% - 300px min) */}
            <aside className="w-[300px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-20">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${instance ? 'bg-green-600' : 'bg-sky-600'}`}>
                        {instance ? 'ON' : 'CL'}
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Client Profile</h2>
                        <div className="text-[10px] text-slate-400 font-mono tracking-wider">
                            {instance ? 'LIVE SYSTEM' : 'SECURE INV.'}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* VALUE CARD (New Phase 7) */}
                    {instance && trialState !== 'SECURED' && (
                        <div className="bg-slate-900 rounded-xl p-4 text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl font-black">€</div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Reality Check</div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <div className="text-2xl font-black">€{REAL_VALUE}</div>
                                    <div className="text-[10px] text-slate-400">Valor Real / mes</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-green-400">€{FOUNDER_PRICE}</div>
                                    <div className="text-[10px] text-green-200">Tu Precio</div>
                                </div>
                            </div>
                            <button
                                onClick={handleSecure}
                                className="w-full py-2 bg-green-500 hover:bg-green-400 text-slate-900 font-bold text-xs rounded transition-colors"
                            >
                                ASEGURAR INFRAESTRUCTURA
                            </button>
                        </div>
                    )}

                    {/* Sidebar Progress */}
                    <div className={`p-4 rounded-lg border ${instance ? 'bg-green-50 border-green-100' : 'bg-sky-50 border-sky-100'}`}>
                        <div className={`text-xs font-bold mb-2 uppercase tracking-wide ${instance ? 'text-green-700' : 'text-sky-700'}`}>
                            {instance ? 'Estado del Sistema' : 'Progreso'}
                        </div>
                        <div className={`h-2 w-full rounded-full overflow-hidden ${instance ? 'bg-green-200' : 'bg-sky-200'}`}>
                            <div
                                className={`h-full transition-all duration-1000 ease-out ${instance ? 'bg-green-500' : 'bg-sky-500'}`}
                                style={{ width: instance ? '100%' : (dossier ? '66%' : '33%') }}
                            ></div>
                        </div>
                        <p className={`text-[10px] mt-2 ${instance ? 'text-green-600' : 'text-sky-600'}`}>
                            {instance ? 'Fase 4: Materialización Completa' : (dossier ? 'Fase 2: Estrategia Definida' : 'Fase 1: Materialización')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informes</h3>
                        <div className="p-3 border border-slate-100 rounded hover:bg-slate-50 cursor-pointer transition-colors group">
                            <div className="text-xs font-medium text-slate-700 group-hover:text-sky-600">Dossier Estratégico</div>
                            <div className="text-[10px] text-slate-400">
                                {dossier ? 'Disponible (PDF)' : 'En proceso...'}
                            </div>
                        </div>
                        {instance && (
                            <div className="p-3 border border-slate-100 rounded hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className="text-xs font-medium text-slate-700 group-hover:text-green-600">Reporte de Consumo</div>
                                <div className="text-[10px] text-slate-400">Tiempo Real</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 text-[10px] text-center text-slate-400">
                    <div>{instance ? instance.slug + '.drako.systems' : 'DRAKO CLIENT ISOLATION'}</div>
                    {/* Branding Signal: Hide for Enterprise */}
                    {!(instance?.plan_tier === 'enterprise') && (
                        <div className="mt-1 opacity-50 font-medium">Powered by Drako Engine</div>
                    )}
                </div>
            </aside>

            {/* COLUMN 2: CENTER - Main Stage (Fluid) */}
            <main className="flex-1 min-w-0 flex flex-col relative z-10 bg-slate-50/50">
                {/* 1. COUNTDOWN BANNER */}
                {instance && trialState !== 'SECURED' && (
                    <div className={`w-full px-6 py-3 flex items-center justify-between shadow-sm z-30 ${trialState === 'EXPIRED' ? 'bg-slate-900 text-white' :
                        trialState === 'ALERT' ? 'bg-amber-100 text-amber-800 border-b border-amber-200' :
                            'bg-blue-50 text-blue-800 border-b border-blue-100'
                        }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">
                                {trialState === 'EXPIRED' ? '🔒' : trialState === 'ALERT' ? '⚠️' : '🛡️'}
                            </span>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wide">
                                    {trialState === 'EXPIRED' ? 'SISTEMA PAUSADO' :
                                        trialState === 'ALERT' ? 'ACCIÓN REQUERIDA' : 'TRIAL ACTIVO'}
                                </div>
                                <div className="text-xs opacity-90">
                                    {trialState === 'EXPIRED' ? 'Tu sistema está pausado para evitar costes. Asegura la continuidad.' :
                                        trialState === 'ALERT' ? `Infraestructura real. ${daysLeft} días para asegurar.` :
                                            `Disfruta de la potencia completa. ${daysLeft} días restantes.`}
                                </div>
                            </div>
                        </div>
                        {trialState !== 'CALM' && (
                            <button
                                onClick={handleSecure}
                                className={`text-xs px-4 py-2 rounded font-bold transition-all ${trialState === 'EXPIRED' ? 'bg-green-500 text-slate-900 hover:bg-green-400' :
                                    'bg-white shadow text-slate-900 hover:bg-slate-50'
                                    }`}
                            >
                                ASEGURAR AHORA
                            </button>
                        )}
                    </div>
                )}

                <div className={`flex-1 overflow-y-auto p-8 relative ${trialState === 'EXPIRED' ? 'blur-sm select-none pointer-events-none' : ''}`}>
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        {children}
                    </div>
                </div>

                {/* EXPIRED OVERLAY */}
                {trialState === 'EXPIRED' && (
                    <div className="absolute inset-0 flex items-center justify-center z-40 bg-slate-900/10 backdrop-blur-[2px]">
                        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md text-center border border-slate-200">
                            <div className="text-4xl mb-4">🔒</div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">Continuidad del Holding</h2>
                            <p className="text-muted-foreground text-sm">
                                &quot;Active&quot; means live. &quot;Maintenance&quot; shows a temporary page. &quot;Disabled&quot; takes it offline.
                            </p>
                            <p className="text-slate-500 text-sm mb-6">
                                Para mantener el acceso a tus agentes y datos, es necesario formalizar la suscripción de infraestructura.
                            </p>
                            <button
                                onClick={handleSecure}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg transform hover:-translate-y-1 transition-all"
                            >
                                REACTIVAR SISTEMA (99€/mes)
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* COLUMN 3: RIGHT - Context Chat (25% - 350px min) */}
            <aside className="w-[350px] flex-shrink-0 bg-white border-l border-slate-200 flex flex-col z-20">
                <div className={`p-4 border-b border-slate-100 ${instance ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/50'}`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest ${instance ? 'text-green-400' : 'text-slate-400'}`}>
                        {instance ? '🟢 Drako Command' : 'Drako Context'}
                    </h3>
                </div>

                <div className="flex-1 p-4 flex flex-col">
                    {instance ? (
                        // ACTIVE COMMAND CHAT
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs text-slate-300">
                                🤖 <b>Sistema Online</b><br />
                                {instance.name} está operativo.<br />
                                <span className={daysLeft < 7 ? "text-amber-400 font-bold" : "text-green-400"}>
                                    Trial: {daysLeft} días restantes.
                                </span>
                                <div className="mt-2 text-[10px] opacity-75 border-t border-slate-700 pt-2">
                                    Comandos disponibles: &quot;Genera posts&quot;, &quot;Analiza SEO&quot;.
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
                                {/* Chat History would go here, for now we rely on the Work Feed */}
                                <div className="text-center text-slate-300 text-xs mt-10">
                                    <p>El sistema escucha.</p>
                                    <p className="opacity-50 text-[10px] mt-2">Drako Agents v1.0 Ready.</p>
                                </div>
                            </div>

                            <div className="mt-auto">
                                <form action={async (formData) => {
                                    const cmd = formData.get('command') as string;
                                    if (!cmd) return;

                                    // Optimistic UI update could happen here
                                    const { executeAgentCommand } = await import('@/app/client/agent-actions');
                                    // Use tenant context from shell or args? 
                                    // For now relying on headers in server action, but simpler to pass ID if needed.
                                    // Actually server action reads headers so we are good if this is server component,
                                    // but this is client component.
                                    // We need to pass tenantId.

                                    await executeAgentCommand(cmd, instance.tenant_id);

                                    // Reset form or show success toast
                                    alert("🤖 Comando recibido. Ejecutando agente...");
                                    // Force Refresh to show new log
                                    window.location.reload();
                                }}>
                                    <input
                                        name="command"
                                        className="w-full text-xs p-3 rounded border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder={trialState === 'EXPIRED' ? "Sistema Pausado." : "Escribe una orden..."}
                                        disabled={trialState === 'EXPIRED'}
                                        autoComplete="off"
                                    />
                                </form>
                            </div>
                        </div>
                    ) : dossier ? (
                        // PASSIVE CONTEXT CHAT
                        <div className="flex-1 flex flex-col gap-4">
                            <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 text-xs text-sky-800">
                                🤖 <b>Drako Activo</b><br />
                                He analizado tu negocio de <b>{dossier.form_data.business.sector}</b>.<br />
                                Tu Web Score es <b>{dossier.analysis_data?.web_score}/100</b>.
                                <div className="mt-2 text-[10px] opacity-75">
                                    Puedo ayudarte a mejorar tu presencia en Google Maps o sugerir tácticas para superar a <i>{dossier.analysis_data?.competitors_found} competidores</i>.
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
                                {/* Chat placeholder - will become fully interactive later */}
                                <div className="text-center text-slate-300 text-xs mt-10">
                                    Historial de chat vacío.
                                </div>
                            </div>

                            <div className="mt-auto">
                                <input
                                    disabled
                                    className="w-full text-xs p-3 rounded border border-slate-200 bg-slate-50 cursor-not-allowed"
                                    placeholder="Chat desactivado en demo..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 text-center p-6">
                            <div className="text-4xl mb-2 grayscale opacity-50">🤖</div>
                            <p className="text-sm font-medium">Esperando Análisis...</p>
                            <p className="text-xs mt-2">Completa el formulario para activar el Cerebro Estratégico.</p>
                        </div>
                    )}
                </div>
            </aside>

        </div>
    );
}
