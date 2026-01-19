"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InterviewStep {
    id: string;
    title: string;
    subtitle: string;
}

const steps: InterviewStep[] = [
    { id: "identity", title: "Identidad", subtitle: "Definamos el alma de tu proyecto." },
    { id: "social", title: "Huella Digital", subtitle: "Tus redes hablan por ti." },
    { id: "geo", title: "Mercado Local", subtitle: "¿Quiénes son tus vecinos?" },
    { id: "costs", title: "Eficiencia", subtitle: "Hablemos de rentabilidad." },
    { id: "result", title: "Diagnóstico", subtitle: "Tu plan maestro está listo." },
];

export function EliteInterview() {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        saasName: "",
        concept: "",
        facebook: "",
        instagram: "",
        linkedin: "",
        address: "",
        rent: 0,
        electricity: 0,
        water: 0,
        labor: 0,
    });

    const [roi, setRoi] = useState({ savings: 0, percentage: 0 });

    useEffect(() => {
        // Calculadora de ROI en tiempo real simplificada
        const totalCosts = Number(formData.rent) + Number(formData.electricity) + Number(formData.water) + Number(formData.labor);
        const estimatedSavings = totalCosts * 0.22; // 22% de ahorro estándar con Drako
        setRoi({
            savings: Math.round(estimatedSavings),
            percentage: 22
        });
    }, [formData]);

    const next = () => currentStep < steps.length - 1 && setCurrentStep(currentStep + 1);
    const prev = () => currentStep > 0 && setCurrentStep(currentStep - 1);

    return (
        <div className="min-h-[600px] w-full max-w-4xl mx-auto glass-panel p-8 mt-12 flex flex-col">
            {/* Stepper Header */}
            <div className="flex justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -z-10 transform -translate-y-1/2" />
                {steps.map((s, idx) => (
                    <div key={s.id} className="flex flex-col items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${idx <= currentStep ? "bg-brand text-white scale-110 shadow-lg" : "bg-panel border border-border text-muted"
                                }`}
                        >
                            {idx + 1}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${idx === currentStep ? "text-brand" : "text-muted"}`}>{s.title}</span>
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full flex flex-col items-center text-center px-4"
                    >
                        <h2 className="text-3xl font-bold text-foreground mb-2">{steps[currentStep].title}</h2>
                        <p className="text-muted mb-8">{steps[currentStep].subtitle}</p>

                        {currentStep === 0 && (
                            <div className="grid gap-4 w-full max-w-md">
                                <input
                                    type="text" placeholder="Nombre de tu SaaS o Empresa" className="input"
                                    value={formData.saasName} onChange={e => setFormData({ ...formData, saasName: e.target.value })}
                                />
                                <textarea
                                    placeholder="Describe tu idea central..." className="input h-32"
                                    value={formData.concept} onChange={e => setFormData({ ...formData, concept: e.target.value })}
                                />
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="grid gap-4 w-full max-w-md">
                                <div className="flex items-center space-x-2">
                                    <span className="w-12 text-blue-600 font-bold">FB</span>
                                    <input type="text" placeholder="URL Facebook" className="input flex-1" />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-12 text-pink-600 font-bold">IG</span>
                                    <input type="text" placeholder="URL Instagram" className="input flex-1" />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="w-12 text-blue-800 font-bold">IN</span>
                                    <input type="text" placeholder="URL LinkedIn" className="input flex-1" />
                                </div>
                                <p className="text-xs text-muted mt-4">Analizaremos seguidores y frecuencia de publicación automáticamente.</p>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="w-full max-w-md bg-brand-quiet/30 rounded-2xl p-6 border border-brand/20">
                                <h4 className="font-bold text-brand-strong mb-4 uppercase text-xs tracking-widest">Calculadora de Eficiencia Drako</h4>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="text-[10px] text-muted block mb-1 uppercase font-bold">Alquiler/Hipoteca</label>
                                        <input type="number" className="input w-full" value={formData.rent} onChange={e => setFormData({ ...formData, rent: Number(e.target.value) })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted block mb-1 uppercase font-bold">Energía (Luz/Gas)</label>
                                        <input type="number" className="input w-full" value={formData.electricity} onChange={e => setFormData({ ...formData, electricity: Number(e.target.value) })} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] text-muted block mb-1 uppercase font-bold">Costos de Personal</label>
                                        <input type="number" className="input w-full" value={formData.labor} onChange={e => setFormData({ ...formData, labor: Number(e.target.value) })} />
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl p-4 shadow-sm border border-brand/10">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs text-muted">Ahorro Mensual Estimado</p>
                                            <p className="text-2xl font-black text-brand-strong">€{roi.savings}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="badge badge-info mb-1">Optimización {roi.percentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold mb-4">Análisis de Situación Listo</h3>
                                <p className="text-muted max-w-sm mx-auto mb-8">
                                    Drako ha encontrado 3 oportunidades críticas de mejora para tu idea de **{formData.saasName}**.
                                </p>
                                <div className="bg-panel p-4 rounded-xl border border-border text-left mb-6">
                                    <p className="text-xs font-bold text-brand uppercase mb-2">Presupuesto Sugerido</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xl font-bold">€1,200 <span className="text-xs text-muted font-normal">llave en mano</span></span>
                                        <button className="btn btn-primary">Aceptar y Ver Diseño</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer Controls */}
            <div className="mt-auto pt-8 border-t border-border flex justify-between">
                <button
                    className={`btn btn-outline ${currentStep === 0 || currentStep === 4 ? "invisible" : ""}`}
                    onClick={prev}
                >
                    Anterior
                </button>
                <button
                    className={`btn btn-primary px-12 ${currentStep === 4 ? "hidden" : ""}`}
                    onClick={next}
                >
                    Continuar
                </button>
            </div>
        </div>
    );
}
