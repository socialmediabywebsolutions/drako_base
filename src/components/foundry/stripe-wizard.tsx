"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


interface StripeWizardProps {
    saasId: string;
    saasName: string;
    suggestedPricing: {
        monthly: number;
        yearly: number;
        rationale?: string;
    };
    onComplete: (data: unknown) => void;
    onCancel: () => void;
}

export function StripeWizard({ saasId, saasName, suggestedPricing, onComplete, onCancel }: StripeWizardProps) {
    const [step, setStep] = useState(1); // 1: Config, 2: Forging, 3: Success

    const [error, setError] = useState<string | null>(null);
    const [currentAction, setCurrentAction] = useState("");

    const handleStartForging = async () => {

        setStep(2);
        setError(null);
        setCurrentAction("INITIALIZING_SECURE_CHANNEL");

        try {
            // Step simulation for visual impact
            const actions = [
                "RESOLVING_API_CREDENTIALS",
                "CREATING_STRIKE_PRODUCT_REFERENCE",
                "GENERATING_MONTHLY_PRICE_TIERS",
                "GENERATING_ANNUAL_DISCOUNT_TIERS",
                "MAPPING_ENTITLEMENT_MATRIX",
                "FINALIZING_FINTECH_PROTOCOL"
            ];

            for (const action of actions) {
                setCurrentAction(action);
                await new Promise(r => setTimeout(r, 800));
            }

            const res = await fetch("/api/stripe/wizard/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-drako-tenant-id": "demo" }, // Tenant context needed
                body: JSON.stringify({
                    saasId,
                    saasName,
                    customPricing: {
                        monthly: suggestedPricing.monthly,
                        yearly: suggestedPricing.yearly
                    }
                })
            });

            const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
            if (data.success) {
                setStep(3);
                setTimeout(() => onComplete(data), 2000);
            } else {
                throw new Error(data.message || data.error || "Materialization failed");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Desconocido");
            setStep(1);
        } finally {

        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="max-w-xl w-full glass-panel-elite relative overflow-hidden shadow-[0_0_80px_var(--brand-glow)]"
            >
                {/* Banner Superior - Industrial */}
                <div className="bg-brand text-slate-950 px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🛠️</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Fintech Forge Interface v2.1</span>
                    </div>
                    <button onClick={onCancel} className="text-[10px] font-black hover:opacity-50 transition-opacity">CLOSE_PORT</button>
                </div>

                <div className="p-10 space-y-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Integration Config</h2>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sincronizando con inteligencia del Blueprint</p>
                                </div>

                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Monthly Price</span>
                                        <span className="text-2xl font-black text-white italic">€{suggestedPricing.monthly} <span className="text-[10px] text-slate-500 not-italic">/ mo</span></span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Annual Price</span>
                                        <span className="text-2xl font-black text-brand italic">€{suggestedPricing.yearly} <span className="text-[10px] text-brand/50 not-italic">/ yr</span></span>
                                    </div>
                                    <div className="pt-4 border-t border-white/5">
                                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">AI Rationale</h4>
                                        <p className="text-[10px] text-slate-300 font-medium leading-relaxed italic">{suggestedPricing.rationale || "Optimized for core market entry and initial user scaling."}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStartForging}
                                    className="w-full py-4 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.4em] hover:bg-brand hover:shadow-brand-glow transition-all active:scale-95 italic"
                                >
                                    Confirm and Forge Fintech
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-12 flex flex-col items-center justify-center space-y-10 text-center"
                            >
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full border-4 border-white/5 border-t-brand animate-spin shadow-[0_0_30px_var(--brand-glow)]" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl animate-pulse">🔥</span>
                                    </div>
                                </div>

                                <div className="space-y-4 w-full px-12">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-black text-white italic tracking-tighter uppercase">Forging Infrastructure...</span>
                                        <span className="text-[10px] text-brand font-mono font-black tracking-widest animate-pulse">{currentAction}</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 6, ease: "linear" }}
                                            className="h-full bg-brand"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-12 flex flex-col items-center justify-center space-y-8 text-center"
                            >
                                <div className="w-24 h-24 rounded-full bg-success/20 border-2 border-success flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                                    ✅
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Forging Complete</h2>
                                    <p className="text-[10px] text-success font-bold uppercase tracking-[0.3em]">Fintech Channels Materialized</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <div className="p-4 bg-danger/10 border-2 border-danger text-danger text-[10px] font-black uppercase tracking-widest animate-pulse text-center">
                            SYSTEM_FAILURE: {error}
                        </div>
                    )}
                </div>

                {/* Decoración Inferior */}
                <div className="h-1.5 w-full bg-white/5 flex">
                    <div className="h-full w-1/3 bg-brand shadow-[0_0_10px_var(--brand-glow)]" />
                </div>
            </motion.div>
        </div>
    );
}
