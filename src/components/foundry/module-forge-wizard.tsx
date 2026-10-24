"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModuleForgeWizardProps {
    saasId: string;
    projectName: string;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

const AVAILABLE_MODULES = [
    { id: "auth_core", name: "Authentication Core", icon: "🔐", description: "Secure identity & session management." },
    { id: "billing_recurring", name: "Subscription Logic", icon: "💳", description: "Recurring billing & tier-based access." },
    { id: "neural_crm", name: "Neural CRM", icon: "🧠", description: "AI-powered customer relations & insights." },
    { id: "edge_analytics", name: "Edge Analytics", icon: "📊", description: "Real-time traffic & conversion metrics." },
    { id: "cloud_inventory", name: "Cloud Inventory", icon: "📦", description: "Digital & physical asset tracking." },
    { id: "smart_booking", name: "Smart Booking", icon: "📅", description: "Automated scheduling & capacity flows." }
];

export function ModuleForgeWizard({ saasId, projectName, onComplete, onCancel }: ModuleForgeWizardProps) {
    const [step, setStep] = useState(1); // 1: Selection, 2: Forging, 3: Success
    const [selectedModules, setSelectedModules] = useState<string[]>(["auth_core"]);
    
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const toggleModule = (id: string) => {
        setSelectedModules(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const handleStartForging = async () => {
        if (selectedModules.length === 0) return;

        
        setStep(2);
        setError(null);
        setLogs([]);

        try {
            addLog("SCANNING_DEPENDENCY_GRAPH...");
            await new Promise(r => setTimeout(r, 1000));

            for (const modId of selectedModules) {
                addLog(`INJECTING_MODULE_${modId.toUpperCase()}...`);
                await new Promise(r => setTimeout(r, 800));
            }

            addLog("REGISTERING_PROJECT_ENTITLEMENTS...");

            const res = await fetch("/api/factory/provisioning/modules", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({ saasId, modules: selectedModules })
            });

            const data = (await res.json()) as { success?: boolean; error?: string };

            if (data.success) {
                addLog("FUNCTIONAL_LAYER_OPTIMIZED");
                await new Promise(r => setTimeout(r, 1000));
                setStep(3);
                setTimeout(() => onComplete(data), 2000);
            } else {
                throw new Error(data.error || "Materialization failed");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Desconocido");
            setStep(1);
        } finally {
            
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-5xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_100px_rgba(0,210,255,0.15)]"
            >
                {/* Header */}
                <div className="bg-slate-900/60 text-brand px-8 py-5 flex items-center justify-between border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/50 flex items-center justify-center text-xs font-black animate-pulse">⚙️</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none text-white">Functional Module Forge</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1 text-brand">System capabilities materialization portal</span>
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
                                className="space-y-10"
                            >
                                <div className="flex justify-between items-end">
                                    <div className="space-y-4">
                                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Module <span className="text-brand">Selection</span></h2>
                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.15em]">
                                            Selecciona las capacidades de ingeniería para el núcleo de **{projectName}**.
                                        </p>
                                    </div>
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">
                                        Selected: {selectedModules.length} / {AVAILABLE_MODULES.length}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {AVAILABLE_MODULES.map((mod) => (
                                        <button
                                            key={mod.id}
                                            onClick={() => toggleModule(mod.id)}
                                            className={`p-6 rounded-3xl border text-left transition-all relative group overflow-hidden ${selectedModules.includes(mod.id)
                                                    ? "bg-brand/10 border-brand shadow-[0_0_30px_rgba(0,210,255,0.1)]"
                                                    : "bg-white/5 border-white/10 hover:border-white/20"
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="text-3xl">{mod.icon}</div>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedModules.includes(mod.id) ? "bg-brand border-brand" : "border-white/20"
                                                    }`}>
                                                    {selectedModules.includes(mod.id) && <span className="text-[10px] text-slate-950 font-black">✓</span>}
                                                </div>
                                            </div>
                                            <h4 className="font-black text-sm text-white uppercase tracking-wider mb-2">{mod.name}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{mod.description}</p>

                                            {/* Decorative HUD Corner */}
                                            <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover:opacity-10 transition-opacity">
                                                <div className="absolute top-2 right-2 border-t border-r border-white w-2 h-2" />
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex justify-center pt-6">
                                    <button
                                        onClick={handleStartForging}
                                        disabled={selectedModules.length === 0}
                                        className="px-16 py-6 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.5em] hover:bg-brand hover:text-white hover:shadow-[0_0_40px_rgba(0,210,255,0.4)] transition-all active:scale-95 italic disabled:opacity-20 disabled:grayscale"
                                    >
                                        Forge Core Capabilities
                                    </button>
                                </div>
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
                                    <div className="w-48 h-48 rounded-full border border-brand/20 flex items-center justify-center">
                                        <motion.div
                                            animate={{ rotate: -360 }}
                                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-2 border-t-2 border-brand/40 rounded-full"
                                        />
                                        <div className="text-4xl animate-pulse">🧩</div>
                                    </div>
                                </div>

                                <div className="w-full space-y-4 max-w-md">
                                    <div className="flex justify-between items-end px-4 font-mono text-[9px] font-black text-slate-500 italic">
                                        <span>PROCESS: CAPABILITY_INJECTION</span>
                                        <span className="animate-pulse text-brand">ACTIVE</span>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1 h-32 overflow-y-auto">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-brand/80">
                                                <span className="text-brand font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-brand animate-pulse">❯ SYSTEM_IDLE_AWAITING_REGISTRY...</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-16 flex flex-col items-center justify-center space-y-10 text-center"
                            >
                                <div className="w-40 h-40 rounded-[2.5rem] bg-brand/10 border-2 border-brand flex items-center justify-center text-6xl shadow-[0_0_60px_rgba(0,210,255,0.3)]">
                                    ⚡
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Modules <span className="text-brand">Live</span></h2>
                                    <p className="text-xs text-brand font-bold uppercase tracking-[0.5em] animate-pulse">Kernel Functional Layer Materialized</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="mt-8 p-6 bg-red-600/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm italic">🚨 INJECTION_FAILURE</div>
                            {error}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
