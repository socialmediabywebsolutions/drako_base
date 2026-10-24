"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { EliteMarketplace } from "@/components/marketplace/elite-marketplace";

export default function MarketplacePage() {
    return (
        <div className="flex flex-col min-h-screen bg-white text-slate-900 relative overflow-hidden">
            {/* Global Subtle Overlay */}
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-10">
                <motion.div
                    animate={{ y: ["0%", "100%", "0%"] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="h-[2px] w-full bg-sky-500 shadow-lg shadow-sky-500/30"
                />
            </div>

            {/* Content Area */}
            <main className="flex-1 container mx-auto px-6 relative z-10">
                {/* Public Navigation */}
                <nav className="flex items-center justify-between py-10 mb-10 border-b border-sky-100">
                    <Link href="/site" className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors group">
                        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-wide">Volver al Home</span>
                    </Link>
                    <div className="px-4 py-2 bg-sky-100 rounded-lg border-2 border-sky-200">
                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-700">Catálogo Público</span>
                    </div>
                </nav>
                {/* Hero Showroom */}
                <section className="mb-24 space-y-8 max-w-4xl">
                    <header className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-sky-100 border-2 border-sky-300 text-sky-700 rounded-full text-[10px] font-black uppercase tracking-[0.3em] font-mono animate-pulse">
                                SECURE_EXHIBIT_v4
                            </span>
                            <span className="w-12 h-[1px] bg-sky-200" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Showroom active</span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.8] text-slate-900">
                            Factory <span className="text-sky-600">Catalog</span>
                        </h1>
                    </header>

                    <p className="text-xl text-slate-600 font-bold max-w-2xl leading-relaxed tracking-wide italic">
                        Explore our modular library of validated SaaS blueprints. Each template is pre-engineered for instant materialization on the Edge.
                    </p>

                    <div className="flex gap-10 pt-4">
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">24/7</div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ORCHESTRATION</div>
                        </div>
                        <div className="w-[1px] h-10 bg-sky-200" />
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">100%</div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">EDGE READY</div>
                        </div>
                        <div className="w-[1px] h-10 bg-sky-200" />
                        <div className="space-y-1">
                            <div className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">v4.0</div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NEURAL KERNEL</div>
                        </div>
                    </div>
                </section>

                {/* Showroom Grid */}
                <EliteMarketplace />

                {/* Closing Call to Action / Factory Narrative */}
                <section className="mt-40 p-16 rounded-[4rem] bg-gradient-to-br from-sky-50 to-white border-2 border-sky-200 relative overflow-hidden text-center shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-100/20 to-transparent opacity-50" />
                    <div className="relative z-10 space-y-8">
                        <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900">Don&apos;t see your <span className="text-sky-600">Vision</span>?</h2>
                        <p className="text-slate-600 font-bold max-w-xl mx-auto text-sm leading-relaxed tracking-widest uppercase">
                            Use the Drako Partner Interview Engine to forge a bespoke blueprint from scratch in minutes.
                        </p>
                        <div className="flex justify-center gap-6">
                            <Link href="/site" className="px-10 py-5 bg-sky-500 text-white font-black text-xs uppercase tracking-[0.5em] rounded-xl hover:bg-sky-600 transition-all hover:scale-105 active:scale-95 italic shadow-lg shadow-sky-500/30">
                                Start Custom Forge ✍️
                            </Link>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
