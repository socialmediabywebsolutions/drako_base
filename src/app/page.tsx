import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { StatCounter } from "@/components/marketing/home/StatCounter";

// drako.systems — web de ventas de servicios IA
// Concepto: vender resultados a empresas, no tecnología a ingenieros
// Paleta: blanco · #f0f6ff · azul #3b82f6 · turquesa #06b6d4 · navy #080f23
// Display: Syne 800 · Cuerpo: DM Sans

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const D = "font-[family-name:var(--font-syne)]";

type Status = "live" | "beta" | "dev" | "core";

const BADGE: Record<Status, { label: string; color: string }> = {
  live:  { label: "En producción", color: "#10b981" },
  beta:  { label: "Beta",          color: "#f59e0b" },
  dev:   { label: "Desarrollo",    color: "#3b82f6" },
  core:  { label: "Core",          color: "#06b6d4" },
};

const PRODUCTS: {
  name: string;
  tagline: string;
  description: string;
  status: Status;
  url?: string;
}[] = [
  {
    name: "Socialcors",
    tagline: "Tus redes en piloto automático.",
    description:
      "El único SaaS que crea, programa y publica contenido que convierte en Instagram, LinkedIn, TikTok y más — sin que muevas un dedo. Tus clientes lo ven. Tu competencia no lo entiende.",
    status: "live",
    url: "https://socialcors.com",
  },
  {
    name: "Mentoría",
    tagline: "Tutores de IA para cada alumno.",
    description:
      "Apoyo académico personalizado que se adapta al ritmo y nivel de cada estudiante. Los padres siguen el progreso por WhatsApp. Los profesores supervisan en tiempo real.",
    status: "beta",
  },
  {
    name: "Crypto IA",
    tagline: "Análisis de mercado en tiempo real.",
    description:
      "Agentes especializados que monitorizan, analizan y alertan sobre oportunidades en criptomonedas. RSI, MACD, Fibonacci — interpretados y explicados por IA.",
    status: "dev",
  },
  {
    name: "Cazh",
    tagline: "Finanzas digitales, sin fricción.",
    description:
      "Wallet, pagos instantáneos, tarjetas virtuales y físicas con scoring financiero automatizado. La cuenta bancaria inteligente que tu empresa necesita.",
    status: "dev",
  },
  {
    name: "Rentia",
    tagline: "Tu cartera inmobiliaria, gestionada sola.",
    description:
      "Contratos, cobros, incidencias y reparaciones automatizadas. La IA evalúa inquilinos y predice riesgos de impago antes de que ocurran.",
    status: "dev",
  },
];

const STATS: { value: number; suffix?: string; prefix?: string; label: string }[] = [
  { value: 5,   label: "SaaS de IA" },
  { value: 6,   label: "Sectores cubiertos" },
  { value: 100, suffix: "%", label: "Basados en IA" },
  { value: 50,  prefix: "<", suffix: "ms", label: "Latencia global" },
];

