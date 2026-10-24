"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SalesForgeWizardProps {
    saasId: string;
    projectName: string;
    vertical?: string;
    businessVision?: string;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

interface MarketingPlan {
    targetAudience: string;
    contentPillars: string[];
    activeSalesHooks: string[];
    growthRoadmap: string[];
}

export function SalesForgeWizard({ saasId, projectName, vertical, businessVision, onComplete, onCancel }: SalesForgeWizardProps) {
    const [step, setStep] = useState(1); // 1: Pre-flight, 2: Forging Plan, 3: Success

    const [marketingPlan, setMarketingPlan] = useState<MarketingPlan | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const handleStartForging = async () => {

        setStep(2);
        setError(null);
        setLogs([]);

        try {
            addLog("INITIATING_GROWTH_SCAN...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("MAPPING_NEURAL_AUDIENCE...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("GENERATING_SALES_HOOKS...");

            const res = await fetch("/api/factory/provisioning/marketing", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({ saasId, projectName, vertical, businessVision })
            });

            const data = (await res.json()) as { success?: boolean; plan?: MarketingPlan; error?: string };

            if (data.success && data.plan) {
                setMarketingPlan(data.plan);
                addLog("GROWTH_LAYER_OPTIMIZED");
                await new Promise(r => setTimeout(r, 1000));
                setStep(3);
            } else {
                throw new Error(data.error || "Materialization failed");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Desconocido");
            setStep(1);
        } finally {

        }
    };

    const handleFinish = () => {
        onComplete({ saasId, status: "COMPLETE" });
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-6xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_120px_rgba(255,50,150,0.15)]"
            >
                {/* Industrial Header */}
                <div className="bg-slate-900/60 text-pink-500 px-8 py-5 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/50 flex items-center justify-center text-xs font-black animate-pulse">🚀</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none text-white">Neural Marketing Autopilot</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1 text-pink-500">Growth materialization protocols initialized</span>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity uppercase tracking-widest italic text-white/50">Abort_Mission</button>
                </div>

                <div className="p-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center text-center space-y-10 py-10"
                            >
                                <div className="w-32 h-32 rounded-[2rem] border-2 border-dashed border-pink-500/30 flex items-center justify-center relative">
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.4, 0.1] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="absolute inset-0 bg-pink-500 rounded-[2rem]"
                                    />
                                    <div className="text-5xl">🎯</div>
                                </div>

                                <div className="space-y-4 max-w-xl">
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Growth <span className="text-pink-500">Materialization</span></h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.15em] leading-relaxed">
                                        Materializando el motor de adquisición para **{projectName}**. <br />
                                        Esto activará un swarm de agentes de venta IA y forjará tu plan de dominación de mercado de 30 días.
                                    </p>
                                </div>

                                <button
                                    onClick={handleStartForging}
                                    className="px-12 py-6 bg-pink-500 text-white font-black text-xs uppercase tracking-[0.5em] hover:bg-pink-400 hover:shadow-[0_0_40px_rgba(236,72,153,0.4)] transition-all active:scale-95 italic"
                                >
                                    Activate Sales Autopilot
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-10 flex flex-col items-center space-y-12"
                            >
                                <div className="grid grid-cols-3 gap-8">
                                    {[1, 2, 3].map(i => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                y: [0, -20, 0],
                                                opacity: [0.3, 1, 0.3]
                                            }}
                                            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                                            className="w-20 h-20 rounded-2xl bg-pink-500/10 border border-pink-500/40 flex items-center justify-center text-3xl"
                                        >
                                            🤖
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="w-full space-y-4 max-w-md">
                                    <div className="flex justify-between items-end px-4 font-mono text-[9px] font-black text-slate-500 italic">
                                        <span>PROCESS: NEURAL_GROWTH_MAPPING</span>
                                        <span className="animate-pulse text-pink-500">OPTIMIZING...</span>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1 h-32 overflow-y-auto">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-pink-500/80">
                                                <span className="text-pink-500 font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-pink-500 animate-pulse">❯ COLLECTING_MARKET_INTELLIGENCE...</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && marketingPlan && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Neural Growth <span className="text-pink-500">Plan</span></h3>
                                    <div className="text-[9px] font-black text-pink-500 uppercase tracking-widest border border-pink-500/30 px-3 py-1 rounded">SWARM_ACTIVATED</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                                        <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Target Audience</div>
                                        <div className="text-xs text-white font-bold leading-relaxed">{marketingPlan.targetAudience}</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                                        <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Content Pillars</div>
                                        <ul className="space-y-2">
                                            {marketingPlan.contentPillars.map((p: string, i: number) => (
                                                <li key={i} className="text-[10px] text-slate-400 font-bold flex gap-2">
                                                    <span className="text-pink-500">◈</span> {p}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                                        <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Sales Hooks</div>
                                        <div className="bg-black/40 p-3 rounded-xl border border-white/5 scrollbar-hide overflow-y-auto h-24">
                                            {marketingPlan.activeSalesHooks.map((p: string, i: number) => (
                                                <div key={i} className="text-[9px] text-slate-500 font-mono mb-2 italic">“{p}”</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-pink-500/5 border border-pink-500/20 rounded-3xl p-8">
                                    <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-6 text-center">30-Day Materialization Roadmap</div>
                                    <div className="flex justify-between items-start gap-4">
                                        {marketingPlan.growthRoadmap.map((p: string, i: number) => (
                                            <div key={i} className="flex-1 text-center space-y-2">
                                                <div className="w-8 h-8 rounded-full bg-pink-500 text-slate-950 flex items-center justify-center text-[10px] font-black mx-auto">0{i + 1}</div>
                                                <div className="text-[10px] text-white font-black uppercase tracking-tighter leading-tight">{p}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleFinish}
                                    className="w-full py-6 bg-pink-500 text-white font-black text-xs uppercase tracking-[0.5em] rounded-2xl hover:bg-pink-400 hover:shadow-[0_0_50px_rgba(236,72,153,0.5)] transition-all italic"
                                >
                                    Finalize Global Materialization
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="mt-8 p-6 bg-red-600/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm italic">🚨 GROWTH_FAULT</div>
                            {error}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
