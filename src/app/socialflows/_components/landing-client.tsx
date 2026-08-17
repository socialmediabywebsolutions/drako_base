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
// CTA final, diferenciador, footer). El hero es la única excepción deliberada: usa las
// identidades de marca de Instagram/LinkedIn (ver HERO_SIDES) para hablarle a cada
// audiencia en "su" color desde el primer segundo.
const ACCENT_SOFT = "#6D5DFB";
const ACCENT = "#4338CA";
const ACCENT_STRONG = "#2B2483";
// Extremo más oscuro para los paneles de fondo oscuro (El Cerebro, CTA final).
const ACCENT_DEEP = "#0D0B28";

// Turquesa "brillo solar" — acento secundario, acotado al badge del hero y al degradado
// animado del titular, para que el morado siga siendo el dominante.
const ACCENT2 = "#00C2A8";
const ACCENT2_STRONG = "#0F766E"; // versión oscura, para texto legible sobre fondo claro

// Colores de marca de red social — solo para el hero dividido y las fichas de "Síguenos",
// nunca para el resto del sitio (que se queda en el morado dominante de arriba).
const IG_PINK = "#DD2A7B";
const LI_BLUE = "#0A66C2";

// Variante de entrada compartida por los bloques principales (scroll reveal): fade + slide-up
// sutil de ~20px, se dispara una sola vez al entrar en el viewport.
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────
type HeroPlan = {
  name: string;
  price: string;
  period: string;
  stats: string[];
  popular?: boolean;
};

type HeroSideConfig = {
  key: "influencer" | "empresa";
  bgGradient: string;
  badgeLabel: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  plans: HeroPlan[];
  popularBg: string;
  explainerText: string;
  ctaGradient: string;
  ctaGlowClass: string;
  ctaLabel: string;
};

type SocialLink = {
  network: "instagram" | "linkedin";
  name: string;
  handle: string;
  href: string;
  initials: string;
  followers: number;
  posts: number | null;
};

// ─── Data ──────────────────────────────────────────────────────────────────────
const IG_CIRCLE = "linear-gradient(135deg,#F58529,#DD2A7B)";
const LI_LI_CIRCLE = "linear-gradient(135deg,#6D5DFB,#4338CA)"; // pasos "diseño/creación" — morado dominante
const HANDOFF_CIRCLE = "linear-gradient(135deg,#DD2A7B,#0A66C2)"; // paso 7: publica en ambas redes

const HOW_IT_WORKS = [
  { num: "1", title: "Subes la foto", sub: "móvil u ordenador", circle: IG_CIRCLE },
  { num: "2", title: "Analiza contexto", sub: "personas, lugar, producto", circle: IG_CIRCLE },
  { num: "3", title: "Diseña contenido", sub: "formato por red social", circle: LI_LI_CIRCLE },
  { num: "4", title: "Escribe el caption", sub: "tu voz + hashtags", circle: IG_CIRCLE },
  { num: "5", title: "Crea reel/carrusel", sub: "animado automático", circle: LI_LI_CIRCLE },
  { num: "6", title: "Elige el momento", sub: "hora exacta tu audiencia", circle: LI_BLUE },
  { num: "7", title: "Publica automático", sub: "Instagram y LinkedIn", circle: HANDOFF_CIRCLE },
  { num: "8", title: "Mide y aprende", sub: "mejora el siguiente", circle: LI_BLUE },
  { num: "9", title: "Responde", sub: "comentarios y DMs", circle: IG_CIRCLE },
];

const AI_AGENTS = [
  { network: "instagram" as const, name: "Visual Agent", text: "Analiza la foto — detecta personas, lugar, productos y emoción." },
  { network: "instagram" as const, name: "Strategy Agent", text: "Cruza con tu Knowledge Base — entiende tu marca, voz y audiencia." },
  { network: "instagram" as const, name: "Trend Agent", text: "Detecta qué está siendo viral en tu nicho ahora mismo." },
  { network: "instagram" as const, name: "Copywriter Agent", text: "Escribe el caption en tu voz + hashtags con tracción real." },
  { network: "linkedin" as const, name: "Best Time Agent", text: "Calcula la hora exacta según el comportamiento real de tu audiencia." },
  { network: "linkedin" as const, name: "Publisher Agent", text: "Publica en Instagram y LinkedIn en el momento exacto." },
  { network: "linkedin" as const, name: "Analytics Agent", text: "Mide resultados reales y mejora automáticamente el siguiente contenido." },
  { network: "instagram" as const, name: "Community Agent", text: "Responde comentarios y DMs usando el conocimiento de tu marca." },
];

