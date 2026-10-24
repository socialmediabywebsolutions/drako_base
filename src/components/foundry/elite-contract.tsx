"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface EliteContractProps {
    contractId: string;
    projectId: string;
    projectName: string;
    content: string;
    onSigned: () => void;
}

export function EliteContract({ contractId, projectName, content, onSigned }: EliteContractProps) {
    const [isSigning, setIsSigning] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            setHasScrolledToBottom(true);
        }
    };

    const handleSign = async () => {
        if (!hasScrolledToBottom) return;
        setIsSigning(true);
        setError(null);

        try {
            const res = await fetch("/api/factory/contracts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contractId,
                    metadata: {
                        userAgent: navigator.userAgent,
                        language: navigator.language,
                        platform: navigator.platform
                    }
                })
            });

            const data = (await res.json()) as { ok?: boolean; error?: string };
            if (data.ok) {
                onSigned();
            } else {
                throw new Error(data.error || "Fallo en la sincronización de la firma");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setIsSigning(false);
        }
    };

    return (
        <div className="glass-panel-elite p-1 relative min-h-[600px] flex flex-col shadow-[0_0_100px_var(--brand-glow)]">
            {/* Decorative Hardware Frame */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-brand/30 rounded-b-full shadow-[0_0_15px_var(--brand-glow)]" />
            <div className="absolute -top-[2px] right-20 w-40 h-[2px] bg-brand shadow-[0_0_10px_var(--brand-glow)]" />

            {/* Internal Console Header */}
            <div className="px-10 py-8 border-b border-white/10 flex items-center justify-between">
                <div>
                    <h3 className="text-technical text-[10px] text-brand mb-1">Secure Protocol: Legal_Sync_v3</h3>
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Materialization Agreement</h2>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{contractId.slice(0, 8)}</div>
                    <div className="text-[8px] font-black text-success uppercase tracking-[0.4em] mt-1 animate-pulse italic">Awaiting Signature</div>
                </div>
            </div>

            {/* Document Area */}
            <div
                className="flex-1 overflow-y-auto px-10 py-12 space-y-8 scrollbar-hide grayscale hover:grayscale-0 transition-all duration-700"
                onScroll={handleScroll}
                style={{ maxHeight: '500px' }}
            >
                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-bold selection:bg-brand selection:text-slate-950">
                    {content.split('\n').map((line, i) => (
                        <p key={i} className={line.startsWith('#') ? 'text-white font-black italic uppercase tracking-tight' : ''}>
                            {line}
                        </p>
                    ))}
                </div>
            </div>

            {/* Signature Module */}
            <div className="p-10 bg-slate-950/80 border-t border-white/10 backdrop-blur-3xl rounded-b-[2rem]">
                {error && (
                    <div className="mb-6 p-4 bg-danger/10 border-2 border-danger text-danger text-[10px] font-black uppercase tracking-widest animate-pulse">
                        {error}
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="space-y-3 max-w-md">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest italic">Declaración de Conformidad</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                            Al proceder con la firma electrónica, usted confirma que ha revisado los módulos de materialización para <span className="text-brand">{projectName}</span> y acepta los términos de provisión automatizada.
                        </p>
                    </div>

                    <div className="relative group">
                        {!hasScrolledToBottom && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-brand uppercase tracking-[0.4em] animate-bounce">
                                ⬇️ Deslice hasta el final para autorizar
                            </div>
                        )}

                        <button
                            disabled={!hasScrolledToBottom || isSigning}
                            onClick={handleSign}
                            className={`
                 relative flex items-center gap-6 px-12 py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.5em] transition-all
                 ${hasScrolledToBottom ? 'bg-white text-slate-950 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:bg-brand hover:shadow-brand-glow hover:scale-105 italic active:scale-95' : 'bg-slate-900 text-slate-700 cursor-not-allowed opacity-50 grayscale'}
               `}
                        >
                            {isSigning ? (
                                <>
                                    <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <span className="text-xl">✍️</span>
                                    Firmar y Materializar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Scanning Line Overlay for the doc */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
                <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="h-[2px] w-full bg-brand shadow-[0_0_15px_var(--brand-glow)]"
                />
            </div>
        </div>
    );
}
