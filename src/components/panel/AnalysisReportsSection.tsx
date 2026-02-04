"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function AnalysisReportsSection() {
    const [analysisStatus, setAnalysisStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalysisStatus();
    }, []);

    const fetchAnalysisStatus = async () => {
        try {
            const res = await fetch("/api/analysis/status");
            const data = await res.json();
            setAnalysisStatus(data);
        } catch (error) {
            console.error("Error fetching analysis status:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const res = await fetch("/api/analysis/generate-pdf", { method: "POST" });
            if (!res.ok) throw new Error("Failed to generate PDF");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `analisis_competitivo_${Date.now()}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF:", error);
            alert("Error al descargar el PDF");
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (analysisStatus?.status === "not_started") {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl border-2 border-blue-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-500 text-white p-3 rounded-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Análisis Competitivo</h3>
                        <p className="text-sm text-slate-600 mb-3">
                            Completa el proceso de onboarding para recibir tu análisis competitivo personalizado.
                        </p>
                        <Link
                            href="/site/onboarding"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                            Completar Onboarding
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (analysisStatus?.status === "pending" || analysisStatus?.status === "processing") {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                    <div className="bg-amber-500 text-white p-3 rounded-lg animate-pulse">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Analizando tu Competencia...</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Estamos comparando tu negocio con {analysisStatus.summary?.competitors_found || "varios"} competidores locales.
                        </p>
                        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-sky-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${analysisStatus.progress || 0}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-500">{analysisStatus.progress || 0}% completado</p>
                    </div>
                </div>
            </div>
        );
    }

    if (analysisStatus?.status === "completed") {
        const summary = analysisStatus.summary;

        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-1">✅ Análisis Completado</h3>
                            <p className="text-sm text-blue-100">
                                {new Date(analysisStatus.completed_at).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                }) || "Recientemente"}
                            </p>
                        </div>
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-white text-blue-600 px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Descargar PDF
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="p-6 border-b border-slate-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-slate-50 rounded-lg">
                            <div className="text-2xl font-bold text-slate-800">{summary.competitors_found}</div>
                            <div className="text-xs text-slate-600 mt-1">Competidores Analizados</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{summary.key_gaps?.instagram_posts || 0}%</div>
                            <div className="text-xs text-slate-600 mt-1">Gap en Posts IG</div>
                        </div>
                        <div className="text-center p-4 bg-amber-50 rounded-lg">
                            <div className="text-2xl font-bold text-amber-600">{summary.key_gaps?.engagement || 0}%</div>
                            <div className="text-xs text-slate-600 mt-1">Gap en Engagement</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{summary.opportunities_count}</div>
                            <div className="text-xs text-slate-600 mt-1">Oportunidades</div>
                        </div>
                    </div>
                </div>

                {/* Top Opportunities */}
                {analysisStatus.opportunities && analysisStatus.opportunities.length > 0 && (
                    <div className="p-6">
                        <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                            🎯 Principales Oportunidades
                        </h4>
                        <div className="space-y-3">
                            {analysisStatus.opportunities.map((opp: any, index: number) => (
                                <div key={index} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
                                    <h5 className="font-semibold text-slate-800 text-sm mb-1">{opp.title}</h5>
                                    <p className="text-xs text-slate-600">{opp.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CTA */}
                <div className="bg-gradient-to-br from-slate-50 to-sky-50 p-6 text-center border-t border-slate-200">
                    <p className="text-sm text-slate-700 mb-3">
                        💡 <strong>Descarga tu informe completo</strong> para ver todas las oportunidades y departamentos recomendados
                    </p>
                    <button
                        onClick={handleDownloadPDF}
                        className="bg-gradient-to-r from-blue-600 to-sky-600 text-white px-8 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-sky-700 transition-all shadow-lg hover:shadow-xl"
                    >
                        📄 Descargar Informe PDF
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
