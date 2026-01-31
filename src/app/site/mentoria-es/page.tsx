"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Zap,
    ShieldCheck,
    MessageSquare,
    BrainCircuit,
    LayoutDashboard,
    ArrowRight,
    Sparkles,
    BarChart3
} from "lucide-react";

export default function MentoriaLandingPageES() {
    return (
        <div className="relative isolate">
            {/* Background Decor - Scanline & Grid */}
            <div className="cyber-scanline" />
            <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-950">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-brand/10 blur-[120px] rounded-full opacity-50" />
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-brand-strong/5 blur-[100px] rounded-full" />
            </div>

            {/* Hero Section */}
            <section className="relative px-6 pt-24 pb-32 sm:pt-32 lg:px-8 flex flex-col items-center overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-4xl"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-quiet border border-brand/20 mb-8 backdrop-blur-md">
                        <Sparkles className="w-4 h-4 text-brand" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-strong">Nueva Era en Educación Digital - España</span>
                    </div>

                    <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-white uppercase italic leading-[0.8] mb-8">
                        MentorIA <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-white to-brand-strong">Escolar</span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed mb-12">
                        La IA que prepara para la excelencia. Especializada en <strong>EBAU / Selectividad</strong>. 24/7 en WhatsApp, integrada con apoyo psicoemocional y control total para centros educativos.
                    </p>

                    <div className="flex flex-wrap justify-center gap-6">
                        <Link
                            href="/site/mentoria-es/signup"
                            className="px-10 py-5 bg-white text-slate-950 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-brand transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,255,255,0.15)] italic flex items-center gap-3"
                        >
                            Comenzar Ahora <ArrowRight className="w-4 h-4" />
                        </Link>
                        <button
                            onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                            className="px-10 py-5 border-2 border-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/5 transition-all"
                        >
                            Ver Módulos
                        </button>
                    </div>
                </motion.div>

                {/* Floating Mockup Preview */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="mt-20 relative w-full max-w-5xl aspect-video rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-3xl overflow-hidden shadow-2xl"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 via-transparent to-brand-strong/5" />
                    <div className="p-4 border-b border-white/5 flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                        </div>
                        <div className="mx-auto text-[10px] font-black text-slate-500 tracking-widest uppercase italic">Neural Dashboard • mentoria-es.drako.systems</div>
                    </div>
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center space-y-4">
                            <BrainCircuit className="w-16 h-16 text-brand/30 mx-auto animate-pulse" />
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Sincronizando Currículo EBAU...</p>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Features Grid */}
            <section id="features" className="px-6 py-32 lg:px-8 max-w-7xl mx-auto">
                <div className="mb-20">
                    <span className="text-brand text-xs font-black uppercase tracking-[0.5em]">Módulos de Élite</span>
                    <h2 className="text-4xl sm:text-6xl font-black text-white mt-4 italic tracking-tight">Capacidades del Sistema</h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: MessageSquare,
                            title: "Tutoría EBAU 24/7",
                            desc: "Resolución de dudas alineada con exámenes de selectividad y currículo nacional.",
                            color: "text-brand"
                        },
                        {
                            icon: ShieldCheck,
                            title: "Psicólogo IA",
                            desc: "Apoyo emocional ante la presión de exámenes y orientación vocacional universitaria.",
                            color: "text-rose-400"
                        },
                        {
                            icon: BarChart3,
                            title: "Action Dashboard",
                            desc: "Métricas de progreso por asignatura y detección temprana de dificultades.",
                            color: "text-amber-400"
                        }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="p-10 card flex flex-col gap-6"
                        >
                            <div className={`p-4 rounded-2xl bg-white/5 w-fit ${feature.color}`}>
                                <feature.icon className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-black text-white italic">{feature.title}</h3>
                            <p className="text-slate-400 font-medium leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Pricing Section */}
            <section className="px-6 py-32 lg:px-8 bg-slate-900/50">
                <div className="max-w-4xl mx-auto text-center space-y-12">
                    <div className="space-y-4">
                        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Plan España</h2>
                        <p className="text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">Acceso Inmediato</p>
                    </div>

                    <div className="glass-panel-elite p-12 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand/20 blur-[50px] rounded-full" />

                        <div className="relative z-10 space-y-8">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-7xl font-black text-white italic leading-none">10.00€<span className="text-xl text-slate-500">/mes</span></span>
                                <span className="text-xs font-bold text-brand uppercase tracking-[0.3em]">Todo Incluido</span>
                            </div>

                            <ul className="grid sm:grid-cols-2 gap-6 text-left max-w-lg mx-auto">
                                {["Currículo EBAU", "WhatsApp Ilimitado", "Soporte Local", "Dominio .drako.systems", "Metrics Dashboard", "Cumplimiento RGPD"].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-300 font-semibold text-sm">
                                        <Zap className="w-4 h-4 text-brand fill-brand/20" />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <div className="pt-8">
                                <Link
                                    href="/site/mentoria-es/signup"
                                    className="inline-block px-16 py-6 bg-brand text-slate-950 font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:scale-105 hover:bg-white transition-all shadow-[0_0_50px_var(--brand-glow)] italic"
                                >
                                    Contratar Plan ES
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <footer className="px-6 py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-slate-950 font-black text-lg italic">M.</div>
                        <span className="text-xl font-black text-white tracking-tighter uppercase italic">MentorIA España</span>
                    </div>

                    <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <Link href="/site" className="hover:text-brand transition-colors">Drako Base</Link>
                        <Link href="/site/legal" className="hover:text-brand transition-colors">Privacidad RGPD</Link>
                        <Link href="/site/panel" className="hover:text-brand transition-colors">Acceso Cliente</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
