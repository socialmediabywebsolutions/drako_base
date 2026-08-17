"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import ChatWidget from "./chat-widget";

// ─── Design tokens (landing-only, ver auditoría de fondo oscuro para el resto del SaaS) ──
const BG = "#F7F6FA";
const INK = "#1a1a2e";
const MUTED = "#64748b";
// Morado azulado vivo — color dominante (logo, nav, CTAs principales, panel "El Cerebro",
// CTA final, tab "Influencer").
const ACCENT_SOFT = "#6D5DFB";
const ACCENT = "#4338CA";
const ACCENT_STRONG = "#2B2483";
// Extremo más oscuro para los paneles de fondo oscuro (El Cerebro, CTA final).
const ACCENT_DEEP = "#0D0B28";

// Turquesa "brillo solar" — acento secundario, uso deliberadamente acotado (tab "Empresa",
// badge del hero) para que el morado siga leyéndose como el color dominante de la marca.
const ACCENT2_SOFT = "#00F5D4";
const ACCENT2 = "#00C2A8";
const ACCENT2_STRONG = "#0F766E"; // versión oscura, para texto legible sobre fondo claro

// Variante de entrada compartida por los bloques principales (scroll reveal): fade + slide-up
// sutil de ~20px, se dispara una sola vez al entrar en el viewport.
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────
type PricingTab = "influencer" | "empresa";

type WeeklyPlan = {
  id: string;
  name: string;
  price: string;
  period: string;
  weeklyPosts: number;
  maxPerDay: number;
  storiesPerDay: number;
  distribution: number[]; // [L, M, X, J, V, S, D]
  networks: string;
  features: string[];
  popular?: boolean;
};

type SocialLink = {
  label: string;
  handle: string;
  href: string;
  badge: string;
};

// ─── Data ──────────────────────────────────────────────────────────────────────
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const DIST_8 = [2, 1, 1, 1, 1, 1, 1];
const DIST_12 = [2, 2, 2, 2, 2, 1, 1];
const DIST_14 = [2, 2, 2, 2, 2, 2, 2];

const HOW_IT_WORKS = [
  {
    num: "1",
    icon: "📸",
    title: "Subes una foto",
    text: "Desde el móvil o el ordenador. Nada de plantillas ni formularios eternos.",
  },
  {
    num: "2",
    icon: "🧠",
    title: "La IA analiza, crea y elige la mejor hora",
    text: "Genera el caption, los hashtags y decide cuándo publicar según tu audiencia real.",
  },
  {
    num: "3",
    icon: "✅",
    title: "Apruebas con un toque y se publica solo",
    text: "Tú das el visto bueno (o dejas que se publique automáticamente). El resto lo hacemos nosotros.",
  },
];

const PLANS_INFLUENCER: WeeklyPlan[] = [
  {
    id: "influencer-starter",
    name: "Influencer Starter",
    price: "99€",
    period: "/mes",
    weeklyPosts: 8,
    maxPerDay: 2,
    storiesPerDay: 1,
    distribution: DIST_8,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Instagram + LinkedIn (perfil personal)",
      "1 historia/día",
      "El Cerebro elige la mejor hora para ti",
      "Publicación automática",
    ],
  },
  {
    id: "influencer-basico",
    name: "Influencer Básico",
    price: "179€",
    period: "/mes",
    weeklyPosts: 12,
    maxPerDay: 2,
    storiesPerDay: 2,
    distribution: DIST_12,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Todo lo de Starter",
      "2 historias/día",
      "Análisis de imagen con IA",
      "Reels y carruseles automáticos",
    ],
    popular: true,
  },
  {
    id: "influencer-pro",
    name: "Influencer Pro",
    price: "299€",
    period: "/mes",
    weeklyPosts: 14,
    maxPerDay: 2,
    storiesPerDay: 2,
    distribution: DIST_14,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Todo lo de Básico",
      "2 historias/día",
      "Analytics avanzados",
      "Soporte prioritario",
    ],
  },
];

