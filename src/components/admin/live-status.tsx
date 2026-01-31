"use client";

import { useEffect, useState } from "react";

type StatusData = {
    system: string;
    version: string;
    lastUpdated: string;
    infrastructure: { runtime: string; status: string; entryPoint: string; envProfiles: string[] };
    bindings: { active: string[]; draft: string[]; unregistered: string[] };
    watchdogAlerts: { draftsInProduction: boolean; unregisteredBindings: boolean; envConflicts: boolean };
    ciVerifiers: Record<string, "pass" | "warn" | "fail">;
    learningCycle: {
        id: string;
        status: string;
        signals: number;
        artefactsChanged: number;
        nextReview: string;
    };
    links: Record<string, string>;
};

export default function LiveStatusDashboard() {
    const [status, setStatus] = useState<StatusData | null>(null);

    useEffect(() => {
        fetch("/api/status.json")
            .then((res) => res.json())
            .then(setStatus)
            .catch(err => console.error("Failed to load status.json", err));
    }, []);

    if (!status) return <div className="p-4 text-sm text-gray-500 animate-pulse">Cargando estado del sistema…</div>;

    return (
        <div className="p-6 space-y-6 text-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    🚀 Estado del Sistema — {status.system}
                </h1>
                <span className="text-xs text-slate-500 font-mono">v{status.version} | {status.lastUpdated}</span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Infrastructure */}
                <section className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Infraestructura</h2>
                    <ul className="space-y-1 text-slate-300">
                        <li className="flex justify-between"><span>Runtime:</span> <span className="text-white font-medium">{status.infrastructure.runtime}</span></li>
                        <li className="flex justify-between"><span>Estado:</span> <span className="text-green-400 font-medium uppercase">{status.infrastructure.status}</span></li>
                        <li className="flex justify-between"><span>Entry:</span> <span className="text-slate-400 font-mono text-xs">{status.infrastructure.entryPoint}</span></li>
                        <li className="flex justify-between"><span>Perfiles:</span> <span className="text-slate-400">{status.infrastructure.envProfiles.join(", ")}</span></li>
                    </ul>
                </section>

                {/* Bindings */}
                <section className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Bindings Activos</h2>
                    <ul className="space-y-1">
                        {status.bindings.active.map((b) => (
                            <li key={b} className="flex items-center gap-2 text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {b}
                            </li>
                        ))}
                    </ul>
                    {status.bindings.draft.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-xs font-bold text-yellow-500/80 uppercase mb-2">🟡 En draft:</h3>
                            <ul className="space-y-1">
                                {status.bindings.draft.map((b) => (
                                    <li key={b} className="flex items-center gap-2 text-slate-400 italic">
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                {/* CI Verifiers */}
                <section className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Verificadores CI</h2>
                    <ul className="space-y-2">
                        {Object.entries(status.ciVerifiers).map(([key, val]) => (
                            <li key={key} className="flex items-center justify-between p-2 rounded bg-white/5 text-slate-300">
                                <span className="capitalize">{key.replace(/-/g, ' ')}:</span>
                                <span className="text-lg">{val === "pass" ? "✅" : val === "warn" ? "⚠️" : "❌"}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Learning Cycle */}
                <section className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                    <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Ciclo de Aprendizaje</h2>
                    <ul className="space-y-1 text-slate-300">
                        <li className="flex justify-between"><span>ID:</span> <span className="text-slate-400">{status.learningCycle.id}</span></li>
                        <li className="flex justify-between"><span>Estado:</span> <span className="text-blue-400">{status.learningCycle.status}</span></li>
                        <li className="flex justify-between"><span>Señales:</span> <span className="text-white">{status.learningCycle.signals}</span></li>
                        <li className="flex justify-between"><span>Artefactos:</span> <span className="text-white">{status.learningCycle.artefactsChanged}</span></li>
                        <li className="flex justify-between italic text-slate-500 mt-2 text-xs"><span>Próxima revisión:</span> <span>{status.learningCycle.nextReview}</span></li>
                    </ul>
                </section>
            </div>

            <section className="pt-4 border-t border-white/5">
                <h2 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Links de Infraestructura</h2>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(status.links).map(([label, href]) => (
                        <a key={label} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full text-blue-400 transition-colors border border-white/5" href={href}>
                            {label}
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );
}
