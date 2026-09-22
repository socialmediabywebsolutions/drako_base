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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-white/95 px-4 py-12 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-700">
              Prueba gratuita finalizada
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            Tu prueba gratuita ha terminado
          </h1>
          <p className="mt-3 text-sm text-gray-500">
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
                  ? "border-[#3b82f6]/60 bg-[#3b82f6]/5 ring-1 ring-[#3b82f6]/25"
                  : "border-gray-200 bg-gray-50",
              ].join(" ")}
            >
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow shadow-[#3b82f6]/25">
                  {plan.badge}
                </span>
              )}

              <div className="mb-5">
                <h2 className="text-xl font-black text-gray-900">{plan.name}</h2>
                <p className="mt-1 text-xs text-gray-500">{plan.networks}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-gray-900">{plan.price}€</span>
                  <span className="text-sm text-gray-500">/mes</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#3b82f6]">
                  {plan.postsPerNetwork} posts/mes por red
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-px shrink-0 text-[#3b82f6]">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading}
                className={[
                  "w-full rounded-xl py-3.5 text-sm font-black tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50",
                  plan.highlight
                    ? "text-white bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] shadow-lg shadow-[#3b82f6]/20 hover:brightness-110"
                    : "text-gray-900 border border-gray-300 bg-gray-100 hover:bg-gray-200",
                ].join(" ")}
              >
                {loadingCheckout === plan.id ? "Redirigiendo…" : "Suscribirme ahora"}
              </button>

              <Link
                href={plansPageHref}
                className="mt-3 block text-center text-xs text-gray-400 transition hover:text-gray-600"
              >
                Ver todos los planes
              </Link>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          Pago seguro con Stripe · Cancela en cualquier momento
        </p>
      </div>
    </div>
  );
}
