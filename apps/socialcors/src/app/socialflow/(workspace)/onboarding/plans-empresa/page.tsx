"use client";

import { useState } from "react";
import Link from "next/link";
import { getSocialFlowPlanDefinition } from "@/lib/socialflow/billing/plans";

type Plan = {
  id: string;
  name: string;
  badge?: string;
  price: number;
  networks: string;
  postsPerNetwork: number;
  users: string;
  features: string[];
  stripePlan: "empresa_starter" | "empresa_basico" | "empresa_pro";
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "empresa_starter",
    name: "Empresa Starter",
    price: getSocialFlowPlanDefinition("empresa_starter").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 30,
    users: "2 usuarios incluidos",
    features: [
      "Base de Conocimiento (web + PDFs + catálogos)",
      "1 pieza/día por formato (post, reel, historia, carrusel) — ~30/mes",
      "Respuesta automática comentarios y DMs",
      "2 usuarios (dueño + community manager)",
    ],
    stripePlan: "empresa_starter",
  },
  {
    id: "empresa_basico",
    name: "Empresa Básico",
    price: getSocialFlowPlanDefinition("empresa_basico").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 60,
    users: "2 usuarios incluidos",
    features: [
      "Base de Conocimiento (web + PDFs + catálogos)",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
      "Voz de marca en tercera persona",
      "CRM Social básico",
      "Respuesta automática comentarios y DMs",
      "Análisis reseñas Google Business",
      "Campañas por temporada automáticas",
      "Informe mensual PDF",
      "2 usuarios (dueño + community manager)",
    ],
    stripePlan: "empresa_basico",
  },
  {
    id: "empresa_pro",
    name: "Empresa Pro",
    badge: "Más popular",
    price: getSocialFlowPlanDefinition("empresa_pro").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 90,
    users: "Usuarios ilimitados",
    features: [
      "Todo lo de Empresa Básico",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "Gestión de reputación y alertas",
      "Generación de leads desde DMs con precios del catálogo",
      "Presupuestos automáticos desde conversaciones",
      "Usuarios ilimitados con roles y permisos",
      "WhatsApp orquestador",
    ],
    stripePlan: "empresa_pro",
    highlight: true,
  },
];

export default function OnboardingPlansEmpresaPage() {
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: Plan) {
    setError(null);
    setLoadingCheckout(plan.id);
    try {
      const res = await fetch("/api/socialflow/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.stripePlan, context: "onboarding" }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; code?: string };
      if (!data.ok || !data.url) {
        throw new Error(data.code ?? "Error al crear sesión de pago");
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setLoadingCheckout(null);
    }
  }

  const isLoading = loadingCheckout !== null;

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">
        Socialcors · Elige tu plan
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
        Empieza gratis, crece sin límites
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-500">
        15 días gratis sin tarjeta de crédito. O suscríbete ahora y activa todas las funciones de inmediato.
      </p>

      {/* Plan cards — 2 columns on sm+ */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-5xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={[
              "group relative flex flex-col rounded-2xl border p-7 transition-all duration-300",
              plan.highlight
                ? "border-[#3b82f6]/60 bg-[#3b82f6]/5 ring-1 ring-[#3b82f6]/25 hover:border-[#3b82f6]/80 hover:shadow-xl hover:shadow-[#3b82f6]/15 hover:-translate-y-1"
                : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 hover:shadow-lg hover:-translate-y-1",
            ].join(" ")}
          >
            {/* Popular badge */}
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[#3b82f6]/25">
                {plan.badge}
              </span>
            )}

            {/* Plan header */}
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900">{plan.name}</h2>
              <p className="mt-1 text-xs font-semibold text-gray-500">{plan.networks}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-gray-900">{plan.price}€</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[#3b82f6]">
                {plan.postsPerNetwork} posts/mes por red · {plan.users}
              </p>
            </div>

            {/* Features list */}
            <ul className="mb-7 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                  <span className="mt-px shrink-0 text-[13px] font-black text-[#3b82f6]">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Primary CTA — Subscribe now */}
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={isLoading}
              className={[
                "w-full rounded-xl py-3.5 text-sm font-black tracking-wide transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-50",
                plan.highlight
                  ? "text-white bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] shadow-lg shadow-[#3b82f6]/25 hover:brightness-110"
                  : "text-gray-900 border border-gray-300 bg-gray-100 hover:bg-gray-200",
              ].join(" ")}
            >
              {loadingCheckout === plan.id ? "Redirigiendo…" : "Suscribirme ahora"}
            </button>

            {/* Secondary CTA — Start free trial */}
            <Link
              href="/socialflow/onboarding"
              className="mt-3 block w-full rounded-xl py-3 text-center text-sm font-bold text-gray-500 transition-colors hover:text-gray-800"
            >
              Empezar gratis 15 días →
            </Link>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia
      </p>
    </div>
  );
}
