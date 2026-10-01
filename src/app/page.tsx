import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DM_Sans, Syne } from "next/font/google";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { NetworkCanvas } from "@/components/marketing/home/NetworkCanvas";
import { StatCounter } from "@/components/marketing/home/StatCounter";

// Home de drako.systems — diseño "IA en el core" (referencia: artifact 6WajhNGmDakD5zk9Gsu2xx).
// Página autocontenida: nav sticky y footer propios, sin SiteLayout. Tokens fijos:
// fondo #f8fafc, superficie #ffffff, azul #3b82f6, turquesa #06b6d4; Syne (display) y
// DM Sans (cuerpo).

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-syne", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const DISPLAY = "font-[family-name:var(--font-syne)]";
const GRADIENT_TEXT = "bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent";

type Status = "live" | "beta" | "dev" | "core";
type Tone = "b" | "t";

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  live: { label: "En producción", className: "bg-[#dcfce7] text-[#16a34a]" },
  beta: { label: "Beta", className: "bg-[#fef9c3] text-[#b45309]" },
  dev: { label: "Desarrollo", className: "bg-[#eff6ff] text-[#3b82f6]" },
  core: { label: "Core", className: "bg-[#ecfeff] text-[#0891b2]" },
};

const TONE_WASH: Record<Tone, string> = { b: "bg-[#eff6ff]", t: "bg-[#ecfeff]" };
const TAG_TONE: Record<Tone, string> = { b: "bg-[#eff6ff] text-[#3b82f6]", t: "bg-[#ecfeff] text-[#0891b2]" };

const PRODUCTS: { name: string; status: Status; icon: string; tone: Tone; description: string; tags: [string, Tone][] }[] = [
  {
    name: "Socialcors",
    status: "live",
    icon: "📱",
    tone: "b",
    description:
      "Automatización de marketing en redes sociales. Sustituye el trabajo repetitivo de agencias: contenido, programación, CRM social y analítica en un solo flujo.",
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
      "Análisis técnico avanzado de criptomonedas: RSI, MACD, Fibonacci, Elliott. Agentes especializados como Market Watcher, Risk Manager y Signal Composer.",
    tags: [["Análisis técnico", "b"], ["Backtesting", "b"], ["Signal AI", "t"]],
  },
  {
    name: "Cazh",
    status: "dev",
    icon: "💳",
    tone: "t",
    description:
      "Plataforma financiera digital con wallet, pagos instantáneos, tarjetas virtuales y físicas, y scoring financiero automatizado para personas y empresas.",
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
      "El sistema operativo del holding. Gobierno, facturación centralizada, observabilidad global y orquestación de agentes IA para todos los SaaS del ecosistema.",
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
  { value: 5, label: "SaaS en el ecosistema" },
  { value: 100, suffix: "%", label: "IA en el núcleo" },
  { value: 6, label: "Sectores cubiertos" },
  { value: 50, prefix: "<", suffix: "ms", label: "Latencia global (Edge)" },
];

const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] px-7 py-3.5 text-[15px] font-semibold leading-none text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2563eb] hover:shadow-[0_8px_28px_rgba(59,130,246,.45)]";
const BTN_SECONDARY =
  "inline-block rounded-lg border border-[#e2e8f0] bg-white px-7 py-3.5 text-[15px] font-medium leading-none text-[#0f172a] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b82f6] hover:text-[#3b82f6] hover:shadow-[0_4px_16px_rgba(59,130,246,.1)]";

