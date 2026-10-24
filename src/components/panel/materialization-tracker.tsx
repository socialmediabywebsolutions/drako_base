import React from 'react';
import Link from "next/link";

export function MaterializationTracker({
    phase = 0,
    status = 'draft'
}: {
    phase: number;
    status: string
}) {
    const steps = [
        { label: "Diagnóstico", desc: "Análisis de viabilidad" },
        { label: "Blueprint", desc: "Arquitectura técnica" },
        { label: "Identidad", desc: "Branding y Diseño" },
        { label: "Presupuesto", desc: "Validación financiera" },
        { label: "Despliegue", desc: "Entorno productivo" }
    ];

    // Map AI phases (0-4) to our steps
    const currentStep = Math.min(phase, 4);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Línea de Materialización</h3>
                <span className="text-xs font-semibold text-slate-500">
                    Fase {currentStep + 1} de {steps.length}
                </span>
            </div>

            <div className="relative">
                {/* Connecting Line */}
                <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 -z-10" />
                <div
                    className="absolute top-4 left-0 h-0.5 bg-sky-500 -z-10 transition-all duration-1000 ease-out"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />

                <div className="flex justify-between items-start w-full">
                    {steps.map((step, idx) => {
                        const isCompleted = idx < currentStep;
                        const isCurrent = idx === currentStep;

                        return (
                            <div key={idx} className="flex flex-col items-center group relative">
                                {/* Dot */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-500 ${isCompleted
                                    ? "bg-sky-500 border-sky-500 text-white"
                                    : isCurrent
                                        ? "bg-white border-sky-500 text-sky-600 shadow-lg shadow-sky-500/20 scale-110"
                                        : "bg-white border-slate-200 text-slate-300"
                                    }`}>
                                    {isCompleted ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <span className="text-xs font-bold">{idx + 1}</span>
                                    )}
                                </div>

                                {/* Label */}
                                <div className="mt-3 text-center opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity absolute md:static top-10 w-32 md:w-auto">
                                    <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${isCurrent ? "text-slate-900" : "text-slate-500"
                                        }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium hidden md:block">
                                        {step.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Button based on phase */}
            <div className="mt-8 flex justify-end">
                {status === 'active' ? (
                    <button className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2">
                        <span>Sistema Operativo</span>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </button>
                ) : (
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                            {phase < 5 ? "Esperando finalización de diagnóstico..." : "Diagnóstico listo"}
                        </span>
                        <Link href="/site/onboarding/chat" className="px-6 py-2 bg-sky-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-sky-500/30 hover:bg-sky-600 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 no-underline">
                            {phase < 5 ? "Continuar Entrevista" : "Ver Blueprint Final"} &rarr;
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
