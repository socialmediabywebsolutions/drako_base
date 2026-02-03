"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function ROICalculator() {
    const [numCompanies, setNumCompanies] = useState(3);
    const [modulesPerCompany, setModulesPerCompany] = useState(5);

    // Drako pricing model: €500 base + €300 per company
    const drakoBaseFee = 500;
    const pricePerCompany = 300;
    const drakoTotalCost = drakoBaseFee + (numCompanies * pricePerCompany);

    // Traditional development: €15,000 per company + €500/month maintenance per company
    const traditionalCostPerCompany = 15000;
    const traditionalMaintenancePerCompany = 500;
    const traditionalTotalOneTime = numCompanies * traditionalCostPerCompany;
    const traditionalYearlyCost = traditionalTotalOneTime + (numCompanies * traditionalMaintenancePerCompany * 12);

    // Drako yearly (one-time setup + €150/month total maintenance)
    const drakoYearlyCost = drakoTotalCost + (150 * 12);

    const savings = traditionalYearlyCost - drakoYearlyCost;
    const savingsPercentage = ((savings / traditionalYearlyCost) * 100).toFixed(0);

    return (
        <section className="py-32 bg-gradient-to-br from-white to-sky-50">
            <div className="max-w-6xl mx-auto px-10">
                <div className="text-center mb-16 space-y-4">
                    <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Calculadora de Costes</span>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                        Precio <span className="text-sky-600">Transparente</span> y Variable
                    </h2>
                    <p className="text-slate-600 font-medium max-w-2xl mx-auto">
                        Cobras solo por lo que necesitas. Nuestro modelo: <strong>€500 base + €300 por empresa</strong>
                    </p>
                </div>

                <div className="bg-white rounded-3xl p-10 border-2 border-sky-200 shadow-2xl">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Inputs */}
                        <div className="space-y-8">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    ¿Cuántas empresas necesita tu cliente?
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        step="1"
                                        value={numCompanies}
                                        onChange={(e) => setNumCompanies(Number(e.target.value))}
                                        className="flex-1 h-3 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-2xl font-black text-sky-600 min-w-[80px] text-right">
                                        {numCompanies}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-medium">
                                    Cada empresa incluye: dashboard, autenticación, base de datos, despliegue Edge
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">
                                    Módulos promedio por empresa
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="3"
                                        max="15"
                                        step="1"
                                        value={modulesPerCompany}
                                        onChange={(e) => setModulesPerCompany(Number(e.target.value))}
                                        className="flex-1 h-3 bg-sky-100 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                    />
                                    <span className="text-2xl font-black text-sky-600 min-w-[80px] text-right">
                                        {modulesPerCompany}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-medium">
                                    Estimación de complejidad (solo referencia, no afecta precio)
                                </p>
                            </div>

                            <div className="pt-6 border-t-2 border-sky-100">
                                <div className="bg-sky-50 p-4 rounded-xl">
                                    <h4 className="text-xs font-black text-sky-600 uppercase tracking-wider mb-2">Tu Precio Drako</h4>
                                    <div className="text-3xl font-black text-slate-900">
                                        €{drakoTotalCost.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                        €500 base + ({numCompanies} × €300)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="bg-gradient-to-br from-sky-50 to-white p-8 rounded-2xl border-2 border-sky-200">
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-6">Ahorro vs. Desarrollo Tradicional</h3>

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
                                        Ahorro de <span className="text-sky-600 text-xl font-black">{savingsPercentage}%</span> en el primer año
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t-2 border-sky-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Desarrollo tradicional</span>
                                        <span className="text-slate-900 font-bold">€{traditionalYearlyCost.toLocaleString()}/año</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Con Drako Partner</span>
                                        <span className="text-sky-600 font-black">€{drakoYearlyCost.toLocaleString()}/año</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t-2 border-sky-100 text-xs text-slate-500 space-y-1">
                                    <p>✓ Mantenimiento: €150/mes (todas las empresas)</p>
                                    <p>✓ Infraestructura Edge incluida</p>
                                    <p>✓ Soporte 24/7 incluido</p>
                                    <p>✓ 6 meses garantía sin coste</p>
                                </div>

                                <button
                                    onClick={() => {
                                        const chatEl = document.getElementById('chat-section');
                                        chatEl?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="w-full mt-6 px-6 py-4 bg-sky-500 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-sky-600 hover:scale-105 transition-all shadow-lg shadow-sky-500/30"
                                >
                                    Comenzar Diagnóstico →
                                </button>
                            </motion.div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center text-xs text-slate-500 font-medium">
                    <strong className="text-slate-700">Modelo de precio:</strong> €500 setup + €300 por cada empresa que necesites materializar.
                    Sin costes ocultos. Sin sorpresas.
                </div>
            </div>
        </section>
    );
}
