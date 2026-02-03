"use client";

import { motion } from "framer-motion";

export function GuaranteeBanner() {
    const guarantees = [
        {
            icon: "⚡",
            title: "Materialización en 48h",
            subtitle: "O te devolvemos el 100% del dinero",
            highlight: true
        },
        {
            icon: "🛡️",
            title: "6 meses de soporte",
            subtitle: "Incluido sin coste adicional"
        },
        {
            icon: "📈",
            title: "99.9% Uptime SLA",
            subtitle: "Garantía de alta disponibilidad"
        },
        {
            icon: "🔒",
            title: "Seguridad certificada",
            subtitle: "ISO 27001 y GDPR compliant"
        }
    ];

    return (
        <section className="py-20 bg-gradient-to-br from-emerald-50 to-sky-50 relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-400 blur-[100px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto px-10 relative z-10">
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        className="inline-block"
                    >
                        <div className="px-6 py-2 bg-emerald-500 text-white rounded-full mb-4 inline-flex items-center gap-2">
                            <span className="text-2xl">✓</span>
                            <span className="font-black uppercase tracking-wide text-sm">Garantía Total</span>
                        </div>
                    </motion.div>
                    <h2 className="text-4xl font-black text-slate-900 mt-4">
                        Sin Riesgos. <span className="text-emerald-600">100% Garantizado</span>
                    </h2>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                    {guarantees.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className={`
                p-6 rounded-2xl text-center space-y-3
                ${item.highlight
                                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 scale-105'
                                    : 'bg-white border-2 border-sky-100 shadow-lg'
                                }
                hover:scale-110 transition-transform
              `}
                        >
                            <div className={`text-5xl ${item.highlight ? 'animate-pulse' : ''}`}>{item.icon}</div>
                            <h3 className={`text-sm font-black uppercase tracking-wide ${item.highlight ? 'text-white' : 'text-slate-900'}`}>
                                {item.title}
                            </h3>
                            <p className={`text-xs font-medium ${item.highlight ? 'text-emerald-100' : 'text-slate-600'}`}>
                                {item.subtitle}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <p className="text-sm text-slate-600 font-medium">
                        <strong className="text-slate-900">Nuestra promesa:</strong> Si no estás 100% satisfecho con el resultado,
                        te devolvemos tu inversión. Sin preguntas. Sin letra pequeña.
                    </p>
                </div>
            </div>
        </section>
    );
}
