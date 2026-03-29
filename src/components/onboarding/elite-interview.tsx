"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface EliteInterviewProps {
    onComplete?: (data: BlueprintResponse) => void;
}

export function EliteInterview({ onComplete }: EliteInterviewProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [currentPhase, setCurrentPhase] = useState(0);
    const [projectName, setProjectName] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // 1. Cargar memoria persistente al iniciar
    useEffect(() => {
        const savedMemory = localStorage.getItem("drako_interview_memory");
        const savedPhase = localStorage.getItem("drako_interview_phase");
        const savedProject = localStorage.getItem("drako_interview_project");

        if (savedMemory) {
            try {
                setMessages(JSON.parse(savedMemory));
                if (savedPhase) setCurrentPhase(parseInt(savedPhase));
                if (savedProject) setProjectName(savedProject);
            } catch (e) {
                console.error("Error recuperando memoria de Drako:", e);
            }
        } else {
            // Si no hay memoria previa, iniciar protocolo estándar
            setIsTyping(true);
            setTimeout(() => {
                const firstMessage: Message = {
                    role: "assistant",
                    content: "Soy **Drako Partner**, tu consultor de digitalización empresarial.\n\nMi objetivo es entender tu negocio en profundidad para diseñarte una solución tecnológica que **genere retorno real** en menos de 6 meses.\n\nNo vendo software genérico. Arquitecto sistemas a medida basándome en:\n• Tu operativa actual\n• Tus costes reales\n• Tus objetivos de crecimiento\n\n**Para empezar:** Cuéntame sobre tu negocio. ¿A qué te dedicas? ¿Tienes web o redes sociales donde pueda ver tu proyecto?"
                };
                setMessages([firstMessage]);
                setIsTyping(false);
            }, 1200);
        }
        setIsLoaded(true);
    }, []);

    // 2. Guardar memoria en cada actualización
    useEffect(() => {
        if (!isLoaded || messages.length === 0) return;
        localStorage.setItem("drako_interview_memory", JSON.stringify(messages));
        localStorage.setItem("drako_interview_phase", currentPhase.toString());
        if (projectName) localStorage.setItem("drako_interview_project", projectName);
    }, [messages, currentPhase, projectName, isLoaded]);

    // Guardar memoria helper
    const saveMemory = (msgs: Message[], phase: number, project: string | null) => {
        localStorage.setItem("drako_interview_memory", JSON.stringify(msgs));
        localStorage.setItem("drako_interview_phase", phase.toString());
        if (project) localStorage.setItem("drako_interview_project", project);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { role: "user", content: input };
        const newMessages = [...messages, userMessage];

        // 1. UI Update inmediata
        setMessages(newMessages);
        setInput("");
        setIsTyping(true);

        // 2. Persistencia Inmediata (Backup)
        saveMemory(newMessages, currentPhase, projectName);

        try {
            // Construct context from previous messages
            const contextMessages = newMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await fetch("/api/factory/blueprints/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input, // Original input for the current turn
                    history: contextMessages, // Full history for context
                    mode: "partner",
                    currentPhase: currentPhase
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as { error?: string };
                const errorMessage: Message = {
                    role: "assistant",
                    content: `⚠️ **Error de Sistema**: ${errorData.error || "No se pudo procesar tu mensaje. Por favor, intenta de nuevo."}`
                };
                const updatedMessagesWithError = [...newMessages, errorMessage];
                setMessages(updatedMessagesWithError);
                saveMemory(updatedMessagesWithError, currentPhase, projectName);
                return;
            }

            const data = (await response.json()) as {
                reply?: string;
                v2?: { fullAnalysis?: { currentPhase?: number } }
            };

            const analysis = data.v2?.fullAnalysis as (BlueprintResponse & { currentPhase?: number });

            if (data?.reply) {
                const aiMessage: Message = { role: "assistant", content: data.reply as string };
                const updatedMessagesWithAi = [...newMessages, aiMessage];
                setMessages(updatedMessagesWithAi);
            }

            if (analysis) {
                const nextPhaseValue = typeof analysis.currentPhase === 'number' ? analysis.currentPhase : currentPhase;
                console.log(`[Drako] Phase Transition: ${currentPhase} -> ${nextPhaseValue}`);

                setCurrentPhase(nextPhaseValue);

                const identityName = analysis.detectedKnowledge?.identity &&
                    (analysis.detectedKnowledge.identity as Record<string, unknown>).name as string;

                if (identityName) {
                    setProjectName(identityName);
                } else if (analysis.understanding && analysis.understanding.length < 50) {
                    setProjectName(analysis.understanding);
                }

                if (nextPhaseValue >= 5 && onComplete) {
                    console.log("[Drako] Materializing Foundry... Phase >= 5 reached.");
                    setTimeout(() => onComplete(analysis), 3000);
                }
            }
        } catch (error) {
            console.error("Error en la entrevista:", error);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "🛑 **Error de Conexión**: No se pudo contactar con el servidor. Verifica tu conexión."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    // Dev tool: Reset
    const resetMemory = () => {
        if (confirm("¿Estás seguro de que quieres borrar el historial y empezar de nuevo desde la Fase 0?")) {
            // Limpieza Total
            localStorage.clear(); // Nuclear option for safety
            sessionStorage.clear();

            // Re-init state
            setMessages([]);
            setCurrentPhase(0);
            setProjectName(null);

            window.location.href = window.location.pathname; // Hard reload without hash/params
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col md:flex-row min-h-[600px]">

            {/* Sidebar Steps (Desktop) */}
            <div className="hidden md:flex flex-col w-64 bg-slate-50 border-r border-slate-200 p-6 space-y-8">
                <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Progreso</span>
                    <h3 className="font-bold text-slate-800 text-lg mt-1">Materialización</h3>
                </div>

                <div className="relative space-y-6 flex-1">
                    {/* Vertical Line */}
                    <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200 -z-10" />

                    {[
                        { title: "Diagnóstico", desc: "4-5 preguntas" },
                        { title: "Blueprint", desc: "Arquitectura" },
                        { title: "Diseño", desc: "Identidad Visual" },
                        { title: "Presupuesto", desc: "Validación" },
                        { title: "Despliegue", desc: "Producción" }
                    ].map((step, i) => (
                        <div key={i} className={`flex gap-4 relative ${i === currentPhase ? 'opacity-100' : i < currentPhase ? 'opacity-50' : 'opacity-40'}`}>
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all z-10 ${i <= currentPhase ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-400'
                                }`}>
                                {i < currentPhase ? '✓' : i + 1}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800">{step.title}</h4>
                                <p className="text-[10px] text-slate-500 font-medium">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-800 font-medium leading-relaxed">
                        &quot;Analizando cada respuesta para optimizar tu infraestructura.&quot;
                    </p>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative bg-white">

                {/* Header */}
                <div className="bg-white border-b border-slate-100 px-8 py-4 flex justify-between items-center sticky top-0 z-20 backdrop-blur-md bg-white/95">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">
                            {projectName || "Consultoría Digital Personalizada"}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">
                            {isTyping ? "Drako escribiendo..." : "Esperando respuesta..."}
                        </p>
                    </div>
                    <div className="md:hidden text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                        Fase {currentPhase + 1}/5
                    </div>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 border-b border-blue-100 px-8 py-3">
                    <div className="max-w-5xl mx-auto flex items-start gap-3">
                        <div className="text-blue-600 mt-0.5 text-sm">ℹ️</div>
                        <p className="text-sm font-medium text-blue-900 leading-relaxed">
                            Responde con honestidad. Tus respuestas definen la arquitectura técnica y el coste final.
                        </p>
                    </div>
                </div>

                {/* Chat Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 bg-slate-50 relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{ backgroundImage: "radial-gradient(#0f172a 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                    />

                    <div className="max-w-4xl mx-auto space-y-6 relative z-10">
                        <AnimatePresence initial={false}>
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {m.role === "assistant" && (
                                        <div className="flex-shrink-0 mr-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-xl ring-4 ring-white">
                                                DP
                                            </div>
                                        </div>
                                    )}

                                    <div className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-sm ${m.role === "user"
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-slate-800 border border-slate-200"
                                        }`}>
                                        <div className="prose prose-sm max-w-none">
                                            {m.content.split("\n").map((line, idx) => (
                                                <p key={idx} className={`${idx > 0 ? "mt-2" : ""} ${m.role === "user" ? "text-slate-100" : "text-slate-700"} text-[15px] leading-relaxed`}>
                                                    {line}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                    <div className="flex-shrink-0 mr-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-xl ring-4 ring-white">
                                            DP
                                        </div>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-slate-400 rounded-full" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Input Area */}
                <div className="bg-white border-t border-slate-200 px-8 py-6 z-20">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition-all p-1">
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Escribe tu respuesta aquí..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-slate-900 text-lg placeholder-slate-400 resize-none min-h-[50px] px-4 py-3"
                                    rows={1}
                                    style={{ height: input.split('\n').length > 1 ? 'auto' : '60px' }}
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={isTyping || !input.trim()}
                                className="h-[60px] w-[60px] bg-slate-900 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg hover:scale-105 active:scale-95"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Footer Controls */}
                        <div className="mt-4 flex justify-between items-center text-xs text-slate-400 px-1">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-semibold text-slate-500">Memoria Activa</span>
                            </div>
                            <button
                                onClick={resetMemory}
                                className="hover:text-red-500 transition-colors font-bold uppercase tracking-wide text-[10px]"
                            >
                                Reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
