"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { EliteInterview } from "@/components/onboarding/elite-interview";
import { FoundryWorkplace } from "@/components/foundry/foundry-workplace";
import { type BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { ROICalculator } from "@/components/marketing/roi-calculator";
import { PricingComparison } from "@/components/marketing/pricing-comparison";
import { StatsCounter } from "@/components/marketing/stats-counter";
import { Testimonials } from "@/components/marketing/testimonials";
import { GuaranteeBanner } from "@/components/marketing/guarantee-banner";

export default function HomePage() {
  const [activeView, setActiveView] = useState<"landing" | "workspace">("landing");
  const [finalBlueprint, setFinalBlueprint] = useState<BlueprintResponse | null>(null);

  const handleInterviewComplete = (data: BlueprintResponse) => {
    setFinalBlueprint(data);
    setActiveView("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToChat = () => {
    const chatEl = document.getElementById('chat-section');
    chatEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (activeView === "workspace") {
    return <FoundryWorkplace blueprint={finalBlueprint} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-sky-50">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center p-10 pt-32 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-100/40 via-white to-sky-50/60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-200/30 blur-[150px] rounded-full -z-10 animate-pulse" />

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="space-y-12 max-w-7xl relative z-10"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-4 px-8 py-3 rounded-2xl bg-white/80 border-2 border-sky-200 shadow-lg backdrop-blur-xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
            </span>
            <span className="text-[10px] text-sky-600 tracking-[0.5em] font-black uppercase">Neural Foundry Active • Materialization v3.0</span>
          </div>

          <h1 className="text-[8rem] md:text-[14rem] font-black text-slate-900 tracking-tighter leading-[0.7] uppercase italic drop-shadow-lg">
            AGENTS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-sky-600 to-sky-500 animate-pulse block py-4">BUILDING</span>
            PROJECTS.
          </h1>

          {/* Value Proposition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 pt-16 text-left max-w-4xl mx-auto border-t-2 border-sky-200 mt-16 relative">
            <div className="absolute -top-[2px] left-0 w-32 h-[2px] bg-sky-500 shadow-lg shadow-sky-500/50" />

            <div className="space-y-4">
              <p className="text-2xl text-slate-900 font-black tracking-tighter italic leading-none uppercase">
                &quot;De la idea al provisionamiento en 24h.&quot;
              </p>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed">
                Factoría automatizada de grado militar para la materialización de SaaS y ecosistemas digitales auto-escalables.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex gap-6">
                <button
                  onClick={scrollToChat}
                  className="px-10 py-4 bg-sky-500 text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-xl hover:bg-sky-600 transition-all hover:scale-105 shadow-lg shadow-sky-500/30 italic"
                >
                  Iniciar Consultoría
                </button>
                <Link
                  href="/site/marketplace"
                  className="px-10 py-4 border-2 border-sky-200 text-slate-700 font-black text-[10px] uppercase tracking-[0.4em] rounded-xl hover:bg-sky-50 transition-all flex items-center gap-3 group"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 group-hover:bg-sky-600" />
                  Ver Templates
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Trust Badges */}
      <TrustBadges />

      {/* Chat Section - IMMEDIATELY AFTER TRUST BADGES */}
      <section id="chat-section" className="relative px-10 py-32 z-20 bg-gradient-to-b from-white to-sky-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">Paso 1: Diagnóstico</span>
            <h2 className="text-5xl font-black text-slate-900 tracking-tight">Consultoría Personalizada</h2>
            <p className="text-slate-600 font-medium max-w-2xl mx-auto">
              Responde 4-5 preguntas sobre tu negocio. Al finalizar, recibirás un análisis completo y presupuesto exacto.
            </p>
          </div>

          <EliteInterview onComplete={handleInterviewComplete} />
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator />

      {/* What We Do Section */}
      <section className="px-10 py-32 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <div>
              <span className="text-sky-600 text-xs font-black uppercase tracking-[0.5em]">El Sistema Drako</span>
              <h2 className="text-5xl font-black text-slate-900 mt-4 tracking-tight leading-tight">
                No vendemos software. <span className="text-sky-600">Arquitecturamos soluciones.</span>
              </h2>
            </div>
            <div className="space-y-4 text-slate-700 leading-relaxed">
              <p className="font-medium text-base">
                Drako Partner es tu consultor de digitalización empresarial. En lugar de ofrecerte un producto genérico,
                te hacemos una <strong className="text-slate-900">entrevista estratégica</strong> para entender:
              </p>
              <ul className="space-y-3 pl-6">
                <li className="flex items-start gap-3">
                  <span className="text-sky-500 mt-1">•</span>
                  <span>Tu operativa actual y puntos de dolor</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-sky-500 mt-1">•</span>
                  <span>Tus costes reales y estructura financiera</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-sky-500 mt-1">•</span>
                  <span>Tus objetivos de crecimiento a 6 meses</span>
                </li>
              </ul>
              <p className="font-medium text-base pt-4">
                Con esos datos, diseñamos un <strong className="text-slate-900">sistema a medida</strong> que garantiza
                retorno de inversión en menos de 6 meses. No pagas por funciones que no necesitas.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-10 border-2 border-sky-100 shadow-xl space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Proceso de Materialización</h3>
            <div className="space-y-6">
              {[
                { step: "01", title: "Diagnóstico", desc: "4-5 preguntas estratégicas" },
                { step: "02", title: "Blueprint", desc: "Diseño arquitectónico personalizado" },
                { step: "03", title: "Presupuesto", desc: "Precio exacto basado en tu escala" },
                { step: "04", title: "Materialización", desc: "Construcción automatizada en 24h" }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start group">
                  <div className="w-12 h-12 rounded-xl bg-sky-50 border-2 border-sky-200 flex items-center justify-center font-black text-sky-600 text-sm group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500 transition-all">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-base">{item.title}</h4>
                    <p className="text-sm text-slate-600 font-medium mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <PricingComparison />

      {/* Stats Counter */}
      <StatsCounter />

      {/* Testimonials */}
      <Testimonials />

      {/* Guarantee Banner */}
      <GuaranteeBanner />

      {/* Footer CTA */}
      <section className="px-10 py-20 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-sky-50 to-white rounded-3xl p-16 text-center border-2 border-sky-100 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/20 to-transparent opacity-50" />
          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl font-black text-slate-900">¿Ya eres cliente?</h2>
            <p className="text-slate-700 font-medium">Accede a tu panel de control para gestionar tu proyecto</p>
            <Link
              href="/site/panel"
              className="inline-block px-10 py-4 bg-sky-500 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-sky-600 hover:scale-105 transition-all shadow-lg shadow-sky-500/30"
            >
              Ir a Mi Panel →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
