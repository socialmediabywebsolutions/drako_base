"use client";

import { motion } from "framer-motion";

export function PricingComparison() {
    const comparisons = [
        {
            category: "Tiempo de desarrollo",
            drako: "24-48h",
            agency: "3-6 meses",
            freelancer: "2-4 meses",
            winner: "drako"
        },
        {
            category: "Coste inicial",
            drako: "€2,500",
            agency: "€25,000+",
            freelancer: "€8,000+",
            winner: "drako"
        },
        {
            category: "Mantenimiento mensual",
            drako: "€150",
            agency: "€800",
            freelancer: "€400",
            winner: "drako"
        },
        {
            category: "Infraestructura",
            drako: "Incluida",
            agency: "€300/mes extra",
            freelancer: "Por tu cuenta",
            winner: "drako"
        },
        {
            category: "Escalabilidad",
            drako: "Automática",
            agency: "Manual (lenta)",
            freelancer: "Limitada",
            winner: "drako"
        },
        {
            category: "Soporte 24/7",
            drako: "Incluido",
            agency: "€500/mes extra",
            freelancer: "No disponible",
            winner: "drako"
        }
    ];

    return (
        <section className="py-32 bg-white">
            <div className="max-w-7xl mx-auto px-10">
                <div className="text-center mb-16 space-y-4">
                    <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Comparativa Transparente</span>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                        Drako vs. <span className="text-slate-400">Alternativas Tradicionales</span>
                    </h2>
                </div>

                <div className="bg-white rounded-3xl border-2 border-sky-100 shadow-2xl overflow-hidden">
                    <div className="grid grid-cols-4 gap-px bg-sky-100">
                        {/* Headers */}
                        <div className="bg-white p-6">
                            <div className="text-sm font-black text-slate-400 uppercase tracking-wider">Métrica</div>
                        </div>
                        <div className="bg-gradient-to-br from-sky-500 to-sky-600 p-6 relative">
                            <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-400 text-yellow-900 text-[8px] font-black uppercase rounded-full">
                                Mejor opción
                            </div>
                            <div className="text-sm font-black text-white uppercase tracking-wider">Drako Partner</div>
                        </div>
                        <div className="bg-white p-6">
                            <div className="text-sm font-black text-slate-400 uppercase tracking-wider">Agencia</div>
                        </div>
                        <div className="bg-white p-6">
                            <div className="text-sm font-black text-slate-400 uppercase tracking-wider">Freelancer</div>
                        </div>

                        {/* Rows */}
                        {comparisons.map((row, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                viewport={{ once: true }}
                                className="col-span-4 grid grid-cols-4 gap-px bg-sky-100"
                            >
                                <div className="bg-white p-6">
                                    <div className="text-sm font-bold text-slate-900">{row.category}</div>
                                </div>
                                <div className={`p-6 ${row.winner === 'drako' ? 'bg-sky-50' : 'bg-white'}`}>
                                    <div className={`text-sm font-black flex items-center gap-2 ${row.winner === 'drako' ? 'text-sky-600' : 'text-slate-700'}`}>
                                        {row.winner === 'drako' && <span className="text-xl">✓</span>}
                                        {row.drako}
                                    </div>
                                </div>
                                <div className="bg-white p-6">
                                    <div className="text-sm font-medium text-slate-500">{row.agency}</div>
                                </div>
                                <div className="bg-white p-6">
                                    <div className="text-sm font-medium text-slate-500">{row.freelancer}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-slate-600 font-medium text-sm">
                        * Datos basados en proyectos de <strong className="text-slate-900">complejidad media</strong> (5-10 módulos).
                        Tu presupuesto exacto se calcula después de la entrevista.
                    </p>
                </div>
            </div>
        </section>
    );
}