const HERO_SIDES: HeroSideConfig[] = [
  {
    key: "influencer",
    bgGradient: "linear-gradient(160deg, #FDF0F8 0%, #F8EEFF 60%, #F0EEFF 100%)",
    badgeLabel: "INFLUENCER · INSTAGRAM",
    badgeColor: IG_PINK,
    title: "Sube una foto. La IA lo hace todo.",
    subtitle: "Analiza, escribe el caption, elige hashtags y publica en el mejor momento para tu audiencia real.",
    plans: [
      { name: "Starter", price: "99€", period: "/mes", stats: ["8 piezas/semana", "máx. 2/día", "6 vídeos IA/mes", "1 historia/día"] },
      { name: "Básico", price: "179€", period: "/mes", popular: true, stats: ["12 piezas/semana", "máx. 2/día", "12 vídeos IA/mes", "2 historias/día", "LinkedIn incluido"] },
      { name: "Pro", price: "299€", period: "/mes", stats: ["14 piezas/semana", "máx. 2/día", "20 vídeos IA/mes", "CRM Social", "Cerebro completo"] },
    ],
    popularBg: "linear-gradient(90deg, #F58529, #DD2A7B)",
    explainerText: "Publicamos de forma constante sin saturar tu audiencia. El límite diario protege tu alcance orgánico — el algoritmo penaliza las cuentas que publican más de 2 veces al día. Tu plan semanal se reparte automáticamente para que siempre estés presente sin perder visibilidad.",
    ctaGradient: "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)",
    ctaGlowClass: "sc-cta-glow-ig",
    ctaLabel: "Soy Influencer →",
  },
  {
    key: "empresa",
    bgGradient: "linear-gradient(160deg, #F0F7FF 0%, #EEF4FF 60%, #EEF2FF 100%)",
    badgeLabel: "EMPRESA · LINKEDIN",
    badgeColor: LI_BLUE,
    title: "Solo saca la foto. Nosotros hacemos el resto.",
    subtitle: "La IA reconoce empleados, local y productos. Genera el texto y publica en Instagram y LinkedIn.",
    plans: [
      { name: "Starter", price: "169€", period: "/mes", stats: ["8 piezas/semana", "máx. 2/día", "6 vídeos IA/mes", "1 historia/día"] },
      { name: "Básico", price: "299€", period: "/mes", popular: true, stats: ["12 piezas/semana", "máx. 2/día", "12 vídeos IA/mes", "2 historias/día", "LinkedIn incluido"] },
      { name: "Pro", price: "449€", period: "/mes", stats: ["14 piezas/semana", "máx. 2/día", "20 vídeos IA/mes", "CRM Social", "LinkedIn Company Page"] },
    ],
    popularBg: LI_BLUE,
    explainerText: "Cada publicación está pensada para construir reputación y generar confianza. En LinkedIn, publicar más de 1 vez al día reduce el alcance hasta un 66% — por eso tu plan distribuye el contenido de forma inteligente a lo largo de la semana, llegando a más personas con menos publicaciones.",
    ctaGradient: "linear-gradient(90deg, #0A66C2, #0077B5)",
    ctaGlowClass: "sc-cta-glow-li",
    ctaLabel: "Soy Empresa →",
  },
];

const OLD_WAY_POINTS = [
  "Solo programan posts — tú sigues creando todo",
  "Muestran métricas pero no actúan sobre ellas",
  "Texto genérico sin conocer tu marca ni tu voz",
  "No aprenden de tu audiencia real",
  "No responden comentarios ni DMs",
  "No detectan tendencias ni oportunidades",
];

