"use client";

import React, { useState } from "react";
import Link from "next/link";

interface FoundryLayoutProps {
    children: React.ReactNode; // El contenido de la pizarra (Columna 2)
    chatComponent: React.ReactNode; // El chat del orquestador (Columna 3)
}

export function FoundryLayout({ children, chatComponent }: FoundryLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900">
            {/* COLUMNA 1: Navegación de Construcción (Izquierda) */}
            <aside className={`w-64 border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full w-0"}`}>
                <div className="p-6 border-b border-slate-100">
                    <Link href="/site" className="flex items-center gap-2 text-xs font-black tracking-widest uppercase">
                        <span className="w-6 h-6 rounded bg-cyan-400" />
                        DRĀKO FOUNDRY
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-4">Módulos del Proyecto</div>
                    {["Identidad Visual", "Base de Datos", "Pasarela de Pagos", "Agentes lA", "Roadmap"].map(item => (
                        <button key={item} className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-between group">
                            {item}
                            <span className="w-1.5 h-1.5 rounded-full bg-success opacity-0 group-hover:opacity-100" />
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-slate-400">STATUS</span>
                        <span className="badge badge-info">PROVISIONING</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-success" /> D1 DATABASE: OK
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" /> STRIPE: SETUP...
                        </div>
                    </div>
                </div>
            </aside>

            {/* COLUMNA 2: Pizarra de Evolución (Centro) */}
            <main className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                <header className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur-md flex items-center justify-between px-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-200 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <h2 className="font-black text-lg uppercase tracking-tight">Pizarra de Diseño <span className="text-cyan-500">Live</span></h2>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn btn-outline text-xs py-1.5">Version Hist.</button>
                        <button className="btn btn-primary text-xs py-1.5 px-6 shadow-cyan-200/50 shadow-lg">Desplegar Preview</button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-12">
                    <div className="max-w-4xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>

            {/* COLUMNA 3: Chat Orquestador (Derecha) */}
            <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col shadow-2xl">
                <header className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-xl">🤖</div>
                    <div>
                        <h3 className="font-black text-sm uppercase">Agente Orquestador</h3>
                        <p className="text-[10px] text-success font-bold">ONLINE • ANALIZANDO NEGOCIO</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    {chatComponent}
                </div>

                <div className="p-6 border-t border-slate-200">
                    <div className="relative">
                        <textarea
                            placeholder="Escribe tu requerimiento o cambio..."
                            className="input w-full pr-12 h-24 resize-none brightness-105"
                        />
                        <button className="absolute bottom-3 right-3 p-2 bg-slate-900 text-white rounded-lg hover:bg-cyan-500 transition-all">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
