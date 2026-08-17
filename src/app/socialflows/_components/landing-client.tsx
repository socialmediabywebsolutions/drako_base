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
const HOW_IT_WORKS = [
  { num: "1", icon: "📸", title: "Subes una foto", text: "Desde el móvil o el ordenador. Sin plantillas ni formularios — solo la foto que ya has hecho hoy." },
  { num: "2", icon: "🔍", title: "La IA analiza el contexto", text: "Detecta quién aparece, dónde estás y qué producto o servicio muestra la imagen." },
  { num: "3", icon: "🎨", title: "Genera la imagen optimizada", text: "Ajusta formato, composición y estilo según Instagram o LinkedIn automáticamente." },
  { num: "4", icon: "✍️", title: "Escribe el contenido completo", text: "Caption en tu voz, hashtags con tracción real y CTA adaptado a tu objetivo." },
  { num: "5", icon: "🎬", title: "Crea el carrusel o el reel", text: "Si aplica, diseña los slides o anima el vídeo con efectos visuales automáticamente." },
  { num: "6", icon: "⏰", title: "Elige el mejor momento", text: "Calcula la hora exacta de publicación según el comportamiento real de tu audiencia." },
  { num: "7", icon: "🚀", title: "Publica y agenda", text: "En Instagram y LinkedIn, en el momento exacto, sin que toques nada más." },
  { num: "8", icon: "📊", title: "Mide y aprende", text: "Analiza los resultados reales y mejora automáticamente el siguiente contenido." },
];

const AI_AGENTS = [
  { num: "1", network: "instagram" as const, icon: "📸", name: "Visual Agent", text: "Analiza la foto — detecta personas, lugar, productos y emoción." },
  { num: "2", network: "instagram" as const, icon: "🧠", name: "Strategy Agent", text: "Cruza con tu Knowledge Base — entiende tu marca, voz y audiencia." },
  { num: "3", network: "instagram" as const, icon: "🔥", name: "Trend Agent", text: "Detecta qué está siendo viral en tu nicho ahora mismo." },
  { num: "4", network: "instagram" as const, icon: "✍️", name: "Copywriter Agent", text: "Escribe el caption en tu voz + hashtags con tracción real." },
  { num: "5", network: "linkedin" as const, icon: "⏰", name: "Best Time Agent", text: "Calcula la hora exacta según el comportamiento real de tu audiencia." },
  { num: "6", network: "linkedin" as const, icon: "🚀", name: "Publisher Agent", text: "Publica en Instagram y LinkedIn en el momento exacto." },
  { num: "7", network: "linkedin" as const, icon: "📊", name: "Analytics Agent", text: "Mide resultados reales y mejora automáticamente el siguiente contenido." },
  { num: "8", network: "instagram" as const, icon: "💬", name: "Community Agent", text: "Responde comentarios y DMs usando el conocimiento de tu marca." },
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

const NETWORK_COLOR: Record<SocialLink["network"], string> = {
  instagram: IG_PINK,
  linkedin: LI_BLUE,
};

const SOCIAL_LINKS: SocialLink[] = [
  { network: "instagram", name: "Socialcors", handle: "@socialcors", href: "https://www.instagram.com/socialcors/", initials: "SC", followers: 2, posts: 0 },
  { network: "linkedin", name: "Socialcors", handle: "Página de empresa", href: "https://www.linkedin.com/company/socialcors/", initials: "SC", followers: 0, posts: 0 },
  { network: "instagram", name: "Drako Systems", handle: "@drako.systems", href: "https://www.instagram.com/drako.systems/", initials: "DS", followers: 0, posts: 0 },
  { network: "linkedin", name: "Drako Systems", handle: "Página de empresa", href: "https://www.linkedin.com/company/drako-systems/", initials: "DS", followers: 0, posts: 0 },
  { network: "linkedin", name: "Cristóbal Cors Bernal", handle: "Founder", href: "https://www.linkedin.com/in/cris-cors/", initials: "CB", followers: 0, posts: null },
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
      className="relative px-6 pb-14 pt-28 sm:px-10 md:pb-20 lg:px-14"
      style={{ background: config.bgGradient }}
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

      <div className="mt-8">
        <Link
          href="/socialflow/auth"
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
  return (
    <motion.a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      {...fadeUp}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className="flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_3px_rgba(15,15,35,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,15,35,0.10)]"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
        style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
      >
        {link.initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black" style={{ color: INK }}>{link.name}</p>
        <p className="truncate text-xs" style={{ color: MUTED }}>{link.handle}</p>
        <p className="mt-1 text-xs font-semibold" style={{ color: `${INK}99` }}>
          {link.followers} seguidor{link.followers !== 1 ? "es" : ""}
          {link.posts !== null ? ` · ${link.posts} publicacion${link.posts !== 1 ? "es" : ""}` : ""}
        </p>
      </div>
    </motion.a>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingClient() {
  const scrolled = useScrolledNav();

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

      {/* ── HERO DIVIDIDO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
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
              Nuestro contenido, hecho con Socialcors
            </h2>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOCIAL_LINKS.map((link, i) => (
              <SocialCard key={link.href} link={link} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
            <p className="text-center text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              EL PROCESO
            </p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl" style={{ color: INK }}>
              Cómo funciona
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm" style={{ color: MUTED }}>
              De la foto al resultado — sin tocar nada más
            </p>
          </motion.div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
              >
                <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(15,15,35,0.06)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_14px_30px_rgba(67,56,202,0.16)]">
                  <span
                    className="pointer-events-none absolute -right-2 -top-4 text-7xl font-black leading-none"
                    style={{ color: ACCENT, opacity: 0.06 }}
                  >
                    {step.num}
                  </span>
                  <div
                    className="relative mb-4 flex items-center justify-center rounded-[10px]"
                    style={{ width: 40, height: 40, backgroundColor: `${ACCENT}1a` }}
                  >
                    <span style={{ fontSize: "20px", lineHeight: 1 }}>{step.icon}</span>
                  </div>
                  <h3 className="relative text-base font-black" style={{ color: INK }}>{step.title}</h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed" style={{ color: MUTED }}>{step.text}</p>
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
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          >
            {/* Glow orbs decorativos — drift lento tipo float, discretos, nunca protagonistas */}
            <motion.div
              className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-[100px]"
              animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-violet-400/10 blur-[110px]"
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

              <div className="mx-auto mt-12 max-w-3xl">
                <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                  LOS AGENTES
                </p>
                <p className="mt-2 text-center text-sm text-white/80">
                  8 agentes trabajando en paralelo, 24/7
                </p>
              </div>

              <div className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                {AI_AGENTS.map((agent, i) => (
                  <motion.div
                    key={agent.num}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.06 }}
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20">
                      <span
                        className="pointer-events-none absolute -right-2 -top-3 text-6xl font-black leading-none text-white"
                        style={{ opacity: 0.08 }}
                      >
                        {agent.num}
                      </span>
                      <div
                        className="relative mb-3 flex items-center justify-center rounded-lg bg-white/10"
                        style={{ width: 36, height: 36 }}
                      >
                        <span style={{ fontSize: "18px", lineHeight: 1 }}>{agent.icon}</span>
                      </div>
                      <span
                        className="relative mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
                        style={{ background: agent.network === "instagram" ? "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)" : LI_BLUE }}
                      >
                        {agent.network === "instagram" ? "Instagram" : "LinkedIn"}
                      </span>
                      <p className="relative text-sm font-black text-white">{agent.name}</p>
                      <p className="relative mt-1 text-xs leading-relaxed text-white/70">{agent.text}</p>
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
