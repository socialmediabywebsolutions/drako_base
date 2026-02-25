"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { trackGrowthEventClient } from "@/lib/saas/growth/client";
import {
    Building2,
    Mail,
    Key,
    ArrowRight,
    ShieldCheck,
    Zap,
    CheckCircle2,
    Loader2
} from "lucide-react";

export default function MentoriaSignupPage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        institutionName: "",
        email: "",
        password: "",
    });

    const handleNext = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 1) {
            setStep(2);
            return;
        }

        setLoading(true);
        try {
            // 1. REGISTRO FORMAL EN D1 (Tabula Rasa API)
            const regResponse = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    name: formData.institutionName // Use institution name as name or separate if needed
                })
            });

            const regData = await regResponse.json() as any;

            // Si el email ya existe, procedemos (asumimos que es el mismo usuario reintentando pago)
            // Si es un error distinto, paramos para informar al usuario
            if (!regResponse.ok && regData.code !== "EMAIL_EXISTS") {
                throw new Error(regData.message || "Error al crear la cuenta de acceso.");
            }

            // 2. TRACKING & STRIPE
            trackGrowthEventClient({
                tenantId: "mentoria_ia",
                eventName: "mentoria.signup",
                conversionSource: "direct",
                country: "OTHER",
                payload: {
                    institutionName: formData.institutionName,
                    email: formData.email
                }
            });

            const response = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan: "mentoria_ia",
                    institutionName: formData.institutionName,
                    email: formData.email,
                })
            });
            const data = (await response.json()) as any;
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
            {/* Background */}
            <div className="fixed inset-0 -z-10 bg-slate-950">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xl"
            >
                {/* Header */}
                <div className="text-center mb-10 space-y-4">
                    <Link href="/site/mentoria" className="inline-flex items-center gap-2 mb-4 group">
                        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-slate-950 font-black text-sm italic group-hover:scale-110 transition-transform">M.</div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest italic group-hover:text-white transition-colors">Volver a MentorIA</span>
                    </Link>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Alta de Institución</h1>
                    <p className="text-slate-400 font-medium italic uppercase tracking-widest text-[10px]">Paso {step} de 2: {step === 1 ? "Información Básica" : "Configuración Técnica"}</p>
                </div>

                {/* Form Card */}
                <div className="glass-panel-elite p-10 relative">
                    <div className="cyber-scanline opacity-10" />

                    <form onSubmit={handleNext} className="space-y-8 relative z-10">
                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 italic">Nombre de la Institución</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Building2 className="h-5 w-5 text-slate-600 group-focus-within:text-brand transition-colors" />
                                            </div>
                                            <input
                                                required
                                                type="text"
                                                placeholder="E.g. Colegio San Ignacio"
                                                className="modern-input w-full pl-12 h-14"
                                                value={formData.institutionName}
                                                onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 italic">Email del Administrador</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Mail className="h-5 w-5 text-slate-600 group-focus-within:text-brand transition-colors" />
                                            </div>
                                            <input
                                                required
                                                type="email"
                                                placeholder="admin@colegio.com"
                                                className="modern-input w-full pl-12 h-14"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 italic">Contraseña de Acceso</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Key className="h-5 w-5 text-slate-600 group-focus-within:text-brand transition-colors" />
                                            </div>
                                            <input
                                                required
                                                type="password"
                                                placeholder="••••••••"
                                                className="modern-input w-full pl-12 h-14"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1 mt-2">Mínimo 8 caracteres, incluye símbolo neural.</p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-brand-quiet border border-brand/20 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck className="w-5 h-5 text-brand" />
                                            <span className="text-xs font-black text-white uppercase tracking-tight">Seguridad MentorIA Activada</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                            Al continuar, aceptas la creación de un entorno seguro bajo la normativa GDPR-ED. Tus datos y los de tus alumnos estarán encriptados end-to-end.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full h-16 bg-white text-slate-950 font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:bg-brand transition-all hover:scale-[1.02] shadow-[0_0_40px_rgba(255,255,255,0.1)] italic flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    {step === 1 ? "Siguiente Paso" : "Proceder al Pago"}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer info */}
                <div className="mt-8 grid grid-cols-3 gap-4">
                    {[
                        { label: "GDPR Compliant", icon: ShieldCheck },
                        { label: "Materialización < 24h", icon: Zap },
                        { label: "Setup Automático", icon: CheckCircle2 }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 opacity-50">
                            <item.icon className="w-4 h-4 text-slate-400" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{item.label}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
