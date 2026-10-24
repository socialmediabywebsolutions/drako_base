"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NeuralForgeWizardProps {
    saasId: string;
    projectName: string;
    packs: Record<string, string>;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

export function NeuralForgeWizard({ saasId, projectName, packs, onComplete, onCancel }: NeuralForgeWizardProps) {
    const [step, setStep] = useState(1); // 1: Strategy, 2: Forging, 3: Success
    const [strategy, setStrategy] = useState<"BALANCED" | "QUALITY">("BALANCED");
    
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [currentLayer, setCurrentLayer] = useState("");

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const handleStartForging = async () => {
        
        setStep(2);
        setError(null);
        setLogs([]);

        try {
            const layers = [
                { label: "CORE_REASONING_KERNEL", msg: "Cargando Llama 3.1 70B Instruct..." },
                { label: "SYMPATIC_MAPPING", msg: "Generando prompts de sistema por departamento..." },
                { label: "CONTEXT_INJECTION", msg: `Inyectando identidad del negocio: ${projectName}...` },
                { label: "PROTOCOL_VERIFICATION", msg: "Validando coherencia de respuestas agenticas..." }
            ];

            for (const layer of layers) {
                setCurrentLayer(layer.label);
                addLog(layer.msg);
                await new Promise(r => setTimeout(r, 1500));
            }

            const res = await fetch("/api/factory/provisioning/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({ saasId, strategy, packs })
            });

            const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
            if (data.success) {
                setStep(3);
                addLog("NEURAL_FORGE_COMPLETE_SUCCESS");
                setTimeout(() => onComplete(data), 2000);
            } else {
                throw new Error(data.message || data.error || "Forging failed");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Desconocido");
            setStep(1);
        } finally {
            
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-3xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_100px_rgba(139,92,246,0.2)]"
            >
                {/* Header - Neural Theme */}
                <div className="bg-violet-600 text-white px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded bg-slate-950 flex items-center justify-center text-xs animate-pulse">🧠</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none">Neural Forge v4.2</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1">Intelligence Layer Materialization</span>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity uppercase tracking-widest">Abort_Neural_Link</button>
                </div>

                <div className="p-10 space-y-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-3">
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Model <span className="text-violet-400">Calibration</span></h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Configurando la intensidad del núcleo neural</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <button
                                        onClick={() => setStrategy("BALANCED")}
                                        className={`p-8 rounded-[2rem] border-2 transition-all text-left space-y-4 ${strategy === 'BALANCED' ? 'bg-violet-600/10 border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.2)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-2xl">⚖️</span>
                                            {strategy === 'BALANCED' && <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest">Active_Profile</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xl font-black text-white italic tracking-tight uppercase">Balanced Core</div>
                                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">Optimizado para velocidad y coherencia lógica estándar.</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setStrategy("QUALITY")}
                                        className={`p-8 rounded-[2rem] border-2 transition-all text-left space-y-4 ${strategy === 'QUALITY' ? 'bg-violet-600/10 border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.2)]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="text-2xl">🔥</span>
                                            {strategy === 'QUALITY' && <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest">Active_Profile</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-xl font-black text-white italic tracking-tight uppercase">Bespoke Deepness</div>
                                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest">Máxima precisión y creatividad. Mayor carga computacional.</p>
                                        </div>
                                    </button>
                                </div>

                                <div className="p-8 rounded-[2.5rem] bg-slate-900/50 border border-violet-500/20 space-y-6">
                                    <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-[0.3em]">Agentic Swarm Protocol</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.keys(packs).map((dept) => (
                                            <div key={dept} className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{dept}: {packs[dept]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartForging}
                                    className="w-full py-6 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.5em] hover:bg-violet-500 hover:text-white hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-all active:scale-95 italic"
                                >
                                    Initiate Neural Forging
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
                                    <div className="w-48 h-48 rounded-full border border-violet-500/20 flex items-center justify-center">
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                            className="w-32 h-32 rounded-full border-t-2 border-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.3)]"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-4xl animate-pulse">⚛️</div>
                                        </div>
                                    </div>
                                    {/* Orbiting particles */}
                                    {[...Array(6)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 3 + i, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0"
                                        >
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_10px_#8b5cf6]" />
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="w-full space-y-6">
                                    <div className="flex justify-between items-end px-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black text-white italic tracking-tighter uppercase block">Forging Neural Path...</span>
                                            <span className="text-xs text-violet-400 font-mono font-black tracking-widest animate-pulse">{currentLayer}</span>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-600 font-mono italic">SYNS_ACTIVE</span>
                                    </div>

                                    <div className="bg-black/80 p-6 rounded-2xl border border-white/5 font-mono text-[10px] space-y-2 h-40 overflow-y-auto scrollbar-hide shadow-inner">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-violet-400/80">
                                                <span className="text-violet-500 font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-violet-400 animate-pulse">❯ NEURAL_SYNC_WAITING...</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="py-16 flex flex-col items-center justify-center space-y-10 text-center"
                            >
                                <div className="w-40 h-40 rounded-[3rem] bg-violet-600/20 border-2 border-violet-500 flex items-center justify-center text-6xl shadow-[0_0_60px_rgba(139,92,246,0.4)]">
                                    🔋
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Agents <span className="text-violet-400">Live</span></h2>
                                    <p className="text-xs text-violet-400 font-bold uppercase tracking-[0.5em] animate-pulse">Neural Architecture Materialized</p>
                                </div>

                                <div className="grid grid-cols-3 gap-6 w-full">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                                        <div className="text-xl font-black text-white italic tracking-tighter uppercase">70B</div>
                                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">MODEL_KERNEL</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                                        <div className="text-xl font-black text-white italic tracking-tighter uppercase">∞</div>
                                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">SYNS_MAP</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
                                        <div className="text-xl font-black text-white italic tracking-tighter uppercase">v4.2</div>
                                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest font-mono">PROTOCOL</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="p-6 bg-red-600/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm">🚨 NEURAL_SYNC_FAILURE</div>
                            {error}
                        </div>
                    )}
                </div>

                {/* Neural Activity Bar */}
                <div className="h-1.5 w-full bg-slate-900 overflow-hidden flex">
                    <motion.div
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="w-1/3 h-full bg-gradient-to-r from-transparent via-violet-500 to-transparent shadow-[0_0_15px_rgba(139,92,246,0.8)]"
                    />
                </div>
            </motion.div>
        </div>
    );
}
