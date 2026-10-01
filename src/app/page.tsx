import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { NetworkCanvas } from "@/components/marketing/home/NetworkCanvas";
import { StatCounter } from "@/components/marketing/home/StatCounter";

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const DISPLAY = "font-[family-name:var(--font-syne)]";

type Status = "live" | "beta" | "dev" | "core";
type Tone = "b" | "t";

const STATUS_BADGE: Record<Status, { label: string; dot: string }> = {
  live:  { label: "En producción", dot: "#10b981" },
  beta:  { label: "Beta",          dot: "#f59e0b" },
  dev:   { label: "Desarrollo",    dot: "#3b82f6" },
  core:  { label: "Core",          dot: "#06b6d4" },
};

const PRODUCTS: { name: string; status: Status; icon: string; description: string; url?: string }[] = [
  {
    name: "Socialcors",
    status: "live",
    icon: "◈",
    description: "Sistema operativo de marketing social. Agentes IA que generan, programan y publican contenido viral de forma autónoma en todas las redes.",
    url: "https://socialcors.com",
  },
  {
    name: "Mentoría",
    status: "beta",
    icon: "◎",
    description: "Tutores IA que adaptan el aprendizaje al ritmo de cada alumno. Seguimiento parental por WhatsApp y supervisión docente en tiempo real.",
  },
  {
    name: "Crypto IA",
    status: "dev",
    icon: "◆",
    description: "Análisis técnico avanzado con agentes especializados: Market Watcher, Risk Manager, Signal Composer. RSI, MACD, Fibonacci en tiempo real.",
  },
  {
    name: "Cazh",
    status: "dev",
    icon: "◇",
    description: "Fintech con wallet digital, pagos instantáneos, tarjetas virtuales y físicas, y scoring financiero automatizado por IA.",
  },
  {
    name: "Rentia",
    status: "dev",
    icon: "◉",
    description: "Gestión inmobiliaria inteligente. Contratos, cobros e incidencias automatizados. Evaluación de inquilinos y predicción de riesgos con IA.",
  },
  {
    name: "Campamento Base",
    status: "core",
    icon: "⬡",
    description: "El sistema nervioso central del holding. Gobierno, facturación, observabilidad global y orquestación de agentes para todo el ecosistema.",
  },
];

const PILLARS: { num: string; title: string; text: string }[] = [
  {
    num: "01",
    title: "Agentes que operan negocios",
    text: "No son chatbots. Son agentes especializados que razonan, planifican y ejecutan tareas complejas de forma autónoma — los departamentos completos de tus clientes, automatizados.",
  },
  {
    num: "02",
    title: "Edge computing sin límites",
    text: "Infraestructura 100% en Cloudflare Edge. Latencia submilisegundo en cualquier región del mundo. Sin servidores que mantener, sin cuellos de botella que escalar.",
  },
  {
    num: "03",
    title: "Aislamiento total por cliente",
    text: "Arquitectura multi-tenant diseñada para que ningún dato cruce fronteras entre clientes. Row-Level Security, auditoría completa, cumplimiento desde el primer día.",
  },
  {
    num: "04",
    title: "De concepto a mercado en días",
    text: "Auth, billing, IA, CRM y analítica compartidos entre todos los SaaS. Lo que tarda meses en el mercado, en Drako tarda días. La ventaja del ecosistema.",
  },
];

const STATS: { value: number; suffix?: string; prefix?: string; label: string }[] = [
  { value: 5,   label: "SaaS activos" },
  { value: 100, suffix: "%", label: "IA en el núcleo" },
  { value: 6,   label: "Sectores verticales" },
  { value: 50,  prefix: "<", suffix: "ms", label: "Latencia global" },
];

