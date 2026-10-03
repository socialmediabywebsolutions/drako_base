import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { StatCounter } from "@/components/marketing/home/StatCounter";

const sg = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--sg",
  display: "swap",
});

const LOGO =
  "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo%20drako.png";
const CABECERA =
  "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/cabecera%20drako%20%20linkedin.png";

const isHostMode = (v: string | null): v is HostMode =>
  v === "CAMPAMENTO_BASE" || v === "PREVIEW" || v === "PUBLIC_SAAS";

type PStatus = "live" | "beta" | "dev";

interface Product {
  name: string;
  sector: string;
  tagline: string;
  body: string;
  status: PStatus;
  label: string;
  url?: string;
  icon: string;
}

const PRODUCTS: Product[] = [
  {
    name: "Socialcors",
    sector: "Redes sociales",
    tagline: "30 posts al mes, cero esfuerzo",
    body: "IA que crea, programa y publica en Instagram, LinkedIn y TikTok — aprende tu marca y lo hace todo sola.",
    status: "live",
    label: "Disponible",
    url: "https://socialcors.com",
    icon: "◈",
  },
  {
    name: "Mentoría",
    sector: "Educación",
    tagline: "Tutor IA 24/7 para tus hijos",
    body: "Apoyo personalizado en matemáticas, idiomas y más. Seguimiento de rendimiento directo a los padres por WhatsApp.",
    status: "beta",
    label: "Beta",
    icon: "◉",
  },
  {
    name: "Crypto IA",
    sector: "Finanzas",
    tagline: "Análisis de mercado en tiempo real",
    body: "Agentes especializados que monitorizan, analizan señales y gestionan riesgo. Decisiones basadas en datos, no en intuición.",
    status: "dev",
    label: "Próximamente",
    icon: "◆",
  },
  {
    name: "Cazh",
    sector: "Pagos",
    tagline: "Wallet inteligente con IA",
    body: "Transferencias, tarjetas y scoring financiero. Tu dinero gestionado por inteligencia artificial.",
    status: "dev",
    label: "Próximamente",
    icon: "◇",
  },
  {
    name: "Rentia",
    sector: "Inmobiliario",
    tagline: "Gestión de alquileres automatizada",
    body: "Contratos, cobros, incidencias y evaluación de inquilinos. Todo gestionado por IA sin intervención manual.",
    status: "dev",
    label: "Próximamente",
    icon: "◎",
  },
];