const SECTORS = ["marketing digital", "redes sociales", "educación", "finanzas", "inmobiliaria"];

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

  const totalDuration = `${SECTORS.length * 3}s`;

  return (
    <div className={`${syne.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-white font-[family-name:var(--font-dm-sans)] text-[#080f23]`}>

      <style>{`
        /* ─── TOKENS ─── */
        :root {
          --blue: #3b82f6;
          --cyan: #06b6d4;
          --navy: #080f23;
          --surf: #f0f6ff;
          --mid: #64748b;
        }

        /* ─── GRADIENT TEXT ─── */
        .g {
          background: linear-gradient(110deg, var(--blue) 0%, var(--cyan) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ─── CYCLING WORD ─── */
        /* ${SECTORS.length} words · 3 s each · total ${totalDuration} */
        /* each word: fade-in 0-6%, hold 6-26%, fade-out 26-33%, hidden 33-100% */
        @keyframes wshow {
          0%       { opacity: 0; transform: translateY(14px); }
          6%       { opacity: 1; transform: translateY(0); }
          26%      { opacity: 1; transform: translateY(0); }
          33%      { opacity: 0; transform: translateY(-14px); }
          100%     { opacity: 0; transform: translateY(-14px); }
        }
        .cycling-wrap {
          position: relative;
          display: block;
          height: 1.06em;
          overflow: hidden;
        }
        .cycling-wrap span {
          position: absolute;
          left: 0;
          white-space: nowrap;
          opacity: 0;
          animation: wshow ${totalDuration} infinite;
        }
        ${SECTORS.map((_, i) => `.cycling-wrap span:nth-child(${i + 1}) { animation-delay: ${i * 3}s; }`).join("\n        ")}

        /* ─── NAV ─── */
        .nav-link {
          color: var(--mid);
          font-size: 14px;
          font-weight: 500;
          position: relative;
          transition: color .2s;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -3px; left: 0; right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, var(--blue), var(--cyan));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .25s cubic-bezier(.4,0,.2,1);
        }
        .nav-link:hover { color: var(--navy); }
        .nav-link:hover::after { transform: scaleX(1); }

        /* ─── BUTTONS ─── */
        .btn-blue {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(110deg, var(--blue), var(--cyan));
          color: #fff;
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 15px; letter-spacing: .01em;
          padding: 13px 26px; border-radius: 10px;
          box-shadow: 0 4px 20px rgba(59,130,246,.3);
          transition: transform .2s, box-shadow .2s;
        }
        .btn-blue:hover { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(59,130,246,.45); }

        .btn-outline {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent;
          color: var(--blue);
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 15px; letter-spacing: .01em;
          padding: 13px 26px; border-radius: 10px;
          border: 1.5px solid rgba(59,130,246,.4);
          transition: all .2s;
        }
        .btn-outline:hover { background: rgba(59,130,246,.06); border-color: var(--blue); transform: translateY(-2px); }

        /* ─── SCROLL REVEAL ─── */
        .reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
        }
        .reveal.visible { opacity: 1; transform: none; }
        .reveal-d1 { transition-delay: .1s; }
        .reveal-d2 { transition-delay: .2s; }
        .reveal-d3 { transition-delay: .3s; }
        .reveal-d4 { transition-delay: .4s; }

        /* ─── PRODUCT ROWS ─── */
        .product-row {
          border-top: 1px solid #e2e8f0;
          padding: 36px 0;
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          gap: 24px 48px;
          align-items: start;
          position: relative;
          transition: border-color .3s;
        }
        .product-row::before {
          content: '';
          position: absolute;
          top: -1px; left: 0;
          height: 1.5px; width: 0;
          background: linear-gradient(90deg, var(--blue), var(--cyan));
          transition: width .45s cubic-bezier(.4,0,.2,1);
        }
        .product-row:hover::before { width: 100%; }
        .product-row:last-child { border-bottom: 1px solid #e2e8f0; }
        @media (max-width: 640px) {
          .product-row { grid-template-columns: 1fr; gap: 12px; }
        }

        /* ─── STATEMENT BLOCKS ─── */
        .statement {
          border-left: 3px solid transparent;
          padding-left: 24px;
          transition: border-color .3s;
        }
        .statement:hover { border-color: var(--blue); }

        /* ─── STAT ROW ─── */
        .stat-cell {
          text-align: center;
          padding: 36px 16px;
          border-right: 1px solid #e2e8f0;
        }
        .stat-cell:last-child { border-right: none; }

        /* ─── HERO ORBS ─── */
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.97); }
        }
        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none; will-change: transform;
        }
        .orb-1 {
          width: 520px; height: 520px;
          background: rgba(59,130,246,.09);
          top: -100px; right: -80px;
          animation: orb-drift 14s ease-in-out infinite;
        }
        .orb-2 {
          width: 380px; height: 380px;
          background: rgba(6,182,212,.07);
          bottom: 0; left: -60px;
          animation: orb-drift 18s ease-in-out infinite reverse;
        }

        /* ─── HERO BADGE ─── */
        .live-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(59,130,246,.08);
          border: 1px solid rgba(59,130,246,.2);
          border-radius: 999px; padding: 5px 14px 5px 10px;
          font-size: 13px; font-weight: 600; color: var(--blue);
        }
        @keyframes blink {
          0%, 100% { opacity: 1; } 50% { opacity: .3; }
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--blue);
          animation: blink 1.8s ease-in-out infinite;
        }

        /* ─── FINAL CTA SECTION ─── */
        .cta-section {
          background: linear-gradient(125deg, #1d4ed8 0%, #0369a1 50%, #0891b2 100%);
          position: relative; overflow: hidden;
        }
        .cta-section::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .btn-white {
          display: inline-flex; align-items: center; gap: 8px;
          background: #fff; color: #1d4ed8;
          font-family: var(--font-syne), sans-serif;
          font-weight: 700; font-size: 16px;
          padding: 15px 30px; border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,.15);
          transition: transform .2s, box-shadow .2s;
        }
        .btn-white:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(0,0,0,.22); }

        /* ─── ARROW ─── */
        .arr { display: inline-block; transition: transform .2s; }
        a:hover .arr, button:hover .arr { transform: translateX(4px); }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation: none !important; transition: none !important; }
          .reveal { opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      {/* ═══════════════════════════ NAV ═══════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/96 backdrop-blur-lg border-b border-slate-100/80">
        <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between gap-8">
          <Link href={`${prefix}/`} className={`${D} text-[20px] font-extrabold tracking-tight text-[#080f23]`}>
            drako<span className="g">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href={`${prefix}/ecosystem`} className="nav-link">Ecosistema</Link>
            <Link href={`${prefix}/journal`}    className="nav-link">Journal IA</Link>
            <Link href="https://socialcors.com" className="nav-link" target="_blank">Socialcors</Link>
          </div>
          <Link href="https://socialcors.com" target="_blank" className="btn-blue py-2.5 px-5 text-sm">
            Empezar <span className="arr">→</span>
          </Link>
        </div>
      </nav>

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative min-h-[92vh] flex flex-col justify-center px-6 pt-20 pb-24 bg-[#f0f6ff] overflow-hidden">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          {/* Live badge */}
          <div className="live-badge mb-10">
            <span className="live-dot" />
            Socialcors en producción — empieza hoy
          </div>

          {/* Headline */}
          <h1 className={`${D} font-extrabold leading-[.97] tracking-tight text-[#080f23] mb-8`}
              style={{ fontSize: "clamp(44px, 7vw, 88px)" }}>
            Tu{" "}
            <span className="g cycling-wrap" aria-label="sector">
              {SECTORS.map((s) => <span key={s}>{s}</span>)}
            </span>
            <br />
            automatizado con IA.
          </h1>

          {/* Sub */}
          <p className="text-[#64748b] leading-relaxed mb-12 max-w-xl"
             style={{ fontSize: "clamp(17px, 2vw, 20px)" }}>
            Drako construye SaaS de inteligencia artificial que automatizan sectores completos.
            Tus agentes trabajan 24 horas al día. Tú decides qué hacer con el tiempo que recuperas.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <Link href="https://socialcors.com" target="_blank" className="btn-blue">
              Ver Socialcors <span className="arr">→</span>
            </Link>
            <Link href={`${prefix}/ecosystem`} className="btn-outline">
              Explorar el ecosistema
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ STATS ═══════════════════════════ */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100">
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-cell reveal reveal-d${i + 1}`}>
              <p className={`${D} font-extrabold text-[#080f23] mb-1.5`} style={{ fontSize: "40px" }}>
                <StatCounter value={s.value} prefix={s.prefix} suffix={s.suffix} className="g" />
              </p>
              <p className="text-sm font-medium text-[#64748b]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════ PRODUCTS ═══════════════════════════ */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-16 reveal">
            <p className="text-[13px] font-bold tracking-[.15em] text-[#3b82f6] uppercase mb-4">
              nuestros servicios
            </p>
            <h2 className={`${D} font-extrabold leading-[1.02] text-[#080f23]`}
                style={{ fontSize: "clamp(36px, 4.5vw, 56px)" }}>
              Elige tu solución de IA.<br />
              <span className="g">Tu sector, automatizado.</span>
            </h2>
          </div>

          {/* Product list */}
          <div>
            {PRODUCTS.map((p, i) => {
              const b = BADGE[p.status];
              return (
                <div key={p.name} className={`product-row reveal reveal-d${Math.min(i + 1, 4)}`}>
                  {/* Left */}
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-xs font-semibold" style={{ color: b.color }}>{b.label}</span>
                    </div>
                    <h3 className={`${D} font-bold text-[#080f23] mb-1`} style={{ fontSize: "24px" }}>{p.name}</h3>
                    <p className="font-semibold text-[#3b82f6] text-[15px]">{p.tagline}</p>
                  </div>

                  {/* Right */}
                  <div>
                    <p className="text-[#64748b] leading-relaxed mb-5">{p.description}</p>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                         className={`${D} inline-flex items-center gap-1.5 font-bold text-[14px] text-[#3b82f6] hover:text-[#06b6d4] transition-colors`}>
                        Acceder ahora <span className="arr">→</span>
                      </a>
                    ) : (
                      <span className="text-[13px] text-[#94a3b8] font-medium">Próximamente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ STATEMENTS ═══════════════════════════ */}
      <section className="py-28 px-6 bg-[#f0f6ff]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-20 reveal">
            <p className="text-[13px] font-bold tracking-[.15em] text-[#3b82f6] uppercase mb-4">
              por qué drako
            </p>
            <h2 className={`${D} font-extrabold text-[#080f23] leading-[1.02]`}
                style={{ fontSize: "clamp(34px, 4.5vw, 54px)" }}>
              La IA que trabaja cuando tú no puedes.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                headline: "Tus agentes no descansan.",
                body: "Los sistemas de IA de Drako operan 24 horas al día, 7 días a la semana. No se ponen enfermos, no se van de vacaciones, no se olvidan de publicar.",
              },
              {
                headline: "Sin curva de aprendizaje.",
                body: "La IA aprende de tu negocio, tu voz y tus resultados. Cuanto más la usas, mejor funciona — sin que tengas que tocar una sola configuración.",
              },
              {
                headline: "Resultados medibles desde el día uno.",
                body: "Cada acción de la IA genera datos reales: publicaciones que llegan a más personas, clientes que responden, tiempo que recuperas.",
              },
            ].map((s, i) => (
              <div key={s.headline} className={`statement reveal reveal-d${i + 1}`}>
                <h3 className={`${D} font-bold text-[#080f23] mb-3 leading-tight`} style={{ fontSize: "22px" }}>
                  {s.headline}
                </h3>
                <p className="text-[#64748b] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ FINAL CTA ═══════════════════════════ */}
      <section className="cta-section py-32 px-6">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className={`${D} font-extrabold text-white leading-[1.02] mb-6`}
              style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>
            La IA de Drako ya trabaja para otras empresas.
            <br />¿Cuándo empieza a trabajar para ti?
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            Socialcors está en producción hoy. Si tienes redes sociales y quieres resultados reales, empieza ahora — sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="https://socialcors.com" target="_blank" className="btn-white">
              Probar Socialcors gratis <span className="arr">→</span>
            </Link>
            <Link href={`${prefix}/ecosystem`}
              className={`${D} inline-flex items-center gap-2 text-white/80 hover:text-white font-semibold text-[15px] transition-colors`}>
              Ver todo el ecosistema <span className="arr">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ FOOTER ═══════════════════════════ */}
      <footer className="bg-white border-t border-slate-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <span className={`${D} text-[18px] font-extrabold text-[#080f23] tracking-tight`}>
            drako<span className="g">.</span>
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: "Ecosistema", href: `${prefix}/ecosystem` },
              { label: "Journal IA", href: `${prefix}/journal` },
              { label: "Socialcors", href: "https://socialcors.com", ext: true },
            ].map((l) => (
              <Link key={l.label} href={l.href}
                {...(l.ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-sm text-[#94a3b8] hover:text-[#3b82f6] transition-colors font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-[#cbd5e1]">© {new Date().getFullYear()} Drako Systems</p>
        </div>
      </footer>

      {/* ═══════════════════════════ REVEAL SCRIPT ═══════════════════════════ */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          const obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
              if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
              }
            });
          }, { threshold: 0.12 });
          document.querySelectorAll('.reveal').forEach(function(el) { obs.observe(el); });
        })();
      `}} />
    </div>
  );
}