function SectionIntro({ eyebrow, title, lead }: { eyebrow: string; title: [string, string]; lead: string }) {
  return (
    <>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3b82f6]">{eyebrow}</p>
      <h2 className={`${DISPLAY} mb-3.5 text-balance text-[clamp(28px,4vw,46px)] font-extrabold leading-[1.12] tracking-[-0.025em] text-[#0f172a]`}>
        {title[0]}
        <br />
        {title[1]}
      </h2>
      <p className="mb-13 max-w-[520px] text-[17px] leading-[1.65] text-[#64748b]">{lead}</p>
    </>
  );
}

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
    <div
      className={`${syne.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-[#f8fafc] font-[family-name:var(--font-dm-sans)] text-base leading-[1.65] text-[#0f172a] scroll-smooth`}
    >
      {/* NAV */}
      <nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-[#e2e8f0] bg-[rgba(248,250,252,0.88)] px-5 py-3.5 backdrop-blur-[18px] md:px-12 md:py-[18px]">
        <Link href={prefix || "/"} className={`${DISPLAY} ${GRADIENT_TEXT} text-[21px] font-extrabold tracking-[-0.5px]`}>
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
              <a href={item.href} className="text-sm font-medium text-[#64748b] transition-colors hover:text-[#0f172a]">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#contacto"
          className="inline-block rounded-lg bg-[#3b82f6] px-5 py-[9px] text-sm font-semibold leading-none text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#2563eb] hover:shadow-[0_4px_16px_rgba(59,130,246,.4)]"
        >
          Hablar con Drako
        </a>
      </nav>

      {/* HERO */}
      <section className="relative flex min-h-[94vh] items-center justify-center overflow-hidden px-5 pb-20 pt-15 md:px-10 md:pb-25 md:pt-20">
        <NetworkCanvas className="absolute inset-0 h-full w-full" />

        <div className="relative z-[2] max-w-[840px] text-center">
          <div className="mb-[30px] inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white py-1.5 pl-2.5 pr-4 text-xs font-semibold tracking-[0.03em] text-[#64748b] shadow-[0_1px_3px_rgba(15,23,42,.06),0_1px_2px_rgba(15,23,42,.04)]">
            <span className="h-2 w-2 animate-spin rounded-full bg-[conic-gradient(#3b82f6,#06b6d4,#3b82f6)] [animation-duration:3s]" />
            Holding Tecnológico · IA en el core
          </div>

          <h1 className={`${DISPLAY} mb-6 text-balance text-[clamp(40px,6.5vw,76px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-[#0f172a]`}>
            Software que <span className={GRADIENT_TEXT}>automatiza</span>
            <br />
            industrias completas
          </h1>
          <p className="mx-auto mb-11 max-w-[560px] text-balance text-[clamp(16px,2vw,20px)] leading-[1.65] text-[#64748b]">
            Drako crea SaaS verticales impulsados por inteligencia artificial. Cada producto resuelve un sector con agentes autónomos, edge computing y arquitectura de primer nivel.
          </p>

          <div className="mb-18 flex flex-wrap items-center justify-center gap-3">
            <a href="#productos" className={BTN_PRIMARY}>
              Ver el ecosistema →
            </a>
            <a href="#stack" className={BTN_SECONDARY}>
              Nuestra arquitectura
            </a>
          </div>

          <div className="flex flex-col overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,.06),0_1px_2px_rgba(15,23,42,.04)] md:flex-row">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`relative flex-[1_1_150px] px-5 py-6 text-center ${
                  i > 0 ? "md:before:absolute md:before:inset-y-[20%] md:before:left-0 md:before:w-px md:before:bg-[#e2e8f0] md:before:content-['']" : ""
                }`}
              >
                <StatCounter
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  className={`${DISPLAY} ${GRADIENT_TEXT} mb-1.5 block text-[30px] font-extrabold leading-none tracking-[-0.025em] tabular-nums`}
                />
                <span className="text-xs font-medium leading-[1.4] text-[#64748b]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTOS */}
      <div className="mx-auto max-w-[1160px] px-5 md:px-10">
        <section id="productos" className="scroll-mt-20 py-16 md:py-24">
          <SectionIntro
            eyebrow="El ecosistema"
            title={["Seis productos.", "Un solo stack."]}
            lead="Cada SaaS opera de forma independiente y comparte infraestructura, agentes IA y conocimiento acumulado. Lo que uno aprende, lo aprovechan todos."
          />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(310px,100%),1fr))] gap-[18px]">
            {PRODUCTS.map((product) => {
              const badge = STATUS_BADGE[product.status];
              return (
                <article
                  key={product.name}
                  className="relative overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white p-7 transition-all duration-[280ms] after:absolute after:inset-x-0 after:top-0 after:h-[3px] after:bg-gradient-to-r after:from-[#3b82f6] after:to-[#06b6d4] after:opacity-0 after:transition-opacity after:duration-300 after:content-[''] hover:-translate-y-[5px] hover:border-[rgba(59,130,246,.3)] hover:shadow-[0_0_0_1px_rgba(59,130,246,.25),0_8px_32px_rgba(59,130,246,.14)] hover:after:opacity-100"
                >
                  <span className={`absolute right-5 top-5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
                  <div className={`mb-[18px] flex h-12 w-12 items-center justify-center rounded-xl text-[22px] ${TONE_WASH[product.tone]}`} aria-hidden="true">
                    {product.icon}
                  </div>
                  <h3 className={`${DISPLAY} mb-2 text-[17px] font-bold text-[#0f172a]`}>{product.name}</h3>
                  <p className="mb-5 text-sm leading-[1.62] text-[#64748b]">{product.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags.map(([tag, tone]) => (
                      <span key={tag} className={`rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${TAG_TONE[tone]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* STACK */}
      <section id="stack" className="scroll-mt-20 bg-[#020c1a] px-5 py-12 md:px-10 md:py-15">
        <div className="mx-auto max-w-[1160px]">
          <p className="mb-8 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-white/35">Infraestructura compartida en todos los productos</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {STACK.map(([item, tone]) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.05] px-[18px] py-2.5 text-[13px] font-medium text-white/65 transition-colors duration-200 hover:border-[rgba(59,130,246,.4)] hover:bg-[rgba(59,130,246,.12)] hover:text-white"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone === "b" ? "bg-[#3b82f6]" : "bg-[#06b6d4]"}`} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POR QUÉ DRAKO */}
      <div className="mx-auto max-w-[1160px] px-5 md:px-10">
        <section id="por-que" className="scroll-mt-20 py-16 md:py-24">
          <SectionIntro
            eyebrow="Por qué Drako"
            title={["IA estructural,", "no decorativa."]}
            lead="La inteligencia artificial no es una función que añadimos. Está en el núcleo de cada decisión de arquitectura, desde el primer día."
          />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-[18px]">
            {WHY.map((item) => (
              <div
                key={item.title}
                className="rounded-[14px] border border-[#e2e8f0] bg-white p-7 transition-all duration-[250ms] hover:-translate-y-[3px] hover:shadow-[0_6px_24px_rgba(15,23,42,.08)]"
              >
                <span className="mb-3.5 block text-[26px]" aria-hidden="true">{item.icon}</span>
                <h3 className={`${DISPLAY} mb-2 text-base font-bold text-[#0f172a]`}>{item.title}</h3>
                <p className="text-sm leading-[1.65] text-[#64748b]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* CTA */}
      <section id="contacto" className="scroll-mt-20 px-5 py-12 text-center md:px-10 md:py-20">
        <div className="relative mx-auto max-w-[640px] overflow-hidden rounded-[26px] border border-[rgba(59,130,246,.18)] bg-[linear-gradient(145deg,rgba(59,130,246,.07),rgba(6,182,212,.07))] px-6 py-10 md:px-12 md:py-16">
          <span aria-hidden="true" className="pointer-events-none absolute -right-[60px] -top-[60px] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,.12),transparent_70%)]" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-[50px] -left-[50px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(6,182,212,.1),transparent_70%)]" />
          <h2 className={`${DISPLAY} relative z-[1] mb-4 text-balance text-[clamp(24px,4vw,36px)] font-extrabold tracking-[-0.02em] text-[#0f172a]`}>
            ¿Tu sector necesita un SaaS especializado en IA?
          </h2>
          <p className="relative z-[1] mb-8 text-base leading-[1.65] text-[#64748b]">
            Drako construye productos verticales con arquitectura de primer nivel. Hablamos, identificamos el problema y lo automatizamos.
          </p>
          <Link href={`${prefix}/contact`} className={`${BTN_PRIMARY} relative z-[1]`}>
            Contactar con Drako →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-5 py-7 md:px-10 md:py-9">
        <span className={`${DISPLAY} ${GRADIENT_TEXT} text-base font-extrabold`}>DRAKO</span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#64748b]">
          <Link href="/aviso-legal" className="transition-colors hover:text-[#0f172a]">Aviso legal</Link>
          <Link href="/privacidad" className="transition-colors hover:text-[#0f172a]">Privacidad</Link>
          <Link href="/cookies" className="transition-colors hover:text-[#0f172a]">Cookies</Link>
          <span>© 2026 Drako Systems · Holding Tecnológico</span>
        </div>
      </footer>
    </div>
  );
}
