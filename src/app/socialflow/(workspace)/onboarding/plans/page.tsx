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
  features: string[];
  stripePlan: "influencer_starter" | "influencer_basico" | "influencer_pro";
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "influencer_starter",
    name: "Influencer Starter",
    price: getSocialFlowPlanDefinition("influencer_starter").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 30,
    features: [
      "Instagram",
      "1 pieza/día por formato (post, reel, historia, carrusel) — ~30/mes",
      "IA para captions y hashtags",
      "Calendario de contenido",
      "Publicación automática",
    ],
    stripePlan: "influencer_starter",
  },
  {
    id: "influencer_basico",
    name: "Influencer Básico",
    price: getSocialFlowPlanDefinition("influencer_basico").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 60,
    features: [
      "Instagram",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
      "IA para captions y hashtags",
      "Análisis de imagen con IA",
      "Calendario de contenido",
      "Publicación automática",
    ],
    stripePlan: "influencer_basico",
  },
  {
    id: "influencer_pro",
    name: "Influencer Pro",
    badge: "Más popular",
    price: getSocialFlowPlanDefinition("influencer_pro").priceEur!,
    networks: "Instagram",
    postsPerNetwork: 90,
    features: [
      "Instagram",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "IA avanzada para contenido",
      "Análisis de imagen con IA",
      "Calendario de contenido",
      "Publicación automática + Analytics avanzados",
    ],
    stripePlan: "influencer_pro",
    highlight: true,
  },
];

export default function OnboardingPlansPage() {
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
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
        Socialcors · Elige tu plan
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
        Empieza gratis, crece sin límites
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">
        7 días gratis sin tarjeta de crédito. O suscríbete ahora y activa todas las funciones de inmediato.
      </p>

      {/* Plan cards — 3 columns on lg+ */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-5xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={[
              "group relative flex flex-col rounded-2xl border p-7 transition-all duration-300",
              plan.highlight
                ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30 hover:border-violet-400/80 hover:shadow-xl hover:shadow-violet-500/20 hover:-translate-y-1"
                : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-1",
            ].join(" ")}
          >
            {/* Popular badge */}
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-violet-500/40">
                {plan.badge}
              </span>
            )}

            {/* Plan header */}
            <div className="mb-6">
              <h2 className="text-xl font-black text-white">{plan.name}</h2>
              <p className="mt-1 text-xs font-semibold text-white/40">{plan.networks}</p>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-white">{plan.price}€</span>
                <span className="text-sm text-white/40">/mes</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-violet-300/80">
                {plan.postsPerNetwork} posts/mes por red
              </p>
            </div>

            {/* Features list */}
            <ul className="mb-7 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                  <span className="mt-px shrink-0 text-[13px] font-black text-violet-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Primary CTA — Subscribe now */}
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={isLoading}
              className={[
                "w-full rounded-xl py-3.5 text-sm font-black tracking-wide text-white transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-50",
                plan.highlight
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30 hover:brightness-110 hover:shadow-violet-500/50"
                  : "border border-white/20 bg-white/10 hover:bg-white/18 hover:border-white/30",
              ].join(" ")}
            >
              {loadingCheckout === plan.id ? "Redirigiendo…" : "Suscribirme ahora"}
            </button>

            {/* Secondary CTA — Start free trial */}
            <Link
              href="/socialflow/onboarding"
              className="mt-3 block w-full rounded-xl py-3 text-center text-sm font-bold text-white/50 transition-colors hover:text-white/80"
            >
              Empezar gratis 7 días →
            </Link>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <p className="mt-8 text-xs text-white/20">
        Pago seguro con Stripe · Cancela en cualquier momento · Sin permanencia
      </p>
    </div>
  );
}
