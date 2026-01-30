"use client";

import React, { useState } from "react";
import Link from "next/link";

interface FoundryLayoutProps {
    children: React.ReactNode;
    chatComponent: React.ReactNode;
    chatInput?: string;
    onChatInputChange?: (val: string) => void;
    onSendMessage?: () => void;
    onReset?: () => void;
}

export function FoundryLayout({ children, chatComponent, chatInput, onChatInputChange, onSendMessage, onReset }: FoundryLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    // ... rest of the component

    return (
        <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-100">
            {/* COLUMNA 1: Navegación de Construcción (Izquierda) */}
            <aside className={`w-64 border-r border-white/5 bg-slate-900/50 flex flex-col transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full w-0"}`}>
                <div className="p-8 border-b border-white/5">
                    <Link href="/site" className="flex items-center gap-3 text-xs font-black tracking-[0.3em] uppercase italic text-brand">
                        <span className="w-6 h-6 rounded bg-brand shadow-[0_0_10px_var(--brand-glow)]" />
                        DRĀKO FOUNDRY
                    </Link>
                </div>

                <nav className="flex-1 p-6 space-y-4 overflow-y-auto">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 mb-6">Módulos de Sistema</div>
                    {["Protocolo Identidad", "Núcleo de Datos", "Pasarela Fiscal", "Agentes lA", "Roadmap Maestro"].map(item => (
                        <button key={item} className="w-full text-left px-4 py-3 rounded-2xl text-xs font-bold hover:bg-white/5 transition-all flex items-center justify-between group text-slate-400 hover:text-white border border-transparent hover:border-white/5">
                            {item}
                            <span className="w-1.5 h-1.5 rounded-full bg-brand opacity-0 group-hover:opacity-100 shadow-[0_0_8px_var(--brand-glow)]" />
                        </button>
                    ))}

                    {onReset && (
                        <div className="pt-10">
                            <button
                                onClick={onReset}
                                className="w-full px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] bg-red-500/5 text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all flex items-center gap-3"
                            >
                                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                                Borrar Proyecto
                            </button>
                        </div>
                    )}
                </nav>

                <div className="p-6 border-t border-white/5 bg-slate-900/20 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] font-black text-slate-500 tracking-widest">OPS STATUS</span>
                        <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[9px] font-bold border border-brand/20">PROVISIONING</span>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[9px] font-black tracking-wider text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> D1 DATABASE: OK
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black tracking-wider text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.5)]" /> STRIPE: SETUP...
                        </div>
                    </div>
                </div>
            </aside>

            {/* COLUMNA 2: Pizarra de Evolución (Centro) */}
            <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                <header className="h-20 border-b border-white/5 bg-slate-900/30 backdrop-blur-xl flex items-center justify-between px-10">
                    <div className="flex items-center gap-6">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10">
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <h2 className="font-black text-base uppercase tracking-widest italic text-white flex items-center gap-2">
                            Pizarra de Diseño
                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-brand border border-brand/20">LIVE</span>
                        </h2>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 bg-slate-900 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl hover:bg-white/5 transition-all">Historique</button>
                        <button className="px-6 py-2 bg-brand text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_var(--brand-glow)]">Desplegar Protocolo</button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-16 custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>

            {/* COLUMNA 3: Chat Orquestador (Derecha) */}
            <aside className="w-[450px] border-l border-white/5 bg-slate-900/40 backdrop-blur-2xl flex flex-col shadow-2xl relative">
                <header className="p-8 border-b border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner">🤖</div>
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-widest text-white">Agente Orquestador</h3>
                        <p className="text-[10px] text-brand font-black tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                            NEURAL LINK ACTIVE
                        </p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[radial-gradient(circle_at_top_right,rgba(0,210,255,0.02)_0,transparent_100%)]">
                    {chatComponent}
                </div>

                <div className="p-8 border-t border-white/5 bg-slate-950/50 backdrop-blur-xl">
                    <div className="relative group">
                        <textarea
                            placeholder="Ingrese comando o requerimiento técnico..."
                            className="modern-input w-full pr-14 h-28 resize-none text-sm leading-relaxed"
                            value={chatInput}
                            onChange={(e) => onChatInputChange?.(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    onSendMessage?.();
                                }
                            }}
                        />
                        <button
                            onClick={onSendMessage}
                            className="absolute bottom-4 right-4 p-2.5 bg-brand text-slate-900 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_15px_var(--brand-glow)]"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
