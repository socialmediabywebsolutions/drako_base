"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function ROICalculator() {
    const [monthlyBudget, setMonthlyBudget] = useState(5000);
    const [teamSize, setTeamSize] = useState(3);

    // Cálculos
    const traditionalYearlyCost = monthlyBudget * 12 + (teamSize * 50000); // Agencia
    const drakoYearlyCost = 2500 + (150 * 12); // Setup + mantenimiento
    const savings = traditionalYearlyCost - drakoYearlyCost;
    const savingsPercentage = ((savings / traditionalYearlyCost) * 100).toFixed(0);

    return (
        <section className="py-32 bg-gradient-to-br from-white to-sky-50">
            <div className="max-w-6xl mx-auto px-10">
                <div className="text-center mb-16 space-y-4">
                    <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Calculadora de ROI</span>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                        ¿Cuánto <span className="text-sky-600">ahorrarías</span> con Drako?
                    </h2>
                    <p className="text-slate-600 font-medium max-w-2xl mx-auto">
                        Compara el coste real de desarrollar tu SaaS de forma tradicional vs. usar Drako Partner
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-10 border-2 border-sky-200 shadow-2xl">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Inputs */}
                        <div className="space-y-8">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    Presupuesto mensual actual en software/desarrollo
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1000"
                                        max="20000"
                                        step="500"
                                        value={monthlyBudget}
                                        onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                                        className="flex-1 h-3 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-2xl font-black text-sky-600 min-w-[120px] text-right">
                                        €{monthlyBudget.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    Tamaño del equipo de desarrollo
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="1"
                                        value={teamSize}
                                        onChange={(e) => setTeamSize(Number(e.target.value))}
                                        className="flex-1 h-3 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-2xl font-black text-sky-600 min-w-[120px] text-right">
                                        {teamSize} personas
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="bg-gradient-to-br from-sky-50 to-white p-8 rounded-2xl border-2 border-sky-200">
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-6">Tu ahorro anual</h3>

                            <motion.div
                                key={savings}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="space-y-6"
                            >
                                <div>
                                    <div className="text-6xl font-black text-sky-600 mb-2">
                                        €{savings.toLocaleString()}
                                    </div>
                                    <div className="text-sm text-slate-500 font-bold">
                                        Ahorro de <span className="text-sky-600 text-xl font-black">{savingsPercentage}%</span> vs. desarrollo tradicional
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t-2 border-sky-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Coste tradicional</span>
                                        <span className="text-slate-900 font-bold">€{traditionalYearlyCost.toLocaleString()}/año</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Coste con Drako</span>
                                        <span className="text-sky-600 font-black">€{drakoYearlyCost.toLocaleString()}/año</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const chatEl = document.getElementById('chat-section');
                                        chatEl?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="w-full mt-6 px-6 py-4 bg-sky-500 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-sky-600 hover:scale-105 transition-all shadow-lg shadow-sky-500/30"
                                >
                                    Comenzar mi proyecto →
                                </button>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
