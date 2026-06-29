"use client";

import { useState } from "react";

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
    features: ["30 posts programados/mes", "IA para contenido", "Instagram + TikTok", "Hasta 3 canales"],
    stripePlan: "creator",
  },
  {
    id: "pro",
    name: "Influencer Pro",
    badge: "Más popular",
    price: 99,
    postsLabel: "60 posts/mes",
    features: ["60 posts programados/mes", "IA avanzada", "Todos los canales", "Soporte prioritario", "Analytics avanzados"],
    stripePlan: "pro",
    highlight: true,
  },
  {
    id: "empresa",
    name: "Empresa",
    price: 99,
    postsLabel: "30 posts + Reels + Stories",
    features: ["30 posts/mes con Reels + Stories", "IA avanzada", "Canales ilimitados", "Gestión de equipo", "Analytics avanzados"],
    stripePlan: "pro",
  },
];

export default function TrialPaywall() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(plan: Plan) {
    setError(null);
    setLoading(plan.id);
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
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#030312]/90 px-4 py-10 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-300">Prueba gratuita finalizada</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tu prueba gratuita ha terminado
          </h1>
          <p className="mt-3 text-base text-white/50">
            Elige un plan para seguir usando SocialFlow. Tus datos y publicaciones están a salvo.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? "border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow shadow-violet-500/30">
                  {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">{plan.postsLabel}</p>
                <h2 className="mt-1 text-lg font-black text-white">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">{plan.price}€</span>
                  <span className="text-sm text-white/40">/mes</span>
                </div>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="mt-0.5 shrink-0 text-violet-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading !== null}
                className={`w-full rounded-xl py-3 text-sm font-black tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  plan.highlight
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:brightness-110"
                    : "border border-white/20 bg-white/10 hover:bg-white/15"
                }`}
              >
                {loading === plan.id ? "Redirigiendo…" : "Suscribirme ahora"}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-red-400">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-white/25">
          Pago seguro con Stripe · Cancela en cualquier momento
        </p>
      </div>
    </div>
  );
}
