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
                const errorData = await response.json().catch(() => ({})) as { error?: string };
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
                const analysis = data.v2?.fullAnalysis as (BlueprintResponse & { currentPhase?: number });

                if (analysis && typeof analysis.currentPhase === 'number') {
                    const nextPhase = analysis.currentPhase;
                    setCurrentPhase(nextPhase);

                    if (analysis.understanding && analysis.understanding !== "Unable to parse AI response") {
                        setProjectName(analysis.understanding);
                    }

                    if (nextPhase >= 10 && onComplete) {
                        setTimeout(() => onComplete(analysis), 3000);
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
        <div className="w-full max-w-5xl mx-auto flex flex-col h-[800px] bg-[#020617]/95 backdrop-blur-[100px] rounded-[2rem] overflow-hidden border-2 border-white/20 shadow-[0_0_100px_-20px_rgba(0,210,255,0.15)] relative group/chat">
            {/* Scanning Line Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="h-[2px] w-full bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_15px_var(--brand-glow)]"
                />
            </div>

            {/* Background Texture/Grid */}
            <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />

            {/* Industrial Header */}
            <div className="bg-slate-900/40 px-10 py-6 border-b border-white/10 flex items-center justify-between relative z-10 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-brand/10 border-2 border-brand/50 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(0,210,255,0.3)] animate-pulse">🐲</div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#020617] shadow-[0_0_10px_#10b981]" />
                    </div>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-[0.4em] text-white italic">
                            {projectName ? `Project: ${projectName}` : "Drako Partner"}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="h-1 w-1 bg-brand rounded-full animate-ping" />
                            <p className="text-[9px] font-black text-brand uppercase tracking-[0.3em]">Neural Link Established • Session Elite v3.0</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-2.5 rounded-full transition-all duration-1000 ${i <= currentPhase ? "bg-brand w-8 shadow-[0_0_15px_var(--brand-glow)]" : "bg-white/5 w-4"}`}
                        />
                    ))}
                </div>
            </div>

            {/* Chat Area with custom scrollbar */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-10 relative z-10 scrollbar-hide">
                <AnimatePresence initial={false}>
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: "spring", damping: 20 }}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[80%] px-10 py-8 rounded-[2.5rem] text-[15px] leading-relaxed shadow-2xl relative group/msg ${m.role === "user"
                                ? "bg-brand text-slate-950 font-bold rounded-tr-none border-2 border-white/20 shadow-[0_0_40px_-10px_rgba(0,210,255,0.4)]"
                                : "bg-slate-900/80 text-white border border-white/10 rounded-tl-none backdrop-blur-3xl"
                                }`}>

                                {/* Corner Accents for Assistant */}
                                {m.role === "assistant" && (
                                    <>
                                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand/40 rounded-tl-lg" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 opacity-5 font-black italic select-none text-4xl">DRKO</div>
                                    </>
                                )}

                                {m.content.split("\n").map((line, idx) => (
                                    <p key={idx} className={`${idx > 0 ? "mt-5" : ""} ${m.role === 'user' ? 'text-slate-950' : 'text-white'}`}>
                                        {line.includes("**") ? (
                                            line.split("**").map((part, pidx) => pidx % 2 === 1 ? (
                                                <span key={pidx} className={`font-black uppercase tracking-widest text-[11px] px-2 py-0.5 rounded mx-1 ${m.role === 'user' ? 'bg-slate-950/10 text-slate-950 border border-slate-950/20' : 'bg-brand/20 text-brand border border-brand/30'}`}>
                                                    {part}
                                                </span>
                                            ) : part)
                                        ) : line}
                                    </p>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                    {isTyping && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="bg-slate-900/60 px-6 py-4 rounded-3xl border border-white/10 rounded-tl-none flex gap-2 items-center">
                                <span className="text-[10px] font-black text-brand uppercase tracking-[0.2em] animate-pulse">Analizando Visión</span>
                                <div className="flex gap-1 ml-2">
                                    <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area - The Commander Console */}
            <div className="p-10 bg-[#020617]/80 border-t-2 border-white/5 relative z-10">
                <div className="relative group max-w-4xl mx-auto">
                    {/* Input Glow Aura */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-brand to-slate-900 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition-opacity duration-500" />

                    <input
                        type="text"
                        placeholder="Escriba su respuesta estratégica..."
                        className="relative w-full pr-24 h-20 bg-slate-950 border-2 border-white/10 rounded-2xl px-8 text-xl font-bold tracking-tight text-white placeholder-slate-600 focus:outline-none focus:border-brand transition-all shadow-inner"
                        style={{ color: 'white' }}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />

                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-4 top-4 w-12 h-12 bg-white text-slate-950 rounded-xl flex items-center justify-center hover:bg-brand hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale shadow-[0_0_20px_rgba(255,255,255,0.2)] font-black"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
                <div className="flex justify-between items-center mt-6 px-4">
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">
                        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> Secure Protocol</span>
                        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Server Optimized</span>
                    </div>
                    <span className="text-[10px] text-brand font-black uppercase tracking-[0.4em] italic">Materializer Engine v3.0</span>
                </div>
            </div>

            {/* Corner Decorative Brackets */}
            <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-brand/20 -m-1 pointer-events-none rounded-tl-[3rem]" />
            <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-brand/20 -m-1 pointer-events-none rounded-br-[3rem]" />
        </div>
    );
}