const SOCIALCORS_POINTS = [
  "Crea, diseña, escribe y publica por ti",
  "Analiza resultados y mejora el siguiente contenido solo",
  "Aprende tu voz, tu estilo y tu marca desde el día 1",
  "Detecta tendencias virales en tu nicho en tiempo real",
  "Responde comentarios y DMs con tu conocimiento de marca",
  "Cada cliente tiene su hora de publicación calculada con sus datos reales",
];

const NETWORK_COLOR: Record<SocialLink["network"], string> = {
  instagram: IG_PINK,
  linkedin: LI_BLUE,
};

const SOCIAL_LINKS: SocialLink[] = [
  { network: "instagram", name: "Socialcors", handle: "@socialcors", href: "https://www.instagram.com/socialcors/", initials: "SC", followers: 2, posts: 0 },
  { network: "linkedin", name: "Socialcors", handle: "Página de empresa", href: "https://www.linkedin.com/company/socialcors/", initials: "SC", followers: 0, posts: 0 },
  { network: "instagram", name: "Drako Systems", handle: "@drako.systems", href: "https://www.instagram.com/drako.systems/", initials: "DS", followers: 0, posts: 0 },
  { network: "linkedin", name: "Drako Systems", handle: "Página de empresa", href: "https://www.linkedin.com/company/drako-systems/", initials: "DS", followers: 0, posts: 0 },
  { network: "linkedin", name: "Cristóbal Cors Bernal", handle: "Founder · Drako Systems", href: "https://www.linkedin.com/in/cris-cors/", initials: "CB", followers: 0, posts: null },
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
function HeroPlanCard({ plan, popularBg }: { plan: HeroPlan; popularBg: string }) {
  return (
    <div
      className={[
        "relative rounded-xl border bg-white/85 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5",
        plan.popular
          ? "border-transparent shadow-[0_6px_20px_rgba(15,15,35,0.10)] hover:shadow-[0_10px_26px_rgba(15,15,35,0.16)]"
          : "border-black/[0.06] shadow-[0_1px_3px_rgba(15,15,35,0.05)] hover:shadow-[0_10px_22px_rgba(15,15,35,0.08)]",
      ].join(" ")}
    >
      {plan.popular && (
        <span
          className="absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow"
          style={{ background: popularBg }}
        >
          Popular
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-black" style={{ color: INK }}>{plan.name}</h4>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black" style={{ color: INK }}>{plan.price}</span>
          <span className="text-[11px]" style={{ color: MUTED }}>{plan.period}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-relaxed" style={{ color: MUTED }}>
        {plan.stats.join(" · ")}
      </p>
    </div>
  );
}

function HeroColumn({ config }: { config: HeroSideConfig }) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col px-6 pb-14 pt-28 sm:px-10 md:pb-20 lg:px-14"
      style={{ background: config.bgGradient, height: "100%" }}
    >
      <div
        className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
        style={{ borderColor: `${config.badgeColor}40`, backgroundColor: `${config.badgeColor}14` }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: config.badgeColor }} />
        <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: config.badgeColor }}>
          {config.badgeLabel}
        </span>
      </div>

      <h2 className="max-w-md text-3xl font-black leading-[1.1] tracking-tight md:text-4xl" style={{ color: INK }}>
        {config.title}
      </h2>
      <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: MUTED }}>
        {config.subtitle}
      </p>

      <div className="mt-8 max-w-md space-y-3">
        {config.plans.map((plan) => (
          <HeroPlanCard key={plan.name} plan={plan} popularBg={config.popularBg} />
        ))}
      </div>

      <p className="mt-6 max-w-md text-sm leading-relaxed" style={{ color: `${INK}99` }}>
        {config.explainerText}
      </p>

      <div style={{ marginTop: "auto", paddingTop: 32 }}>
        <Link
          href={`/socialflow/planes?type=${config.key}`}
          className={`${config.ctaGlowClass} sc-cta-shine inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-black text-white transition-all hover:brightness-110 hover:-translate-y-0.5`}
          style={{ background: config.ctaGradient }}
        >
          {config.ctaLabel}
        </Link>
        <p className="mt-3 text-xs font-semibold" style={{ color: MUTED }}>
          15 días gratis · sin tarjeta
        </p>
      </div>
    </motion.div>
  );
}

