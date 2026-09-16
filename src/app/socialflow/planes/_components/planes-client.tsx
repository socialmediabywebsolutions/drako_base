"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── Design tokens — mismos que landing-client.tsx (morado dominante para nav/logo,
// colores de red para el contenido específico de cada tipo de plan) ──────────────
const BG = "#F7F6FA";
const INK = "#1a1a2e";
const MUTED = "#64748b";
const ACCENT_SOFT = "#6D5DFB";
const ACCENT = "#4338CA";

const IG_PINK = "#DD2A7B";
const LI_BLUE = "#0A66C2";
const IG_GRADIENT = "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)";
const LI_GRADIENT = "linear-gradient(90deg, #0A66C2, #0077B5)";

type PlanDetail = {
  slug: string;
  name: string;
  price: string;
  period: string;
  description: string;
  checks: string[];
  crosses: string[];
  popular?: boolean;
};

type PlanKind = "influencer" | "empresa";

type PlanKindConfig = {
  badgeLabel: string;
  badgeColor: string;
  title: string;
  networkColor: string;
  ctaGradient: string;
  ctaGlowClass: string;
  plans: PlanDetail[];
};

const PLAN_KIND_CONFIG: Record<PlanKind, PlanKindConfig> = {
  influencer: {
    badgeLabel: "INFLUENCER · INSTAGRAM + LINKEDIN",
    badgeColor: IG_PINK,
    title: "Elige tu plan de Influencer",
    networkColor: IG_PINK,
    ctaGradient: IG_GRADIENT,
    ctaGlowClass: "sc-cta-glow-ig",
    plans: [
      {
        slug: "starter",
        name: "Starter",
        price: "99€",
        period: "/mes",
        description: "Para creadores que empiezan a automatizar",
        checks: [
          "8 piezas/semana Instagram",
          "Máx. 2/día",
          "1 historia/día",
          "6 vídeos IA/mes",
          "Caption en tu voz",
          "Hashtags con tracción real",
          "Hora de publicación IA",
        ],
        crosses: ["LinkedIn personal", "Análisis de competencia", "CRM Social", "Soporte prioritario"],
      },
      {
        slug: "basico",
        name: "Básico",
        price: "179€",
        period: "/mes",
        popular: true,
        description: "Para creadores que quieren crecer de verdad",
        checks: [
          "12 piezas/semana Instagram",
          "Máx. 2/día",
          "2 historias/día",
          "12 vídeos IA/mes",
          "Caption en tu voz",
          "Hashtags con tracción real",
          "Hora de publicación IA",
          "LinkedIn personal (2/sem)",
          "Análisis de imagen con IA",
          "Reels y carruseles automáticos",
        ],
        crosses: ["CRM Social", "Soporte prioritario"],
      },
      {
        slug: "pro",
        name: "Pro",
        price: "299€",
        period: "/mes",
        description: "Para influencers que quieren el máximo impacto",
        checks: [
          "Todo lo de Básico",
          "14 piezas/semana",
          "2 historias/día",
          "20 vídeos IA/mes",
          "LinkedIn personal (5/sem)",
          "Análisis avanzado",
          "CRM Social completo",
          "Soporte prioritario",
        ],
        crosses: [],
      },
    ],
  },
  empresa: {
    badgeLabel: "EMPRESA · INSTAGRAM + LINKEDIN",
    badgeColor: LI_BLUE,
    title: "Elige tu plan de Empresa",
    networkColor: LI_BLUE,
    ctaGradient: LI_GRADIENT,
    ctaGlowClass: "sc-cta-glow-li",
    plans: [
      {
        slug: "starter",
        name: "Starter",
        price: "169€",
        period: "/mes",
        description: "Para negocios que quieren empezar a publicar solos",
        checks: [
          "6 piezas/semana Instagram",
          "Máx. 2/día",
          "1 historia/día",
          "6 vídeos IA/mes",
          "Reconocimiento de empleados",
          "Caption adaptado a tu marca",
          "Hora de publicación IA",
        ],
        crosses: ["LinkedIn empresa", "CRM Social", "Análisis de competencia", "Soporte prioritario"],
      },
      {
        slug: "basico",
        name: "Básico",
        price: "299€",
        period: "/mes",
        popular: true,
        description: "Para empresas que quieren presencia real en redes",
        checks: [
          "12 piezas/semana Instagram",
          "Máx. 2/día",
          "2 historias/día",
          "12 vídeos IA/mes",
          "Reconocimiento de empleados",
          "Caption adaptado a tu marca",
          "Hora de publicación IA",
          "LinkedIn empresa (3/sem)",
          "Análisis de imagen con IA",
          "Reels y carruseles automáticos",
        ],
        crosses: ["CRM Social", "Soporte prioritario"],
      },
      {
        slug: "pro",
        name: "Pro",
        price: "449€",
        period: "/mes",
        description: "Para empresas que quieren el máximo rendimiento",
        checks: [
          "Todo lo de Básico",
          "14 piezas/semana",
          "2 historias/día",
          "20 vídeos IA/mes",
          "LinkedIn empresa (4/sem)",
          "Análisis avanzado",
          "CRM Social completo",
          "Soporte prioritario",
        ],
        crosses: [],
      },
    ],
  },
};

