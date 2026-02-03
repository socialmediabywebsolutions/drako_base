"use client";

import { motion } from "framer-motion";

export function TrustBadges() {
    const badges = [
        { icon: "🔒", title: "ISO 27001", subtitle: "Seguridad certificada" },
        { icon: "🇪🇺", title: "GDPR", subtitle: "Datos protegidos" },
        { icon: "⚡", title: "99.9% Uptime", subtitle: "Alta disponibilidad" },
        { icon: "💳", title: "Stripe Partner", subtitle: "Pagos verificados" }
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
                            <div className="text-4xl mb-3">{badge.icon}</div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">{badge.title}</h3>
                            <p className="text-xs text-slate-500 mt-1">{badge.subtitle}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
