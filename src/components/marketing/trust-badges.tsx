"use client";

import { motion } from "framer-motion";

export function TrustBadges() {
    const badges = [
        {
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            title: "ISO 27001",
            subtitle: "Seguridad certificada"
        },
        {
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
            ),
            title: "GDPR",
            subtitle: "Datos protegidos"
        },
        {
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            title: "99.9% Uptime",
            subtitle: "Alta disponibilidad"
        },
        {
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            ),
            title: "Stripe Partner",
            subtitle: "Pagos verificados"
        }
    ];

    return (
        <section className="py-16 bg-gradient-to-br from-sky-50 to-white">
            <div className="max-w-7xl mx-auto px-10">
                <div className="text-center mb-12">
                    <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Confianza Garantizada</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {badges.map((badge, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="bg-white p-6 rounded-2xl border-2 border-sky-100 shadow-md hover:shadow-xl hover:border-sky-300 transition-all text-center"
                        >
                            <div className="text-sky-600 mb-3 flex justify-center">{badge.icon}</div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{badge.title}</h3>
                            <p className="text-xs text-slate-500 mt-1">{badge.subtitle}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
