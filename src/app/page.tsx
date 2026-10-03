import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { StatCounter } from "@/components/marketing/home/StatCounter";

// ─── NUEVA TIPOGRAFÍA: Space Grotesk (nada de Syne) ───────────────────────
const sg = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--sg",
  display: "swap",
});

// ─── ASSETS DRAKO EN R2 ───────────────────────────────────────────────────
const LOGO =
  "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo%20drako.png";

const isHostMode = (v: string | null): v is HostMode =>
  v === "CAMPAMENTO_BASE" || v === "PREVIEW" || v === "PUBLIC_SAAS";

type PStatus = "live" | "beta" | "dev";

interface Product {
  name: string;
  sector: string;
  outcome: string;
  body: string;
  status: PStatus;
  label: string;
  url?: string;
  icon: string;
  accent: "blue" | "cyan";
}

const PRODUCTS: Product[] = [
  {
    name: "Socialcors",
    sector: "Marketing · Redes sociales",
    outcome: "30+ posts al mes sin tocar nada",
    body: "El Cerebro crea, programa y publica en Instagram, LinkedIn y TikTok — aprendiendo de tu marca y tendencias. Tu comunidad crece sola.",
    status: "live",
    label: "Disponible ahora",
    url: "https://socialcors.com",
    icon: "📱",
    accent: "blue",
  },
  {
    name: "Mentoría",
    sector: "Educación",
    outcome: "Cada alumno aprende a su ritmo",
    body: "Tutores IA que se adaptan al nivel de cada estudiante. Padres informados por WhatsApp. Sin contratar más profesores.",
    status: "beta",
    label: "Beta",
    icon: "🎓",
    accent: "cyan",
  },
  {
    name: "Crypto IA",
    sector: "Inversión · Trading",
    outcome: "El mercado, analizado 24 horas",
    body: "Agentes que monitorizan y alertan sobre oportunidades — RSI, MACD, Fibonacci — en lenguaje humano, en tiempo real.",
    status: "dev",
    label: "Próximamente",
    icon: "📊",
    accent: "blue",
  },
  {
    name: "Cazh",
    sector: "Finanzas empresariales",
    outcome: "Pagos y cobros sin gestión manual",
    body: "Wallet, transferencias y tarjetas virtuales con scoring financiero automatizado. La cuenta bancaria inteligente.",
    status: "dev",
    label: "Próximamente",
    icon: "💳",
    accent: "cyan",
  },
  {
    name: "Rentia",
    sector: "Inmobiliaria · Alquileres",
    outcome: "Tu cartera inmobiliaria, autogestionada",
    body: "La IA gestiona contratos, cobros e incidencias. Evalúa inquilinos y predice riesgos de impago antes de que ocurran.",
    status: "dev",
    label: "Próximamente",
    icon: "🏠",
    accent: "blue",
  },
];

const TICKER = [
  "📱 Post publicado en Instagram — Restaurante La Mar — +847 likes",
  "📈 +45% engagement — Clínica Dental Plus",
  "✍️ 12 posts generados para la semana — Academia FitLife",
  "🚀 Campaña LinkedIn lanzada — Inmobiliaria Torres — +230 impresiones",
  "💬 Respuestas automáticas 24h activas — E-commerce Modavida",
  "📊 Análisis mensual completado — Bufete García",
  "🎯 Nuevo lead captado — SaaS TechPro",
  "⚡ 98 posts publicados este mes — Agencia Digital X",
];

