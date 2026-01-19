"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function EliteInterview() {
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
                    mode: "partner" // Nueva bandera para usar el prompt de Drako Partner
                })
            });

            const data = await response.json();

            if (data.reply) {
                setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
                if (data.v2?.fullAnalysis?.currentPhase !== undefined) {
                    setCurrentPhase(data.v2.fullAnalysis.currentPhase);
                }
            }
        } catch (error) {
            console.error("Error en la entrevista:", error);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col h-[700px] glass-panel overflow-hidden border border-brand/20 shadow-glass">
            {/* Header con Fases */}
            <div className="bg-white/50 backdrop-blur px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-xl shadow-lg">🐲</div>
                    <div>
                        <h3 className="font-black text-xs uppercase tracking-widest text-slate-800">Drako Partner</h3>
                        <p className="text-[10px] font-bold text-brand uppercase tracking-tighter">Entrevista Estratégica</p>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    {Array.from({ length: 11 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-1 rounded-full transition-all duration-500 ${i <= currentPhase ? "bg-brand w-8" : "bg-slate-200"}`}
                        />
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                <AnimatePresence initial={false}>
                    {messages.map((m, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === "user"
                                    ? "bg-slate-900 text-white rounded-tr-none"
                                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                                }`}>
                                {m.content.split("\n").map((line, idx) => (
                                    <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                                        {line.includes("**") ? (
                                            line.split("**").map((part, pidx) => pidx % 2 === 1 ? <b key={pidx} className="text-brand-strong">{part}</b> : part)
                                        ) : line}
                                    </p>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                    {isTyping && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 rounded-tl-none flex gap-1">
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" />
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce delay-75" />
                                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce delay-150" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-border">
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="Escribe tu mensaje..."
                        className="input w-full pr-14 h-14 bg-slate-50 border-slate-200 focus:bg-white focus:border-brand transition-all text-base"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-brand hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
                <p className="text-[10px] text-muted text-center mt-3 uppercase tracking-widest font-bold">
                    Drako Partner v1.0 • Conversación Estratégica
                </p>
            </div>
        </div>
    );
}
