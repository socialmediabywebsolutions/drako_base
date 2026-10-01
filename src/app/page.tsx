import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { StatCounter } from "@/components/marketing/home/StatCounter";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const SY = "font-[family-name:var(--font-syne)]";

type PStatus = "live" | "beta" | "dev";

interface Product {
  name: string;
  sector: string;
  outcome: string;
  description: string;
  status: PStatus;
  statusLabel: string;
  url?: string;
  icon: string;
}

const PRODUCTS: Product[] = [
  {
    name: "Socialcors",
    sector: "Marketing digital · Redes sociales",
    outcome: "30+ posts al mes sin tocar nada",
    description:
      "El Cerebro crea, programa y publica en Instagram, LinkedIn, TikTok y más — aprendiendo de tu marca y de las tendencias del momento. Tu comunidad crece mientras tú haces otra cosa.",
    status: "live",
    statusLabel: "Disponible ahora",
    url: "https://socialcors.com",
    icon: "📱",
  },
  {
    name: "Mentoría",
    sector: "Educación · Apoyo académico",
    outcome: "Cada alumno aprende a su ritmo, sin más profesores",
    description:
      "Tutores IA que se adaptan al nivel de cada estudiante. Los padres siguen el progreso por WhatsApp en tiempo real. Sin contratar.",
    status: "beta",
    statusLabel: "Beta",
    icon: "🎓",
  },
  {
    name: "Crypto IA",
    sector: "Inversión · Trading",
    outcome: "El mercado, analizado las 24 horas",
    description:
      "Agentes especializados que monitorizan y alertan sobre oportunidades — RSI, MACD, Fibonacci — explicados en lenguaje humano.",
    status: "dev",
    statusLabel: "Próximamente",
    icon: "📊",
  },
  {
    name: "Cazh",
    sector: "Finanzas · Pagos",
    outcome: "Pagos y cobros sin gestión manual",
    description:
      "Wallet, transferencias y tarjetas virtuales con scoring financiero automatizado. La cuenta bancaria inteligente para tu empresa.",
    status: "dev",
    statusLabel: "Próximamente",
    icon: "💳",
  },
  {
    name: "Rentia",
    sector: "Inmobiliaria · Alquileres",
    outcome: "Tu cartera inmobiliaria, autogestionada",
    description:
      "La IA gestiona contratos, cobros e incidencias. Evalúa inquilinos y predice riesgos de impago antes de que ocurran.",
    status: "dev",
    statusLabel: "Próximamente",
    icon: "🏠",
  },
];

const TICKER = [
  "📱 Post publicado en Instagram — Restaurante La Mar — +847 likes",
  "📈 +45% engagement esta semana — Clínica Dental Plus",
  "✍️ 12 posts generados para la semana — Academia FitLife",
  "🚀 Campaña lanzada en LinkedIn — Inmobiliaria Torres — +230 impresiones",
  "💬 Respuestas automáticas activas 24h — E-commerce Modavida",
  "📊 Análisis mensual completado — Bufete García",
  "🎯 Nuevo lead captado vía contenido IA — SaaS TechPro",
  "⚡ 98 posts publicados este mes — Agencia Digital X",
];

const METRICS = [
  { value: 98,  suffix: "%", label: "más engagement" },
  { value: 5,   suffix: "x", label: "más publicaciones" },
  { value: 24,  suffix: "h", label: "operación continua" },
  { value: 30,  suffix: "%", label: "menos costes marketing" },
];

