import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Cloud,
  CreditCard,
  Database,
  GraduationCap,
  Hammer,
  Infinity as InfinityIcon,
  Layers,
  LayoutDashboard,
  Search,
  Share2,
  Sparkles,
  Wallet,
} from "lucide-react";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const SOCIALCORS_URL = "https://socialcors.com";

const TRUST_ITEMS: { name: string; icon: ReactNode }[] = [
  { name: "Cloudflare", icon: <Cloud className="h-5 w-5" /> },
  { name: "Anthropic", icon: <Sparkles className="h-5 w-5" /> },
  { name: "Meta", icon: <InfinityIcon className="h-5 w-5" /> },
  { name: "Stripe", icon: <CreditCard className="h-5 w-5" /> },
];

const ECOSYSTEM: { name: string; description: string; active: boolean; href?: string; icon: ReactNode }[] = [
  { name: "Socialcors", description: "Automatización total de redes sociales con IA", active: true, href: SOCIALCORS_URL, icon: <Share2 className="h-6 w-6" /> },
  { name: "Mentoría", description: "Tutores IA para estudiantes", active: false, icon: <GraduationCap className="h-6 w-6" /> },
  { name: "Cazh", description: "Wallet digital inteligente", active: false, icon: <Wallet className="h-6 w-6" /> },
  { name: "Rentia", description: "Gestión inmobiliaria con IA", active: false, icon: <Building2 className="h-6 w-6" /> },
];

const STEPS: { title: string; description: string; icon: ReactNode }[] = [
  { title: "Identifica un problema real", description: "Drako detecta sectores donde la IA puede sustituir trabajo manual repetitivo.", icon: <Search className="h-7 w-7" /> },
  { title: "Construye un SaaS especializado", description: "Cada producto se lanza con su propia marca, stack y modelo de negocio.", icon: <Hammer className="h-7 w-7" /> },
  { title: "Lo dirige desde el centro", description: "Campamento Base coordina tecnología, facturación e inteligencia compartida.", icon: <LayoutDashboard className="h-7 w-7" /> },
];

const METRICS: { value: string; label: string; icon: ReactNode }[] = [
  { value: "4", label: "SaaS en el ecosistema", icon: <Layers className="h-5 w-5" /> },
  { value: "26", label: "agentes IA activos", icon: <Bot className="h-5 w-5" /> },
  { value: "1", label: "plataforma central", icon: <LayoutDashboard className="h-5 w-5" /> },
  { value: "0", label: "silos de datos", icon: <Database className="h-5 w-5" /> },
];

const ECOSYSTEM_STATUS: { name: string; description: string; status: "Activo" | "Beta" | "En desarrollo"; progress: number }[] = [
  { name: "Socialcors", description: "Automatización de redes sociales con IA", status: "Activo", progress: 85 },
  { name: "Mentoría", description: "Tutores IA para estudiantes", status: "Beta", progress: 60 },
  { name: "Crypto IA", description: "Análisis de mercados cripto con IA", status: "En desarrollo", progress: 40 },
  { name: "Cazh", description: "Wallet digital inteligente", status: "En desarrollo", progress: 25 },
  { name: "Rentia", description: "Gestión inmobiliaria con IA", status: "En desarrollo", progress: 20 },
];

const STATUS_BADGE_CLASS: Record<(typeof ECOSYSTEM_STATUS)[number]["status"], string> = {
  Activo: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Beta: "bg-cyan-50 border-cyan-200 text-cyan-700",
  "En desarrollo": "bg-slate-100 border-gray-200 text-slate-600",
};

