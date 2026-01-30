"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BrandingForgeWizardProps {
    saasId: string;
    projectName: string;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

export function BrandingForgeWizard({ saasId, projectName, onComplete, onCancel }: BrandingForgeWizardProps) {
    const [step, setStep] = useState(1); // 1: Color Selection, 2: Forging, 3: Success
    const [colors, setColors] = useState({
        primary: "#00d2ff",
        secondary: "#94a3b8",
        accent: "#f59e0b",
        background: "#0b0b0f",
        surface: "#14141d",
        text: "#f5f5f5",
    });

    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const handleStartForging = async () => {

        setStep(2);
        setError(null);
        setLogs([]);

        try {
            const operations = [
                "CALIBRATING_CHROMATIC_MATRICES...",
                "GENERATING_SATELLITE_THEME_JSON...",
                "INJECTING_CSS_VARIABLES_V4...",
                "OPTIMIZING_CONTRAST_RATIOS...",
                "PERSISTING_BRAND_IDENTITY..."
            ];

            for (const op of operations) {
                addLog(op);
                await new Promise(r => setTimeout(r, 1200));
            }

            const res = await fetch("/api/campamento-base/provisioning/branding", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({
                    saasId,
                    ...colors,
                    enableDarkMode: true,
                    layoutDensity: "NORMAL"
                })
            });

            const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
            if (data.success) {
                setStep(3);
                addLog("BRANDING_FORGE_COMPLETE_SUCCESS");
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl font-sans">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-4xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_100px_rgba(0,210,255,0.15)]"
            >
                {/* Header - Branding Theme */}
                <div className="bg-brand text-slate-950 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded bg-slate-950 flex items-center justify-center text-xs text-brand font-black animate-pulse">🖌️</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none">Branding Forge v1.0</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1">White-label Materialization Engine</span>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity uppercase tracking-widest italic">Abort_Personalization</button>
                </div>

                <div className="p-10">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-10"
                            >
                                <div className="space-y-8">
                                    <div className="space-y-3">
                                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Visual <span className="text-brand">Identity</span></h2>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Configurando el ADN visual de {projectName}</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Color Inputs */}
                                        {[
                                            { label: "Primary Color", key: "primary" },
                                            { label: "Secondary Color", key: "secondary" },
                                            { label: "Accent Color", key: "accent" }
                                        ].map((c) => (
                                            <div key={c.key} className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                                                    {c.label}
                                                    <span className="text-white font-mono">{colors[c.key as keyof typeof colors]}</span>
                                                </label>
                                                <div className="flex gap-4">
                                                    <input
                                                        type="color"
                                                        className="w-12 h-12 rounded-lg bg-slate-800 border-2 border-white/5 cursor-pointer"
                                                        value={colors[c.key as keyof typeof colors]}
                                                        onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={colors[c.key as keyof typeof colors]}
                                                        onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })}
                                                        className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-4 text-xs font-mono text-white focus:outline-none focus:border-brand"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleStartForging}
                                        className="w-full py-6 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.5em] hover:bg-brand hover:text-white hover:shadow-[0_0_40px_rgba(0,210,255,0.4)] transition-all active:scale-95 italic"
                                    >
                                        Forge Visual Protocol
                                    </button>
                                </div>

                                {/* Preview Window */}
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Real-time HUD Preview</div>
                                    <div className="aspect-square bg-slate-950 rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-2xl">
                                        <div className="absolute inset-0 p-6 flex flex-col gap-6">
                                            {/* Fake Sidebar */}
                                            <div className="flex gap-4 h-full">
                                                <div className="w-12 space-y-4">
                                                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: colors.primary }} />
                                                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                                                    <div className="w-8 h-8 rounded-lg bg-white/5" />
                                                </div>
                                                {/* Fake Dashboard Content */}
                                                <div className="flex-1 space-y-6">
                                                    <div className="flex justify-between items-center">
                                                        <div className="h-6 w-32 rounded-full" style={{ backgroundColor: colors.primary, opacity: 0.2 }} />
                                                        <div className="h-2 w-12 rounded-full bg-white/10" />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="h-24 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden p-4">
                                                            <div className="h-2 w-16 rounded-full" style={{ backgroundColor: colors.primary }} />
                                                            <div className="mt-2 h-4 w-20 bg-white/20 rounded" />
                                                            <div className="absolute bottom-4 right-4 text-xl" style={{ color: colors.accent }}>⚡</div>
                                                        </div>
                                                        <div className="h-24 rounded-2xl bg-white/5 border border-white/5 p-4">
                                                            <div className="h-2 w-16 rounded-full bg-white/20" />
                                                            <div className="mt-2 h-6 w-12 rounded" style={{ backgroundColor: colors.primary, opacity: 0.1 }} />
                                                        </div>
                                                    </div>
                                                    <div className="h-32 rounded-3xl border border-white/10 p-6 flex flex-col gap-4">
                                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                animate={{ width: ["20%", "80%", "40%"] }}
                                                                transition={{ duration: 4, repeat: Infinity }}
                                                                className="h-full"
                                                                style={{ backgroundColor: colors.primary }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <div className="space-y-2">
                                                                <div className="h-2 w-20 bg-white/20 rounded" />
                                                                <div className="h-2 w-32 bg-white/10 rounded" />
                                                            </div>
                                                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px]" style={{ backgroundColor: colors.accent, color: colors.background }}>GO</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 pointer-events-none border-4 border-white/5 rounded-[2.5rem]" />
                                    </div>
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
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0"
                                        >
                                            <div className="w-3 h-3 rounded-full bg-brand absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_20px_#00d2ff]" />
                                        </motion.div>
                                        <div className="text-4xl" style={{ color: colors.primary }}>🎨</div>
                                    </div>
                                    {/* Scanning lines */}
                                    <motion.div
                                        animate={{ top: ["0%", "100%", "0%"] }}
                                        transition={{ duration: 4, repeat: Infinity }}
                                        className="absolute left-0 right-0 h-1 bg-brand/30 shadow-[0_0_20px_#00d2ff] pointer-events-none"
                                    />
                                </div>

                                <div className="w-full space-y-4">
                                    <div className="flex justify-between items-end px-4 font-mono text-[9px] font-black text-slate-500 italic">
                                        <span>PROCESS: BRANDING_MATERIALIZATION</span>
                                        <span className="animate-pulse text-brand">ACTIVE</span>
                                    </div>
                                    <div className="bg-black/60 p-6 rounded-2xl border border-white/5 font-mono text-[10px] space-y-1 h-32 overflow-y-auto">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-brand/80">
                                                <span className="text-brand font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-brand animate-pulse">❯ SYSTEM_IDLE_WAITING...</div>
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
                                <div className="w-40 h-40 rounded-[3rem] bg-brand/10 border-2 border-brand flex items-center justify-center text-6xl shadow-[0_0_60px_rgba(0,210,255,0.3)]">
                                    💎
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Brand <span className="text-brand">Forged</span></h2>
                                    <p className="text-xs text-brand font-bold uppercase tracking-[0.5em] animate-pulse">Visual Protocol Synchronized</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="mt-8 p-6 bg-red-600/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm italic">🚨 SYNC_FAILURE</div>
                            {error}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
