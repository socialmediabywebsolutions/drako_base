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
  "Publicación automática en Instagram",
  "Detecta colaboraciones y sponsors en tus DMs",
  "Crece sin esfuerzo manual",
];

const EMPRESA_FEATURES = [
  "Base de Conocimiento con tu web, PDFs y catálogo",
  "Voz de marca consistente en todas las redes",
  "Responde comentarios y DMs automáticamente",
  "Detecta leads y genera presupuestos",
];

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  networks: string;
  posts: string;
  features: string[];
  popular?: boolean;
};

const PLANS_INFLUENCER: Plan[] = [
  {
    id: "influencer-starter",
    name: "Influencer Starter",
    price: "99€",
    period: "/mes",
    networks: "Instagram",
    posts: "1 post+reel+historia+carrusel/día",
    features: [
      "Captions con tu voz",
      "Hashtags por tendencias",
      "Publicación automática",
      "Calendario de contenido",
    ],
  },
  {
    id: "influencer-basico",
    name: "Influencer Básico",
    price: "179€",
    period: "/mes",
    networks: "Instagram",
    posts: "2 posts+reels+historias+carruseles/día",
    features: [
      "Todo lo de Starter",
      "Reels automáticos",
      "Historias diarias",
      "Carruseles educativos",
    ],
    popular: true,
  },
  {
    id: "influencer-pro",
    name: "Influencer Pro",
    price: "299€",
    period: "/mes",
    networks: "Instagram",
    posts: "3 posts+reels+historias+carruseles/día",
    features: [
      "Todo lo de Básico",
      "Análisis de imagen IA",
      "Analytics avanzados",
      "Soporte prioritario",
    ],
  },
];

const PLANS_EMPRESA: Plan[] = [
  {
    id: "empresa-starter",
    name: "Empresa Starter",
    price: "169€",
    period: "/mes",
    networks: "Instagram",
    posts: "1 post+reel+historia+carrusel/día",
    features: [
      "Base de Conocimiento",
      "Voz de marca consistente",
      "Respuesta automática comentarios y DMs",
      "Calendario de contenido",
    ],
  },
  {
    id: "empresa-basico",
    name: "Empresa Básico",
    price: "299€",
    period: "/mes",
    networks: "Instagram",
    posts: "2 posts+reels+historias+carruseles/día",
    features: [
      "Todo lo de Starter",
      "CRM Social básico",
      "Reels e Historias diarias",
      "Carruseles de producto",
    ],
    popular: true,
  },
  {
    id: "empresa-pro",
    name: "Empresa Pro",
    price: "449€",
    period: "/mes",
    networks: "Instagram",
    posts: "3 posts+reels+historias+carruseles/día",
    features: [
      "Todo lo de Básico",
      "Gestión de reputación",
      "Leads desde DMs",
      "WhatsApp orquestador",
    ],
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

function PlanGridCard({ plan, expanded, onSelect, accentClass }: {
  plan: Plan;
  expanded: boolean;
  onSelect: () => void;
  accentClass: string;
}) {
  const visibleFeatures = expanded ? plan.features : plan.features.slice(0, 3);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
      }}
      className={[
        "relative flex cursor-pointer flex-col rounded-2xl border text-left transition-all duration-300",
        expanded
          ? "border-violet-500/60 bg-violet-500/10 p-7 ring-1 ring-violet-500/30"
          : "border-white/10 bg-white/5 p-5 hover:border-white/25 hover:bg-white/[0.08]",
      ].join(" ")}
    >
      {plan.popular && (
        <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full ${accentClass} px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg`}>
          MÁS POPULAR
        </span>
      )}

      <h3 className={expanded ? "text-xl font-black text-white" : "text-sm font-black text-white"}>
        {plan.name}
      </h3>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={expanded ? "text-4xl font-black text-white" : "text-2xl font-black text-white"}>
          {plan.price}
        </span>
        <span className="text-sm text-white/40">{plan.period}</span>
      </div>

      {expanded && (
        <p className="mt-1.5 text-sm font-semibold text-violet-300/80">{plan.networks} · {plan.posts}</p>
      )}

      <ul className={`mt-4 space-y-2 ${expanded ? "flex-1" : ""}`}>
        {visibleFeatures.map((f) => (
          <li key={f} className={`flex items-start gap-2 text-white/65 ${expanded ? "text-sm" : "text-xs"}`}>
            <span className="mt-px shrink-0 text-[13px] font-black text-violet-400">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {expanded ? (
        <Link
          href="/socialflow/auth"
          onClick={(e) => e.stopPropagation()}
          className={`mt-6 block w-full rounded-xl py-3.5 text-center text-sm font-black tracking-wide text-white transition-all duration-200 ${accentClass} shadow-lg hover:brightness-110`}
        >
          Empezar gratis 15 días
        </Link>
      ) : (
        <span className="mt-4 block text-center text-xs font-bold text-white/30">
          Ver detalles ↓
        </span>
      )}
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
  const [activePlanId, setActivePlanId] = useState<string>(
    PLANS_INFLUENCER.find((p) => p.popular)?.id ?? PLANS_INFLUENCER[0].id
  );
  const { ref: agentsRef, inView: agentsInView } = useInView(0.1);

  function switchTab(tab: PricingTab) {
    if (tab === pricingTab) return;
    setPricingVisible(false);
    setTimeout(() => {
      setPricingTab(tab);
      const plans = tab === "influencer" ? PLANS_INFLUENCER : PLANS_EMPRESA;
      setActivePlanId(plans.find((p) => p.popular)?.id ?? plans[0].id);
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
            {["15 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
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
      `}</style>
      <section className="border-b border-white/5 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="relative net-pill-0">
              <div
                className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-125"
                style={{ background: "linear-gradient(135deg,rgba(131,58,180,.13),rgba(253,29,29,.09),rgba(252,176,69,.08))", border: "1px solid rgba(188,62,138,.40)" }}
              >
                Instagram
              </div>
              <span className="net-activity net-act-1">+1</span>
            </div>
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
            className="mx-auto mt-10 grid max-w-4xl grid-cols-1 items-start gap-4 sm:grid-cols-3"
            style={{
              opacity: pricingVisible ? 1 : 0,
              transform: pricingVisible ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            {(pricingTab === "influencer" ? PLANS_INFLUENCER : PLANS_EMPRESA).map((plan) => (
              <PlanGridCard
                key={plan.id}
                plan={plan}
                expanded={activePlanId === plan.id}
                onSelect={() => setActivePlanId(plan.id)}
                accentClass={
                  pricingTab === "influencer"
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                    : "bg-gradient-to-r from-blue-500 to-sky-500"
                }
              />
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-white/25">
            Todos los planes incluyen 15 días gratis sin tarjeta de crédito
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
            {["15 días gratis", "Sin tarjeta", "Cancela cuando quieras"].map((item) => (
              <span key={item} className="flex items-center gap-1.5 text-sm text-white/70">
                <span className="font-black text-emerald-400">✓</span>
                {item}
              </span>
            ))}
          </div>
          <p className="text-sm font-bold text-white/50">
            8 agentes IA trabajando · Instagram · Más redes próximamente · Resultados desde el día 1
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
