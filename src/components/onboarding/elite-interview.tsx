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
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // Primer mensaje (Fase 0)
    useEffect(() => {
        const startInterview = async () => {
            setIsTyping(true);
            setTimeout(() => {
                const firstMessage: Message = {
                    role: "assistant",
                    content: "Hola, soy **Drako Partner**, tu arquitecto de negocio. Voy a hacerte una entrevista conversacional para entender tu visión. Mientras hablamos, analizaré tu mercado y competencia para darte un diagnóstico real y un presupuesto llave en mano. \n\nPara empezar, **¿cuál es tu sitio web, tus redes sociales y tu objetivo principal con este proyecto?**"
                };
                setMessages([firstMessage]);
                setIsTyping(false);
            }, 1000);
        };
        startInterview();
    }, []);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        try {
            const response = await fetch("/api/campamento-base/saas-factory/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    history: messages,
                    mode: "partner"
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: `⚠️ **ERROR TÉCNICO**: El servidor respondió con estado ${response.status}. ${errorData.error || "No se pudo establecer conexión con el motor de IA. Por favor, asegúrese de que el entorno esté configurado correctamente."}`
                }]);
                return;
            }

            const data = (await response.json()) as {
                reply?: string;
                v2?: { fullAnalysis?: { currentPhase?: number } }
            };

            if (data?.reply) {
                setMessages(prev => [...prev, { role: "assistant", content: data.reply as string }]);
                const analysis = data.v2?.fullAnalysis;
                if (analysis?.currentPhase !== undefined) {
                    const nextPhase = analysis.currentPhase;
                    setCurrentPhase(nextPhase);

                    if (nextPhase >= 10 && onComplete) {
                        setTimeout(() => onComplete(analysis as BlueprintResponse), 3000);
                    }
                }
            }
        } catch (error) {
            console.error("Error en la entrevista:", error);
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "🛑 **ERROR DE RED**: No se pudo contactar con Drako Systems. Verifique su conexión o intente reiniciar la sesión."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col h-[750px] bg-slate-950/90 backdrop-blur-3xl rounded-[3rem] overflow-hidden border-2 border-white shadow-[0_0_50px_-15px_rgba(255,255,255,0.2)] relative transition-all duration-500 hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.3)]">
            {/* Header con Fases */}
            <div className="bg-slate-900/50 backdrop-blur px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-slate-900 flex items-center justify-center text-2xl shadow-lg border border-white/10">🐲</div>
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white">Drako Partner</h3>
                        <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Protocol Intake Server • Active</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-700 ${i <= currentPhase ? "bg-brand w-6 shadow-[0_0_10px_var(--brand-glow)]" : "bg-white/10 w-3"}`}
                        />
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-[radial-gradient(circle_at_center,rgba(0,210,255,0.03)_0,transparent_100%)]">
                <AnimatePresence initial={false}>
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[85%] px-8 py-6 rounded-[2rem] text-sm leading-[1.6] shadow-2xl relative overflow-hidden ${m.role === "user"
                                ? "bg-brand text-slate-950 font-black rounded-tr-none tracking-tight"
                                : "bg-slate-900/90 text-slate-200 border border-white/10 rounded-tl-none backdrop-blur-xl"
                                }`}>
                                {m.role === "assistant" && (
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <span className="text-[40px] font-black uppercase tracking-tighter">DRKO</span>
                                    </div>
                                )}
                                {m.content.split("\n").map((line, idx) => (
                                    <p key={idx} className={idx > 0 ? "mt-4" : ""}>
                                        {line.includes("**") ? (
                                            line.split("**").map((part, pidx) => pidx % 2 === 1 ? (
                                                <b key={pidx} className="text-white font-black uppercase tracking-widest text-[10px] bg-brand/20 px-1.5 py-0.5 rounded ml-1 mr-1 border border-brand/30">
                                                    {part}
                                                </b>
                                            ) : part)
                                        ) : line}
                                    </p>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                    {isTyping && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="bg-slate-900/80 px-4 py-3 rounded-2xl border border-white/10 rounded-tl-none flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" />
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-8 bg-slate-900/50 border-t border-white/5 backdrop-blur-xl">
                <div className="relative group max-w-4xl mx-auto">
                    <input
                        type="text"
                        placeholder="Escriba su respuesta estratégica..."
                        className="modern-input w-full pr-16 h-16 text-lg tracking-tight text-white !placeholder-slate-500 font-bold"
                        style={{ color: 'white', backgroundColor: '#0f172a' }}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-3 top-3 w-10 h-10 bg-brand text-slate-950 rounded-xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all disabled:opacity-30 disabled:grayscale shadow-[0_0_15px_var(--brand-glow)]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
                <div className="flex justify-between items-center mt-4 px-2">
                    <span className="text-[9px] text-muted font-bold uppercase tracking-[0.3em]">Protocol Activated</span>
                    <span className="text-[9px] text-brand/60 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                        {isTyping && <span className="h-1 w-1 bg-brand rounded-full animate-ping" />}
                        {isTyping ? "Sincronizando..." : "Drako Partner v2.1"}
                    </span>
                </div>
            </div>
        </div>
    );
}