const PLANS_EMPRESA: WeeklyPlan[] = [
  {
    id: "empresa-starter",
    name: "Empresa Starter",
    price: "169€",
    period: "/mes",
    weeklyPosts: 8,
    maxPerDay: 2,
    storiesPerDay: 1,
    distribution: DIST_8,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Instagram + LinkedIn (perfil personal)",
      "1 historia/día",
      "Base de Conocimiento (web, PDFs, catálogo)",
      "Respuesta automática a comentarios y DMs",
    ],
  },
  {
    id: "empresa-basico",
    name: "Empresa Básico",
    price: "299€",
    period: "/mes",
    weeklyPosts: 12,
    maxPerDay: 2,
    storiesPerDay: 2,
    distribution: DIST_12,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Todo lo de Starter",
      "2 historias/día",
      "CRM Social básico",
      "Voz de marca consistente",
    ],
    popular: true,
  },
  {
    id: "empresa-pro",
    name: "Empresa Pro",
    price: "449€",
    period: "/mes",
    weeklyPosts: 14,
    maxPerDay: 2,
    storiesPerDay: 2,
    distribution: DIST_14,
    networks: "Instagram + LinkedIn (perfil personal)",
    features: [
      "Todo lo de Básico",
      "2 historias/día",
      "Gestión de reputación y leads",
      "WhatsApp orquestador",
    ],
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    label: "Instagram",
    handle: "@socialcors",
    href: "https://www.instagram.com/socialcors/",
    badge: "IG",
  },
  {
    label: "LinkedIn",
    handle: "Socialcors",
    href: "https://www.linkedin.com/company/socialcors/",
    badge: "in",
  },
  {
    label: "Instagram",
    handle: "@drako.systems",
    href: "https://www.instagram.com/drako.systems/",
    badge: "IG",
  },
  {
    label: "LinkedIn",
    handle: "Drako Systems",
    href: "https://www.linkedin.com/company/drako-systems/",
    badge: "in",
  },
  {
    label: "LinkedIn",
    handle: "Cristóbal Cors Bernal · Founder",
    href: "https://www.linkedin.com/in/cris-cors/",
    badge: "in",
  },
];

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
function WeekDistribution({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution);
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map((day, i) => (
        <div key={`${day}-${i}`} className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-full items-end overflow-hidden rounded-lg bg-black/[0.04]">
            <div
              className="w-full rounded-lg"
              style={{
                height: `${(distribution[i] / max) * 100}%`,
                minHeight: "16px",
                background: `linear-gradient(180deg, ${ACCENT_SOFT}, ${ACCENT})`,
              }}
            />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: `${INK}66` }}>{day}</span>
          <span className="text-[10px] font-bold" style={{ color: INK }}>{distribution[i]}</span>
        </div>
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: WeeklyPlan }) {
  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border bg-white p-6 text-left transition-all duration-300 hover:-translate-y-1",
        plan.popular
          ? "shadow-[0_8px_30px_rgba(67,56,202,0.18)] hover:shadow-[0_16px_36px_rgba(67,56,202,0.28)]"
          : "border-black/[0.06] shadow-[0_1px_3px_rgba(15,15,35,0.06)] hover:shadow-[0_12px_28px_rgba(15,15,35,0.10)]",
      ].join(" ")}
      style={plan.popular ? { borderColor: `${ACCENT}55` } : undefined}
    >
      {plan.popular && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg"
          style={{ background: `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT})` }}
        >
          Más popular
        </span>
      )}

      <h3 className="text-lg font-black" style={{ color: INK }}>{plan.name}</h3>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-4xl font-black" style={{ color: INK }}>{plan.price}</span>
        <span className="text-sm" style={{ color: MUTED }}>{plan.period}</span>
      </div>

      <p className="mt-1.5 text-xs font-semibold" style={{ color: ACCENT }}>{plan.networks}</p>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-black/[0.03] px-2 py-3 text-center">
          <div className="text-2xl font-black leading-none" style={{ color: INK }}>{plan.weeklyPosts}</div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>piezas/semana</div>
        </div>
        <div className="rounded-xl bg-black/[0.03] px-2 py-3 text-center">
          <div className="text-2xl font-black leading-none" style={{ color: INK }}>{plan.maxPerDay}</div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>máx/día</div>
        </div>
        <div className="rounded-xl bg-black/[0.03] px-2 py-3 text-center">
          <div className="text-2xl font-black leading-none" style={{ color: INK }}>{plan.storiesPerDay}</div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>historia{plan.storiesPerDay !== 1 ? "s" : ""}/día</div>
        </div>
      </div>

      <WeekDistribution distribution={plan.distribution} />

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ color: `${INK}cc` }}>
            <span className="mt-px shrink-0 font-black" style={{ color: ACCENT }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href="/socialflow/auth"
        className="mt-6 block w-full rounded-xl py-3 text-center text-sm font-black tracking-wide text-white shadow-lg transition-all duration-200 hover:brightness-110"
        style={{ background: `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT})` }}
      >
        Empezar gratis 15 días
      </Link>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingClient() {
  const scrolled = useScrolledNav();
  const [pricingTab, setPricingTab] = useState<PricingTab>("influencer");
  const [pricingVisible, setPricingVisible] = useState(true);

  function switchTab(tab: PricingTab) {
    if (tab === pricingTab) return;
    setPricingVisible(false);
    setTimeout(() => {
      setPricingTab(tab);
      setPricingVisible(true);
    }, 200);
  }

  const activePlans = pricingTab === "influencer" ? PLANS_INFLUENCER : PLANS_EMPRESA;

  return (
    <>
    <div className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ backgroundColor: BG }}>
      <style>{`
        @keyframes sc-hero-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .sc-hero-gradient-text {
          background-image: linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT2} 50%, ${ACCENT} 100%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: sc-hero-gradient 4s ease-in-out infinite;
        }

        @keyframes sc-cta-glow {
          0%, 100% { box-shadow: 0 10px 26px rgba(67,56,202,0.38), 0 0 0 0 rgba(0,245,212,0); }
          50% { box-shadow: 0 16px 40px rgba(67,56,202,0.55), 0 0 26px 6px rgba(0,245,212,0.22); }
        }
        .sc-cta-glow {
          animation: sc-cta-glow 2.6s ease-in-out infinite;
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
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shadow-lg"
              style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}, ${ACCENT})`, boxShadow: `0 8px 20px ${ACCENT}33` }}
            >
              <span className="text-xs font-black text-white">SC</span>
            </div>
            <span className="text-lg font-black tracking-tight" style={{ color: INK }}>Socialcors</span>
          </div>
          {/* Actions */}
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

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24">
        {/* Soft color blobs, tuned for light background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[8%] h-[600px] w-[600px] rounded-full bg-violet-300/35 blur-[130px]" />
          <div className="absolute right-[-8%] top-[20%] h-[500px] w-[500px] rounded-full bg-indigo-200/40 blur-[130px]" />
          <div className="absolute bottom-[5%] left-[35%] h-[400px] w-[400px] rounded-full bg-cyan-100/50 blur-[110px]" />
        </div>
        {/* Dot grid, tinted brand color */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: `radial-gradient(${ACCENT}22 1px, transparent 1px)`, backgroundSize: "28px 28px" }}
        />

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl px-6 pb-10 pt-7 text-center md:pb-14 md:pt-10"
        >
          {/* Eyebrow */}
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
            style={{ borderColor: `${ACCENT2}40`, backgroundColor: `${ACCENT2}14` }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: ACCENT2 }} />
            <span className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT2_STRONG }}>
              Para influencers y empresas
            </span>
          </div>

          {/* Headline */}
          <h1 className="sc-hero-gradient-text mx-auto max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Tu Community Manager
            <br />
            con Inteligencia Artificial
          </h1>

          {/* Sub */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: MUTED }}>
            Para creadores de contenido y para empresas: sube una foto y nosotros analizamos,
            creamos, publicamos y aprendemos por ti.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/socialflow/auth"
              className="sc-cta-glow sc-cta-shine rounded-xl px-9 py-4 text-base font-black text-white transition-all hover:brightness-110 hover:-translate-y-0.5"
              style={{ background: `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT}, ${ACCENT_STRONG})` }}
            >
              Prueba 15 días gratis, sin tarjeta →
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["15 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                <span className="font-black" style={{ color: ACCENT }}>✓</span>
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── CÓMO FUNCIONA ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              Cómo funciona
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Tres pasos. Cero esfuerzo.
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.12 }}
              >
                <div className="relative flex h-full flex-col rounded-2xl border border-black/[0.06] bg-white p-7 shadow-[0_1px_3px_rgba(15,15,35,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,15,35,0.10)]">
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}22, ${ACCENT}22)`, boxShadow: `0 8px 20px ${ACCENT}22` }}
                  >
                    {step.icon}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: ACCENT }}>
                    Paso {step.num}
                  </span>
                  <h3 className="mt-2 text-xl font-black" style={{ color: INK }}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{step.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EL CEREBRO ────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl px-8 py-14 text-center md:px-16 md:py-20"
            style={{ background: `linear-gradient(135deg, ${ACCENT_STRONG}, ${ACCENT} 55%, ${ACCENT_DEEP})` }}
          >
            {/* Glow orbs decorativos — drift lento tipo float, discretos, nunca protagonistas */}
            <motion.div
              className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-[100px]"
              animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-cyan-300/10 blur-[110px]"
              animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2">
                <span className="text-lg">🧠</span>
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                  El diferenciador real
                </span>
              </div>

              <h2 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
                No es un programador de publicaciones. Es un cerebro.
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
                Socialcors analiza constantemente tu nicho y la viralidad de contenido similar,
                y decide la hora exacta de publicar según los seguidores y el comportamiento
                <strong className="font-black text-white"> reales de cada cliente</strong> — no un
                horario genérico igual para todos.
              </p>

              <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
                {[
                  { label: "Analiza tu nicho", desc: "Detecta qué funciona en cuentas parecidas a la tuya, en tiempo real." },
                  { label: "Mide viralidad", desc: "Compara tu contenido contra lo que ya está funcionando en tu sector." },
                  { label: "Decide tu hora exacta", desc: "Cada cliente tiene una hora distinta, calculada con sus propios datos." },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/15 bg-white/5 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/10 hover:shadow-[0_12px_28px_rgba(0,0,0,0.25)]"
                  >
                    <p className="text-sm font-black text-white">{item.label}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/65">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── PLANES ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              Precios
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Planes simples, cadencia real cada semana
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm" style={{ color: MUTED }}>
              Cada plan reparte tus publicaciones a lo largo de la semana — sin saturar ningún día.
            </p>
          </motion.div>

          {/* Toggle */}
          <div className="mt-8 flex justify-center">
            <div className="flex overflow-hidden rounded-xl border border-black/[0.06] bg-white p-1 shadow-[0_1px_3px_rgba(15,15,35,0.06)]">
              {(["influencer", "empresa"] as PricingTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className="rounded-lg px-6 py-2 text-sm font-bold capitalize transition-all duration-200"
                  style={
                    pricingTab === tab
                      ? {
                          background: tab === "empresa"
                            ? `linear-gradient(90deg, ${ACCENT2_SOFT}, ${ACCENT2})`
                            : `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT})`,
                          color: "#fff",
                        }
                      : { color: MUTED }
                  }
                >
                  {tab === "influencer" ? "Influencer" : "Empresa"}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div
            className="mx-auto mt-10 grid max-w-5xl grid-cols-1 items-start gap-5 sm:grid-cols-3"
            style={{
              opacity: pricingVisible ? 1 : 0,
              transform: pricingVisible ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            {activePlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                {...fadeUp}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
              >
                <PlanCard plan={plan} />
              </motion.div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs" style={{ color: `${MUTED}99` }}>
            Todos los planes incluyen 15 días gratis sin tarjeta de crédito
          </p>
        </div>
      </section>

      {/* ── DIFERENCIADOR ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              Por qué no somos un programador de publicaciones
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Herramientas tradicionales vs. Socialcors
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl border border-red-200 bg-red-50/60 p-7"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-4 py-2">
                <span className="text-sm">❌</span>
                <span className="text-xs font-bold text-red-600">Herramientas tradicionales</span>
              </div>
              <p className="text-lg font-black leading-snug" style={{ color: INK }}>
                Tú creas, tú programas, tú analizas.
              </p>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
              className="rounded-2xl border-2 p-7"
              style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}0d` }}
            >
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2"
                style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}1a` }}
              >
                <span className="text-sm">✅</span>
                <span className="text-xs font-bold" style={{ color: ACCENT_STRONG }}>Socialcors</span>
              </div>
              <p className="text-lg font-black leading-snug" style={{ color: INK }}>
                Nosotros lo hacemos todo por ti.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SÍGUENOS ──────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              Síguenos
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Nuestro contenido, hecho con Socialcors
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_LINKS.map((link, i) => (
              <motion.a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                {...fadeUp}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
                className="flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(15,15,35,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,15,35,0.10)]"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}, ${ACCENT})` }}
                >
                  {link.badge}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black" style={{ color: INK }}>{link.label}</p>
                  <p className="truncate text-xs" style={{ color: MUTED }}>{link.handle}</p>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="px-6 py-16">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl py-16 text-center"
          style={{ background: `linear-gradient(135deg, ${ACCENT_STRONG}, ${ACCENT} 55%, ${ACCENT_DEEP})` }}
        >
          <motion.div
            className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-[100px]"
            animate={{ x: [0, 25, 0], y: [0, 15, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-cyan-300/10 blur-[110px]"
            animate={{ x: [0, -20, 0], y: [0, -25, 0] }}
            transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-6 px-6">
            <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
              Empieza gratis hoy
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {["15 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm text-white/80">
                  <span className="font-black text-emerald-300">✓</span>
                  {item}
                </span>
              ))}
            </div>
            <Link
              href="/socialflow/auth"
              className="sc-cta-glow sc-cta-shine sc-cta-shine-dark inline-flex items-center gap-2 rounded-xl bg-white px-10 py-4 text-base font-black transition-all hover:-translate-y-0.5 hover:brightness-95"
              style={{ color: ACCENT_STRONG }}
            >
              Prueba 15 días gratis, sin tarjeta →
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/5 py-10" style={{ backgroundColor: BG }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}, ${ACCENT})` }}
              >
                <span className="text-[10px] font-black text-white">SC</span>
              </div>
              <span className="text-base font-black" style={{ color: INK }}>Socialcors</span>
            </div>
            {/* Links */}
            <div className="flex items-center gap-5">
              {[
                { label: "Términos", href: "/terminos" },
                { label: "Privacidad", href: "/privacidad" },
                { label: "Contacto", href: "/contacto" },
              ].map((l) => (
                <Link key={l.label} href={l.href} className="text-xs transition-colors hover:opacity-70" style={{ color: `${INK}80` }}>
                  {l.label}
                </Link>
              ))}
            </div>
            {/* Copyright */}
            <p className="text-xs" style={{ color: `${INK}55` }}>
              © 2025 Socialcors by Drako. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

    </div>

    <ChatWidget />
    </>
  );
}