const FEED = [
  { icon: "📸", action: "Post publicado en Instagram", client: "Restaurante La Mar",   result: "+847 likes" },
  { icon: "📈", action: "Análisis completado",         client: "Clínica Dental Plus",  result: "+45% reach" },
  { icon: "✍️", action: "12 posts generados",          client: "Academia FitLife",     result: "semana próxima" },
  { icon: "🚀", action: "Campaña LinkedIn activa",     client: "Inmobiliaria Torres",  result: "+230 imprs." },
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
  const ticker2 = [...TICKER, ...TICKER];

  return (
    <div className={`${sg.variable} min-h-screen overflow-x-hidden bg-white text-[#07111f]`}
         style={{ fontFamily: "var(--sg), system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════════════════════════════════
          ESTILOS GLOBALES
      ══════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ─── TOKENS ─────────────────────────────────────────────────── */
        :root {
          --bl:   #3b82f6;
          --cy:   #06b6d4;
          --nv:   #07111f;
          --sf:   #f0f8ff;
          --stf:  #e8fbff;          /* turquoise surface */
          --bdr:  #dbeafe;
          --cbdr: #a5f3fc;          /* turquoise border */
          --mid:  #64748b;
          --sg:   'Space Grotesk', system-ui, sans-serif;
        }

        /* ─── GRADIENT TEXT ───────────────────────────────────────────── */
        .G  { background: linear-gradient(110deg,#3b82f6 0%,#06b6d4 100%);
              -webkit-background-clip:text; -webkit-text-fill-color:transparent;
              background-clip:text; }
        .GC { background: linear-gradient(110deg,#06b6d4 0%,#3b82f6 100%);
              -webkit-background-clip:text; -webkit-text-fill-color:transparent;
              background-clip:text; }

        /* ─── NAV ─────────────────────────────────────────────────────── */
        .topnav {
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        }
        .nl { font-size:14px; font-weight:600; color:var(--mid); transition:color .18s; }
        .nl:hover { color:var(--nv); }

        /* ─── BUTTONS ─────────────────────────────────────────────────── */
        .btn-blue {
          display:inline-flex; align-items:center; gap:8px;
          background:linear-gradient(108deg,#3b82f6,#06b6d4);
          color:#fff; font-weight:700; font-size:15px; font-family:var(--sg);
          padding:14px 28px; border-radius:12px;
          box-shadow:0 4px 24px rgba(59,130,246,.35);
          transition:transform .2s, box-shadow .2s;
        }
        .btn-blue:hover { transform:translateY(-3px); box-shadow:0 10px 40px rgba(59,130,246,.45); }

        .btn-cyan {
          display:inline-flex; align-items:center; gap:8px;
          background:linear-gradient(108deg,#06b6d4,#3b82f6);
          color:#fff; font-weight:700; font-size:15px; font-family:var(--sg);
          padding:14px 28px; border-radius:12px;
          box-shadow:0 4px 24px rgba(6,182,212,.35);
          transition:transform .2s, box-shadow .2s;
        }
        .btn-cyan:hover { transform:translateY(-3px); box-shadow:0 10px 40px rgba(6,182,212,.45); }

        .btn-out {
          display:inline-flex; align-items:center; gap:8px;
          background:transparent; color:var(--cy);
          font-weight:700; font-size:15px; font-family:var(--sg);
          padding:13px 26px; border-radius:12px;
          border:2px solid rgba(6,182,212,.4);
          transition:all .2s;
        }
        .btn-out:hover { background:rgba(6,182,212,.07); border-color:var(--cy); transform:translateY(-2px); }

        .btn-sm { padding:10px 20px !important; font-size:14px !important; border-radius:10px !important; }

        /* ─── LIVE DOT ────────────────────────────────────────────────── */
        .ldot {
          width:9px; height:9px; border-radius:50%;
          background:#10b981;
          animation:ldot 2s ease-in-out infinite;
        }
        @keyframes ldot {
          0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.5); }
          50%      { box-shadow:0 0 0 6px rgba(16,185,129,.0); }
        }

        /* ─── HERO BACKGROUND ─────────────────────────────────────────── */
        .hero-section {
          background: white;
          position: relative; overflow:hidden;
        }
        /* Dot grid */
        .hero-section::before {
          content:'';
          position:absolute; inset:0; pointer-events:none;
          background-image: radial-gradient(circle, rgba(59,130,246,.14) 1.5px, transparent 1.5px);
          background-size:36px 36px;
        }
        .hblob {
          position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none;
        }
        .hb1 {
          width:700px; height:500px; top:-100px; right:-80px;
          background: radial-gradient(ellipse, rgba(59,130,246,.14), transparent 65%);
          animation: hbmove 12s ease-in-out infinite;
        }
        .hb2 {
          width:500px; height:400px; bottom:-60px; left:-60px;
          background: radial-gradient(ellipse, rgba(6,182,212,.12), transparent 65%);
          animation: hbmove 17s ease-in-out infinite reverse;
        }
        .hb3 {
          width:350px; height:280px; top:50%; left:42%;
          background: radial-gradient(ellipse, rgba(6,182,212,.08), transparent 65%);
          animation: hbmove 22s ease-in-out infinite;
        }
        @keyframes hbmove {
          0%,100% { transform:translate(0,0); }
          33%      { transform:translate(40px,-28px); }
          66%      { transform:translate(-28px,20px); }
        }

        /* ─── AI FEED CARD ────────────────────────────────────────────── */
        .ai-card {
          background:#fff;
          border:1.5px solid var(--cbdr);
          border-radius:22px;
          box-shadow:0 0 0 4px rgba(6,182,212,.06), 0 24px 72px rgba(6,182,212,.12), 0 4px 16px rgba(0,0,0,.04);
          overflow:hidden;
        }
        .ai-hdr {
          padding:14px 18px;
          background: linear-gradient(135deg, #f0fbff, #e8f4ff);
          border-bottom:1.5px solid var(--cbdr);
          display:flex; align-items:center; gap:10px;
        }
        .ai-live {
          margin-left:auto;
          font-size:10px; font-weight:800; letter-spacing:.12em; color:#06b6d4;
          border:1.5px solid rgba(6,182,212,.3);
          background:rgba(6,182,212,.07);
          padding:3px 8px; border-radius:6px;
        }
        .fi {
          display:flex; align-items:center; gap:12px;
          padding:13px 18px;
          border-bottom:1px solid rgba(165,243,252,.3);
          opacity:0;
          animation:fiin .4s ease forwards;
        }
        .fi:last-of-type { border-bottom:none; }
        @keyframes fiin { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:none} }
        .fi:nth-child(1){animation-delay:.4s}
        .fi:nth-child(2){animation-delay:.9s}
        .fi:nth-child(3){animation-delay:1.4s}
        .fi:nth-child(4){animation-delay:1.9s}
        .fi-tag {
          margin-left:auto; white-space:nowrap;
          font-size:11px; font-weight:700; color:#059669;
          background:rgba(16,185,129,.1); padding:3px 8px; border-radius:99px;
        }
        .prog-bar { height:5px; background:rgba(6,182,212,.15); border-radius:5px; overflow:hidden; }
        .prog-fill {
          height:100%;
          background:linear-gradient(90deg,#3b82f6,#06b6d4);
          border-radius:5px; width:0;
          animation:pfill 2.8s ease-out 2.4s forwards;
        }
        @keyframes pfill { to{width:73%} }

        /* ─── TICKER ──────────────────────────────────────────────────── */
        .ticker-wrap {
          overflow:hidden;
          background:linear-gradient(90deg, rgba(6,182,212,.08) 0%, rgba(59,130,246,.06) 100%);
          border-top:1.5px solid rgba(6,182,212,.2);
          border-bottom:1.5px solid rgba(6,182,212,.2);
        }
        .ticker-track {
          display:flex; width:max-content;
          animation:tick 32s linear infinite;
        }
        .ticker-track:hover { animation-play-state:paused; }
        @keyframes tick { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .ti {
          padding:13px 36px;
          font-size:13px; font-weight:600; color:#0e7490;
          white-space:nowrap;
          border-right:1.5px solid rgba(6,182,212,.2);
        }

        /* ─── METRICS ─────────────────────────────────────────────────── */
        .mcell {
          text-align:center; padding:44px 20px;
          border-right:1px solid var(--bdr);
        }
        .mcell:last-child { border-right:none; }

        /* ─── PRODUCT CARDS — Gradient border always visible ──────────── */
        /* Technique: ::before pseudo with mask to create gradient border  */
        .pc {
          background:#fff;
          border-radius:18px;
          padding:32px;
          position:relative;
          isolation:isolate;
          transition:transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s;
        }
        /* gradient border at 35% opacity at rest */
        .pc::before {
          content:'';
          position:absolute; inset:0; border-radius:18px; padding:1.5px;
          background:linear-gradient(135deg, rgba(59,130,246,.4), rgba(6,182,212,.4));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          transition:background .28s;
        }
        .pc:hover { transform:translateY(-8px); box-shadow:0 0 40px rgba(6,182,212,.22), 0 12px 48px rgba(59,130,246,.12); }
        .pc:hover::before {
          background:linear-gradient(135deg,#3b82f6,#06b6d4);
        }
        /* cyan accent cards */
        .pc.ac-cyan::before {
          background:linear-gradient(135deg, rgba(6,182,212,.45), rgba(59,130,246,.35));
        }
        .pc.ac-cyan:hover::before {
          background:linear-gradient(135deg,#06b6d4,#3b82f6);
        }
        .pc.ac-cyan:hover { box-shadow:0 0 40px rgba(6,182,212,.28), 0 12px 48px rgba(6,182,212,.12); }

        .pc-icon { font-size:40px; line-height:1; display:block; margin-bottom:20px; }
        .pc-sector {
          font-size:11px; font-weight:700; letter-spacing:.15em;
          text-transform:uppercase; margin-bottom:8px;
        }
        .pc-name { font-weight:700; font-size:24px; color:var(--nv); margin-bottom:10px; }
        .pc-out  { font-weight:700; font-size:18px; color:var(--nv); line-height:1.25; margin-bottom:14px; }
        .pc-body { font-size:14px; line-height:1.65; color:var(--mid); margin-bottom:24px; }
        .sp {
          display:inline-flex; align-items:center; gap:6px;
          font-size:12px; font-weight:700; padding:4px 12px; border-radius:99px;
        }
        .sp-live { background:rgba(16,185,129,.1); color:#059669; }
        .sp-beta { background:rgba(245,158,11,.1); color:#d97706; }
        .sp-dev  { background:rgba(148,163,184,.12); color:#64748b; }
        .clink {
          font-weight:700; font-size:14px; color:var(--bl);
          display:inline-flex; align-items:center; gap:5px;
          transition:gap .2s, color .2s;
        }
        .clink:hover { gap:9px; color:var(--cy); }

        /* ─── FEATURED SOCIALCORS ─────────────────────────────────────── */
        .pc-feat {
          border-radius:22px; padding:48px;
          position:relative; isolation:isolate;
          background: linear-gradient(145deg, #f0f8ff 0%, #e8fbff 100%);
          transition:transform .28s, box-shadow .28s;
          margin-bottom:24px;
        }
        .pc-feat::before {
          content:'';
          position:absolute; inset:0; border-radius:22px; padding:2px;
          background:linear-gradient(135deg,#3b82f6,#06b6d4);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
        }
        .pc-feat:hover { transform:translateY(-5px); box-shadow:0 0 48px rgba(6,182,212,.2), 0 16px 56px rgba(59,130,246,.15); }

        /* ─── SECTION LABELS (turquoise not blue) ─────────────────────── */
        .label-cy {
          font-size:11px; font-weight:800; letter-spacing:.18em;
          text-transform:uppercase; color:#06b6d4;
          display:block; margin-bottom:16px;
        }
        .label-bl {
          font-size:11px; font-weight:800; letter-spacing:.18em;
          text-transform:uppercase; color:#3b82f6;
          display:block; margin-bottom:16px;
        }

        /* ─── WHY SECTION ─────────────────────────────────────────────── */
        .why-number {
          font-weight:800; font-size:48px; line-height:1;
          margin-bottom:4px;
        }

        /* ─── REVEAL ──────────────────────────────────────────────────── */
        .rv { opacity:0; transform:translateY(28px);
              transition:opacity .72s cubic-bezier(.16,1,.3,1), transform .72s cubic-bezier(.16,1,.3,1); }
        .rv.vis { opacity:1; transform:none; }
        .d1{transition-delay:.06s} .d2{transition-delay:.14s}
        .d3{transition-delay:.22s} .d4{transition-delay:.30s}
        .d5{transition-delay:.38s}

        /* ─── CTA ─────────────────────────────────────────────────────── */
        .cta-sec {
          background:linear-gradient(135deg,#0c2461 0%,#1d4ed8 40%,#0284c7 70%,#06b6d4 100%);
          position:relative; overflow:hidden;
        }
        .cta-sec::before {
          content:'';
          position:absolute; inset:0;
          background:
            radial-gradient(ellipse 900px 600px at 10% 50%, rgba(255,255,255,.07), transparent),
            radial-gradient(ellipse 600px 400px at 90% 50%, rgba(6,182,212,.3), transparent);
          pointer-events:none;
        }
        .btn-wh {
          display:inline-flex; align-items:center; gap:8px;
          background:#fff; color:#1d4ed8;
          font-weight:800; font-size:16px; font-family:var(--sg);
          padding:17px 34px; border-radius:14px;
          box-shadow:0 8px 36px rgba(0,0,0,.15);
          transition:transform .2s, box-shadow .2s;
        }
        .btn-wh:hover { transform:translateY(-3px); box-shadow:0 16px 48px rgba(0,0,0,.22); }

        /* ─── ARROW ───────────────────────────────────────────────────── */
        .arr { display:inline-block; transition:transform .2s; }
        a:hover .arr, button:hover .arr { transform:translateX(5px); }

        /* ─── REDUCED MOTION ──────────────────────────────────────────── */
        @media (prefers-reduced-motion:reduce) {
          *,*::before,*::after { animation:none !important; transition:none !important; }
          .rv { opacity:1 !important; transform:none !important; }
        }

        /* ─── RESPONSIVE ──────────────────────────────────────────────── */
        @media (max-width:920px) {
          .hero-grid  { grid-template-columns:1fr !important; }
          .feed-col   { display:none !important; }
        }
        @media (max-width:768px) {
          .met-grid   { grid-template-columns:1fr 1fr !important; }
          .mcell      { border-right:none; border-bottom:1px solid var(--bdr); }
          .mcell:nth-child(odd) { border-right:1px solid var(--bdr) !important; }
          .prod-grid  { grid-template-columns:1fr !important; }
          .why-grid   { grid-template-columns:1fr !important; }
          .feat-inner { grid-template-columns:1fr !important; }
          .pc-feat    { padding:32px; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          NAV — Logo real de R2
      ══════════════════════════════════════════════════════════════════ */}
      <nav className="topnav sticky top-0 z-50 border-b border-slate-100/70">
        <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between gap-8">
          {/* Logo imagen desde R2 */}
          <Link href={`${prefix}/`} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Drako" width={36} height={36}
                 style={{ width:36, height:36, objectFit:"contain" }} />
            <span style={{ fontFamily:"var(--sg),sans-serif", fontWeight:700, fontSize:20, color:"#07111f", letterSpacing:"-0.02em" }}>
              drako<span className="G">.</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href={`${prefix}/ecosystem`} className="nl">Ecosistema</Link>
            <Link href={`${prefix}/journal`}    className="nl">Journal IA</Link>
            <Link href="https://socialcors.com" className="nl" target="_blank">Socialcors</Link>
          </div>

          <Link href="https://socialcors.com" target="_blank" className="btn-blue btn-sm">
            Empieza gratis <span className="arr">→</span>
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — dot grid + blobs de color + split layout
      ══════════════════════════════════════════════════════════════════ */}
      <section className="hero-section min-h-screen flex items-center py-24 px-6">
        <div className="hblob hb1" />
        <div className="hblob hb2" />
        <div className="hblob hb3" />

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <div className="hero-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:72, alignItems:"center" }}>

            {/* IZQUIERDA */}
            <div>
              {/* Badge live */}
              <div className="inline-flex items-center gap-2 mb-9"
                   style={{ background:"rgba(6,182,212,.08)", border:"1.5px solid rgba(6,182,212,.25)",
                            borderRadius:999, padding:"6px 16px 6px 10px" }}>
                <span className="ldot" />
                <span style={{ fontSize:13, fontWeight:700, color:"#0891b2" }}>
                  Socialcors disponible — sin tarjeta de crédito
                </span>
              </div>

              {/* Titular — SIN Syne, Space Grotesk */}
              <h1 style={{ fontWeight:800, lineHeight:.92, letterSpacing:"-0.03em",
                           fontSize:"clamp(48px,7vw,88px)", color:"#07111f",
                           marginBottom:24 }}>
                Resolvemos<br />
                tus problemas<br />
                <span className="G">con IA.</span>
              </h1>

              <p style={{ fontSize:"clamp(17px,1.8vw,20px)", color:"#475569",
                          lineHeight:1.65, maxWidth:480, marginBottom:40 }}>
                Drako construye agentes de inteligencia artificial que automatizan sectores completos. Marketing, educación, finanzas, inversión, inmobiliaria. Tu equipo hace lo que importa. La IA hace el resto.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link href="https://socialcors.com" target="_blank" className="btn-blue">
                  Ver Socialcors <span className="arr">→</span>
                </Link>
                <Link href={`${prefix}/ecosystem`} className="btn-out">
                  Explorar ecosistema
                </Link>
              </div>

              {/* Mini stats row */}
              <div className="mt-14 pt-10"
                   style={{ borderTop:"1.5px solid rgba(6,182,212,.2)",
                            display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {[
                  { v: "5",   c: "cy", l: "SaaS de IA" },
                  { v: "24h", c: "bl", l: "sin parar" },
                  { v: "0€",  c: "cy", l: "para empezar" },
                ].map((s) => (
                  <div key={s.l}>
                    <p style={{ fontWeight:800, fontSize:32, lineHeight:1, marginBottom:4 }}
                       className={s.c === "cy" ? "GC" : "G"}>{s.v}</p>
                    <p style={{ fontSize:13, color:"#94a3b8", fontWeight:600 }}>{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* DERECHA — feed IA en vivo */}
            <div className="feed-col">
              <div className="ai-card">
                <div className="ai-hdr">
                  <span className="ldot" />
                  <span style={{ fontWeight:700, fontSize:13, color:"#07111f" }}>Cerebro Socialcors</span>
                  <span className="ai-live">EN VIVO</span>
                </div>

                <div>
                  {FEED.map((item, i) => (
                    <div key={i} className="fi">
                      <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:700, color:"#07111f", lineHeight:1, marginBottom:3 }}>
                          {item.action}
                        </p>
                        <p style={{ fontSize:12, color:"#94a3b8" }}>{item.client}</p>
                      </div>
                      <span className="fi-tag">{item.result}</span>
                    </div>
                  ))}
                </div>

                <div style={{ padding:"14px 18px", borderTop:"1.5px solid rgba(165,243,252,.4)" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom:8 }}>
                    <span style={{ fontSize:12, color:"#64748b" }}>Generando semana del 7 oct…</span>
                    <span style={{ fontSize:12, fontWeight:800, color:"#06b6d4" }}>73%</span>
                  </div>
                  <div className="prog-bar"><div className="prog-fill" /></div>
                </div>

                <div style={{ padding:"12px 18px", background:"linear-gradient(135deg,#f0fbff,#e8f4ff)",
                              borderTop:"1.5px solid rgba(165,243,252,.4)",
                              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#64748b" }}>Próxima publicación</span>
                  <span style={{ fontSize:12, fontWeight:800, color:"#07111f" }}>mañana 09:00</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TICKER — turquesa visible, no azul
      ══════════════════════════════════════════════════════════════════ */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {ticker2.map((item, i) => (
            <div key={i} className="ti">{item}</div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MÉTRICAS — alternando azul y turquesa
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white" style={{ borderBottom:"1px solid #dbeafe" }}>
        <div className="max-w-5xl mx-auto">
          <div className="met-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
            {[
              { value:98,  suffix:"%", label:"más engagement",          cls:"G"  },
              { value:5,   suffix:"x", label:"más publicaciones",       cls:"GC" },
              { value:24,  suffix:"h", label:"de operación continua",   cls:"G"  },
              { value:30,  suffix:"%", label:"menos costes marketing",  cls:"GC" },
            ].map((m, i) => (
              <div key={m.label} className={`mcell rv d${i+1}`}>
                <p className={m.cls} style={{ fontWeight:800, fontSize:56, lineHeight:1, marginBottom:8 }}>
                  <StatCounter value={m.value} suffix={m.suffix} />
                </p>
                <p style={{ fontSize:14, color:"#64748b", fontWeight:600 }}>{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PRODUCTOS — fondo turquesa suave + cards con borde degradado
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ padding:"112px 24px", background:"linear-gradient(160deg,#f0f8ff 0%,#e8fbff 50%,#f0f8ff 100%)" }}>
        <div className="max-w-6xl mx-auto">
          {/* Cabecera */}
          <div className="text-center rv" style={{ marginBottom:56 }}>
            <span className="label-cy">El ecosistema Drako</span>
            <h2 style={{ fontWeight:800, fontSize:"clamp(36px,4.5vw,58px)",
                         lineHeight:.98, letterSpacing:"-0.025em", color:"#07111f" }}>
              Tu sector, automatizado.<br />
              <span className="GC">Elige el que te corresponde.</span>
            </h2>
          </div>

          {/* FEATURED: Socialcors */}
          <div className="pc-feat rv">
            <div className="feat-inner"
                 style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center" }}>
              <div>
                <span className="pc-icon">{PRODUCTS[0].icon}</span>
                <span className="pc-sector" style={{ color:"#06b6d4" }}>{PRODUCTS[0].sector}</span>
                <h3 style={{ fontWeight:800, fontSize:40, color:"#07111f",
                             letterSpacing:"-0.025em", marginBottom:12, lineHeight:1 }}>
                  {PRODUCTS[0].name}
                </h3>
                <p style={{ fontWeight:700, fontSize:22, color:"#07111f", lineHeight:1.2 }}>
                  {PRODUCTS[0].outcome}.
                </p>
              </div>
              <div>
                <p style={{ fontSize:16, color:"#475569", lineHeight:1.65, marginBottom:28 }}>
                  {PRODUCTS[0].body}
                </p>
                <div className="flex items-center gap-5 flex-wrap">
                  <span className="sp sp-live">
                    <span style={{ width:7, height:7, borderRadius:"50%", background:"#10b981", display:"inline-block" }} />
                    {PRODUCTS[0].label}
                  </span>
                  <a href={PRODUCTS[0].url} target="_blank" rel="noopener noreferrer"
                     className="btn-cyan btn-sm">
                    Acceder a Socialcors <span className="arr">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 4 productos restantes */}
          <div className="prod-grid"
               style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:24 }}>
            {PRODUCTS.slice(1).map((p, i) => {
              const sc = p.status === "beta" ? "sp-beta" : "sp-dev";
              return (
                <div key={p.name} className={`pc rv d${i+1}${p.accent==="cyan"?" ac-cyan":""}`}>
                  <span className="pc-icon">{p.icon}</span>
                  <span className="pc-sector" style={{ color: p.accent==="cyan" ? "#06b6d4" : "#3b82f6" }}>
                    {p.sector}
                  </span>
                  <h3 className="pc-name">{p.name}</h3>
                  <p className="pc-out">{p.outcome}.</p>
                  <p className="pc-body">{p.body}</p>
                  <span className={`sp ${sc}`}>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          POR QUÉ DRAKO — blanco, turquesa en números
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ padding:"112px 24px", background:"#fff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="why-grid"
               style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:80, alignItems:"start" }}>

            {/* Izquierda */}
            <div className="rv">
              <span className="label-bl">Por qué Drako</span>
              <h2 style={{ fontWeight:800, fontSize:"clamp(32px,4vw,52px)",
                           lineHeight:1.02, letterSpacing:"-0.025em", color:"#07111f",
                           marginBottom:20 }}>
                Tu negocio,<br />multiplicado<br />
                <span className="G">por IA.</span>
              </h2>
              <p style={{ fontSize:16, color:"#64748b", lineHeight:1.65 }}>
                No vendemos software. Vendemos tiempo, escala y resultados. Cada SaaS de Drako automatiza un departamento completo — sin contratar, sin formar, sin esperar.
              </p>
            </div>

            {/* Derecha — 3 puntos numerados, turquesa en los números */}
            <div style={{ display:"flex", flexDirection:"column", gap:36 }}>
              {[
                { n:"01", c:"GC", h:"Sin curva de aprendizaje",
                  b:"La IA aprende de tu negocio y mejora sola. No hay configuraciones ni formación. Funciona el primer día." },
                { n:"02", c:"G",  h:"Resultados desde el primer día",
                  b:"Cada acción genera métricas reales: publicaciones que llegan a más personas, clientes que responden." },
                { n:"03", c:"GC", h:"Escala sin contratar a nadie",
                  b:"La misma IA que gestiona 10 clientes gestiona 1.000. Tu empresa crece sin que crezcan tus costes." },
              ].map((s) => (
                <div key={s.n} className="rv" style={{ display:"flex", gap:22 }}>
                  <span className={`why-number ${s.c}`} style={{ flexShrink:0 }}>{s.n}</span>
                  <div>
                    <h3 style={{ fontWeight:700, fontSize:18, color:"#07111f", marginBottom:8 }}>{s.h}</h3>
                    <p style={{ fontSize:14, color:"#64748b", lineHeight:1.65 }}>{s.b}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          CTA — gradiente azul → turquesa
      ══════════════════════════════════════════════════════════════════ */}
      <section className="cta-sec" style={{ padding:"144px 24px" }}>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 style={{ fontWeight:800, fontSize:"clamp(40px,5.5vw,74px)",
                       lineHeight:.93, letterSpacing:"-0.03em",
                       color:"#fff", marginBottom:28 }}>
            La IA trabaja.<br />
            Tú decides qué hacer<br />
            con el tiempo libre.
          </h2>
          <p style={{ fontSize:18, color:"rgba(186,230,253,.85)", lineHeight:1.6,
                      marginBottom:48, maxWidth:520, marginInline:"auto" }}>
            Socialcors está en producción hoy. Sin permanencias, sin tarjeta de crédito.
            14 días gratis — ve los resultados antes de pagar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://socialcors.com" target="_blank" className="btn-wh">
              Empezar gratis — 14 días <span className="arr">→</span>
            </Link>
            <Link href={`${prefix}/ecosystem`}
                  style={{ fontWeight:700, fontSize:15, color:"rgba(255,255,255,.75)",
                           display:"inline-flex", alignItems:"center", gap:6,
                           transition:"color .2s" }}>
              Ver todo el ecosistema <span className="arr">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer style={{ background:"#fff", borderTop:"1.5px solid #dbeafe", padding:"40px 24px" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <Link href={`${prefix}/`} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Drako" width={28} height={28}
                 style={{ width:28, height:28, objectFit:"contain" }} />
            <span style={{ fontWeight:700, fontSize:18, color:"#07111f", letterSpacing:"-0.02em" }}>
              drako<span className="G">.</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label:"Ecosistema", href:`${prefix}/ecosystem` },
              { label:"Journal IA",  href:`${prefix}/journal` },
              { label:"Socialcors",  href:"https://socialcors.com", ext:true },
            ].map((l) => (
              <Link key={l.label} href={l.href}
                    {...(l.ext ? { target:"_blank", rel:"noopener noreferrer" } : {})}
                    style={{ fontSize:14, color:"#94a3b8", fontWeight:600,
                             transition:"color .2s" }}
                    className="hover:text-[#06b6d4]">
                {l.label}
              </Link>
            ))}
          </div>
          <p style={{ fontSize:12, color:"#cbd5e1" }}>© {new Date().getFullYear()} Drako Systems</p>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════
          SCRIPTS
      ══════════════════════════════════════════════════════════════════ */}
      <script dangerouslySetInnerHTML={{ __html:`
(function(){
  // Scroll reveal
  var io=new IntersectionObserver(function(e){
    e.forEach(function(x){ if(x.isIntersecting){x.target.classList.add('vis');io.unobserve(x.target);} });
  },{threshold:0.1});
  document.querySelectorAll('.rv').forEach(function(el){io.observe(el);});

  // 3D tilt suave en product cards
  document.querySelectorAll('.pc,.pc-feat').forEach(function(card){
    card.addEventListener('mousemove',function(e){
      var r=card.getBoundingClientRect();
      var rx=((e.clientY-r.top)/r.height-.5)*-12;
      var ry=((e.clientX-r.left)/r.width-.5)*12;
      card.style.transform='perspective(1000px) rotateX('+rx+'deg) rotateY('+ry+'deg) translateY(-8px)';
    });
    card.addEventListener('mouseleave',function(){
      card.style.transform='';
    });
  });
})();
      `}} />
    </div>
  );
}
