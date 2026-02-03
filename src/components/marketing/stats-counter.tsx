"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const [hasAnimated, setHasAnimated] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    setHasAnimated(true);
                    let current = 0;
                    const increment = target / 50;
                    const timer = setInterval(() => {
                        current += increment;
                        if (current >= target) {
                            setCount(target);
                            clearInterval(timer);
                        } else {
                            setCount(Math.floor(current));
                        }
                    }, 30);
                }
            },
            { threshold: 0.5 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, hasAnimated]);

    return (
        <div ref={ref} className="text-6xl md:text-7xl font-black text-sky-600 italic">
            {count}{suffix}
        </div>
    );
}

export function StatsCounter() {
    const stats = [
        { value: 247, suffix: "+", label: "SaaS Materializados", sublabel: "Proyectos entregados en 2024" },
        { value: 89, suffix: "", label: "Clientes Activos", sublabel: "Empresas confiando en Drako" },
        { value: 45, suffix: "K€", label: "Ahorro Promedio", sublabel: "Por cliente al año" },
        { value: 99, suffix: ".9%", label: "Uptime SLA", sublabel: "Disponibilidad garantizada" }
    ];

    return (
        <section className="py-32 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500 blur-[120px] rounded-full" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-sky-600 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto px-10 relative z-10">
                <div className="text-center mb-20">
                    <span className="text-sky-400 text-xs font-black uppercase tracking-[0.5em]">Resultados Comprobados</span>
                    <h2 className="text-5xl font-black mt-4 tracking-tight">
                        Números que <span className="text-sky-400">Hablan por Sí Solos</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {stats.map((stat, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                            className="text-center space-y-4"
                        >
                            <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">{stat.label}</h3>
                                <p className="text-sm text-slate-400 font-medium mt-1">{stat.sublabel}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