function SocialCard({ link, delay }: { link: SocialLink; delay: number }) {
  const color = NETWORK_COLOR[link.network];
  const isInstagram = link.network === "instagram";
  const buttonBg = isInstagram ? "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)" : LI_BLUE;
  const glowClass = isInstagram ? "sc-cta-glow-ig" : "sc-cta-glow-li";
  const networkLabel = isInstagram ? "Instagram" : "LinkedIn";

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={
        isInstagram
          ? "cursor-pointer rounded-xl bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(221,42,123,0.22)]"
          : "cursor-pointer rounded-xl bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(10,102,194,0.22)]"
      }
      style={{ border: `1.5px solid ${color}` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex shrink-0 items-center justify-center rounded-full font-black text-white"
          style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${color}cc, ${color})`, fontSize: "16px" }}
        >
          {link.initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-black" style={{ fontSize: "13px", color: INK }}>{link.name}</p>
          <p className="truncate" style={{ fontSize: "11px", color: MUTED }}>{link.handle}</p>
        </div>
      </div>

      <div className="my-3" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }} />

      <div className="mb-4 flex gap-6">
        <div>
          <p className="font-black leading-none" style={{ fontSize: "18px", color: INK }}>{link.followers}</p>
          <p className="mt-1 uppercase tracking-wide" style={{ fontSize: "9px", color: "#94a3b8" }}>Seguidores</p>
        </div>
        {link.posts !== null && (
          <div>
            <p className="font-black leading-none" style={{ fontSize: "18px", color: INK }}>{link.posts}</p>
            <p className="mt-1 uppercase tracking-wide" style={{ fontSize: "9px", color: "#94a3b8" }}>Posts</p>
          </div>
        )}
      </div>

      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${glowClass} sc-cta-shine block w-full text-center text-white transition-all hover:brightness-110`}
        style={{ background: buttonBg, borderRadius: 8, padding: 8, fontSize: 11, fontWeight: 700 }}
      >
        Seguir en {networkLabel} →
      </a>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingClient() {
  const scrolled = useScrolledNav();

  return (
    <>
    <div className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ backgroundColor: BG }}>
      <style>{`
        html {
          scroll-behavior: smooth;
        }

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
              href="#hero-dividido"
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

          {/* Cómo funciona */}
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }} className="mt-10">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              CÓMO FUNCIONA
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Lo que pasa desde que subes tu foto
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm" style={{ color: MUTED }}>
              Todo ocurre automáticamente, en segundos
            </p>
          </motion.div>

          <div
            className="px-6"
            style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", marginTop: 32, overflowX: "auto", paddingBottom: 8 }}
          >
            <div className="mx-auto" style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8, width: "max-content" }}>
              {HOW_IT_WORKS.map((step, i) => [
                <motion.div
                  key={`step-${step.num}`}
                  {...fadeUp}
                  transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.06 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, maxWidth: 80 }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: step.circle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {step.num}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.3 }}>{step.title}</span>
                  <span style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.3 }}>{step.sub}</span>
                </motion.div>,
                i < HOW_IT_WORKS.length - 1 ? (
                  <span key={`arrow-${step.num}`} style={{ color: "#c4b5fd", fontSize: 16, marginTop: 8, flexShrink: 0 }}>
                    →
                  </span>
                ) : null,
              ])}
            </div>
          </div>

          {/* Sub */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: MUTED }}>
            Para creadores de contenido y para empresas: sube una foto y nosotros analizamos,
            creamos, publicamos y aprendemos por ti.
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#hero-dividido"
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

      {/* ── HERO DIVIDIDO ─────────────────────────────────────────────────── */}
      <section id="hero-dividido" className="relative scroll-mt-20 overflow-hidden">
        <div className="relative grid grid-cols-1 md:grid-cols-2">
          {HERO_SIDES.map((side) => (
            <HeroColumn key={side.key} config={side} />
          ))}
          {/* Fusión suave entre las dos columnas — sustituye al border-right duro */}
          <div
            className="pointer-events-none absolute hidden md:block"
            style={{
              left: "50%",
              top: 0,
              bottom: 0,
              width: "220px",
              transform: "translateX(-50%)",
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(200,150,255,0.2) 15%,
                rgba(160,130,255,0.42) 40%,
                rgba(140,120,255,0.42) 50%,
                rgba(160,130,255,0.42) 60%,
                rgba(200,150,255,0.2) 85%,
                transparent 100%
              )`,
            }}
          />
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
              Cuentas reales gestionadas por Socialcors
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm" style={{ color: MUTED }}>
              Seguimos creciendo — esto es lo que la IA hace por nosotros mismos
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_LINKS.map((link, i) => (
              <SocialCard key={link.href} link={link} delay={i * 0.08} />
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
            style={{ background: "linear-gradient(160deg,#F0FDF9 0%,#E8FFF9 50%,#F0F7FF 100%)" }}
          >
            {/* Glow orbs decorativos — drift lento tipo float, discretos, nunca protagonistas.
                Recoloreados a tonos claros ahora que el panel tiene fondo claro (antes eran
                blancos/violeta oscuro, pensados para el panel oscuro anterior). */}
            <motion.div
              className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-[100px]"
              animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-violet-200/40 blur-[110px]"
              animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative">
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
                style={{ borderColor: `${ACCENT2}40`, backgroundColor: `${ACCENT2}14` }}
              >
                <span className="text-lg">🧠</span>
                <span className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT2_STRONG }}>
                  El diferenciador real
                </span>
              </div>

              <h2 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-5xl" style={{ color: INK }}>
                No es un programador de publicaciones. Es un cerebro.
              </h2>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: `${INK}cc` }}>
                Socialcors analiza constantemente tu nicho y la viralidad de contenido similar,
                y decide la hora exacta de publicar según los seguidores y el comportamiento
                <strong className="font-black" style={{ color: INK }}> reales de cada cliente</strong> — no un
                horario genérico igual para todos.
              </p>

              <div className="mx-auto mt-12 max-w-3xl">
                <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                  LOS AGENTES
                </p>
                <p className="mt-2 text-center text-sm" style={{ color: MUTED }}>
                  8 agentes trabajando en paralelo, 24/7
                </p>
              </div>

              <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                {AI_AGENTS.map((agent, i) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.06 }}
                  >
                    <div
                      className={
                        agent.network === "instagram"
                          ? "rounded-[10px] border-[1.5px] bg-white p-[14px] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_28px_rgba(221,42,123,0.25)]"
                          : "rounded-[10px] border-[1.5px] bg-white p-[14px] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_28px_rgba(10,102,194,0.25)]"
                      }
                      style={{ borderColor: agent.network === "instagram" ? IG_PINK : LI_BLUE }}
                    >
                      <span
                        className="mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                        style={{ background: agent.network === "instagram" ? "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)" : LI_BLUE }}
                      >
                        {agent.network === "instagram" ? "Instagram" : "LinkedIn"}
                      </span>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: INK }}>{agent.name}</p>
                      <p className="mt-1 leading-relaxed" style={{ fontSize: "10px", color: MUTED }}>{agent.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── DIFERENCIADOR ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              LA DIFERENCIA
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              ¿Por qué Socialcors y no otra herramienta?
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="rounded-2xl p-7"
              style={{ backgroundColor: "#FFF5F5", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-4 py-2">
                <span className="text-sm">❌</span>
                <span className="text-xs font-bold text-red-600">Herramientas tradicionales</span>
              </div>
              <ul className="space-y-3">
                {OLD_WAY_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm" style={{ color: `${INK}cc` }}>
                    <span className="mt-px shrink-0 font-black text-red-600">✗</span>
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
              className="rounded-2xl p-7"
              style={{ backgroundColor: "#F0FDF9", border: `1px solid ${ACCENT2}4d` }}
            >
              <div
                className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: `linear-gradient(90deg, ${ACCENT2}, ${ACCENT})` }}
              >
                <span className="text-sm">✅</span>
                <span className="text-xs font-bold text-white">Socialcors</span>
              </div>
              <ul className="space-y-3">
                {SOCIALCORS_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm" style={{ color: `${INK}cc` }}>
                    <span className="mt-px shrink-0 font-black" style={{ color: ACCENT2 }}>✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
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
