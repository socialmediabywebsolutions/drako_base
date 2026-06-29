"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = {
  id: string;
  name: string;
  badge?: string;
  price: number;
  postsLabel: string;
  features: string[];
  stripePlan: "creator" | "pro";
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "creator",
    name: "Influencer Básico",
    price: 49,
    postsLabel: "30 posts/mes",
    features: [
      "30 posts programados/mes",
      "IA para contenido con LLaVA + Mistral",
      "Instagram + TikTok",
      "Hasta 3 canales",
      "Calendario de contenido",
    ],
    stripePlan: "creator",
  },
  {
    id: "pro",
    name: "Influencer Pro",
    badge: "Más popular",
    price: 99,
    postsLabel: "60 posts/mes",
    features: [
      "60 posts programados/mes",
      "IA avanzada + análisis de imagen",
      "Todos los canales",
      "Soporte prioritario",
      "Analytics avanzados + detección de leads",
    ],
    stripePlan: "pro",
    highlight: true,
  },
  {
    id: "empresa",
    name: "Empresa",
    price: 99,
    postsLabel: "30 posts + Reels + Stories",
    features: [
      "30 posts/mes con Reels + Stories",
      "IA avanzada + análisis de imagen",
      "Canales ilimitados",
      "Gestión de equipo",
      "Analytics avanzados",
    ],
    stripePlan: "pro",
  },
];

export default function OnboardingPlansPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: Plan) {
    setError(null);
    setLoading(plan.id);
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
      setLoading(null);
    }
  }

  return (
    <div className="py-4">
      {/* Header */}
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
        SocialFlow · Onboarding
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
        Elige tu plan
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
        Empieza gratis 7 días sin tarjeta de crédito, o suscríbete ahora y activa todas las funciones de inmediato.
      </p>

      {/* Plan cards */}
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 transition ${
              plan.highlight
                ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30"
                : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow shadow-violet-500/30">
                {plan.badge}
              </span>
            )}

            {/* Plan header */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">{plan.postsLabel}</p>
              <h2 className="mt-1 text-xl font-black text-white">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">{plan.price}€</span>
                <span className="text-sm text-white/40">/mes</span>
              </div>
            </div>

            {/* Features */}
            <ul className="mb-6 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/60">
                  <span className="mt-0.5 shrink-0 font-bold text-violet-400">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Subscribe CTA */}
            <button
              onClick={() => handleSubscribe(plan)}
              disabled={loading !== null}
              className={`w-full rounded-xl py-3 text-sm font-black tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                plan.highlight
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:brightness-110"
                  : "border border-white/20 bg-white/10 hover:bg-white/15"
              }`}
            >
              {loading === plan.id ? "Redirigiendo a pago…" : "Suscribirme ahora"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Free trial CTA */}
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/3 px-6 py-6 text-center">
        <p className="text-sm font-semibold text-white/70">
          ¿Prefieres probarlo antes de pagar?
        </p>
        <Link
          href="/socialflow/onboarding"
          className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-black tracking-wide text-violet-300 transition hover:bg-violet-500/20"
        >
          Empezar prueba gratis 7 días →
        </Link>
        <p className="text-xs text-white/30">Sin tarjeta de crédito. Cancela cuando quieras.</p>
      </div>

      <p className="mt-6 text-center text-xs text-white/20">
        Pago seguro con Stripe · IVA incluido
      </p>
    </div>
  );
}