// Mismos artículos que muestra /journal (src/app/journal/page.tsx).
const JOURNAL_ARTICLES = [
  { category: "Ingeniería", title: "Por qué la latencia es el nuevo downtime en sistemas LLM", date: "Oct 2025" },
  { category: "Producto", title: "El fin del dashboard estático", date: "Sep 2025" },
  { category: "Cultura", title: "Pragmatismo Radical: Nuestro sistema operativo cultural", date: "Ago 2025" },
];

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-16">
      <span className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-4 block">{eyebrow}</span>
      <h2 className="heading-lg text-slate-900 mb-5 text-balance">{title}</h2>
      {subtitle ? <p className="text-lg text-slate-600 leading-relaxed">{subtitle}</p> : null}
    </div>
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
  const pathParts = matchedPath.split("/");
  const localeFromPath = resolveMarketingLocale(resolvedParams?.locale ?? (pathParts[1] || undefined));
  const locale: MarketingLocale = localeFromPath;
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  const currentPath = "/";

  // Using the first paragraph of About as the footer line
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine }}>
      <div>

        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-blue-50 pt-24 pb-28 md:pt-36 md:pb-40">
          <div className="container-premium relative z-10">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Holding tecnológico de IA
              </span>
              <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                El holding tecnológico que construye <span className="drako-gradient-text">el futuro con IA.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-12 leading-relaxed max-w-2xl mx-auto text-balance delay-100 fade-in-up">
                Drako crea, dirige y hace crecer empresas de software especializadas impulsadas por inteligencia artificial. Cada SaaS resuelve un problema real. Todos comparten una misma inteligencia.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 delay-200 fade-in-up">
                <a href="#ecosistema" className="btn-premium btn-primary">
                  Conoce el ecosistema
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <Link href={`${prefix}/journal`} className="btn-premium btn-secondary">
                  Leer el Journal
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] bg-blue-200/40 rounded-full blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-100/60 rounded-full blur-3xl" />
          </div>
        </section>

        {/* BANDA DE CONFIANZA */}
        <section className="bg-white border-y border-gray-200 py-12">
          <div className="container-premium">
            <p className="text-center text-sm font-semibold text-slate-500 mb-8">
              Tecnología construida sobre
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
              {TRUST_ITEMS.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors duration-300">
                  {item.icon}
                  <span className="text-base font-semibold tracking-tight">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EL ECOSISTEMA */}
        <section id="ecosistema" className="section-spacing bg-slate-50 scroll-mt-24">
          <div className="container-premium">
            <SectionHeading
              eyebrow="El ecosistema"
              title="Empresas que ya operan con inteligencia artificial"
              subtitle="Cada producto de Drako es una empresa independiente con su propia marca, clientes y modelo de negocio. Todas comparten tecnología, agentes IA y la inteligencia acumulada del ecosistema."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {ECOSYSTEM.map((saas) => (
                <div key={saas.name} className="card-premium flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${saas.active ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {saas.icon}
                    </span>
                    {saas.active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Activo
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 border border-gray-200 px-3 py-1 text-xs font-bold text-slate-500">
                        Próximamente
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{saas.name}</h3>
                  <p className="text-slate-600 mb-8">{saas.description}</p>
                  {saas.active && saas.href ? (
                    <a href={saas.href} className="btn-premium btn-primary mt-auto py-3 px-6 text-sm">
                      Visitar {saas.name}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ESTADO DEL ECOSISTEMA */}
        <section id="estado-ecosistema" className="py-24 bg-slate-50 border-t border-gray-200 scroll-mt-24">
          <div className="container-premium">
            <SectionHeading eyebrow="Roadmap" title="Estado del Ecosistema" subtitle="Progreso en tiempo real de cada producto Drako" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {ECOSYSTEM_STATUS.map((item) => (
                <div key={item.name} className="card-premium flex flex-col p-6">
                  <span className={`self-start rounded-full border px-3 py-1 text-xs font-bold mb-5 ${STATUS_BADGE_CLASS[item.status]}`}>
                    {item.status}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{item.name}</h3>
                  <p className="text-sm text-slate-600 mb-6">{item.description}</p>
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <span className="text-slate-500">Progreso</span>
                      <span className="text-blue-600">{item.progress}%</span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progreso de ${item.name}`}
                    >
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CÓMO OPERA DRAKO */}
        <section id="como-opera" className="section-spacing bg-white scroll-mt-24">
          <div className="container-premium">
            <SectionHeading eyebrow="Cómo opera Drako" title="Del problema al SaaS, dirigido desde el centro" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200" />
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative text-center">
                  <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
                    {step.icon}
                    <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white border border-gray-200 text-xs font-bold text-blue-600 shadow-sm">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 max-w-xs mx-auto leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MÉTRICAS */}
        <section className="section-spacing bg-gradient-to-b from-slate-50 to-blue-50 border-y border-gray-200">
          <div className="container-premium">
            <SectionHeading eyebrow="Impacto" title="Números de un sistema que no descansa" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {METRICS.map((metric) => (
                <div key={metric.label} className="card-premium text-center">
                  <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    {metric.icon}
                  </span>
                  <div className="text-5xl md:text-6xl font-bold tracking-tight drako-gradient-text mb-2">{metric.value}</div>
                  <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* JOURNAL */}
        <section className="section-spacing bg-white">
          <div className="container-premium">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <span className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-4 block">Journal</span>
                <h2 className="heading-lg text-slate-900">Reportajes sobre IA y tecnología</h2>
                <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mt-4">
                  Drako publica análisis, avances y casos de uso reales del ecosistema. Para fundadores, equipos técnicos y curiosos de la IA.
                </p>
              </div>
              <Link href={`${prefix}/journal`} className="btn-premium btn-secondary shrink-0">
                Ver todos los artículos
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {JOURNAL_ARTICLES.map((article) => (
                <Link key={article.title} href={`${prefix}/journal`} className="card-premium group flex flex-col">
                  <div className="mb-6 h-40 rounded-2xl bg-gradient-to-br from-blue-100 via-slate-50 to-cyan-100" />
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-bold uppercase tracking-widest text-blue-600">{article.category}</span>
                    <span className="font-mono text-slate-400">{article.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="section-spacing bg-gradient-to-b from-slate-50 to-blue-50 border-t border-gray-200">
          <div className="container-premium text-center">
            <h2 className="heading-lg text-slate-900 mb-6 max-w-2xl mx-auto text-balance">¿Quieres entrar al ecosistema?</h2>
            <p className="text-xl text-slate-600 mb-10 max-w-xl mx-auto">
              Prueba Socialcors, el primer SaaS activo de Drako. Automatiza tus redes sociales con IA.
            </p>
            <a href={SOCIALCORS_URL} className="btn-premium btn-primary text-lg px-10 py-5">
              Empezar con Socialcors
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </div>
        </section>

      </div>
    </SiteLayout>
  );
}
