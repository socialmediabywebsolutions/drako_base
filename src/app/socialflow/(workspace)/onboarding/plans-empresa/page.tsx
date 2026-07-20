"use client";

import { useState } from "react";
import Link from "next/link";

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
    price: 169,
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
    price: 299,
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
    price: 449,
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
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] text-blue-400">
        Socialcors · Elige tu plan
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
        Empieza gratis, crece sin límites
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">
        7 días gratis sin tarjeta de crédito. O suscríbete ahora y activa todas las funciones de inmediato.
      </p>

      {/* Plan cards — 2 columns on sm+ */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-5xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={[
              "group relative flex flex-col rounded-2xl border p-7 transition-all duration-300",
              plan.highlight
                ? "border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30 hover:border-blue-400/80 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1"
                : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8 hover:shadow-lg hover:shadow-black/40 hover:-translate-y-1",
            ].join(" ")}
          >
            {/* Popular badge */}
            {plan.badge && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-sky-500 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/40">
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
              <p className="mt-1.5 text-sm font-semibold text-blue-300/80">
                {plan.postsPerNetwork} posts/mes por red · {plan.users}
              </p>
            </div>

            {/* Features list */}
            <ul className="mb-7 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                  <span className="mt-px shrink-0 text-[13px] font-black text-blue-400">✓</span>
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
                  ? "bg-gradient-to-r from-blue-500 to-sky-500 shadow-lg shadow-blue-500/30 hover:brightness-110 hover:shadow-blue-500/50"
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
