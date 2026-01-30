"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EdgeProvisioningWizardProps {
    saasId: string;
    projectName: string;
    subdomain: string;
    customDomain?: string | null;
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

export function EdgeProvisioningWizard({ saasId, subdomain, customDomain, onComplete, onCancel }: EdgeProvisioningWizardProps) {
    const [step, setStep] = useState(1); // 1: Pre-flight, 2: Orchestrating, 3: Success

    const [error, setError] = useState<string | null>(null);
    const [currentAction, setCurrentAction] = useState("");
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));

    const handleStartProvisioning = async () => {

        setStep(2);
        setError(null);
        setLogs([]);

        try {
            const actions = [
                { label: "RESOLVING_ZONE_IDENTITY", msg: "Accediendo a la zona drako.systems..." },
                { label: "ENSURING_DNS_CNAME", msg: `Maperando ${subdomain}.drako.systems -> Origin...` },
                { label: "INITIALIZING_SSL_CERT", msg: "Generando certificado Edge (Universal SSL)..." },
                { label: "CONFIGURING_SECURE_BYPASS", msg: "Aplicando reglas de Firewall y WAF..." }
            ];

            if (customDomain) {
                actions.push({ label: "CUSTOM_HOSTNAME_MATERIALIZATION", msg: `Configurando dominio personalizado: ${customDomain}...` });
            }

            for (const action of actions) {
                setCurrentAction(action.label);
                addLog(action.msg);
                await new Promise(r => setTimeout(r, 1200));
            }

            // Simulation for now, or actual API call if ready
            const res = await fetch("/api/campamento-base/provisioning/edge", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" },
                body: JSON.stringify({ saasId, subdomain, customDomain })
            });

            const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
            if (data.success) {
                setStep(3);
                addLog("PROVISIONING_COMPLETE_SUCCESS");
                setTimeout(() => onComplete(data), 2000);
            } else {
                throw new Error(data.message || data.error || "Provisioning failed");
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
                className="max-w-2xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_100px_rgba(34,211,238,0.2)]"
            >
                {/* Header - Orchestrator Theme */}
                <div className="bg-cyan-500 text-slate-950 px-8 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded bg-slate-950 flex items-center justify-center text-xs animate-pulse">🛰️</div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block leading-none">Edge Orchestrator v1.0</span>
                            <span className="text-[8px] font-bold opacity-70 uppercase tracking-widest mt-1">Foundry Deployment Protocol</span>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity uppercase tracking-widest">Abort_Mission</button>
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
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Pre-Flight <span className="text-cyan-400">Scan</span></h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Verificando disponibilidad de recursos Edge</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Subdomain</span>
                                        <div className="text-lg font-black text-white italic truncate">{subdomain}.drako.systems</div>
                                    </div>
                                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Custom Domain</span>
                                        <div className="text-lg font-black text-cyan-400 italic truncate">{customDomain || "NOT_REQUESTED"}</div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-slate-900/50 border border-cyan-500/20">
                                    <h4 className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-3">Validation Protocol</h4>
                                    <ul className="text-[10px] text-slate-400 font-bold space-y-2 uppercase tracking-widest">
                                        <li className="flex items-center gap-2">✓ <span className="opacity-60">Subdomain Availability</span></li>
                                        <li className="flex items-center gap-2">✓ <span className="opacity-60">Global CDN Propagation Capacity</span></li>
                                        <li className="flex items-center gap-2">✓ <span className="opacity-60">Firewall Rules Mapping</span></li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleStartProvisioning}
                                    className="w-full py-5 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.4em] hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all active:scale-95 italic"
                                >
                                    Initiate Edge Materialization
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-6 flex flex-col space-y-10"
                            >
                                <div className="flex items-center justify-center gap-10">
                                    <div className="relative">
                                        <div className="w-40 h-40 rounded-full border-2 border-white/5 border-t-cyan-400 animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-32 h-32 rounded-full bg-cyan-400/10 border border-cyan-400/20 animate-pulse flex items-center justify-center">
                                                <span className="text-3xl">📡</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 w-full px-10">
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-white italic tracking-tighter uppercase">Provisioning Systems...</span>
                                            <span className="text-xs text-cyan-400 font-mono font-black tracking-widest animate-pulse">{currentAction}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 font-mono italic">ALPHA_7</span>
                                    </div>

                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 10, ease: "linear" }}
                                            className="h-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                                        />
                                    </div>

                                    {/* Terminal Logs */}
                                    <div className="bg-black/60 p-4 rounded-xl border border-white/5 font-mono text-[9px] space-y-1 h-32 overflow-y-auto scrollbar-hide">
                                        {logs.map((log, i) => (
                                            <div key={i} className="text-cyan-400/70">
                                                <span className="text-cyan-500 font-black">❯</span> {log}
                                            </div>
                                        ))}
                                        <div className="text-cyan-400 animate-pulse">❯ BLINKING_CURSOR_PENDING...</div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-12 flex flex-col items-center justify-center space-y-10 text-center"
                            >
                                <div className="w-32 h-32 rounded-full bg-cyan-400/20 border-2 border-cyan-400 flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(34,211,238,0.3)]">
                                    ⚡
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Sync <span className="text-cyan-400">Complete</span></h2>
                                    <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-[0.4em] animate-pulse">Infrastructure Live on Edge</p>
                                </div>

                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 w-full max-w-sm">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Deployed URL</span>
                                    <span className="text-sm font-black text-white italic tracking-tight">{subdomain}.drako.systems</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="p-6 bg-red-500/10 border-2 border-red-500 text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse text-center rounded-2xl">
                            <div className="mb-1 text-sm">⚠️ CORE_FAILURE_DETECTED</div>
                            {error}
                        </div>
                    )}
                </div>

                {/* Industrial Status Bar */}
                <div className="h-2 w-full bg-white/5 flex">
                    <div className="h-full w-2/3 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                </div>
            </motion.div>
        </div>
    );
}