export default async function Home({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const headerMode = headersList.get("x-drako-host-mode");
  const mode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);

  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");
  if (host.includes("socialflow")) redirect("/socialflow");

  const matchedPath = headersList.get("x-matched-path") || headersList.get("x-invoke-path") || headersList.get("next-url") || "/";
  const locale = resolveMarketingLocale(resolvedParams?.locale ?? (matchedPath.split("/")[1] || undefined));
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;

  return (
    <div className={`${syne.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-white font-[family-name:var(--font-dm-sans)] text-[#0a0f1e] scroll-smooth`}>

      <style>{`
        /* ---- keyframes ---- */
        @keyframes shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes line-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes glow-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
          50%       { box-shadow: 0 0 0 8px rgba(59,130,246,0.08); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes scan-line {
          0%   { top: 0%; opacity: 0.7; }
          100% { top: 100%; opacity: 0; }
        }

        /* ---- utility ---- */
        .text-gradient {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 55%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .text-shimmer {
          background: linear-gradient(90deg, #3b82f6, #06b6d4, #38bdf8, #06b6d4, #3b82f6);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear infinite;
        }
        .hero-animate {
          animation: fade-in-up 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        .hero-animate-2 { animation: fade-in-up 0.8s 0.15s cubic-bezier(0.16,1,0.3,1) both; }
        .hero-animate-3 { animation: fade-in-up 0.8s 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .hero-animate-4 { animation: fade-in-up 0.8s 0.42s cubic-bezier(0.16,1,0.3,1) both; }

        /* ---- nav ---- */
        .nav-link {
          position: relative;
          color: #475569;
          transition: color 0.2s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0; right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, #3b82f6, #06b6d4);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .nav-link:hover { color: #0a0f1e; }
        .nav-link:hover::after { transform: scaleX(1); }

        /* ---- product cards ---- */
        .product-card {
          position: relative;
          background: #fff;
          border: 1px solid #e8edf5;
          border-radius: 20px;
          padding: 32px;
          transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .product-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(6,182,212,0.04) 100%);
          opacity: 0;
          transition: opacity 0.35s;
        }
        .product-card:hover {
          border-color: rgba(59,130,246,0.35);
          transform: translateY(-6px);
          box-shadow: 0 24px 64px rgba(59,130,246,0.1), 0 4px 16px rgba(0,0,0,0.06);
        }
        .product-card:hover::before { opacity: 1; }
        .product-icon {
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #eff6ff, #e0f9ff);
          color: #3b82f6;
          font-size: 22px;
          transition: all 0.3s;
        }
        .product-card:hover .product-icon {
          background: linear-gradient(135deg, #3b82f6, #06b6d4);
          color: #fff;
        }

        /* ---- pillar cards ---- */
        .pillar-card {
          border-top: 1px solid #e2e8f0;
          padding-top: 32px;
          transition: border-color 0.3s;
        }
        .pillar-card:hover { border-color: #3b82f6; }
        .pillar-num {
          font-family: var(--font-syne), sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #3b82f6;
          margin-bottom: 16px;
        }

        /* ---- CTA button ---- */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #3b82f6, #06b6d4);
          color: #fff;
          font-family: var(--font-syne), sans-serif;
          font-weight: 700;
          font-size: 15px;
          padding: 14px 28px;
          border-radius: 12px;
          transition: all 0.25s;
          box-shadow: 0 4px 24px rgba(59,130,246,0.28);
          letter-spacing: 0.01em;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(59,130,246,0.45);
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: #3b82f6;
          font-family: var(--font-syne), sans-serif;
          font-weight: 700;
          font-size: 15px;
          padding: 14px 28px;
          border-radius: 12px;
          border: 1.5px solid #3b82f6;
          transition: all 0.25s;
          letter-spacing: 0.01em;
        }
        .btn-secondary:hover {
          background: rgba(59,130,246,0.06);
          transform: translateY(-2px);
        }

        /* ---- stat card ---- */
        .stat-item {
          text-align: center;
          padding: 32px 16px;
          border-right: 1px solid #e8edf5;
          transition: background 0.3s;
        }
        .stat-item:last-child { border-right: none; }
        .stat-item:hover { background: rgba(59,130,246,0.03); border-radius: 16px; }

        /* ---- floating badge in hero ---- */
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 999px;
          padding: 6px 16px 6px 10px;
          font-size: 13px;
          font-weight: 600;
          color: #3b82f6;
        }
        .pulse-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulse-dot 1.8s ease-in-out infinite;
        }

        /* ---- network canvas backdrop ---- */
        .canvas-wrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        /* ---- scan line on hero visual ---- */
        .scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent);
          animation: scan-line 3s ease-in-out infinite;
        }

        /* ---- grid lines backdrop ---- */
        .grid-backdrop {
          background-image:
            linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* ---- hover arrow ---- */
        .arrow-hover {
          display: inline-block;
          transition: transform 0.2s;
        }
        a:hover .arrow-hover { transform: translateX(4px); }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* ════════════════════════════════════ NAV ════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`${prefix}/`} className={`${DISPLAY} text-xl font-bold text-[#0a0f1e] tracking-tight`}>
            drako
            <span className="text-gradient">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href={`${prefix}/ecosystem`} className="nav-link text-sm font-medium">Ecosistema</Link>
            <Link href={`${prefix}/journal`}    className="nav-link text-sm font-medium">Journal</Link>
            <Link href="https://socialcors.com" className="nav-link text-sm font-medium" target="_blank">Socialcors</Link>
          </div>
          <Link href="https://socialcors.com" target="_blank" className="btn-primary text-sm py-2.5 px-5">
            Empezar ahora <span className="arrow-hover">→</span>
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════════ HERO ════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pb-20 pt-28 overflow-hidden bg-[#f8faff]">
        {/* Grid backdrop */}
        <div className="canvas-wrap grid-backdrop opacity-60" />

        {/* Network canvas */}
        <div className="canvas-wrap">
          <NetworkCanvas />
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-[-120px] left-[10%] w-[600px] h-[600px] rounded-full bg-blue-500/[0.07] blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-80px] right-[8%] w-[500px] h-[500px] rounded-full bg-cyan-400/[0.07] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="hero-animate flex justify-center mb-10">
            <div className="hero-badge">
              <span className="pulse-dot" />
              Holding tecnológico · 5 SaaS de IA en producción
            </div>
          </div>

          {/* Headline */}
          <h1 className={`${DISPLAY} hero-animate-2 text-5xl sm:text-6xl lg:text-[80px] font-extrabold leading-[1.05] tracking-tight text-[#0a0f1e] mb-6`}>
            Construimos la{" "}
            <span className="text-shimmer">inteligencia artificial</span>
            <br />
            que opera tu sector.
          </h1>

          {/* Sub */}
          <p className="hero-animate-3 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-12">
            Drako es el holding que diseña, construye y escala SaaS de IA especializados.
            Cada producto automatiza un sector completo — desde redes sociales hasta finanzas, educación e inmobiliaria.
          </p>

          {/* CTAs */}
          <div className="hero-animate-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`${prefix}/ecosystem`} className="btn-primary">
              Ver el ecosistema <span className="arrow-hover">→</span>
            </Link>
            <Link href="https://socialcors.com" target="_blank" className="btn-secondary">
              Socialcors — nuestro SaaS líder
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-slate-400" />
        </div>
      </section>

      {/* ════════════════════════════════════ STATS ════════════════════════════════════ */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
          {STATS.map((s) => (
            <div key={s.label} className="stat-item">
              <p className={`${DISPLAY} text-4xl font-extrabold text-[#0a0f1e] mb-1`}>
                {s.prefix && <span className="text-gradient">{s.prefix}</span>}
                <StatCounter target={s.value} />
                {s.suffix && <span className="text-gradient">{s.suffix}</span>}
              </p>
              <p className="text-sm text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════ PRODUCTS ════════════════════════════════════ */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.18em] text-[#3b82f6] uppercase mb-4">El ecosistema</p>
            <h2 className={`${DISPLAY} text-4xl sm:text-5xl font-extrabold leading-tight text-[#0a0f1e] mb-5`}>
              Seis productos.<br />
              <span className="text-gradient">Una sola inteligencia.</span>
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Cada SaaS resuelve un problema vertical concreto. Todos comparten la misma infraestructura, el mismo motor de IA y la misma arquitectura. Lo que aprende uno, lo aprovechan los demás.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PRODUCTS.map((p) => {
              const badge = STATUS_BADGE[p.status];
              return (
                <div key={p.name} className="product-card group">
                  {/* Icon + status */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="product-icon">{p.icon}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
                      <span className="text-xs font-semibold text-slate-400">{badge.label}</span>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className={`${DISPLAY} text-xl font-bold text-[#0a0f1e] mb-3`}>{p.name}</h3>

                  {/* Description */}
                  <p className="text-slate-500 text-sm leading-relaxed">{p.description}</p>

                  {/* Link */}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-[#3b82f6] hover:text-[#06b6d4] transition-colors">
                      Acceder <span className="arrow-hover">→</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════ BANNER ════════════════════════════════════ */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#3b82f6] via-[#0ea5e9] to-[#06b6d4] relative overflow-hidden">
        {/* Subtle grid on banner */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className={`${DISPLAY} text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3`}>
              No construimos herramientas.<br />Construimos operadores de IA.
            </p>
            <p className="text-blue-100 text-base leading-relaxed">
              La diferencia entre un chatbot y un agente es la diferencia entre un asistente que contesta y un empleado que trabaja. Drako construye lo segundo.
            </p>
          </div>
          <Link href={`${prefix}/ecosystem`}
            className="shrink-0 inline-flex items-center gap-2 bg-white text-[#3b82f6] font-bold text-base px-7 py-4 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            Ver el ecosistema <span className="arrow-hover">→</span>
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════ PILLARS ════════════════════════════════════ */}
      <section className="py-28 px-6 bg-[#f8faff]">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="max-w-xl mb-20">
            <p className="text-xs font-bold tracking-[0.18em] text-[#3b82f6] uppercase mb-4">Por qué Drako</p>
            <h2 className={`${DISPLAY} text-4xl sm:text-5xl font-extrabold text-[#0a0f1e] leading-tight`}>
              La ventaja de<br />
              <span className="text-gradient">construir en ecosistema.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
            {PILLARS.map((p) => (
              <div key={p.num} className="pillar-card">
                <p className="pillar-num">{p.num}</p>
                <h3 className={`${DISPLAY} text-xl font-bold text-[#0a0f1e] mb-3`}>{p.title}</h3>
                <p className="text-slate-500 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════ TECH STRIP ════════════════════════════════════ */}
      <section className="py-16 px-6 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase text-center mb-10">
            Infraestructura — 100% Cloudflare Edge
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Cloudflare Workers", "D1 Database", "Durable Objects",
              "R2 Storage", "AI Gateway", "Queues",
              "Stripe", "WhatsApp API", "Mistral AI",
              "SDXL · Generación de imágenes", "Multi-tenant RLS", "GitHub Actions CI/CD",
            ].map((tech) => (
              <span key={tech}
                className="text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 hover:border-blue-300 hover:text-[#3b82f6] hover:bg-blue-50/50 transition-all cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════ FINAL CTA ════════════════════════════════════ */}
      <section className="py-32 px-6 bg-[#f8faff] relative overflow-hidden">
        <div className="canvas-wrap opacity-30">
          <NetworkCanvas />
        </div>
        {/* Orbs */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-blue-400/[0.08] blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-400/[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-[#3b82f6] uppercase mb-6">Empieza hoy</p>
          <h2 className={`${DISPLAY} text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0a0f1e] leading-tight mb-6`}>
            Tu sector, automatizado<br />
            <span className="text-shimmer">por inteligencia artificial.</span>
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            Socialcors ya está en producción. Si gestionas redes sociales para tu empresa o tus clientes, la IA de Drako trabaja por ti desde el primer día.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://socialcors.com" target="_blank" className="btn-primary text-base px-8 py-4">
              Probar Socialcors gratis <span className="arrow-hover">→</span>
            </Link>
            <Link href={`${prefix}/ecosystem`} className="btn-secondary text-base px-8 py-4">
              Explorar el ecosistema
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════ FOOTER ════════════════════════════════════ */}
      <footer className="bg-white border-t border-slate-100 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className={`${DISPLAY} text-lg font-bold text-[#0a0f1e] tracking-tight`}>
              drako<span className="text-gradient">.</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-400">El holding de IA que construye el futuro del trabajo.</span>
          </div>
          <nav className="flex flex-wrap items-center gap-6">
            {[
              { label: "Ecosistema",  href: `${prefix}/ecosystem` },
              { label: "Journal",     href: `${prefix}/journal` },
              { label: "Socialcors",  href: "https://socialcors.com", ext: true },
            ].map((l) => (
              <Link key={l.label} href={l.href} {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-sm text-slate-400 hover:text-[#3b82f6] transition-colors font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-slate-300">© {new Date().getFullYear()} Drako Systems</p>
        </div>
      </footer>
    </div>
  );
}
