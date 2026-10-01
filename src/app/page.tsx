import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { NetworkCanvas } from "@/components/marketing/home/NetworkCanvas";
import { StatCounter } from "@/components/marketing/home/StatCounter";

// Home de drako.systems — "IA dominante"
// Tokens: fondo hero #04080f, superficie light #f8fafc, azul #3b82f6, turquesa #06b6d4
// Display: Syne 800 · Cuerpo: DM Sans

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const DISPLAY = "font-[family-name:var(--font-syne)]";

type Status = "live" | "beta" | "dev" | "core";
type Tone = "b" | "t";

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  live:  { label: "En producción", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  beta:  { label: "Beta",          className: "bg-amber-50 text-amber-700 border border-amber-200" },
  dev:   { label: "Desarrollo",    className: "bg-blue-50 text-[#3b82f6] border border-blue-200" },
  core:  { label: "Core",          className: "bg-cyan-50 text-[#0891b2] border border-cyan-200" },
};

const PRODUCTS: { name: string; status: Status; icon: string; tone: Tone; description: string; tags: [string, Tone][] }[] = [
  {
    name: "Socialcors",
    status: "live",
    icon: "📱",
    tone: "b",
    description:
      "Automatización de marketing en redes sociales. Contenido, programación, CRM social y analítica orquestados por agentes IA que trabajan sin descanso.",
    tags: [["Instagram", "b"], ["TikTok", "b"], ["LinkedIn", "b"], ["Agentes IA", "t"]],
  },
  {
    name: "Mentoría",
    status: "beta",
    icon: "🎓",
    tone: "t",
    description:
      "Tutores IA personalizados para estudiantes con aprendizaje adaptativo. Seguimiento para padres por WhatsApp y supervisión de profesores en tiempo real.",
    tags: [["Matemáticas", "b"], ["Idiomas", "b"], ["Tutores IA", "t"], ["WhatsApp", "b"]],
  },
  {
    name: "Crypto IA",
    status: "dev",
    icon: "📈",
    tone: "b",
    description:
      "Análisis técnico avanzado: RSI, MACD, Fibonacci, Elliott. Agentes especializados como Market Watcher, Risk Manager y Signal Composer en tiempo real.",
    tags: [["Análisis técnico", "b"], ["Backtesting", "b"], ["Signal AI", "t"]],
  },
  {
    name: "Cazh",
    status: "dev",
    icon: "💳",
    tone: "t",
    description:
      "Plataforma financiera digital con wallet, pagos instantáneos, tarjetas virtuales y físicas, y scoring financiero automatizado.",
    tags: [["Wallet", "t"], ["Scoring IA", "t"], ["Tarjetas", "t"]],
  },
  {
    name: "Rentia",
    status: "dev",
    icon: "🏠",
    tone: "b",
    description:
      "Gestión inmobiliaria inteligente. Contratos, cobros e incidencias automatizados. Evaluación de inquilinos con IA y predicción de riesgos de impago.",
    tags: [["Contratos IA", "b"], ["Incidencias", "b"], ["Evaluación", "t"]],
  },
  {
    name: "Campamento Base",
    status: "core",
    icon: "⚙️",
    tone: "t",
    description:
      "El sistema operativo del holding. Gobierno, facturación centralizada, observabilidad global y orquestación de agentes IA para todo el ecosistema.",
    tags: [["Gobierno", "t"], ["Facturación", "t"], ["Observabilidad", "t"]],
  },
];

const STACK: [string, Tone][] = [
  ["Cloudflare Workers", "b"],
  ["D1 Database", "t"],
  ["Durable Objects", "b"],
  ["AI Gateway", "t"],
  ["R2 Storage", "b"],
  ["Queues", "t"],
  ["Stripe Billing", "b"],
  ["Multi-tenant RLS", "t"],
  ["Agentes especializados", "b"],
  ["WhatsApp API", "t"],
];

const WHY: { icon: string; title: string; text: string }[] = [
  {
    icon: "🧠",
    title: "Agentes, no chatbots",
    text: "Cada SaaS tiene agentes especializados que razonan, planifican y ejecutan tareas complejas de forma autónoma. No son asistentes: son operadores reales del negocio.",
  },
  {
    icon: "⚡",
    title: "Edge computing puro",
    text: "Toda la infraestructura corre en Cloudflare Edge. Latencias de milisegundos en cualquier región del mundo, sin servidores propios que escalar o mantener.",
  },
  {
    icon: "🔒",
    title: "Multi-tenant por diseño",
    text: "Aislamiento total entre clientes desde la base de datos hasta la capa de agentes. Cada consulta va acotada a su tenant, con auditoría completa y sin compromisos.",
  },
  {
    icon: "🚀",
    title: "Tiempo a mercado en días",
    text: "El stack compartido (auth, billing, IA, CRM, analítica) significa que cada nuevo SaaS parte de una base madura. Lo que tomaría meses, tarda días.",
  },
];

