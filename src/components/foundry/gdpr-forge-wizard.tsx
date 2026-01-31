"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GDPRForgeWizardProps {
    saasId: string;
    projectName: string;
    vertical?: string;
    businessVision?: string;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

export function GDPRForgeWizard({ saasId, projectName, vertical, businessVision, onComplete, onCancel }: GDPRForgeWizardProps) {
    const [step, setStep] = useState(1); // 1: Pre-flight, 2: Forging Documents, 3: Review, 4: Success

    const [documents, setDocuments] = useState<{ privacyPolicy?: string; termsOfService?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const handleStartForging = async () => {

        setStep(2);
        setError(null);
        setLogs([]);

        try {
            addLog("INITIATING_LEGAL_SCAN...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("MAPPING_DATA_FLOWS...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("GENERATING_GDPR_SHIELD...");

            const res = await fetch("/api/campamento-base/provisioning/gdpr", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({ saasId, projectName, vertical, businessVision })
            });

            const data = (await res.json()) as { success?: boolean; documents?: { privacyPolicy?: string; termsOfService?: string }; error?: string };
            if (data.success && data.documents) {
                setDocuments(data.documents);
                addLog("LEGAL_DOCS_MATERIALIZED_V1");
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
        setStep(4);
        setTimeout(() => onComplete({ saasId, status: "COMPLETE" }), 2000);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-5xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_100px_rgba(0,210,255,0.15)]"
            >
                {/* Industrial Header */}
                <div className="bg-slate-900/60 text-emerald-500 px-8 py-5 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center text-xs font-black animate-pulse">⚖️</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none text-white">GDPR Autonomy Forge</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1 text-emerald-500">Legal Guardrail materialization established</span>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity uppercase tracking-widest italic text-white/50">Abort_Protocol</button>
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
                                <div className="w-32 h-32 rounded-full border-2 border-dashed border-emerald-500/30 flex items-center justify-center relative">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-x-0"
                                    >
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                    </motion.div>
                                    <div className="text-5xl">🛡️</div>
                                </div>

                                <div className="space-y-4 max-w-xl">
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Legal <span className="text-emerald-500">Armor</span></h2>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.15em] leading-relaxed">
                                        Materializando el escudo de cumplimiento para **{projectName}**. <br />
                                        Esto generará Política de Privacidad y Términos de Servicio ajustados a tu modelo de negocio mediante IA.
                                    </p>
                                </div>

                                <button
                                    onClick={handleStartForging}
                                    className="px-12 py-6 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-[0.5em] hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all active:scale-95 italic"
                                >
                                    Activate Compliance Protocol
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
                                <div className="relative">
                                    <div className="w-48 h-48 rounded-[3rem] border border-emerald-500/20 flex items-center justify-center">
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="absolute inset-0 bg-emerald-500/10 rounded-[3rem]"
                                        />
                                        <div className="text-4xl">🧬</div>
                                    </div>
                                </div>

                                <div className="w-full space-y-4 max-w-md">
                                    <div className="flex justify-between items-end px-4 font-mono text-[9px] font-black text-slate-500 italic">
                                        <span>PROCESS: LEGAL_MATERIALIZATION</span>
                                        <span className="animate-pulse text-emerald-500">FORGING...</span>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1 h-32 overflow-y-auto">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-emerald-500/80">
                                                <span className="text-emerald-500 font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-emerald-500 animate-pulse">❯ TRANSCRIBING_LEGAL_NEST...</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && documents && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Document <span className="text-emerald-500">Review</span></h3>
                                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest border border-emerald-500/30 px-3 py-1 rounded">AI_GENERATED_DRAFT</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px]">
                                    <div className="flex flex-col gap-4">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Privacy Policy</div>
                                        <div className="flex-1 bg-slate-900/80 border border-white/5 rounded-2xl p-6 overflow-y-auto font-mono text-[10px] text-slate-400 leading-relaxed scrollbar-hide">
                                            {documents.privacyPolicy}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Terms of Service</div>
                                        <div className="flex-1 bg-slate-900/80 border border-white/5 rounded-2xl p-6 overflow-y-auto font-mono text-[10px] text-slate-400 leading-relaxed scrollbar-hide">
                                            {documents.termsOfService}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={onCancel}
                                        className="flex-1 py-5 bg-white/5 text-white/50 font-black text-[10px] uppercase tracking-[0.3em] rounded-xl hover:bg-white/10 transition-all italic"
                                    >
                                        Discard & Retry
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        className="flex-[2] py-5 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-[0.3em] rounded-xl hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all italic"
                                    >
                                        Commit Legal Armor
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-16 flex flex-col items-center justify-center space-y-10 text-center"
                            >
                                <div className="w-40 h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-6xl shadow-[0_0_60px_rgba(16,185,129,0.3)]">
                                    🔱
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Guardrail <span className="text-emerald-500">Live</span></h2>
                                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-[0.5em] animate-pulse">Enterprise Compliance Operational</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="mt-8 p-6 bg-red-600/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm italic">🚨 MATERIALIZATION_FAULT</div>
                            {error}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
