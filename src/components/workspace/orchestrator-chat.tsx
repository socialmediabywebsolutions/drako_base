"use client";

import { motion } from "framer-motion";
import { EliteInterview } from "@/components/onboarding/elite-interview";
import { type BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";

interface OrchestratorChatProps {
    collapsed: boolean;
    onToggle: () => void;
    onComplete?: (data: BlueprintResponse) => void;
}

export function OrchestratorChat({ collapsed, onToggle, onComplete }: OrchestratorChatProps) {
    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 64 : 420 }}
            className="h-screen bg-white border-l border-slate-200 flex flex-col relative overflow-hidden transition-all duration-300"
        >
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute top-4 -left-3 z-50 w-6 h-6 bg-sky-500 text-white rounded-full shadow-lg hover:bg-sky-600 transition-colors flex items-center justify-center"
            >
                <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-sky-50 to-white">
                {!collapsed ? (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <h2 className="text-lg font-black text-slate-900">AI Orchestrator</h2>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Tu asistente de arquitectura</p>
                    </div>
                ) : (
                    <div className="relative">
                        <svg className="w-8 h-8 text-sky-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        {/* Notification badge */}
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    </div>
                )}
            </div>

            {/* Chat Content */}
            {!collapsed ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Suggested Prompts */}
                    <div className="p-4 bg-sky-50 border-b border-sky-100">
                        <p className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-3">Acciones Rápidas</p>
                        <div className="space-y-2">
                            {[
                                "Ver presupuesto detallado",
                                "Modificar arquitectura",
                                "Solicitar soporte técnico"
                            ].map((prompt, idx) => (
                                <button
                                    key={idx}
                                    className="w-full text-left px-3 py-2 bg-white text-sm text-slate-700 font-medium rounded-lg hover:bg-sky-100 hover:text-sky-700 transition-colors border border-sky-200"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <EliteInterview
                            onComplete={onComplete || (() => { })}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2 opacity-50">
                        <svg className="w-6 h-6 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
            )}
        </motion.aside>
    );
}