const STATS: { value: number; prefix?: string; suffix?: string; label: string }[] = [
  { value: 5, label: "SaaS activos" },
  { value: 100, suffix: "%", label: "IA en el núcleo" },
  { value: 6, label: "Sectores cubiertos" },
  { value: 50, prefix: "<", suffix: "ms", label: "Latencia global" },
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
    <div className={`${syne.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-[#f8fafc] font-[family-name:var(--font-dm-sans)] text-[#0f172a] scroll-smooth`}>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 0.85; transform: scale(1.12); }
        }
        @keyframes badge-border {
          to { background-position: 200% center; }
        }
        @keyframes glow-btn {
          0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,.35), 0 0 50px rgba(6,182,212,.12); }
          50%       { box-shadow: 0 0 35px rgba(59,130,246,.65), 0 0 80px rgba(6,182,212,.25); }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #3b82f6, #06b6d4, #0ea5e9, #06b6d4, #3b82f6);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .btn-glow {
          animation: glow-btn 2.8s ease-in-out infinite;
        }
        .btn-glow:hover {
          animation: none;
          box-shadow: 0 0 40px rgba(59,130,246,.7), 0 0 80px rgba(6,182,212,.3);
          transform: translateY(-2px) scale(1.02);
        }
        .card-glow {
          transition: all 0.3s cubic-bezier(.4,0,.2,1);
        }
        .card-glow:hover {
          box-shadow:
            0 0 0 1.5px rgba(59,130,246,.3),
            0 20px 60px rgba(59,130,246,.12),
            0 0 60px rgba(6,182,212,.07);
          transform: translateY(-6px);
          border-color: rgba(59,130,246,.3);
        }
        .stack-pill {
          transition: all 0.2s ease;
        }
        .stack-pill:hover {
          background: rgba(59,130,246,.08);
          box-shadow: 0 0 20px rgba(59,130,246,.2), inset 0 0 12px rgba(59,130,246,.04);
          border-color: rgba(59,130,246,.4);
          color: #1e40af;
        }
        .why-card {
          transition: all 0.3s cubic-bezier(.4,0,.2,1);
        }
        .why-card:hover {
          box-shadow: 0 0 0 1.5px rgba(59,130,246,.2), 0 20px 50px rgba(59,130,246,.1);
          transform: translateY(-5px);
        }
        .stat-card {
          transition: all 0.25s ease;
        }
        .stat-card:hover {
          background: rgba(59,130,246,.06);
          box-shadow: 0 0 0 1px rgba(59,130,246,.15), 0 8px 24px rgba(59,130,246,.08);
          transform: translateY(-2px);
        }
        .nav-link {
          position: relative;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6, #06b6d4);
          border-radius: 2px;
          transition: width 0.25s ease;
        }
        .nav-link:hover::after { width: 100%; }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-text, .btn-glow { animation: none; }
          .shimmer-text { -webkit-text-fill-color: #3b82f6; }
          .card-glow:hover, .why-card:hover, .stat-card:hover { transform: none; }
        }
      `}</style>

      {/* ─── NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-[20px] shadow-[0_1px_0_0_rgba(59,130,246,.06),0_2px_16px_rgba(0,0,0,.04)] md:px-12 md:py-[18px]">
        <Link href={prefix || "/"} className={`${DISPLAY} text-[21px] font-extrabold tracking-[-0.5px] shimmer-text`}>
          DRAKO
        </Link>
        <ul className="hidden list-none gap-8 md:flex">
          {[
            { href: "#productos", label: "Productos" },
            { href: "#stack", label: "Stack" },
            { href: `${prefix}/ecosystem`, label: "Ecosistema" },
            { href: `${prefix}/journal`, label: "Journal" },
          ].map((item) => (
            <li key={item.href}>
              <a href={item.href} className="nav-link text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-[#3b82f6]">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#contacto"
          className="btn-glow inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-[10px] text-sm font-bold text-white transition-all duration-200"
          style={{ boxShadow: "0 0 18px rgba(59,130,246,.3), 0 0 40px rgba(6,182,212,.1)" }}
        >
          Hablar con Drako
        </a>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[96vh] items-center justify-center overflow-hidden bg-[#f8fafc] px-5 pb-24 pt-16 md:px-10">

        {/* Orbes de luz sobre fondo claro */}
        <div
          className="pointer-events-none absolute left-1/2 top-[30%] h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.06) 50%, transparent 75%)", animation: "orb-pulse 6s ease-in-out infinite" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-[8%] top-[15%] h-[380px] w-[380px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 65%)", animation: "orb-pulse 8s ease-in-out infinite 2s" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-[4%] bottom-[10%] h-[280px] w-[280px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)", animation: "orb-pulse 7s ease-in-out infinite 1s" }}
          aria-hidden="true"
        />

        {/* Red neuronal de fondo */}
        <NetworkCanvas className="absolute inset-0 h-full w-full opacity-[0.12]" />

        {/* Contenido */}
        <div className="relative z-[2] max-w-[880px] text-center">

          {/* Badge animado */}
          <div className="mb-9 inline-flex items-center gap-2.5 rounded-full px-[1.5px] py-[1.5px]"
            style={{ background: "linear-gradient(90deg,#3b82f6,#06b6d4,#0ea5e9,#3b82f6)", backgroundSize: "300% auto", animation: "badge-border 3.5s linear infinite" }}>
            <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[12px] font-bold tracking-wide text-slate-600">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "linear-gradient(90deg,#3b82f6,#06b6d4)", animation: "spin-slow 2.5s linear infinite" }}
              />
              Holding Tecnológico · IA en el core
            </div>
          </div>

          {/* Headline */}
          <h1 className={`${DISPLAY} mb-7 text-[clamp(44px,7vw,88px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#0a0f1e]`}>
            Software que{" "}
            <span className="shimmer-text">automatiza</span>
            <br />
            industrias completas
          </h1>

          <p className="mx-auto mb-12 max-w-[540px] text-[clamp(16px,2vw,19px)] leading-[1.7] text-slate-500">
            Drako crea SaaS verticales impulsados por inteligencia artificial. Cada producto resuelve un sector con agentes autónomos, edge computing y arquitectura de primer nivel.
          </p>

          {/* Botones */}
          <div className="mb-20 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#productos"
              className="btn-glow inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-8 py-4 text-[15px] font-bold text-white transition-all duration-300"
              style={{ boxShadow: "0 0 20px rgba(59,130,246,.35), 0 0 50px rgba(6,182,212,.12)" }}
            >
              Ver el ecosistema
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </a>
            <a
              href="#stack"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-4 text-[15px] font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3b82f6] hover:text-[#3b82f6] hover:shadow-[0_4px_24px_rgba(59,130,246,.15)]"
            >
              Nuestra arquitectura
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_32px_rgba(59,130,246,.06)] md:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`stat-card relative px-5 py-6 text-center ${i > 0 ? "border-l border-slate-100" : ""} ${i >= 2 ? "border-t border-slate-100 md:border-t-0" : ""}`}
              >
                <StatCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  className={`${DISPLAY} shimmer-text mb-1.5 block text-[32px] font-extrabold leading-none tracking-[-0.025em] tabular-nums`}
                />
                <span className="text-[11px] font-medium leading-[1.4] text-slate-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRODUCTOS ───────────────────────────────────────────── */}
      <section id="productos" className="scroll-mt-20 bg-[#f8fafc] px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-14 max-w-[580px]">
            <p className="mb-3 text-[12px] font-bold text-[#3b82f6]">El ecosistema</p>
            <h2 className={`${DISPLAY} mb-4 text-[clamp(30px,4vw,48px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#0a0f1e]`}>
              Seis productos.<br />Un solo stack.
            </h2>
            <p className="text-[17px] leading-[1.65] text-[#64748b]">
              Cada SaaS opera de forma independiente y comparte infraestructura, agentes IA y conocimiento acumulado. Lo que uno aprende, lo aprovechan todos.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-5">
            {PRODUCTS.map((product) => {
              const badge = STATUS_BADGE[product.status];
              return (
                <article
                  key={product.name}
                  className="card-glow group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-7 transition-all duration-300"
                >
                  {/* Top glow strip — aparece en hover via group */}
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="mb-4 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-[22px] ${product.tone === "b" ? "bg-blue-50" : "bg-cyan-50"}`}>
                      {product.icon}
                    </div>
                    <span className={`rounded-full px-2.5 py-[4px] text-[11px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <h3 className={`${DISPLAY} mb-2 text-[18px] font-bold text-[#0a0f1e]`}>{product.name}</h3>
                  <p className="mb-5 text-sm leading-[1.65] text-[#64748b]">{product.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map(([tag, tone]) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${tone === "b" ? "bg-blue-50 text-[#3b82f6]" : "bg-cyan-50 text-[#0891b2]"}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── STACK ───────────────────────────────────────────────── */}
      <section id="stack" className="scroll-mt-20 bg-white px-5 py-16 md:px-10 md:py-20 border-y border-slate-100">
        <div className="mx-auto max-w-[1160px]">
          <p className="mb-10 text-center text-[12px] font-bold tracking-[0.15em] text-slate-400 uppercase">
            Infraestructura compartida en todos los productos
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {STACK.map(([item, tone]) => (
              <div
                key={item}
                className="stack-pill flex cursor-default items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-[13px] font-semibold text-slate-600"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone === "b" ? "bg-[#3b82f6]" : "bg-[#06b6d4]"}`} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── POR QUÉ DRAKO ───────────────────────────────────────── */}
      <section id="por-que" className="scroll-mt-20 bg-[#f8fafc] px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-14 max-w-[520px]">
            <p className="mb-3 text-[12px] font-bold text-[#3b82f6]">Por qué Drako</p>
            <h2 className={`${DISPLAY} mb-4 text-[clamp(30px,4vw,48px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#0a0f1e]`}>
              IA estructural,<br />no decorativa.
            </h2>
            <p className="text-[17px] leading-[1.65] text-[#64748b]">
              La inteligencia artificial no es una función que añadimos. Está en el núcleo de cada decisión de arquitectura, desde el primer día.
            </p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-5">
            {WHY.map((item) => (
              <div
                key={item.title}
                className="why-card group rounded-2xl border border-[#e2e8f0] bg-white p-8 transition-all duration-300"
              >
                <span className="mb-5 block text-[32px]" aria-hidden="true">{item.icon}</span>
                <h3 className={`${DISPLAY} mb-2.5 text-[16px] font-bold text-[#0a0f1e]`}>{item.title}</h3>
                <p className="text-sm leading-[1.7] text-[#64748b]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────── */}
      <section id="contacto" className="scroll-mt-20 relative overflow-hidden bg-gradient-to-br from-[#eff6ff] via-[#f0fdff] to-[#f8fafc] px-5 py-20 text-center md:px-10 md:py-28 border-t border-slate-100">

        {/* Orbes sobre fondo claro */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(6,182,212,0.06) 40%, transparent 70%)", animation: "orb-pulse 5s ease-in-out infinite" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-20 bottom-0 h-[300px] w-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 65%)", animation: "orb-pulse 7s ease-in-out infinite 1s" }}
          aria-hidden="true"
        />

        <div className="relative z-[1] mx-auto max-w-[700px]">
          <p className="mb-5 text-[12px] font-bold tracking-[0.15em] text-[#3b82f6] uppercase">¿Tu sector necesita automatización?</p>
          <h2 className={`${DISPLAY} mb-5 text-balance text-[clamp(32px,5vw,58px)] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#0a0f1e]`}>
            Construimos el SaaS<br />
            <span className="shimmer-text">que tu industria necesita.</span>
          </h2>
          <p className="mx-auto mb-10 max-w-[480px] text-[17px] leading-[1.65] text-slate-500">
            Identificamos el problema, diseñamos la arquitectura y automatizamos el sector con agentes IA especializados.
          </p>
          <Link
            href={`${prefix}/contact`}
            className="btn-glow inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-10 py-[18px] text-[16px] font-bold text-white transition-all duration-300"
            style={{ boxShadow: "0 0 20px rgba(59,130,246,.35), 0 0 50px rgba(6,182,212,.15)" }}
          >
            Hablar con Drako
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-100">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-5 py-8 md:px-10">
          <span className={`${DISPLAY} shimmer-text text-base font-extrabold`}>DRAKO</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-slate-400">
            <Link href="/aviso-legal" className="transition-colors hover:text-[#3b82f6]">Aviso legal</Link>
            <Link href="/privacidad" className="transition-colors hover:text-[#3b82f6]">Privacidad</Link>
            <Link href="/cookies" className="transition-colors hover:text-[#3b82f6]">Cookies</Link>
            <span>© 2026 Drako Systems</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
