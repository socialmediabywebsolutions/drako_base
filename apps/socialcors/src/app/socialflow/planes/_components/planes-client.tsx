"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PlanKind = "empresa" | "influencer";

interface PlanDetail {
  slug: string;
  name: string;
  price: string;
  period: string;
  description: string;
  videoSpec: string;
  checks: string[];
  crosses: string[];
  popular?: boolean;
}

const INFLUENCER_PLANS: PlanDetail[] = [
  {
    slug: "influencer-starter",
    name: "Starter",
    price: "99€",
    period: "/mes",
    description: "Para creadores que empiezan a automatizar su presencia.",
    videoSpec: "6 vídeos IA/mes · hasta 15s (Reels cortos/gancho)",
    checks: [
      "8 piezas/semana en Instagram",
      "Máx. 2 publicaciones al día",
      "1 historia al día",
      "6 vídeos IA/mes (hasta 15s)",
      "Caption adaptado a tu voz",
      "Hashtags con tracción real",
      "Hora de publicación por IA",
    ],
    crosses: [
      "LinkedIn personal",
      "Página de Facebook",
      "Análisis de competencia",
      "CRM Social",
      "Soporte prioritario",
    ],
  },
  {
    slug: "influencer-basico",
    name: "Básico",
    price: "179€",
    period: "/mes",
    description: "Para creadores que quieren crecer con vídeos de mayor valor.",
    videoSpec: "12 vídeos IA/mes · hasta 30s (explicativos y reels)",
    popular: true,
    checks: [
      "12 piezas/semana en Instagram",
      "Máx. 2 publicaciones al día",
      "2 historias al día",
      "12 vídeos IA/mes (hasta 30s)",
      "Caption adaptado a tu voz",
      "Hashtags con tracción real",
      "Hora de publicación por IA",
      "LinkedIn personal (2/sem)",
      "Página de Facebook",
      "Análisis de imagen con IA",
      "Reels y carruseles automáticos",
    ],
    crosses: ["CRM Social", "Soporte prioritario"],
  },
  {
    slug: "influencer-pro",
    name: "Pro",
    price: "299€",
    period: "/mes",
    description: "Para influencers que buscan el máximo impacto audiovisual.",
    videoSpec: "20 vídeos IA/mes · hasta 60s (producción completa)",
    checks: [
      "Todo lo de Básico",
      "14 piezas/semana en Instagram",
      "2 historias al día",
      "20 vídeos IA/mes (hasta 60s)",
      "LinkedIn personal (5/sem)",
      "Página de Facebook",
      "Análisis avanzado",
      "CRM Social completo",
      "Soporte prioritario",
    ],
    crosses: [],
  },
];

const EMPRESA_PLANS: PlanDetail[] = [
  {
    slug: "empresa-starter",
    name: "Starter",
    price: "169€",
    period: "/mes",
    description: "Para negocios que quieren presencia constante sin agencias.",
    videoSpec: "6 vídeos IA/mes · hasta 15s (anuncios y dinámicos)",
    checks: [
      "6 piezas/semana en Instagram",
      "Máx. 2 publicaciones al día",
      "1 historia al día",
      "6 vídeos IA/mes (hasta 15s)",
      "Reconocimiento de empleados",
      "Caption adaptado a tu marca",
      "Hora de publicación por IA",
      "Página de Facebook",
    ],
    crosses: [
      "LinkedIn empresa",
      "CRM Social",
      "Análisis de competencia",
      "Soporte prioritario",
    ],
  },
  {
    slug: "empresa-basico",
    name: "Básico",
    price: "299€",
    period: "/mes",
    description: "Para empresas que necesitan autoridad y Reels trabajados.",
    videoSpec: "12 vídeos IA/mes · hasta 30s (demostraciones y marca)",
    popular: true,
    checks: [
      "12 piezas/semana en Instagram",
      "Máx. 2 publicaciones al día",
      "2 historias al día",
      "12 vídeos IA/mes (hasta 30s)",
      "Reconocimiento de empleados",
      "Caption adaptado a tu marca",
      "Hora de publicación por IA",
      "LinkedIn empresa (3/sem)",
      "Página de Facebook",
      "Análisis de imagen con IA",
      "Reels y carruseles automáticos",
    ],
    crosses: ["CRM Social", "Soporte prioritario"],
  },
  {
    slug: "empresa-pro",
    name: "Pro",
    price: "449€",
    period: "/mes",
    description: "Sustituto completo de agencia de marketing audiovisual.",
    videoSpec: "20 vídeos IA/mes · hasta 60s (micro-documentales y anuncios)",
    checks: [
      "Todo lo de Básico",
      "14 piezas/semana en Instagram",
      "2 historias al día",
      "20 vídeos IA/mes (hasta 60s)",
      "LinkedIn empresa (4/sem)",
      "Página de Facebook",
      "Análisis avanzado",
      "CRM Social completo",
      "Soporte prioritario",
    ],
    crosses: [],
  },
];

