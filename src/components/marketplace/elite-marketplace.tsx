"use client";

import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SaasTemplate } from "@/lib/campamento-base/templates/marketplace";

export function EliteMarketplace() {
    const [templates, setTemplates] = useState<SaasTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("ALL");

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch("/api/templates");
                const data = (await res.json()) as { templates?: SaasTemplate[] };
                setTemplates(data.templates || []);
            } catch (err) {
                console.error("Error fetching templates:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const filteredTemplates = filter === "ALL"
        ? templates
        : templates.filter(t => t.vertical === filter);

    return (
        <div className="space-y-12">
            {/* Search & Filter Tactical Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 glass-panel-elite border-brand/20">
                <div>
                    <h3 className="text-technical text-[10px] text-brand mb-1">Catalog_Filter_v1.0</h3>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Factory Templates</h2>
                </div>

                <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5">
                    {["ALL", "SAAS", "AGENCY", "ECOMMERCE", "EDUCATION"].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-brand text-slate-950 shadow-brand-glow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-80 glass-panel-elite animate-pulse bg-white/5" />
                    ))}
                </div>
            ) : (
                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    <AnimatePresence>
                        {filteredTemplates.map((template) => (
                            <TemplateCard key={template.id} template={template} />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}

function TemplateCard({ template }: { template: SaasTemplate }) {
    const verticalColors: Record<string, string> = {
        SAAS: "text-brand",
        AGENCY: "text-cyan-400",
        ECOMMERCE: "text-purple-400",
        EDUCATION: "text-yellow-400"
    };

    const accentColor = verticalColors[template.vertical] || "text-white";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -5 }}
            className="group relative h-full flex flex-col bg-slate-900/40 rounded-[2rem] border border-white/5 hover:border-brand/40 transition-all overflow-hidden"
        >
            {/* Header Visual */}
            <div className="h-40 bg-slate-800 relative overflow-hidden">
                {template.previewImageUrl ? (
                    <NextImage
                        src={template.previewImageUrl}
                        alt={template.name}
                        width={600}
                        height={400}
                        unoptimized
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity group-hover:scale-110 duration-700"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                        <span className="text-4xl grayscale opacity-20 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🚀</span>
                    </div>
                )}
                <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 bg-slate-950/80 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 ${accentColor}`}>
                        {template.vertical}
                    </span>
                </div>
                {template.isFeatured && (
                    <div className="absolute top-4 right-4 animate-pulse">
                        <span className="px-3 py-1 bg-brand text-slate-950 rounded-full text-[8px] font-black uppercase tracking-widest shadow-brand-glow">
                            Featured
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-8 flex-1 flex flex-col">
                <div className="mb-4">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tight group-hover:text-brand transition-colors">
                        {template.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">{template.tagline || 'Ready for Materialization'}</p>
                </div>

                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6 flex-1 line-clamp-3">
                    {template.description}
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Status</span>
                        <span className="text-[10px] font-black text-success uppercase italic">Production Ready</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Installs</span>
                        <span className="text-[10px] font-black text-white uppercase italic">{template.installations}+</span>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-white italic">€{template.priceUsd}</span>
                        <span className="text-[8px] font-black text-slate-500 uppercase">One-Time Fee</span>
                    </div>
                    <button className="px-6 py-2 bg-white text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand transition-all shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:shadow-brand-glow italic">
                        Materialize ⚡
                    </button>
                </div>
            </div>

            {/* Industrial Accents */}
            <div className="absolute bottom-0 left-0 w-8 h-[1px] bg-brand/50" />
            <div className="absolute bottom-0 left-0 w-[1px] h-8 bg-brand/50" />
        </motion.div>
    );
}
