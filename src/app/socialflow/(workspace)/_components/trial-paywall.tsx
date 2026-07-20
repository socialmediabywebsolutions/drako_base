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
  features: string[];
  stripePlan: "influencer_starter" | "influencer_basico" | "influencer_pro" | "empresa_starter" | "empresa_basico" | "empresa_pro";
  highlight?: boolean;
};

const INFLUENCER_PLANS: Plan[] = [
  {
    id: "influencer_starter",
    name: "Influencer Starter",
    price: 99,
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
    price: 179,
    networks: "Instagram",
    postsPerNetwork: 60,
    features: [
      "Instagram",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
      "IA para captions y hashtags",
      "Calendario de contenido",
      "Publicación automática",
    ],
    stripePlan: "influencer_basico",
  },
  {
    id: "influencer_pro",
    name: "Influencer Pro",
    badge: "Más popular",
    price: 299,
    networks: "Instagram",
    postsPerNetwork: 90,
    features: [
      "Instagram",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "IA avanzada + análisis de imagen",
      "Calendario de contenido",
      "Analytics avanzados",
    ],
    stripePlan: "influencer_pro",
    highlight: true,
  },
];

const EMPRESA_PLANS: Plan[] = [
  {
    id: "empresa_starter",
    name: "Empresa Starter",
    price: 169,
    networks: "Instagram",
    postsPerNetwork: 30,
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
    features: [
      "Base de Conocimiento (web + PDFs + catálogos)",
      "2 piezas/día por formato (post, reel, historia, carrusel) — ~60/mes",
      "CRM Social básico",
      "Respuesta automática comentarios y DMs",
      "Análisis reseñas Google Business",
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
    features: [
      "Todo lo de Empresa Básico",
      "3 piezas/día por formato (post, reel, historia, carrusel) — ~90/mes",
      "Gestión de reputación y alertas",
      "Generación de leads desde DMs",
      "Usuarios ilimitados con roles y permisos",
      "WhatsApp orquestador",
    ],
    stripePlan: "empresa_pro",
    highlight: true,
  },
];

export default function TrialPaywall({ accountType }: { accountType: "influencer" | "empresa" | null }) {
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = accountType === "empresa" ? EMPRESA_PLANS : INFLUENCER_PLANS;
  const plansPageHref = accountType === "empresa" ? "/socialflow/onboarding/plans-empresa" : "/socialflow/onboarding/plans";

  async function handleSubscribe(plan: Plan) {
    setError(null);
    setLoadingCheckout(plan.id);
    try {
      const res = await fetch("/api/socialflow/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: plan.stripePlan, context: "settings" }),
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#030312]/92 px-4 py-12 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-300">
              Prueba gratuita finalizada
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tu prueba gratuita ha terminado
          </h1>
          <p className="mt-3 text-sm text-white/50">
            Tus datos y publicaciones están a salvo. Elige un plan para seguir.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-2xl border p-7",
                plan.highlight
                  ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow shadow-violet-500/40">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <h2 className="text-xl font-black text-white">{plan.name}</h2>
                <p className="mt-1 text-xs text-white/40">{plan.networks}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-white">{plan.price}€</span>
                  <span className="text-sm text-white/40">/mes</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-violet-300/80">
                  {plan.postsPerNetwork} posts/mes por red
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="mt-px shrink-0 text-violet-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading}
                className={[
                  "w-full rounded-xl py-3.5 text-sm font-black tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                  plan.highlight
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:brightness-110"
                    : "border border-white/20 bg-white/10 hover:bg-white/15",
                ].join(" ")}
              >
                {loadingCheckout === plan.id ? "Redirigiendo…" : "Suscribirme ahora"}
              </button>

              <Link
                href={plansPageHref}
                className="mt-3 block text-center text-xs text-white/30 transition hover:text-white/50"
              >
                Ver todos los planes
              </Link>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-red-400">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-white/20">
          Pago seguro con Stripe · Cancela en cualquier momento
        </p>
      </div>
    </div>
  );
}
