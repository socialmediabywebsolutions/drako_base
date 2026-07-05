"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ChatWidget from "./chat-widget";

// ─── Types ─────────────────────────────────────────────────────────────────────
type PricingTab = "influencer" | "empresa";

type StatsData = {
  active_clients: number;
  published_posts: number;
  scheduled_posts: number;
};

// ─── Data ──────────────────────────────────────────────────────────────────────
const ROTATING_PHRASES = [
  "mientras tú creces",
  "mientras tú vendes",
  "mientras tú vives",
  "mientras tú duermes",
];

const AGENTS = [
  { num: "01", name: "Agente de Tendencias",    desc: "Detecta tendencias virales en tu nicho" },
  { num: "02", name: "Agente de Redacción",      desc: "Genera captions con tu voz única" },
  { num: "03", name: "Agente de Estrategia",     desc: "Planifica tu contenido del mes" },
  { num: "04", name: "Agente de Palabras Clave", desc: "Optimiza hashtags y SEO social" },
  { num: "05", name: "Agente de Competencia",    desc: "Analiza a tu competencia en tiempo real" },
  { num: "06", name: "Agente de Publicación",    desc: "Publica en el momento óptimo" },
  { num: "07", name: "Agente de Comunidad",      desc: "Responde comentarios y DMs" },
  { num: "08", name: "Agente de Oportunidades",  desc: "Detecta y clasifica leads" },
];

const INFLUENCER_FEATURES = [
  "Sube tu foto, la IA genera todo",
  "Captions en tu voz y estilo",
  "Hashtags optimizados por tendencias",
  "Publicación automática en Instagram y TikTok",
  "Detecta colaboraciones y sponsors en tus DMs",
  "Crece sin esfuerzo manual",
];

const EMPRESA_FEATURES = [
  "Base de Conocimiento con tu web, PDFs y catálogo",
  "Voz de marca consistente en todas las redes",
  "Responde comentarios y DMs automáticamente",
  "Detecta leads y genera presupuestos",
  "Analiza reseñas de Google Business",
  "Informes mensuales en PDF",
];

const PLANS_INFLUENCER = [
  {
    id: "influencer-basico",
    name: "Influencer Básico",
    price: "49€",
    period: "/mes",
    networks: "Instagram + TikTok",
    posts: "30 posts/mes por red",
    features: [
      "Sube fotos, IA genera captions",
      "Hashtags por tendencias",
      "Publicación automática",
      "Comunidad y leads básico",
    ],
    highlight: false,
  },
  {
    id: "influencer-pro",
    name: "Influencer Pro",
    price: "99€",
    period: "/mes",
    networks: "Instagram + TikTok + Facebook + YouTube",
    posts: "60 posts/mes por red",
    badge: "MÁS POPULAR",
    features: [
      "Todo lo de Básico",
      "IA genera imágenes",
      "Oportunidades y sponsors",
      "WhatsApp orquestador",
    ],
    highlight: true,
  },
];

const PLANS_EMPRESA = [
  {
    id: "empresa-basica",
    name: "Empresa Básica",
    price: "79€",
    period: "/mes",
    networks: "Instagram + Facebook + LinkedIn",
    posts: "30 posts/mes por red",
    features: [
      "Base de Conocimiento",
      "CRM Social",
      "Respuesta automática",
      "Informe PDF mensual",
      "2 usuarios",
    ],
    highlight: false,
  },
  {
    id: "empresa-pro",
    name: "Empresa Pro",
    price: "149€",
    period: "/mes",
    networks: "Instagram + TikTok + Facebook + LinkedIn + Pinterest",
    posts: "60 posts/mes por red",
    badge: "MÁS POPULAR",
    features: [
      "Todo lo de Básico",
      "Leads desde DMs",
      "Presupuestos automáticos",
      "Usuarios ilimitados",
      "WhatsApp orquestador",
    ],
    highlight: true,
  },
];

// ─── Hooks ─────────────────────────────────────────────────────────────────────
function useRotatingText(phrases: string[], interval = 2500) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setVisible(true);
      }, 300);
    }, interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return { text: phrases[index], visible };
}

