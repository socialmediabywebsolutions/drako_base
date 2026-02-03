"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Testimonials() {
    const testimonials = [
        {
            name: "Juan Pérez",
            role: "CEO",
            company: "MentorIA Escolar",
            avatar: "👨‍💼",
            quote: "Drako transformó nuestra idea en un SaaS funcional en menos de 48 horas. Pasamos de 0 a 500 usuarios en 2 meses.",
            metrics: [
                { label: "Reducción de costes", value: "67%" },
                { label: "Tiempo de lanzamiento", value: "48h" },
                { label: "Usuarios en 2 meses", value: "500+" }
            ],
            rating: 5
        },
        {
            name: "María González",
            role: "Fundadora",
            company: "EcoTrack Solutions",
            avatar: "👩‍💼",
            quote: "Invertimos €2,500 con Drako vs los €25,000 que nos pedía una agencia. El ROI fue inmediato y el producto es de calidad profesional.",
            metrics: [
                { label: "Ahorro vs agencia", value: "€22.5K" },
                { label: "Escalabilidad", value: "Automática" },
                { label: "Satisfacción", value: "10/10" }
            ],
            rating: 5
        },
        {
            name: "Carlos Rodríguez",
            role: "CTO",
            company: "FinanceHub Pro",
            avatar: "👨‍💻",
            quote: "La infraestructura Edge y el soporte 24/7 incluido nos ahorra €800/mes. Drako es la mejor decisión técnica que hemos tomado.",
            metrics: [
                { label: "Uptime real", value: "99.97%" },
                { label: "Ahorro mensual", value: "€800" },
                { label: "Tiempo de respuesta", value: "<2h" }
            ],
            rating: 5
        }
    ];

    return (
        <section className="py-32 bg-gradient-to-br from-white to-sky-50">
            <div className="max-w-7xl mx-auto px-10">
                <div className="text-center mb-20 space-y-4">
                    <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Casos de Éxito</span>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                        Lo que dicen <span className="text-sky-600">nuestros clientes</span>
                    </h2>
                    <p className="text-slate-600 font-medium max-w-2xl mx-auto">
                        Resultados reales de empresas que confiaron en Drako Partner
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="bg-white rounded-3xl p-8 border-2 border-sky-100 shadow-lg hover:shadow-2xl hover:border-sky-300 transition-all space-y-6"
                        >
                            {/* Header */}
                            <div className="flex items-start gap-4">
                                <div className="text-5xl">{testimonial.avatar}</div>
                                <div className="flex-1">
                                    <h3 className="font-black text-slate-900">{testimonial.name}</h3>
                                    <p className="text-sm text-slate-600 font-medium">{testimonial.role}, {testimonial.company}</p>
                                    <div className="flex gap-1 mt-2">
                                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                                            <span key={i} className="text-yellow-400 text-lg">★</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Quote */}
                            <blockquote className="text-slate-700 font-medium leading-relaxed italic">
                                &quot;{testimonial.quote}&quot;
                            </blockquote>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-3 pt-4 border-t-2 border-sky-100">
                                {testimonial.metrics.map((metric, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-2xl font-black text-sky-600">{metric.value}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">
                                            {metric.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <a
                        href="#chat-section"
                        className="inline-block px-8 py-4 bg-sky-500 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-sky-600 hover:scale-105 transition-all shadow-lg shadow-sky-500/30"
                    >
                        Únete a nuestros clientes →
                    </a>
                </div>
            </div>
        </section>
    );
}