const FEED = [
  { icon: "📸", action: "Post publicado en Instagram", client: "Restaurante La Mar", result: "+847 likes" },
  { icon: "📈", action: "Análisis completado", client: "Clínica Dental Plus", result: "+45% reach" },
  { icon: "✍️", action: "12 posts generados", client: "Academia FitLife", result: "semana próxima" },
  { icon: "🚀", action: "Campaña LinkedIn activa", client: "Inmobiliaria Torres", result: "+230 imprs." },
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

  const matchedPath =
    headersList.get("x-matched-path") ||
    headersList.get("x-invoke-path") ||
    headersList.get("next-url") ||
    "/";
  const locale = resolveMarketingLocale(
    resolvedParams?.locale ?? (matchedPath.split("/")[1] || undefined)
  );
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;

  const tickerDouble = [...TICKER, ...TICKER];

  return (
    <div
      className={`${syne.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-white font-[family-name:var(--font-dm-sans)] text-[#07111f]`}
    >
      <style>{`
        /* ── TOKENS ─────────────────────────────── */
        :root {
          --bl: #3b82f6;
          --cy: #06b6d4;
          --nv: #07111f;
          --sf: #f0f6ff;
          --bdr: #dbeafe;
          --mid: #64748b;
        }

        /* ── GRADIENT TEXT ───────────────────────── */
        .g {
          background: linear-gradient(110deg, var(--bl) 10%, var(--cy) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── NAV ─────────────────────────────────── */
        .topnav {
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .nl {
          font-size: 14px; font-weight: 500; color: var(--mid);
          transition: color .18s;
        }
        .nl:hover { color: var(--nv); }

        /* ── CTA BUTTONS ─────────────────────────── */
        .cbtn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(108deg, var(--bl) 0%, var(--cy) 100%);
          color: #fff;
          font-family: var(--font-syne), sans-serif;
          font-weight: 800; font-size: 15px;
          padding: 14px 28px; border-radius: 12px;
          box-shadow: 0 4px 24px rgba(59,130,246,.32);
          transition: transform .2s, box-shadow .2s;
          white-space: nowrap;
        }
        .cbtn:hover { transform: translateY(-3px); box-shadow: 0 10px 40px rgba(59,130,246,.42); }

        .cbtn-sm {
          padding: 10px 20px; font-size: 14px; border-radius: 10px;
        }

        .obtn {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: var(--bl);
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 15px;
          padding: 13px 26px; border-radius: 12px;
          border: 1.5px solid rgba(59,130,246,.28);
          transition: all .2s;
        }
        .obtn:hover { background: rgba(59,130,246,.05); border-color: var(--bl); transform: translateY(-2px); }

        /* ── HERO BG ─────────────────────────────── */
        .hero-blobs { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .blob {
          position: absolute; border-radius: 50%;
          filter: blur(100px);
        }
        .b1 {
          width: 720px; height: 520px; top: -120px; right: -100px;
          background: radial-gradient(ellipse, rgba(59,130,246,.11), transparent 68%);
          animation: bdrift 13s ease-in-out infinite;
        }
        .b2 {
          width: 480px; height: 400px; bottom: -60px; left: -80px;
          background: radial-gradient(ellipse, rgba(6,182,212,.09), transparent 65%);
          animation: bdrift 17s ease-in-out infinite reverse;
        }
        .b3 {
          width: 380px; height: 280px; top: 55%; left: 38%;
          background: radial-gradient(ellipse, rgba(59,130,246,.06), transparent 65%);
          animation: bdrift 22s ease-in-out infinite;
        }
        @keyframes bdrift {
          0%,100% { transform: translate(0,0); }
          33%      { transform: translate(38px,-28px); }
          66%      { transform: translate(-24px,18px); }
        }

        /* ── LIVE BADGE ──────────────────────────── */
        .live-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(59,130,246,.07);
          border: 1px solid rgba(59,130,246,.2);
          border-radius: 999px; padding: 6px 16px 6px 10px;
          font-size: 13px; font-weight: 600; color: var(--bl);
        }
        .ldot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #10b981;
          animation: ldot-pulse 2s ease-in-out infinite;
        }
        @keyframes ldot-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); }
          50%      { box-shadow: 0 0 0 5px rgba(16,185,129,.0); }
        }

        /* ── AI FEED CARD ────────────────────────── */
        .ai-card {
          background: #fff;
          border: 1px solid var(--bdr);
          border-radius: 22px;
          box-shadow: 0 24px 80px rgba(59,130,246,.1), 0 4px 20px rgba(0,0,0,.04);
          overflow: hidden;
        }
        .ai-header {
          padding: 15px 20px;
          background: var(--sf);
          border-bottom: 1px solid var(--bdr);
          display: flex; align-items: center; gap: 10px;
        }
        .ai-live-label {
          margin-left: auto;
          font-size: 11px; font-weight: 800; letter-spacing: .1em;
          color: #10b981;
        }
        .fi {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid rgba(219,234,254,.4);
          opacity: 0;
          animation: fi-in .4s ease forwards;
        }
        .fi:last-of-type { border-bottom: none; }
        @keyframes fi-in {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .fi:nth-child(1) { animation-delay: .4s; }
        .fi:nth-child(2) { animation-delay: .9s; }
        .fi:nth-child(3) { animation-delay: 1.4s; }
        .fi:nth-child(4) { animation-delay: 1.9s; }
        .fi-result {
          margin-left: auto; white-space: nowrap;
          font-size: 12px; font-weight: 700; color: #059669;
          background: rgba(16,185,129,.1);
          padding: 3px 9px; border-radius: 99px;
        }
        .prog-bar { height: 5px; background: var(--bdr); border-radius: 5px; overflow: hidden; }
        .prog-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--bl), var(--cy));
          border-radius: 5px; width: 0;
          animation: pfill 2.8s ease-out 2.4s forwards;
        }
        @keyframes pfill { to { width: 73%; } }

        /* ── TICKER ──────────────────────────────── */
        .ticker-outer { overflow: hidden; background: var(--sf); border-top: 1px solid var(--bdr); border-bottom: 1px solid var(--bdr); }
        .ticker-track {
          display: flex; width: max-content;
          animation: tick 32s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes tick {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .ti {
          padding: 13px 40px;
          font-size: 14px; font-weight: 500; color: var(--mid);
          white-space: nowrap;
          border-right: 1px solid var(--bdr);
        }

        /* ── METRIC CELLS ────────────────────────── */
        .mcell {
          text-align: center; padding: 44px 20px;
          border-right: 1px solid var(--bdr);
        }
        .mcell:last-child { border-right: none; }

        /* ── PRODUCT CARDS ───────────────────────── */
        .pc {
          background: #fff;
          border: 1.5px solid var(--bdr);
          border-radius: 20px;
          padding: 32px;
          position: relative;
          transition: transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s, border-color .25s;
          overflow: hidden;
        }
        .pc::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--bl), var(--cy));
          opacity: 0;
          transition: opacity .25s;
        }
        .pc:hover { transform: translateY(-6px); box-shadow: 0 20px 56px rgba(59,130,246,.13); border-color: rgba(59,130,246,.3); }
        .pc:hover::after { opacity: 1; }
        .pc-icon { font-size: 40px; line-height: 1; display: block; margin-bottom: 20px; }
        .pc-sector {
          font-size: 11px; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; color: var(--bl); margin-bottom: 8px;
        }
        .pc-name {
          font-family: var(--font-syne), sans-serif;
          font-weight: 800; font-size: 24px; color: var(--nv);
          margin-bottom: 10px;
        }
        .pc-outcome {
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 18px;
          color: var(--nv); line-height: 1.25;
          margin-bottom: 14px;
        }
        .pc-desc { font-size: 14px; line-height: 1.65; color: var(--mid); margin-bottom: 24px; }
        .sp-live { background: rgba(16,185,129,.1); color: #059669; }
        .sp-beta { background: rgba(245,158,11,.1); color: #d97706; }
        .sp-dev  { background: rgba(148,163,184,.1); color: #64748b; }
        .sp {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700;
          padding: 4px 12px; border-radius: 99px;
        }
        .cl {
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 14px; color: var(--bl);
          display: inline-flex; align-items: center; gap: 5px;
          transition: gap .2s, color .2s;
        }
        .cl:hover { gap: 9px; color: var(--cy); }

        /* ── FEATURED CARD ───────────────────────── */
        .pc-featured {
          background: linear-gradient(135deg, #f0f6ff 0%, #e8f4ff 100%);
          border: 1.5px solid rgba(59,130,246,.2);
          border-radius: 24px;
          padding: 48px;
          position: relative;
          overflow: hidden;
          transition: box-shadow .25s, transform .25s;
          margin-bottom: 24px;
        }
        .pc-featured::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--bl), var(--cy));
        }
        .pc-featured:hover { transform: translateY(-4px); box-shadow: 0 24px 64px rgba(59,130,246,.15); }

        /* ── REVEAL ──────────────────────────────── */
        .rv {
          opacity: 0; transform: translateY(26px);
          transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
        }
        .rv.vis { opacity: 1; transform: none; }
        .d1{transition-delay:.06s} .d2{transition-delay:.14s}
        .d3{transition-delay:.22s} .d4{transition-delay:.30s}
        .d5{transition-delay:.38s}

        /* ── CTA SECTION ─────────────────────────── */
        .cta-section {
          background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 35%, #0284c7 65%, #0891b2 100%);
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 900px 600px at 15% 50%, rgba(255,255,255,.07), transparent),
            radial-gradient(ellipse 600px 400px at 85% 50%, rgba(6,182,212,.25), transparent);
          pointer-events: none;
        }
        .wbtn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #fff; color: #1d4ed8;
          font-family: var(--font-syne), sans-serif;
          font-weight: 800; font-size: 16px;
          padding: 17px 34px; border-radius: 14px;
          box-shadow: 0 8px 36px rgba(0,0,0,.14);
          transition: transform .2s, box-shadow .2s;
        }
        .wbtn:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,.22); }

        /* ── ARROW ───────────────────────────────── */
        .arr { display: inline-block; transition: transform .2s; }
        a:hover .arr, button:hover .arr { transform: translateX(4px); }

        /* ── REDUCED MOTION ──────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
          .rv { opacity: 1 !important; transform: none !important; }
        }

        /* ── MOBILE ──────────────────────────────── */
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .feed-col  { display: none !important; }
        }
        @media (max-width: 768px) {
          .met-grid { grid-template-columns: 1fr 1fr !important; }
          .mcell { border-right: none; border-bottom: 1px solid var(--bdr); }
          .mcell:nth-child(odd) { border-right: 1px solid var(--bdr) !important; }
          .prod-grid { grid-template-columns: 1fr !important; }
          .pc-featured { padding: 32px; }
          .feat-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav className="topnav sticky top-0 z-50 border-b border-slate-100/70">
        <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between gap-8">
          <Link href={`${prefix}/`} className={`${SY} text-[22px] font-extrabold tracking-tight text-[#07111f]`}>
            drako<span className="g">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href={`${prefix}/ecosystem`} className="nl">Ecosistema</Link>
            <Link href={`${prefix}/journal`}    className="nl">Journal IA</Link>
            <Link href="https://socialcors.com" className="nl" target="_blank">Socialcors</Link>
          </div>
          <Link href="https://socialcors.com" target="_blank" className="cbtn cbtn-sm">
            Empieza gratis <span className="arr">→</span>
          </Link>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative flex items-center min-h-screen py-24 px-6 bg-white overflow-hidden">
        <div className="hero-blobs">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <div
            className="hero-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "72px", alignItems: "center" }}
          >
            {/* LEFT */}
            <div>
              <div className="live-badge mb-10">
                <span className="ldot" />
                Socialcors disponible — sin tarjeta de crédito
              </div>

              <h1
                className={`${SY} font-extrabold leading-[.92] tracking-tight text-[#07111f] mb-6`}
                style={{ fontSize: "clamp(46px, 6.5vw, 84px)" }}
              >
                Automatiza<br />
                tu empresa<br />
                <span className="g">con IA.</span>
              </h1>

              <p
                className="text-[#64748b] leading-relaxed mb-10"
                style={{ fontSize: "clamp(17px, 1.8vw, 20px)", maxWidth: "480px" }}
              >
                Drako construye agentes de inteligencia artificial que gestionan sectores completos — marketing, educación, finanzas, inversión, inmobiliaria.
                Tu equipo hace lo que importa. La IA hace el resto, las 24 horas.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link href="https://socialcors.com" target="_blank" className="cbtn">
                  Ver Socialcors <span className="arr">→</span>
                </Link>
                <Link href={`${prefix}/ecosystem`} className="obtn">
                  Explorar el ecosistema
                </Link>
              </div>

              <div
                className="mt-14 pt-10 border-t border-[#dbeafe]"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}
              >
                {[
                  { v: "5", label: "SaaS de IA" },
                  { v: "24h", label: "sin parar" },
                  { v: "0€", label: "para empezar" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className={`${SY} font-extrabold text-[28px] g leading-none mb-1`}>{s.v}</p>
                    <p className="text-[13px] text-[#94a3b8] font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — AI feed */}
            <div className="feed-col">
              <div className="ai-card">
                <div className="ai-header">
                  <span className="ldot" />
                  <span className={`${SY} font-bold text-[13px] text-[#07111f]`}>
                    Cerebro Socialcors
                  </span>
                  <span className="ai-live-label">EN VIVO</span>
                </div>

                <div>
                  {FEED.map((item, i) => (
                    <div key={i} className="fi">
                      <span style={{ fontSize: "20px", flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-[13px] font-semibold text-[#07111f] leading-none mb-1">
                          {item.action}
                        </p>
                        <p className="text-[12px] text-[#94a3b8]">{item.client}</p>
                      </div>
                      <span className="fi-result">{item.result}</span>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 border-t border-[#dbeafe]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-[#64748b]">Generando semana del 7 oct…</span>
                    <span className={`${SY} text-[12px] font-bold text-[#3b82f6]`}>73%</span>
                  </div>
                  <div className="prog-bar">
                    <div className="prog-fill" />
                  </div>
                </div>

                <div className="px-5 py-4 bg-[#f0f6ff] border-t border-[#dbeafe]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#64748b]">Próxima publicación programada</span>
                    <span className={`${SY} text-[12px] font-bold text-[#07111f]`}>mañana 09:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <div className="ticker-outer">
        <div className="ticker-track">
          {tickerDouble.map((item, i) => (
            <div key={i} className="ti">{item}</div>
          ))}
        </div>
      </div>

      {/* ═══ METRICS ═══ */}
      <section className="bg-white border-b border-[#dbeafe]">
        <div className="max-w-5xl mx-auto">
          <div
            className="met-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}
          >
            {METRICS.map((m, i) => (
              <div key={m.label} className={`mcell rv d${i + 1}`}>
                <p className={`${SY} font-extrabold g leading-none mb-2`} style={{ fontSize: "52px" }}>
                  <StatCounter value={m.value} suffix={m.suffix} />
                </p>
                <p className="text-[14px] text-[#64748b] font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRODUCTS ═══ */}
      <section className="py-28 px-6 bg-[#f7faff]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 rv">
            <p
              className={`${SY} font-bold tracking-[.18em] uppercase text-[#3b82f6] mb-4`}
              style={{ fontSize: "11px" }}
            >
              El ecosistema Drako
            </p>
            <h2
              className={`${SY} font-extrabold text-[#07111f] leading-[1.01]`}
              style={{ fontSize: "clamp(36px, 4.5vw, 56px)" }}
            >
              Tu sector, automatizado.<br />
              <span className="g">Elige el que te corresponde.</span>
            </h2>
          </div>

          {/* Featured: Socialcors */}
          <div className="pc-featured rv">
            <div
              className="feat-inner"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center" }}
            >
              <div>
                <span className="pc-icon">{PRODUCTS[0].icon}</span>
                <p className="pc-sector">{PRODUCTS[0].sector}</p>
                <h3 className={`${SY} font-extrabold text-[#07111f] mb-3`} style={{ fontSize: "36px" }}>
                  {PRODUCTS[0].name}
                </h3>
                <p className={`${SY} font-bold text-[22px] text-[#07111f] leading-snug`}>
                  {PRODUCTS[0].outcome}.
                </p>
              </div>
              <div>
                <p className="text-[16px] text-[#475569] leading-relaxed mb-8">
                  {PRODUCTS[0].description}
                </p>
                <div className="flex items-center gap-5">
                  <span className="sp sp-live">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    {PRODUCTS[0].statusLabel}
                  </span>
                  <a
                    href={PRODUCTS[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cbtn"
                    style={{ fontSize: "14px", padding: "11px 22px", borderRadius: "10px" }}
                  >
                    Acceder a Socialcors <span className="arr">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 4 remaining products */}
          <div
            className="prod-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px" }}
          >
            {PRODUCTS.slice(1).map((p, i) => {
              const sc = p.status === "beta" ? "sp-beta" : "sp-dev";
              return (
                <div key={p.name} className={`pc rv d${i + 1}`}>
                  <span className="pc-icon">{p.icon}</span>
                  <p className="pc-sector">{p.sector}</p>
                  <h3 className="pc-name">{p.name}</h3>
                  <p className="pc-outcome">{p.outcome}.</p>
                  <p className="pc-desc">{p.description}</p>
                  <span className={`sp ${sc}`}>{p.statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ WHY ═══ */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "80px", alignItems: "start" }}
          >
            <div className="rv">
              <p
                className={`${SY} font-bold tracking-[.18em] uppercase text-[#3b82f6] mb-4`}
                style={{ fontSize: "11px" }}
              >
                Por qué Drako
              </p>
              <h2
                className={`${SY} font-extrabold text-[#07111f] leading-[1.03]`}
                style={{ fontSize: "clamp(32px, 3.8vw, 50px)" }}
              >
                Tu negocio, multiplicado<br />
                <span className="g">por inteligencia artificial.</span>
              </h2>
              <p className="text-[#64748b] leading-relaxed mt-6 text-[16px]">
                No vendemos software. Vendemos tiempo, escala y resultados. Cada SaaS de Drako automatiza un departamento completo — sin contratar, sin formar, sin esperar.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
              {[
                {
                  n: "01",
                  h: "Sin curva de aprendizaje",
                  b: "La IA aprende de tu negocio, tu voz y tus resultados. Cuanto más la usas, mejor trabaja — sin que toques una sola configuración.",
                },
                {
                  n: "02",
                  h: "Resultados desde el primer día",
                  b: "Cada acción genera métricas reales. Publicaciones que llegan a más personas, clientes que responden, tiempo que recuperas.",
                },
                {
                  n: "03",
                  h: "Escala sin contratar a nadie",
                  b: "La misma IA que gestiona 10 clientes gestiona 1.000. Tu empresa crece sin que crezcan tus costes de personal.",
                },
              ].map((s) => (
                <div key={s.n} className="rv" style={{ display: "flex", gap: "24px" }}>
                  <span className={`${SY} font-extrabold text-[28px] g leading-none`} style={{ flexShrink: 0 }}>
                    {s.n}
                  </span>
                  <div>
                    <h3 className={`${SY} font-bold text-[18px] text-[#07111f] mb-2`}>{s.h}</h3>
                    <p className="text-[14px] text-[#64748b] leading-relaxed">{s.b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta-section py-36 px-6">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2
            className={`${SY} font-extrabold text-white leading-[.94] mb-7`}
            style={{ fontSize: "clamp(40px, 5.5vw, 72px)" }}
          >
            La IA trabaja.<br />
            Tú decides qué hacer<br />
            con el tiempo libre.
          </h2>
          <p className="text-blue-100/80 leading-relaxed mb-12 max-w-xl mx-auto" style={{ fontSize: "18px" }}>
            Socialcors está en producción hoy. Sin permanencias, sin tarjeta de crédito.
            14 días gratis — ve los resultados antes de pagar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://socialcors.com" target="_blank" className="wbtn">
              Empezar gratis — 14 días <span className="arr">→</span>
            </Link>
            <Link
              href={`${prefix}/ecosystem`}
              className={`${SY} inline-flex items-center gap-2 text-white/70 hover:text-white font-bold text-[15px] transition-colors`}
            >
              Ver todo el ecosistema <span className="arr">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-white border-t border-[#dbeafe] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <span className={`${SY} text-[20px] font-extrabold text-[#07111f] tracking-tight`}>
            drako<span className="g">.</span>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: "Ecosistema", href: `${prefix}/ecosystem` },
              { label: "Journal IA",  href: `${prefix}/journal` },
              { label: "Socialcors",  href: "https://socialcors.com", ext: true },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-sm text-[#94a3b8] hover:text-[#3b82f6] transition-colors font-medium"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p className="text-xs text-[#cbd5e1]">© {new Date().getFullYear()} Drako Systems</p>
        </div>
      </footer>

      {/* ═══ SCRIPTS ═══ */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  // Scroll reveal
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('vis'); io.unobserve(e.target); }
    });
  },{threshold:0.1});
  document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });

  // 3-D card tilt
  document.querySelectorAll('.pc').forEach(function(card){
    card.addEventListener('mousemove',function(e){
      var r=card.getBoundingClientRect();
      var rx=((e.clientY-r.top)/r.height-.5)*-10;
      var ry=((e.clientX-r.left)/r.width-.5)*10;
      card.style.transform='perspective(900px) rotateX('+rx+'deg) rotateY('+ry+'deg) translateY(-6px)';
    });
    card.addEventListener('mouseleave',function(){
      card.style.transform='';
    });
  });
})();
          `,
        }}
      />
    </div>
  );
}