export default async function HomePage() {
  const hdrs = await headers();
  const hostMode = resolveHostMode(hdrs);
  if (hostMode === "CAMPAMENTO_BASE") redirect("/admin");
  if (hostMode === "PUBLIC_SAAS") redirect("/app");

  const locale = resolveMarketingLocale(hdrs) ?? defaultMarketingLocale;

  return (
    <div className={`${sg.variable} drako-root`}>
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --bl: #3b82f6;
          --cy: #06b6d4;
          --bl2: #1d4ed8;
          --cy2: #0891b2;
          --txt: #0f172a;
          --txt2: #475569;
          --bg: #ffffff;
          --bg2: #f8faff;
          --sg: 'Space Grotesk', system-ui, sans-serif;
        }
        html { scroll-behavior: smooth; }
        body { background: var(--bg); color: var(--txt); font-family: var(--sg); -webkit-font-smoothing: antialiased; }
        .drako-root { overflow-x: hidden; }

        /* ── NAV ──────────────────────────────── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 5vw; height: 64px;
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(59,130,246,.12);
        }
        .nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .nav-brand span { font-size: 1.15rem; font-weight: 700; color: var(--txt); letter-spacing: -.02em; }
        .nav-links { display: flex; align-items: center; gap: 2rem; }
        .nav-links a { font-size: .875rem; font-weight: 500; color: var(--txt2); text-decoration: none; transition: color .2s; }
        .nav-links a:hover { color: var(--bl); }
        .nav-cta {
          background: var(--bl); color: #fff !important;
          padding: .45rem 1.2rem; border-radius: 8px;
          font-size: .875rem; font-weight: 600;
          transition: background .2s, transform .15s !important;
        }
        .nav-cta:hover { background: var(--bl2) !important; transform: translateY(-1px); }

        /* ── HERO CABECERA ────────────────────── */
        .hero {
          margin-top: 64px;
          position: relative;
          width: 100%;
          background: #000;
          overflow: hidden;
        }
        .hero-img {
          width: 100%;
          display: block;
          object-fit: cover;
          object-position: center top;
          max-height: 520px;
        }
        .hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,.08) 0%,
            rgba(0,0,0,.15) 50%,
            rgba(255,255,255,1) 100%
          );
        }
        .hero-text {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 3rem 5vw 3.5rem;
        }
        .hero-tagline {
          display: inline-flex; align-items: center; gap: .5rem;
          background: rgba(6,182,212,.12);
          border: 1px solid rgba(6,182,212,.35);
          color: var(--cy2);
          font-size: .8rem; font-weight: 600; letter-spacing: .04em;
          padding: .3rem .9rem; border-radius: 100px;
          margin-bottom: 1.25rem;
          text-transform: uppercase;
        }
        .hero-tagline::before {
          content: ''; width: 7px; height: 7px;
          background: var(--cy); border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,100%{ opacity:1; transform:scale(1); }
          50%{ opacity:.5; transform:scale(1.4); }
        }
        .hero-h1 {
          font-size: clamp(2.4rem, 5vw, 4rem);
          font-weight: 800;
          letter-spacing: -.03em;
          line-height: 1.08;
          color: var(--txt);
          max-width: 720px;
          margin-bottom: 1.25rem;
        }
        .hero-h1 .hl-bl { color: var(--bl); }
        .hero-h1 .hl-cy { color: var(--cy); }
        .hero-sub {
          font-size: 1.1rem; color: var(--txt2); font-weight: 400;
          max-width: 540px; line-height: 1.65;
          margin-bottom: 2rem;
        }
        .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
        .btn-pri {
          display: inline-flex; align-items: center; gap: .5rem;
          background: var(--bl); color: #fff;
          padding: .75rem 1.75rem; border-radius: 10px;
          font-size: 1rem; font-weight: 600;
          text-decoration: none;
          transition: background .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 4px 20px rgba(59,130,246,.35);
        }
        .btn-pri:hover { background: var(--bl2); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(59,130,246,.45); }
        .btn-sec {
          display: inline-flex; align-items: center; gap: .5rem;
          background: transparent; color: var(--cy2);
          padding: .75rem 1.75rem; border-radius: 10px;
          font-size: 1rem; font-weight: 600;
          text-decoration: none;
          border: 2px solid var(--cy);
          transition: background .2s, transform .15s;
        }
        .btn-sec:hover { background: rgba(6,182,212,.08); transform: translateY(-2px); }

        /* ── STATS BAR ────────────────────────── */
        .stats-bar {
          background: linear-gradient(90deg, #f0f8ff, #e8fbff, #f0f8ff);
          border-top: 1.5px solid rgba(6,182,212,.18);
          border-bottom: 1.5px solid rgba(59,130,246,.14);
          padding: 2.5rem 5vw;
          display: flex; align-items: center; justify-content: space-around;
          flex-wrap: wrap; gap: 2rem;
        }
        .stat-item { text-align: center; }
        .stat-num {
          font-size: 2.4rem; font-weight: 800;
          letter-spacing: -.04em; line-height: 1;
          background: linear-gradient(135deg, var(--bl), var(--cy));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .stat-label { font-size: .85rem; color: var(--txt2); font-weight: 500; margin-top: .35rem; }
        .stat-sep { width: 1px; height: 40px; background: rgba(59,130,246,.2); }

        /* ── SECCIÓN: CÓMO FUNCIONA ───────────── */
        .section {
          padding: 6rem 5vw;
        }
        .section-alt { background: var(--bg2); }
        .section-label {
          font-size: .75rem; font-weight: 700; letter-spacing: .1em;
          color: var(--cy2); text-transform: uppercase;
          margin-bottom: .75rem;
        }
        .section-h2 {
          font-size: clamp(1.8rem, 3.5vw, 2.75rem);
          font-weight: 800; letter-spacing: -.03em;
          line-height: 1.12; color: var(--txt);
          max-width: 600px; margin-bottom: 1rem;
        }
        .section-sub {
          font-size: 1.05rem; color: var(--txt2);
          max-width: 520px; line-height: 1.7;
          margin-bottom: 3rem;
        }

        /* ── STEPS ────────────────────────────── */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
        }
        .step-card {
          background: #fff;
          border: 1.5px solid rgba(59,130,246,.12);
          border-radius: 16px;
          padding: 2rem 1.75rem;
          position: relative;
          transition: transform .25s, box-shadow .25s, border-color .25s;
        }
        .step-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(59,130,246,.14);
          border-color: var(--bl);
        }
        .step-n {
          font-size: 3rem; font-weight: 900; letter-spacing: -.05em;
          line-height: 1;
          background: linear-gradient(135deg, rgba(59,130,246,.2), rgba(6,182,212,.2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: .75rem;
        }
        .step-card:nth-child(even) .step-n {
          background: linear-gradient(135deg, rgba(6,182,212,.25), rgba(59,130,246,.2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .step-title { font-size: 1.1rem; font-weight: 700; color: var(--txt); margin-bottom: .5rem; }
        .step-body { font-size: .9rem; color: var(--txt2); line-height: 1.6; }
        .step-accent {
          position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
          border-radius: 0 0 14px 14px;
          background: linear-gradient(90deg, var(--bl), var(--cy));
          transform: scaleX(0); transform-origin: left;
          transition: transform .3s;
        }
        .step-card:hover .step-accent { transform: scaleX(1); }

        /* ── PRODUCTOS ────────────────────────── */
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .pcard {
          background: #fff;
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          transition: transform .28s, box-shadow .28s;
          cursor: default;
        }
        .pcard::before {
          content:'';
          position:absolute; inset:0; border-radius:20px; padding:2px;
          background: linear-gradient(135deg, var(--bl), var(--cy));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: destination-out;
          mask-composite: exclude;
          opacity: .25;
          transition: opacity .28s;
          pointer-events: none;
        }
        .pcard:hover { transform: translateY(-8px); box-shadow: 0 20px 48px rgba(59,130,246,.18); }
        .pcard:hover::before { opacity: 1; }
        .pcard-head {
          padding: 2rem 1.75rem 1.25rem;
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem;
        }
        .pcard-icon {
          width: 52px; height: 52px;
          background: linear-gradient(135deg, rgba(59,130,246,.1), rgba(6,182,212,.08));
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
          border: 1px solid rgba(59,130,246,.14);
          transition: background .28s, transform .28s;
        }
        .pcard:nth-child(even) .pcard-icon {
          background: linear-gradient(135deg, rgba(6,182,212,.1), rgba(59,130,246,.08));
        }
        .pcard:hover .pcard-icon { transform: scale(1.1) rotate(5deg); }
        .pcard-status {
          font-size: .72rem; font-weight: 700; letter-spacing: .06em;
          padding: .25rem .75rem; border-radius: 100px;
          white-space: nowrap;
          text-transform: uppercase;
        }
        .st-live { background: rgba(6,182,212,.12); color: var(--cy2); border: 1px solid rgba(6,182,212,.3); }
        .st-beta { background: rgba(59,130,246,.1); color: var(--bl); border: 1px solid rgba(59,130,246,.25); }
        .st-dev { background: rgba(100,116,139,.08); color: #64748b; border: 1px solid rgba(100,116,139,.2); }
        .pcard-body { padding: 0 1.75rem 2rem; }
        .pcard-sector {
          font-size: .75rem; font-weight: 600; letter-spacing: .06em;
          color: var(--cy2); text-transform: uppercase; margin-bottom: .5rem;
        }
        .pcard:nth-child(even) .pcard-sector { color: var(--bl); }
        .pcard-name { font-size: 1.35rem; font-weight: 800; letter-spacing: -.02em; color: var(--txt); margin-bottom: .3rem; }
        .pcard-tagline { font-size: .9rem; font-weight: 600; color: var(--bl); margin-bottom: .6rem; }
        .pcard:nth-child(even) .pcard-tagline { color: var(--cy2); }
        .pcard-desc { font-size: .875rem; color: var(--txt2); line-height: 1.65; margin-bottom: 1.25rem; }
        .pcard-link {
          display: inline-flex; align-items: center; gap: .4rem;
          font-size: .85rem; font-weight: 600; color: var(--bl);
          text-decoration: none;
          transition: gap .2s, color .2s;
        }
        .pcard-link:hover { gap: .7rem; color: var(--bl2); }

        /* ── WHY DRAKO ────────────────────────── */
        .why-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }
        .why-card {
          padding: 2rem 1.5rem;
          border-radius: 16px;
          background: #fff;
          border: 1.5px solid rgba(59,130,246,.1);
          transition: border-color .25s, box-shadow .25s, transform .25s;
        }
        .why-card:hover {
          border-color: var(--cy);
          box-shadow: 0 8px 32px rgba(6,182,212,.12);
          transform: translateY(-4px);
        }
        .why-ic {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, var(--bl), var(--cy));
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.25rem;
          margin-bottom: 1rem;
          transition: transform .25s;
        }
        .why-card:nth-child(even) .why-ic {
          background: linear-gradient(135deg, var(--cy), var(--bl));
        }
        .why-card:hover .why-ic { transform: scale(1.1) rotate(-5deg); }
        .why-title { font-size: 1rem; font-weight: 700; color: var(--txt); margin-bottom: .4rem; }
        .why-body { font-size: .875rem; color: var(--txt2); line-height: 1.6; }

        /* ── CTA FINAL ────────────────────────── */
        .cta-section {
          padding: 7rem 5vw;
          background: linear-gradient(135deg, #0c2461 0%, #1d4ed8 40%, #0284c7 75%, #06b6d4 100%);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }
        .cta-label {
          display: inline-block;
          background: rgba(255,255,255,.15);
          border: 1px solid rgba(255,255,255,.3);
          color: #a5f3fc;
          font-size: .75rem; font-weight: 700; letter-spacing: .1em;
          padding: .3rem 1rem; border-radius: 100px;
          margin-bottom: 1.5rem;
          text-transform: uppercase;
        }
        .cta-h2 {
          font-size: clamp(2rem, 4vw, 3.25rem);
          font-weight: 800; letter-spacing: -.03em;
          line-height: 1.1; color: #fff;
          max-width: 640px; margin: 0 auto 1.25rem;
        }
        .cta-sub {
          font-size: 1.1rem; color: rgba(255,255,255,.75);
          max-width: 480px; margin: 0 auto 2.5rem;
          line-height: 1.65;
        }
        .btn-white {
          display: inline-flex; align-items: center; gap: .5rem;
          background: #fff; color: var(--bl2);
          padding: .85rem 2.25rem; border-radius: 12px;
          font-size: 1.05rem; font-weight: 700;
          text-decoration: none;
          transition: transform .2s, box-shadow .2s;
          box-shadow: 0 6px 24px rgba(0,0,0,.2);
        }
        .btn-white:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,.25); }

        /* ── FOOTER ───────────────────────────── */
        .footer {
          background: #f8faff;
          border-top: 1px solid rgba(59,130,246,.1);
          padding: 3rem 5vw;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 1.5rem;
        }
        .footer-brand { display: flex; align-items: center; gap: 10px; }
        .footer-brand span { font-size: 1rem; font-weight: 700; color: var(--txt); }
        .footer-copy { font-size: .8rem; color: var(--txt2); }
        .footer-links { display: flex; gap: 1.5rem; }
        .footer-links a { font-size: .8rem; color: var(--txt2); text-decoration: none; transition: color .2s; }
        .footer-links a:hover { color: var(--bl); }

        /* ── TICKER ───────────────────────────── */
        .ticker-wrap {
          overflow: hidden;
          padding: .9rem 0;
          background: linear-gradient(90deg, rgba(6,182,212,.07), rgba(59,130,246,.05), rgba(6,182,212,.07));
          border-top: 1.5px solid rgba(6,182,212,.2);
          border-bottom: 1.5px solid rgba(6,182,212,.18);
        }
        .ticker-track {
          display: flex; gap: 3rem;
          animation: tick 28s linear infinite;
          width: max-content;
        }
        @keyframes tick { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .ti {
          font-size: .8rem; font-weight: 600; letter-spacing: .04em;
          color: var(--cy2); white-space: nowrap;
          display: flex; align-items: center; gap: .5rem;
        }
        .ti::before { content: '●'; font-size: .5rem; color: var(--cy); }

        /* ── REVEAL ───────────────────────────── */
        .rv { opacity:0; transform:translateY(28px); transition:opacity .55s ease, transform .55s ease; }
        .vis { opacity:1; transform:translateY(0); }

        /* ── RESPONSIVE ───────────────────────── */
        @media(max-width:680px){
          .nav-links { display:none; }
          .hero-img { max-height: 300px; }
          .hero-text { padding: 1.5rem 5vw 2rem; }
          .stat-sep { display:none; }
          .stats-bar { justify-content: center; gap: 1.5rem; }
          .footer { flex-direction: column; text-align: center; }
          .footer-links { justify-content: center; }
        }
        @media(prefers-reduced-motion:reduce){
          .rv { opacity:1; transform:none; transition:none; }
          .ticker-track { animation:none; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <a href="#" className="nav-brand">
          <img src={LOGO} alt="Drako" width={36} height={36}
               style={{ width:36, height:36, objectFit:"contain" }} />
          <span>Drako</span>
        </a>
        <div className="nav-links">
          <a href="#productos">Productos</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#por-que-drako">Por qué Drako</a>
          <a href="https://socialcors.com" className="nav-cta">Empezar gratis →</a>
        </div>
      </nav>

      {/* HERO — CABECERA REAL */}
      <section className="hero">
        <img src={CABECERA} alt="Drako — IA para empresas" className="hero-img" />
        <div className="hero-overlay" />
        <div className="hero-text">
          <div className="hero-tagline">Inteligencia artificial · Ecosistema empresarial</div>
          <h1 className="hero-h1">
            Automatizamos tu negocio<br />
            con <span className="hl-bl">inteligencia</span>{" "}
            <span className="hl-cy">artificial.</span>
          </h1>
          <p className="hero-sub">
            Holding tecnológico especializado en crear software de IA que resuelve los
            problemas reales de tu empresa — y lo hace solo.
          </p>
          <div className="hero-actions">
            <a href="https://socialcors.com" className="btn-pri">Ver Socialcors →</a>
            <a href="#productos" className="btn-sec">Explorar productos</a>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker-wrap" aria-hidden>
        <div className="ticker-track">
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{display:"flex",gap:"3rem"}}>
              {["Publicación autónoma en redes","Análisis de tendencias en tiempo real","Agentes IA especializados","Gestión de alquileres sin fricción","Tutores inteligentes 24/7","Análisis crypto con IA","Wallet con scoring financiero","Marketing que se gestiona solo"].map(t=>(
                <span className="ti" key={t}>{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <div className="stats-bar">
        {[
          { value:98, suffix:"%", label:"Tasa de ejecución autónoma" },
          { value:5, suffix:"x", label:"Más productividad media" },
          { value:30, suffix:"+", label:"Posts al mes sin intervención" },
          { value:24, suffix:"h", label:"IA activa sin parar" },
        ].map((s, i) => (
          <div key={s.label} style={{display:"contents"}}>
            {i > 0 && <div className="stat-sep" />}
            <div className="stat-item rv">
              <div className="stat-num">
                <StatCounter value={s.value} suffix={s.suffix} />
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CÓMO FUNCIONA */}
      <section className="section" id="como-funciona">
        <div className="section-label">El proceso</div>
        <h2 className="section-h2">De cero a automatizado en 24 horas</h2>
        <p className="section-sub">
          Sin configuraciones complejas, sin curvas de aprendizaje. Conectas,
          la IA aprende tu negocio y empieza a trabajar.
        </p>
        <div className="steps-grid">
          {[
            { n:"01", title:"Conectas tu negocio", body:"Tu marca, tus redes, tus objetivos. La IA absorbe el contexto completo en minutos." },
            { n:"02", title:"La IA aprende tu voz", body:"Analiza tu historial, tu audiencia y las tendencias de tu sector. Construye tu identidad digital." },
            { n:"03", title:"Crea y publica solo", body:"Posts, análisis, respuestas. Todo ejecutado de forma autónoma con tu estilo y sin errores." },
            { n:"04", title:"Aprende y mejora", body:"Cada resultado alimenta el sistema. La IA se vuelve más precisa y efectiva con cada ciclo." },
          ].map(s => (
            <div className="step-card rv" key={s.n}>
              <div className="step-n">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
              <div className="step-accent" />
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTOS */}
      <section className="section section-alt" id="productos">
        <div className="section-label">Ecosistema</div>
        <h2 className="section-h2">Cinco soluciones. Un ecosistema.</h2>
        <p className="section-sub">
          Cada producto resuelve un problema concreto en su sector —
          todos comparten la misma inteligencia artificial.
        </p>
        <div className="products-grid">
          {PRODUCTS.map((p) => (
            <div className="pcard rv" key={p.name}>
              <div className="pcard-head">
                <div className="pcard-icon">{p.icon}</div>
                <span className={`pcard-status ${p.status === "live" ? "st-live" : p.status === "beta" ? "st-beta" : "st-dev"}`}>
                  {p.label}
                </span>
              </div>
              <div className="pcard-body">
                <div className="pcard-sector">{p.sector}</div>
                <div className="pcard-name">{p.name}</div>
                <div className="pcard-tagline">{p.tagline}</div>
                <div className="pcard-desc">{p.body}</div>
                {p.url ? (
                  <a href={p.url} className="pcard-link" target="_blank" rel="noopener">
                    Conocer más <span>→</span>
                  </a>
                ) : (
                  <span style={{fontSize:".85rem",color:"#94a3b8",fontWeight:500}}>En desarrollo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* POR QUÉ DRAKO */}
      <section className="section" id="por-que-drako">
        <div className="section-label">Ventaja Drako</div>
        <h2 className="section-h2">Por qué elegir Drako</h2>
        <p className="section-sub">
          No vendemos herramientas. Vendemos resultados.
          La IA hace el trabajo — tú te llevas el mérito.
        </p>
        <div className="why-grid">
          {[
            { ic:"⚡", title:"Autonomía total", body:"Los agentes trabajan 24/7 sin supervisión. Tú defines el objetivo, ellos lo ejecutan." },
            { ic:"🎯", title:"Especializado por sector", body:"Cada producto está diseñado para un mercado concreto. Nada genérico, todo afinado." },
            { ic:"🔒", title:"Datos aislados", body:"Tu información nunca se mezcla con otros clientes. Arquitectura multi-tenant con aislamiento total." },
            { ic:"📈", title:"Aprende de tus resultados", body:"El sistema mejora con cada publicación, análisis o decisión. Más tiempo usándolo = mejor rendimiento." },
            { ic:"🌐", title:"Ecosistema integrado", body:"Todos los productos comparten la misma infraestructura de IA. Lo que aprende uno beneficia al resto." },
            { ic:"🚀", title:"Listo en horas", body:"Sin onboardings interminables. Conectas, configuras lo básico y la IA empieza a trabajar ese mismo día." },
          ].map(w => (
            <div className="why-card rv" key={w.title}>
              <div className="why-ic">{w.ic}</div>
              <div className="why-title">{w.title}</div>
              <div className="why-body">{w.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-label">Empieza hoy</div>
        <h2 className="cta-h2">Tu competencia ya está usando IA.<br />¿Y tú?</h2>
        <p className="cta-sub">
          Empieza con Socialcors — nuestro producto más maduro —
          y comprueba en 30 días lo que la IA hace por tu marca.
        </p>
        <a href="https://socialcors.com" className="btn-white">
          Probar Socialcors gratis →
        </a>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand">
          <img src={LOGO} alt="Drako" width={28} height={28}
               style={{ width:28, height:28, objectFit:"contain" }} />
          <span>Drako</span>
        </div>
        <span className="footer-copy">© 2026 Drako Systems. Todos los derechos reservados.</span>
        <div className="footer-links">
          <a href="https://socialcors.com">Socialcors</a>
          <a href="mailto:hola@drako.systems">Contacto</a>
        </div>
      </footer>

      {/* SCROLL REVEAL */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var els = document.querySelectorAll('.rv');
          if(!els.length) return;
          var io = new IntersectionObserver(function(entries){
            entries.forEach(function(e){
              if(e.isIntersecting){ e.target.classList.add('vis'); io.unobserve(e.target); }
            });
          }, { threshold:0.12 });
          els.forEach(function(el){ io.observe(el); });
        })();
      `}} />
    </div>
  );
}
