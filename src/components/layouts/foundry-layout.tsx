"use client";

import React, { useState, useEffect } from "react";
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
    const [leftWidth, setLeftWidth] = useState(240);
    const [rightWidth, setRightWidth] = useState(300);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);

    // Resize Handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingLeft) {
                const newWidth = Math.max(160, Math.min(500, e.clientX));
                setLeftWidth(newWidth);
            }
            if (isResizingRight) {
                const newWidth = Math.max(260, Math.min(700, window.innerWidth - e.clientX));
                setRightWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizingLeft(false);
            setIsResizingRight(false);
        };

        if (isResizingLeft || isResizingRight) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
        } else {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isResizingLeft, isResizingRight]);

    return (
        <div className="fixed inset-0 z-50 flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans">
            {/* COLUMNA 1: Navegación de Construcción (Izquierda) */}
            <aside
                style={{ width: leftOpen ? leftWidth : 0 }}
                className={`relative border-r border-slate-200 bg-white flex flex-col z-30 flex-shrink-0 transition-all duration-300 ${!leftOpen ? 'invisible border-none overflow-hidden' : ''}`}
            >
                <header className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                        <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black shadow-lg shadow-sky-500/30">
                            Δ
                        </div>
                        <div className="min-w-0">
                            <span className="block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase truncate">Drāko</span>
                            <span className="block text-sm font-black tracking-tight text-slate-900 leading-none truncate">Campamento base</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setLeftOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Cerrar panel lateral"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" /></svg>
                    </button>
                </header>

                <nav className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 mb-6">Módulos de Sistema</div>
                    {["Protocolo Identidad", "Núcleo de Datos", "Pasarela Fiscal", "Agentes lA", "Roadmap Maestro"].map(item => (
                        <button key={item} className="w-full text-left px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-sky-600 transition-all flex items-center justify-between group">
                            {item}
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 opacity-0 group-hover:opacity-100" />
                        </button>
                    ))}

                    {onReset && (
                        <div className="pt-10">
                            <button
                                onClick={onReset}
                                className="w-full px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] bg-red-50 text-red-500 border border-red-100 hover:bg-red-100 transition-all flex items-center gap-3"
                            >
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Borrar Proyecto
                            </button>
                        </div>
                    )}
                </nav>

                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[9px] font-black text-slate-500 tracking-widest">OPS STATUS</span>
                        <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-600 text-[9px] font-bold border border-sky-200">ACTIVE</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> D1 DB: OK
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> STRIPE: SETUP
                        </div>
                    </div>
                </div>

                {leftOpen && (
                    <div
                        onMouseDown={() => setIsResizingLeft(true)}
                        className={`absolute -right-0.5 top-0 w-1.5 h-full cursor-col-resize z-30 transition-colors group ${isResizingLeft ? 'bg-sky-500' : 'hover:bg-sky-300'}`}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                        </div>
                    </div>
                )}
            </aside>

            {/* COLUMNA 2: Pizarra de Evolución (Centro) */}
            <main className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden min-w-0">
                {/* Expand toggles */}
                {!leftOpen && (
                    <button
                        onClick={() => setLeftOpen(true)}
                        className="absolute top-6 left-6 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-500 hover:text-sky-500 transition-all z-40"
                        title="Abrir panel lateral"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                )}

                <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-10">
                    <div className="flex items-center gap-6">
                        <h2 className="font-black text-sm uppercase tracking-widest text-slate-900 flex items-center gap-2">
                            Pizarra de Diseño
                            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-[9px] text-sky-600 border border-sky-200 font-bold">LIVE</span>
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 bg-slate-50 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-slate-600">Historial</button>
                        <button className="px-5 py-2 bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20">Desplegar</button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </div>

                {!rightOpen && (
                    <button
                        onClick={() => setRightOpen(true)}
                        className="absolute top-6 right-6 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-500 hover:text-sky-500 transition-all z-40"
                        title="Abrir chat"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </button>
                )}
            </main>

            {/* COLUMNA 3: Chat Orquestador (Derecha) */}
            <aside
                style={{ width: rightOpen ? rightWidth : 0 }}
                className={`relative border-l border-slate-200 bg-white flex flex-col shadow-2xl z-20 flex-shrink-0 transition-all duration-300 ${!rightOpen ? 'invisible border-none overflow-hidden' : ''}`}
            >
                {/* Resize Handle Right */}
                {rightOpen && (
                    <div
                        onMouseDown={() => setIsResizingRight(true)}
                        className={`absolute -left-0.5 top-0 w-1.5 h-full cursor-col-resize z-30 transition-colors group ${isResizingRight ? 'bg-sky-500' : 'hover:bg-sky-300'}`}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                        </div>
                    </div>
                )}
                <header className="p-8 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shadow-inner">🤖</div>
                        <div>
                            <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-900">IA Orquestador</h3>
                            <p className="text-[9px] text-emerald-500 font-black tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                ONLINE
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setRightOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Cerrar chat"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {chatComponent}
                </div>

                <div className="p-8 border-t border-slate-100 bg-white shadow-2xl shadow-slate-200">
                    <div className="relative group">
                        <textarea
                            placeholder="Ingrese comando..."
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 pr-14 h-24 resize-none text-[13px] leading-relaxed focus:ring-2 focus:ring-sky-500 outline-none transition-all"
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
                            className="absolute bottom-4 right-4 p-2.5 bg-sky-500 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-sky-500/20"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M14 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
