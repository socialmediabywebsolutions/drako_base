"use client";

import React, { useState } from "react";
import { FoundryLayout } from "@/components/layouts/foundry-layout";
import { motion } from "framer-motion";

interface FoundryWorkplaceProps {
    blueprint: any;
}

export function FoundryWorkplace({ blueprint }: FoundryWorkplaceProps) {
    const [activeTab, setActiveTab] = useState("whiteboard");

    return (
        <FoundryLayout
            chatComponent={
                <div className="flex flex-col h-full">
                    <div className="flex-1 space-y-4">
                        <div className="bg-slate-900 text-white p-4 rounded-2xl rounded-tl-none text-xs">
                            ¡Hola de nuevo! Ya he cargado toda la inteligencia de tu negocio en la Foundry.
                            Estamos en la **Fase de Construcción**. ¿Por dónde quieres empezar?
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-8">
                {/* Banner de Bienvenida */}
                <header className="relative p-8 rounded-[2rem] bg-slate-900 text-white overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand/20 blur-[100px] rounded-full" />
                    <h2 className="text-3xl font-black mb-2 italic">Bienvenido a su Fábrica, Partner.</h2>
                    <p className="text-slate-400 font-medium">Estamos materializando su visión basada en el Onboarding Estratégico.</p>
                </header>

                {/* Grid de Inteligencia (La Pizarra) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ROI Card */}
                    <div className="glass-panel p-6 border-brand/20 border-l-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Métrica de Impacto (ROI)</h4>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-4xl font-black text-slate-900">€{blueprint?.pricing?.monthly || 0}</span>
                            <span className="text-xs font-bold text-success mb-2">AHORRO ESTIMADO / MES</span>
                        </div>
                        <p className="text-xs text-slate-500 italic">Basado en la sustitución de procesos manuales detectados.</p>
                    </div>

                    {/* Social Score Card */}
                    <div className="glass-panel p-6 border-cyan-400/20 border-l-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Visibility Score (Audit)</h4>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-4xl font-black text-slate-900">{blueprint?.detectedKnowledge?.digitalAudit?.webScore || 85}%</span>
                            <span className="text-xs font-bold text-cyan-500 mb-2">PUNTUACIÓN ACTUAL</span>
                        </div>
                        <p className="text-xs text-slate-500 italic">Detectamos fallos críticos en su embudo web que Drako está optimizando.</p>
                    </div>
                </div>

                {/* Tech Stack / Pipeline */}
                <div className="glass-panel p-8">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-2 uppercase tracking-tight">
                        <span className="w-2 h-8 bg-brand rounded-full" />
                        Pipeline de Construcción Live
                    </h3>
                    <div className="space-y-4">
                        {[
                            { name: "SaaS Blueprinting", status: "COMPLETE", progress: 100 },
                            { name: "Provisionamiento Cloudflare Pages", status: "IN_PROGRESS", progress: 65 },
                            { name: "Arquitectura de Agentes", status: "WAITING", progress: 0 },
                            { name: "Configuración Stripe Billing", status: "WAITING", progress: 0 }
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-32 text-[10px] font-black uppercase text-slate-400">{step.name}</div>
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${step.progress}%` }}
                                        transition={{ duration: 1, delay: i * 0.2 }}
                                        className={`h-full ${step.status === 'COMPLETE' ? 'bg-success' : 'bg-brand'}`}
                                    />
                                </div>
                                <div className={`text-[10px] font-bold w-20 text-right ${step.status === 'COMPLETE' ? 'text-success' : 'text-slate-400'}`}>
                                    {step.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Knowledge Insights */}
                <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
                    <h3 className="font-black text-lg mb-4 uppercase tracking-tight text-slate-800">Knowledge Base Insights</h3>
                    <div className="grid gap-4">
                        {blueprint?.detectedKnowledge?.digitalAudit?.insights?.map((insight: string, i: number) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-brand/40 transition-colors cursor-default">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs shadow-sm">💡</div>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">{insight}</p>
                            </div>
                        ))}
                        {!blueprint?.detectedKnowledge?.digitalAudit?.insights && (
                            <p className="text-xs text-slate-400 italic">Analizando datos del onboarding para generar insights estratégicos...</p>
                        )}
                    </div>
                </div>
            </div>
        </FoundryLayout>
    );
}
