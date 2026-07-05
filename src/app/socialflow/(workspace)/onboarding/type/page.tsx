"use client";

import { useState } from "react";

type AccountType = "influencer" | "empresa";

const CARDS = [
  {
    type: "influencer" as AccountType,
    icon: "✨",
    title: "Soy Influencer",
    subtitle: "Hago crecer mi marca personal y monetizo mi audiencia",
    features: [
      "Contenido en primera persona, tu voz auténtica",
      "TikTok, Instagram, Facebook y YouTube",
      "La IA genera caption, hashtags y publica por ti",
    ],
    checkColor: "text-violet-400",
    borderBase: "border-violet-500/30",
    bgBase: "from-violet-900/30 to-fuchsia-900/10",
    borderHover: "hover:border-violet-400/70 hover:shadow-violet-500/20",
    destination: "/socialflow/onboarding/plans",
  },
  {
    type: "empresa" as AccountType,
    icon: "🏢",
    title: "Soy Empresa o Negocio",
    subtitle: "Gestiono las redes de mi negocio para conseguir más clientes",
    features: [
      "Voz de marca profesional en tercera persona",
      "Instagram, LinkedIn, Facebook y Pinterest",
      "La IA conoce tu catálogo y responde por tus clientes",
    ],
    checkColor: "text-blue-400",
    borderBase: "border-blue-500/30",
    bgBase: "from-blue-900/30 to-sky-900/10",
    borderHover: "hover:border-blue-400/70 hover:shadow-blue-500/20",
    destination: "/socialflow/onboarding/plans-empresa",
  },
] as const;

export default function OnboardingTypePage() {
  const [loading, setLoading] = useState<AccountType | null>(null);

  async function handleSelect(card: (typeof CARDS)[number]) {
    if (loading) return;
    setLoading(card.type);

    // Save to D1 (fire-and-forget — navigate immediately)
    fetch("/api/socialflow/onboarding/account-type", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountType: card.type }),
    }).catch((err) => console.error("ACCOUNT_TYPE_SAVE_ERROR", err));

    window.location.assign(card.destination);
  }

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-1 text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
        Socialcors · Tu perfil
      </div>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
        ¿Quién eres tú?
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/50">
        Cuéntanos sobre ti para personalizar tu experiencia
      </p>

      {/* Type selection cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:max-w-3xl">
        {CARDS.map((card) => (
          <button
            key={card.type}
            onClick={() => handleSelect(card)}
            disabled={loading !== null}
            className={[
              "group relative flex flex-col items-start rounded-2xl border p-8 text-left",
              "bg-gradient-to-br transition-all duration-300",
              card.bgBase,
              card.borderBase,
              card.borderHover,
              "hover:shadow-xl hover:-translate-y-2",
              "disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            <span className="mb-5 text-5xl leading-none">{card.icon}</span>

            <h2 className="text-2xl font-black text-white">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/50">{card.subtitle}</p>

            <ul className="mt-6 space-y-2.5">
              {card.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/65">
                  <span className={`mt-px shrink-0 font-black ${card.checkColor}`}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {loading === card.type && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                <span className="text-sm font-bold text-white/80">Un momento…</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-white/25">
        Puedes cambiar esto más adelante desde configuración
      </p>
    </div>
  );
}