export default function PlanesClient() {
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");

  const [activeTab, setActiveTab] = useState<PlanKind>(
    rawType === "influencer" ? "influencer" : "empresa"
  );

  const plans = activeTab === "empresa" ? EMPRESA_PLANS : INFLUENCER_PLANS;

  return (
    <div className="min-h-screen text-slate-100 py-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-xs font-bold tracking-widest text-indigo-400 uppercase mb-2">
          AUTOMATIZACIÓN AUDIOVISUAL CON IA
        </p>
        <h1 className="text-4xl font-extrabold sm:text-5xl text-white">
          Elige el plan ideal para tu proyecto
        </h1>
        <p className="mt-4 text-base text-slate-400 max-w-2xl mx-auto">
          15 días gratis en todos los planes · Sin tarjeta de crédito · Modifica la duración y los vídeos por IA según tus necesidades.
        </p>

        {/* Selector de Pestañas [ Empresa | Influencer ] */}
        <div className="mt-8 flex justify-center">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 inline-flex gap-1">
            <button
              onClick={() => setActiveTab("empresa")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === "empresa"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Planes para Empresas
            </button>
            <button
              onClick={() => setActiveTab("influencer")}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === "influencer"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Planes para Influencers / Creadores
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas */}
      <div className="mt-12 max-w-7xl mx-auto grid gap-8 lg:grid-cols-3 lg:gap-8 items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.slug}
            className={`flex flex-col justify-between rounded-2xl bg-slate-900 p-8 border transition relative ${
              plan.popular
                ? "border-indigo-500 shadow-2xl shadow-indigo-500/10 scale-105"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Más Popular
              </span>
            )}

            <div>
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-xs text-slate-400">{plan.description}</p>

              <div className="mt-6 flex items-baseline">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price}
                </span>
                <span className="ml-1 text-sm text-slate-400">
                  {plan.period}
                </span>
              </div>

              {/* Destacado de Producción de Vídeo IA */}
              <div className="mt-4 p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-indigo-300 text-xs font-medium">
                🎬 <span className="font-bold">Vídeo IA:</span> {plan.videoSpec}
              </div>

              <ul className="mt-6 space-y-3 text-xs text-slate-300">
                {plan.checks.map((check, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{check}</span>
                  </li>
                ))}
                {plan.crosses.map((cross, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-500 line-through">
                    <span className="text-slate-600">✕</span>
                    <span>{cross}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href={`/socialflow/auth?type=${activeTab}&plan=${plan.slug}`}
                className={`block text-center w-full py-3 px-4 rounded-xl text-sm font-bold transition ${
                  plan.popular
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-800 hover:bg-slate-700 text-white"
                }`}
              >
                Empezar gratis 15 días →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-slate-500">
        Todos los planes incluyen 15 días de prueba sin tarjeta · Cancela cuando quieras · IVA no incluido
      </p>
    </div>
  );
}