function useCountUp(target: number, duration = 2000, active = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active || target === 0) {
      setValue(target);
      return;
    }
    const steps = 60;
    const stepDuration = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setValue(Math.round((current / steps) * target));
      if (current >= steps) clearInterval(timer);
    }, stepDuration);
    return () => clearInterval(timer);
  }, [target, duration, active]);

  return value;
}

function useScrolledNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrolled;
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, suffix = "" }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-5">
      <span className="text-4xl font-black tracking-tight text-white">
        {value}{suffix}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</span>
    </div>
  );
}

function CheckItem({ text, color = "text-violet-400" }: { text: string; color?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-white/70">
      <span className={`mt-px shrink-0 font-black ${color}`}>✓</span>
      {text}
    </li>
  );
}

function PlanCard({ plan, accentClass }: {
  plan: typeof PLANS_INFLUENCER[number];
  accentClass: string;
}) {
  return (
    <div className={[
      "relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1",
      plan.highlight
        ? `border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30 hover:border-violet-400/80 hover:shadow-xl hover:shadow-violet-500/20`
        : "border-white/10 bg-white/5 hover:border-white/25 hover:shadow-lg hover:shadow-black/40",
    ].join(" ")}>
      {plan.badge && (
        <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full ${accentClass} px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg`}>
          {plan.badge}
        </span>
      )}
      <div className="mb-5">
        <h3 className="text-xl font-black text-white">{plan.name}</h3>
        <p className="mt-1 text-xs font-semibold text-white/40">{plan.networks}</p>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-5xl font-black text-white">{plan.price}</span>
          <span className="text-sm text-white/40">{plan.period}</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-violet-300/80">{plan.posts}</p>
      </div>
      <ul className="mb-7 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-white/65">
            <span className="mt-px shrink-0 text-[13px] font-black text-violet-400">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/socialflow/auth"
        className={[
          "block w-full rounded-xl py-3.5 text-center text-sm font-black tracking-wide text-white transition-all duration-200",
          plan.highlight
            ? `${accentClass} shadow-lg hover:brightness-110`
            : "border border-white/20 bg-white/10 hover:bg-white/15 hover:border-white/30",
        ].join(" ")}
      >
        Empezar gratis 7 días
      </Link>
    </div>
  );
}

// ─── Stats Section ─────────────────────────────────────────────────────────────
function StatsSection() {
  const { ref, inView } = useInView(0.3);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/socialflow/public/stats")
      .then((r) => r.json())
      .then((d: unknown) => setStats(d as StatsData))
      .catch(() => setStats({ active_clients: 0, published_posts: 0, scheduled_posts: 0 }));
  }, []);

  const clients   = useCountUp(stats?.active_clients ?? 0, 2000, inView && stats !== null);
  const published = useCountUp(stats?.published_posts ?? 0, 2000, inView && stats !== null);
  const scheduled = useCountUp(stats?.scheduled_posts ?? 0, 2000, inView && stats !== null);
  const hours     = useCountUp(Math.round((stats?.published_posts ?? 0) * 0.5), 2000, inView && stats !== null);

  const loading = stats === null;

  return (
    <section ref={ref} className="border-y border-white/5 bg-white/[0.03] py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-px bg-white/5 overflow-hidden rounded-2xl border border-white/5 sm:grid-cols-4">
          <StatCard label="Clientes activos"  value={loading ? "..." : clients.toLocaleString()} />
          <StatCard label="Posts publicados"  value={loading ? "..." : published.toLocaleString()} />
          <StatCard label="Posts programados" value={loading ? "..." : scheduled.toLocaleString()} />
          <StatCard label="Horas ahorradas"   value={loading ? "..." : hours.toLocaleString()} suffix="h" />
        </div>
        <p className="mt-5 text-center text-xs text-white/25">
          Números reales, actualizados en tiempo real
        </p>
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingClient() {
  const scrolled = useScrolledNav();
  const { text: rotatingText, visible: rotatingVisible } = useRotatingText(ROTATING_PHRASES);
  const [pricingTab, setPricingTab] = useState<PricingTab>("influencer");
  const [pricingVisible, setPricingVisible] = useState(true);
  const { ref: agentsRef, inView: agentsInView } = useInView(0.1);

  function switchTab(tab: PricingTab) {
    if (tab === pricingTab) return;
    setPricingVisible(false);
    setTimeout(() => {
      setPricingTab(tab);
      setPricingVisible(true);
    }, 200);
  }

  return (
    <>
    <div className="min-h-screen overflow-x-hidden bg-[#030312] font-sans antialiased">

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className={[
        "fixed top-0 z-50 w-full border-b transition-all duration-300",
        scrolled
          ? "border-white/10 bg-[#030312]/90 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      ].join(" ")}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
              <span className="text-xs font-black text-white">SC</span>
            </div>
            <span className="text-lg font-black tracking-tight text-white">Socialcors</span>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/socialflow/auth"
              className="hidden text-sm font-semibold text-white/60 transition-colors hover:text-white sm:block px-3 py-2"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/socialflow/auth"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:brightness-110 hover:shadow-violet-500/40"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20">
        {/* Orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[8%] h-[600px] w-[600px] rounded-full bg-violet-600/20 blur-[130px]" />
          <div className="absolute right-[-8%] top-[25%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/15 blur-[130px]" />
          <div className="absolute bottom-[5%] left-[35%] h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[110px]" />
        </div>
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pb-10 pt-7 text-center md:pb-12 md:pt-10">
          {/* Eyebrow */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300">
              Para influencers y empresas
            </span>
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
            Tu marketing en piloto automático
            <br />
            <span
              className="mt-2 inline-block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent transition-opacity duration-300"
              style={{ opacity: rotatingVisible ? 1 : 0 }}
            >
              {rotatingText}
            </span>
          </h1>

          {/* Sub */}
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/55">
            Si eres influencer o tienes un negocio, nuestros agentes IA publican, responden y venden por ti — sin que muevas un dedo.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/socialflow/auth?type=influencer"
              className="rounded-xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:brightness-110 hover:shadow-violet-500/50"
            >
              Soy Influencer →
            </Link>
            <Link
              href="/socialflow/auth?type=empresa"
              className="rounded-xl bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-500 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/25 transition-all hover:brightness-110 hover:shadow-blue-500/50"
            >
              Soy Empresa →
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["7 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm text-white/60">
                <span className="font-black text-violet-400">✓</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTADORES ────────────────────────────────────────────────────── */}
      {/* <StatsSection /> */}

      {/* ── REDES SOCIALES ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes net-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes net-rise {
          0% { opacity: 0; transform: translateY(0); }
          20% { opacity: 1; transform: translateY(-6px); }
          75% { opacity: 0.9; transform: translateY(-16px); }
          100% { opacity: 0; transform: translateY(-22px); }
        }
        .net-pill-0 { animation: net-float 3.2s ease-in-out 0.0s infinite; }
        .net-pill-1 { animation: net-float 3.5s ease-in-out 0.5s infinite; }
        .net-pill-2 { animation: net-float 3.8s ease-in-out 1.0s infinite; }
        .net-pill-3 { animation: net-float 3.4s ease-in-out 0.3s infinite; }
        .net-pill-4 { animation: net-float 3.6s ease-in-out 0.8s infinite; }
        .net-pill-5 { animation: net-float 3.3s ease-in-out 1.3s infinite; }
        .net-activity {
          position: absolute;
          top: -10px;
          right: 4px;
          font-size: 10px;
          font-weight: 900;
          color: #a78bfa;
          pointer-events: none;
          animation: net-rise 2.8s ease-out infinite;
        }
        .net-act-1 { animation-delay: 0.0s; animation-duration: 2.8s; }
        .net-act-2 { animation-delay: 1.4s; animation-duration: 3.5s; }
        .net-act-3 { animation-delay: 2.6s; animation-duration: 3.1s; }
      `}</style>
      <section className="border-b border-white/5 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
            Conecta todas tus redes
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {[
              { name: "Instagram", floatCls: "net-pill-0", activityCls: "net-act-1", bg: "linear-gradient(135deg,rgba(131,58,180,.13),rgba(253,29,29,.09),rgba(252,176,69,.08))", border: "rgba(188,62,138,.40)" },
              { name: "TikTok",    floatCls: "net-pill-1", activityCls: "net-act-2", bg: "rgba(18,18,18,.60)",                                                                      border: "rgba(98,234,235,.35)" },
              { name: "Facebook",  floatCls: "net-pill-2", activityCls: "",           bg: "rgba(24,119,242,.13)",                                                                    border: "rgba(24,119,242,.40)" },
              { name: "LinkedIn",  floatCls: "net-pill-3", activityCls: "",           bg: "rgba(10,102,194,.13)",                                                                    border: "rgba(10,102,194,.40)" },
              { name: "Pinterest", floatCls: "net-pill-4", activityCls: "",           bg: "rgba(230,0,35,.13)",                                                                      border: "rgba(230,0,35,.40)"   },
              { name: "YouTube",   floatCls: "net-pill-5", activityCls: "net-act-3", bg: "rgba(255,0,0,.13)",                                                                       border: "rgba(255,0,0,.40)"    },
            ].map((net) => (
              <div key={net.name} className={`relative ${net.floatCls}`}>
                <div
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-125"
                  style={{ background: net.bg, border: `1px solid ${net.border}` }}
                >
                  {net.name}
                </div>
                {net.activityCls && (
                  <span className={`net-activity ${net.activityCls}`}>+1</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AGENTES ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes agent-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .agent-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, #8b5cf6, #06b6d4, transparent);
          background-size: 200% auto;
          animation: agent-shimmer 3s linear infinite;
        }
        @keyframes agent-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
        .agent-dot {
          animation: agent-dot-pulse 2s ease-in-out infinite;
        }
      `}</style>
      <section className="py-10">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-violet-400">
            Agentes IA
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight text-white md:text-4xl">
            8 agentes IA trabajando para ti
          </h2>

          <div ref={agentsRef} className="mt-10 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((agent, i) => (
              <div
                key={agent.name}
                style={{
                  opacity: agentsInView ? 1 : 0,
                  transform: agentsInView ? "translateY(0)" : "translateY(16px)",
                  transition: `opacity 0.4s ease ${i * 80}ms, transform 0.4s ease ${i * 80}ms`,
                }}
              >
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-lg hover:shadow-black/30">
                  <span className="mb-3 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-4xl font-black leading-none text-transparent">
                    {agent.num}
                  </span>
                  <h3 className="text-[11px] font-black uppercase tracking-wide text-white">
                    {agent.name}
                  </h3>
                  <div className="agent-line my-2.5" />
                  <p className="flex-1 text-xs leading-relaxed text-white/45">{agent.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5">
                    <span className="agent-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70">Activo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOS CAMINOS ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-violet-400">
            Para quién es
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight text-white md:text-4xl">
            ¿Eres influencer o empresa?
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Influencer */}
            <div className="flex flex-col rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-900/30 to-fuchsia-900/10 p-8 transition-all duration-300 hover:border-violet-400/50 hover:shadow-xl hover:shadow-violet-500/10">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-2xl shadow-lg shadow-violet-500/30">
                ✨
              </div>
              <h3 className="text-2xl font-black text-white">Para Influencers y Creadores</h3>
              <ul className="mt-6 flex-1 space-y-3">
                {INFLUENCER_FEATURES.map((f) => (
                  <CheckItem key={f} text={f} color="text-violet-400" />
                ))}
              </ul>
              <Link
                href="/socialflow/auth"
                className="mt-8 block w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3.5 text-center text-sm font-black text-white shadow-lg shadow-violet-500/25 transition-all hover:brightness-110"
              >
                Ver planes Influencer →
              </Link>
            </div>

            {/* Empresa */}
            <div className="flex flex-col rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-900/30 to-sky-900/10 p-8 transition-all duration-300 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/10">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 text-2xl shadow-lg shadow-blue-500/30">
                🏢
              </div>
              <h3 className="text-2xl font-black text-white">Para Empresas y PYMEs</h3>
              <ul className="mt-6 flex-1 space-y-3">
                {EMPRESA_FEATURES.map((f) => (
                  <CheckItem key={f} text={f} color="text-blue-400" />
                ))}
              </ul>
              <Link
                href="/socialflow/auth"
                className="mt-8 block w-full rounded-xl bg-gradient-to-r from-blue-500 to-sky-500 py-3.5 text-center text-sm font-black text-white shadow-lg shadow-blue-500/25 transition-all hover:brightness-110"
              >
                Ver planes Empresa →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-white/5 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-violet-400">
            Precios
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight text-white md:text-4xl">
            Planes simples, resultados reales
          </h2>

          {/* Toggle */}
          <div className="mt-8 flex justify-center">
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {(["influencer", "empresa"] as PricingTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={[
                    "rounded-lg px-6 py-2 text-sm font-bold capitalize transition-all duration-200",
                    pricingTab === tab
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md"
                      : "text-white/40 hover:text-white/70",
                  ].join(" ")}
                >
                  {tab === "influencer" ? "Influencer" : "Empresa"}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div
            className="mt-10 grid gap-6 sm:grid-cols-2"
            style={{
              opacity: pricingVisible ? 1 : 0,
              transform: pricingVisible ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            {(pricingTab === "influencer" ? PLANS_INFLUENCER : PLANS_EMPRESA).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                accentClass={
                  pricingTab === "influencer"
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    : "bg-gradient-to-r from-blue-500 to-sky-500"
                }
              />
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-white/25">
            Todos los planes incluyen 7 días gratis sin tarjeta de crédito
          </p>
        </div>
      </section>

      {/* ── POR QUÉ SOCIALCORS ────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-14">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.22em] text-violet-400">
            Por qué Socialcors
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight text-white md:text-4xl">
            Mientras otros programan posts, Socialcors hace crecer tu negocio.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Tradicional */}
            <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/40 via-red-900/10 to-transparent p-7 shadow-[0_0_30px_rgba(239,68,68,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                <span className="text-sm">❌</span>
                <span className="text-xs font-bold text-red-400">Herramientas tradicionales</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Solo programan posts",
                  "Muestran métricas sin contexto",
                  "Texto genérico con IA básica",
                  "No aprenden de tu marca",
                  "No responden por ti",
                  "No detectan leads",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/40">
                    <span className="mt-px shrink-0 text-red-500/60">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Socialcors */}
            <div className="rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-violet-900/15 to-cyan-950/20 p-7 shadow-[0_0_30px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/10 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-[0_0_50px_rgba(139,92,246,0.25)]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/50 bg-violet-500/20 px-4 py-2 shadow-[0_0_16px_rgba(139,92,246,0.25)]">
                <span className="text-sm">✅</span>
                <span className="text-xs font-bold text-violet-400">Socialcors</span>
              </div>
              <ul className="space-y-3">
                {[
                  "Aprende tu marca y voz",
                  "Detecta tendencias en tiempo real",
                  "Genera contenido auténtico por ti",
                  "Responde comentarios y DMs",
                  "Detecta leads automáticamente",
                  "Mejora solo con cada publicación",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/75">
                    <span className="mt-px shrink-0 font-black text-violet-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.03] px-8 py-7 text-center">
            <p className="text-xl font-black text-white md:text-2xl">
              Mientras Hootsuite programa,{" "}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Socialcors piensa.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-16">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-900/60 via-fuchsia-900/40 to-blue-900/60" />
        <div className="pointer-events-none absolute inset-0 border-y border-white/5" />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-5xl font-black tracking-tight text-white md:text-6xl">
            Empieza gratis hoy
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["7 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm text-white/70">
                <span className="font-black text-emerald-400">✓</span>
                {item}
              </span>
            ))}
          </div>
          <p className="text-sm font-bold text-white/50">
            8 agentes IA trabajando · 6 redes sociales conectables · Resultados desde el día 1
          </p>
          <Link
            href="/socialflow/auth"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-12 py-5 text-lg font-black text-violet-700 shadow-2xl shadow-black/30 transition-all hover:-translate-y-0.5 hover:brightness-95"
          >
            Crear mi cuenta gratis →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#030312] py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600">
                <span className="text-[10px] font-black text-white">SC</span>
              </div>
              <span className="text-base font-black text-white">Socialcors</span>
            </div>
            {/* Links */}
            <div className="flex items-center gap-5">
              {[
                { label: "Términos", href: "/terminos" },
                { label: "Privacidad", href: "/privacidad" },
                { label: "Contacto", href: "/contacto" },
              ].map((l) => (
                <Link key={l.label} href={l.href} className="text-xs text-white/35 transition-colors hover:text-white/70">
                  {l.label}
                </Link>
              ))}
            </div>
            {/* Copyright */}
            <p className="text-xs text-white/25">
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
