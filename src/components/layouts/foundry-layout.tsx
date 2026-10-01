"use client";

import React, { useState, useEffect } from "react";

interface FoundryLayoutProps {
    children: React.ReactNode;
    onReset?: () => void;
}

export function FoundryLayout({ children, onReset }: FoundryLayoutProps) {
    const [leftWidth, setLeftWidth] = useState(240);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [leftOpen, setLeftOpen] = useState(true);

    // Resize Handlers
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingLeft) {
                const newWidth = Math.max(160, Math.min(500, e.clientX));
                setLeftWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizingLeft(false);
        };

        if (isResizingLeft) {
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
    }, [isResizingLeft]);

    return (
        <div className="fixed inset-0 z-50 flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 font-sans">
            {/* Panel lateral izquierdo */}
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
                    {["Protocolo Identidad", "Núcleo de Datos", "Pasarela Fiscal", "Agentes IA", "Roadmap Maestro"].map(item => (
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

            {/* Contenido principal */}
            <main className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden min-w-0">
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
                    <h2 className="font-black text-sm uppercase tracking-widest text-slate-900 flex items-center gap-2">
                        Pizarra de Diseño
                        <span className="px-2 py-0.5 rounded-md bg-sky-100 text-[9px] text-sky-600 border border-sky-200 font-bold">LIVE</span>
                    </h2>
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
            </main>
        </div>
    );
}
