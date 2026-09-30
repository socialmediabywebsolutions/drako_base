"use client";

import { motion } from "framer-motion";

export function GuaranteeBanner() {
    const guarantees = [
        {
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            title: "Materialización en 48h",
            subtitle: "O te devolvemos el 100% del dinero",
            highlight: true
        },
        {
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            title: "6 meses de soporte",
            subtitle: "Incluido sin coste adicional"
        },
        {
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            title: "99.9% Uptime SLA",
            subtitle: "Garantía de alta disponibilidad"
        },
        {
            icon: (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            ),
            title: "Seguridad certificada",
            subtitle: "ISO 27001 y GDPR compliant"
        }
    ];

    return (
        <section className="py-20 bg-gradient-to-br from-emerald-50 to-blue-50 relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400 blur-[100px] rounded-full" />
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
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
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
                                    : 'bg-white border-2 border-blue-100 shadow-lg'
                                }
                hover:scale-110 transition-transform
              `}
                        >
                            <div className={`flex justify-center ${item.highlight ? 'text-white' : 'text-emerald-600'}`}>
                                {item.icon}
                            </div>
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