// ─── Hooks ─────────────────────────────────────────────────────────────────────
function useScrolledNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrolled;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function PlanCard({ plan, kind, config }: { plan: PlanDetail; kind: PlanKind; config: PlanKindConfig }) {
  const isInfluencer = kind === "influencer";
  const cardShadowClass = plan.popular
    ? isInfluencer
      ? "shadow-[0_10px_30px_rgba(221,42,123,0.16)] hover:shadow-[0_16px_36px_rgba(221,42,123,0.26)]"
      : "shadow-[0_10px_30px_rgba(10,102,194,0.16)] hover:shadow-[0_16px_36px_rgba(10,102,194,0.26)]"
    : isInfluencer
      ? "hover:shadow-[0_16px_36px_rgba(221,42,123,0.22)]"
      : "hover:shadow-[0_16px_36px_rgba(10,102,194,0.22)]";

  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-[14px] bg-white p-7 transition-all duration-300 hover:-translate-y-[3px]",
        cardShadowClass,
      ].join(" ")}
      style={{ border: `${plan.popular ? 2 : 1.5}px solid ${config.networkColor}` }}
    >
      {plan.popular && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg"
          style={{ background: config.ctaGradient }}
        >
          Más popular
        </span>
      )}

      <h3 className="text-lg font-black" style={{ color: INK }}>{plan.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: MUTED }}>{plan.description}</p>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-black" style={{ fontSize: "26px", color: config.networkColor }}>{plan.price}</span>
        <span className="text-sm" style={{ color: MUTED }}>{plan.period}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.checks.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: `${INK}cc` }}>
            <span className="mt-px shrink-0 font-black" style={{ color: config.networkColor }}>✓</span>
            {f}
          </li>
        ))}
        {plan.crosses.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: MUTED }}>
            <span className="mt-px shrink-0 font-black text-gray-300">✗</span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={`/socialflow/auth?type=${kind}&plan=${plan.slug}`}
        className={`${config.ctaGlowClass} sc-cta-shine mt-6 block w-full rounded-xl py-3 text-center text-sm font-black tracking-wide text-white transition-all duration-200 hover:brightness-110`}
        style={{ background: config.ctaGradient }}
      >
        Empezar gratis 15 días →
      </Link>
    </div>
  );
}

