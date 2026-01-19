"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Card from "@/components/ui/card";
import { EliteInterview } from "@/components/onboarding/elite-interview";
import { FoundryWorkplace } from "@/components/foundry/foundry-workplace";

import { type BlueprintResponse } from "@/lib/campamento-base/ai-blueprint-v2/prompts";

export default function SiteLandingPage() {
  const [activeView, setActiveView] = useState<"landing" | "workspace">("landing");
  const [finalBlueprint, setFinalBlueprint] = useState<BlueprintResponse | null>(null);

  const handleInterviewComplete = (data: BlueprintResponse) => {
    setFinalBlueprint(data);
    setActiveView("workspace");
    // Opcional: Hacer scroll al top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (activeView === "workspace") {
    return <FoundryWorkplace blueprint={finalBlueprint} />;
  }

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section - The Cyber Forge */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center p-6 pt-20 overflow-hidden">
        {/* Background visual element */}
        <div className="absolute inset-0 -z-10 bg-[url('/brain/8c6d1e6b-f577-40d7-a590-d5fd04124238/cyber_foundry_hero_bg_1768798075820.png')] bg-cover bg-center opacity-40 mix-blend-lighten" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-b from-background via-transparent to-background" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-brand/30 text-brand text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
            </span>
            Neural Foundry Activated • v2.0
          </div>

          <h1 className="text-6xl md:text-9xl font-black text-white tracking-tighter leading-[0.8] uppercase italic">
            AGENTS <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-white to-brand animate-pulse">BUILDING</span> <br />
            PROJECTS.
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 text-left max-w-3xl mx-auto border-t border-white/10 mt-12">
            <div>
              <p className="text-xl text-white font-bold tracking-tight italic">
                &quot;De la idea al provisionamiento en 24h.&quot;
              </p>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                No somos una agencia. Somos una factoría automatizada que orquestra agentes de élite para materializar SaaS, sistemas y ecosistemas digitales.
              </p>
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex gap-4">
                <div className="px-4 py-2 bg-brand text-slate-900 font-black text-xs uppercase tracking-widest rounded-lg hover:scale-105 transition-transform cursor-pointer">
                  Iniciar Secuencia
                </div>
                <div className="px-4 py-2 border border-white/20 text-white font-black text-xs uppercase tracking-widest rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  Ver Protocolos
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Elite Interview & Foundry Canvas */}
      <section id="interview" className="relative px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full bg-brand/5 blur-[120px] -z-10 rounded-full" />
        <div className="max-w-6xl mx-auto text-center mb-16 space-y-4">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Foundry Intake System</h2>
          <p className="text-muted text-sm max-w-xl mx-auto">Complete el protocolo de onboarding analítico para que Drako Partner diseñe su arquitectura.</p>
        </div>
        <EliteInterview onComplete={handleInterviewComplete} />
      </section>

      {/* Capabilities Grid */}
      <section className="grid gap-8 md:grid-cols-3 px-6 max-w-7xl mx-auto">
        <Card
          tone="glass"
          title="Social Nerve Center"
          subtitle="ANÁLISIS PROFUNDO"
          icon={<span className="text-2xl text-brand">📡</span>}
        >
          <p className="text-sm text-muted leading-relaxed">
            Nuestros Agentes Auditores escanean sus perfiles digitales para detectar fugas de ROI y optimizar su embudo de conversión en tiempo real.
          </p>
        </Card>
        <Card
          tone="glass"
          title="Automated Provisioning"
          subtitle="INFRAESTRUCTURA EDGE"
          icon={<span className="text-2xl text-brand">⚡</span>}
        >
          <p className="text-sm text-muted leading-relaxed">
            Cloudflare Workers + D1 + Stripe Billing. Desplegamos su solución en la red más rápida del mundo sin intervención humana.
          </p>
        </Card>
        <Card
          tone="glass"
          title="Orchestrated Ops"
          subtitle="BASE DE CONOCIMIENTO"
          icon={<span className="text-2xl text-brand">🧠</span>}
        >
          <p className="text-sm text-muted leading-relaxed">
            Creamos un &apos;Brain&apos; específico para su negocio que alimenta a los agentes de atención, ventas y soporte 24/7.
          </p>
        </Card>
      </section>

      {/* Enterprise Status */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="glass-panel p-16 text-center relative overflow-hidden group border-brand/20">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand/10 blur-[100px] rounded-full group-hover:bg-brand/20 transition-all duration-700" />
          <h2 className="text-5xl font-black mb-8 text-white italic tracking-tighter uppercase">EL ESTÁNDAR DRAKO</h2>
          <p className="max-w-2xl mx-auto text-lg text-muted mb-12 font-medium">
            Entregamos proyectos con arquitectura de grado militar, listos para facturar y auto-escalables. Sin deuda técnica, sin esperas.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            {["Identity Verified", "Fintech Ready", "Edge Distributed", "AI Native"].map((tag, i) => (
              <span key={i} className="inline-flex px-6 py-2 rounded-xl bg-slate-900 border border-white/10 text-brand text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
