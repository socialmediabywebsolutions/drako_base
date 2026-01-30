"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    MessageSquare,
    BrainCircuit,
    BookOpen,
    Smile,
    Zap,
    LayoutDashboard,
    ArrowRight,
    Send,
    Bot,
    GraduationCap,
    HeartPulse,
    Compass
} from "lucide-react";

export default function MentoriaStudentDashboard() {
    const [messages, setMessages] = useState([
        { role: "assistant", content: "¡Hola! Soy tu Orquestador. Veo que tienes un examen de Matemáticas pronto. ¿Quieres repasar ecuaciones o prefieres hacer algo más visual?" }
    ]);
    const [input, setInput] = useState("");

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages([...messages, { role: "user", content: input }]);
        setInput("");
        // Simulate response
        setTimeout(() => {
            setMessages(prev => [...prev, { role: "assistant", content: "¡Entendido! Vamos a verlo con un gráfico interactivo para que sea más fácil." }]);
        }, 1000);
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* COLUMN 1: ORCHESTRATOR CHAT (Left) */}
            <div className="w-[25%] border-r border-slate-200 bg-white flex flex-col shadow-sm z-10">
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm text-slate-800">Orquestador IA</h2>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Tu guía personal</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-2 focus-within:ring-2 ring-blue-500/20 transition-all">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Escribe a tu mentor..."
                            className="bg-transparent border-none text-sm w-full focus:outline-none px-2 placeholder:text-slate-400"
                        />
                        <button onClick={handleSend} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* COLUMN 2: MAIN CONTENT (Center) */}
            <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent opacity-50 pointer-events-none" />

                <header className="p-6 flex justify-between items-center backdrop-blur-sm z-10 text-slate-800">
                    <div>
                        <h1 className="text-2xl font-black italic tracking-tight text-slate-900">Hola, Mateo 👋</h1>
                        <p className="text-sm text-slate-500 font-medium">Hoy es un buen día para desbloquear tu insignia de <span className="text-blue-600 font-bold">Pensador Crítico</span>.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
                            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-bold text-slate-700">1,250 XP</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-8 pt-0 overflow-y-auto z-10">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* Dynamic Activity Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100 group hover:border-blue-200 transition-colors"
                        >
                            <div className="h-48 bg-blue-600 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                                <div className="absolute bottom-6 left-8 text-white">
                                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">Matemáticas • Ecuaciones</span>
                                    <h3 className="text-3xl font-black italic">Misión: El Misterio de X</h3>
                                </div>
                                <div className="absolute right-8 bottom-6">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-lg group-hover:scale-110 transition-transform duration-500">
                                        <BrainCircuit className="w-8 h-8" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <p className="text-slate-600 leading-relaxed mb-6 font-medium">
                                    Vamos a resolver esto usando el método visual que tanto te gustó ayer. Arrastra los bloques para equilibrar la balanza.
                                </p>
                                <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    [Área Interactiva de Ejercicios]
                                </div>
                                <div className="mt-6 flex justify-between items-center">
                                    <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider">Necesito una pista</button>
                                    <button className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all hover:translate-y-[-2px] flex items-center gap-2">
                                        Enviar Respuesta <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Recent Progress */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
                                    <h4 className="font-bold text-slate-800">Historia</h4>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">Resumen de la Revolución Francesa completado.</p>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 w-[80%] h-full" />
                                </div>
                            </div>
                            <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Smile className="w-5 h-5" /></div>
                                    <h4 className="font-bold text-slate-800">Bienestar</h4>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">Estado de ánimo positivo. ¡Sigue así!</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* COLUMN 3: QUICK ACCESS (Right) */}
            <div className="w-[80px] hover:w-[240px] transition-all duration-300 border-l border-slate-200 bg-white flex flex-col z-20 shadow-xl group">
                <div className="p-6 flex flex-col gap-6 items-center group-hover:items-stretch overflow-hidden">
                    <div className="mb-4 text-center group-hover:text-left transition-all">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity delay-100">Tu Equipo</span>
                    </div>

                    <button className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors group/btn relative">
                        <div className="w-10 h-10 shrink-0 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap duration-200 absolute left-16">
                            <span className="font-bold text-sm text-slate-800 block">Tutor IA</span>
                            <span className="text-xs text-slate-500">Ayuda con deberes</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors group/btn relative">
                        <div className="w-10 h-10 shrink-0 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                            <HeartPulse className="w-5 h-5" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap duration-200 absolute left-16">
                            <span className="font-bold text-sm text-slate-800 block">Psicólogo IA</span>
                            <span className="text-xs text-slate-500">Apoyo emocional</span>
                        </div>
                    </button>

                    <button className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors group/btn relative">
                        <div className="w-10 h-10 shrink-0 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                            <Compass className="w-5 h-5" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap duration-200 absolute left-16">
                            <span className="font-bold text-sm text-slate-800 block">Orientador</span>
                            <span className="text-xs text-slate-500">Decisiones futuras</span>
                        </div>
                    </button>

                    <div className="mt-auto border-t border-slate-100 pt-6">
                        <div className="text-[10px] font-bold text-slate-400 text-center group-hover:text-left opacity-0 group-hover:opacity-100 transition-opacity">
                            MENTORIA ESCOLAR <br /> v1.0
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