export default function PlanesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scrolled = useScrolledNav();

  const rawType = searchParams.get("type");
  const planKind: PlanKind | null = rawType === "influencer" || rawType === "empresa" ? rawType : null;

  useEffect(() => {
    if (!planKind) router.replace("/socialflows");
  }, [planKind, router]);

  if (!planKind) return null;

  const config = PLAN_KIND_CONFIG[planKind];

  return (
    <div className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ backgroundColor: BG }}>
      <style>{`
        @keyframes sc-cta-glow {
          0%, 100% { box-shadow: 0 10px 26px rgba(67,56,202,0.38), 0 0 0 0 rgba(0,245,212,0); }
          50% { box-shadow: 0 16px 40px rgba(67,56,202,0.55), 0 0 26px 6px rgba(0,245,212,0.22); }
        }
        .sc-cta-glow {
          animation: sc-cta-glow 2.6s ease-in-out infinite;
        }

        @keyframes sc-cta-glow-ig {
          0%, 100% { box-shadow: 0 10px 26px rgba(221,42,123,0.35), 0 0 0 0 rgba(245,133,41,0); }
          50% { box-shadow: 0 16px 40px rgba(221,42,123,0.5), 0 0 26px 6px rgba(245,133,41,0.28); }
        }
        .sc-cta-glow-ig {
          animation: sc-cta-glow-ig 2.6s ease-in-out infinite;
        }

        @keyframes sc-cta-glow-li {
          0%, 100% { box-shadow: 0 10px 26px rgba(10,102,194,0.35), 0 0 0 0 rgba(10,102,194,0); }
          50% { box-shadow: 0 16px 40px rgba(10,102,194,0.5), 0 0 26px 6px rgba(0,119,181,0.28); }
        }
        .sc-cta-glow-li {
          animation: sc-cta-glow-li 2.6s ease-in-out infinite;
        }

        @keyframes sc-cta-shine {
          0% { transform: translateX(-140%) skewX(-20deg); }
          35% { transform: translateX(140%) skewX(-20deg); }
          100% { transform: translateX(140%) skewX(-20deg); }
        }
        .sc-cta-shine {
          position: relative;
          overflow: hidden;
        }
        .sc-cta-shine::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
          transform: translateX(-140%) skewX(-20deg);
          animation: sc-cta-shine 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        .sc-cta-shine-dark::after {
          background: linear-gradient(115deg, transparent 30%, rgba(67,56,202,0.35) 50%, transparent 70%);
        }
      `}</style>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className={[
        "fixed top-0 z-50 w-full border-b transition-all duration-300",
        scrolled
          ? "border-black/5 bg-white/85 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      ].join(" ")}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/socialflows" className="flex items-center gap-2.5">
            <img src="/logo-cabecera.png" alt="Socialcors" className="h-8 w-auto" />
            <span className="text-lg font-black tracking-tight" style={{ color: INK }}>Socialcors</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/socialflow/auth"
              className="hidden px-3 py-2 text-sm font-semibold transition-colors sm:block"
              style={{ color: MUTED }}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/socialflow/auth"
              className="sc-cta-glow sc-cta-shine rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT})` }}
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <section className="pt-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
            style={{ borderColor: `${config.badgeColor}40`, backgroundColor: `${config.badgeColor}14` }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: config.badgeColor }} />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: config.badgeColor }}>
              {config.badgeLabel}
            </span>
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.1] tracking-tight md:text-5xl" style={{ color: INK }}>
            {config.title}
          </h1>
          <p className="mt-4 text-base" style={{ color: MUTED }}>
            15 días gratis en todos los planes · sin tarjeta de crédito
          </p>
        </div>
      </section>

      {/* ── PLANES ────────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-6 px-6 sm:grid-cols-3">
          {config.plans.map((plan) => (
            <PlanCard key={plan.slug} plan={plan} kind={planKind} config={config} />
          ))}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 py-10" style={{ backgroundColor: BG }}>
        <p className="text-center text-sm" style={{ color: MUTED }}>
          Todos los planes incluyen 15 días gratis · Cancela cuando quieras · Sin permanencia
        </p>
      </footer>
    </div>
  );
}
