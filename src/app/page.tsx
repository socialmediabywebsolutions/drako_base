import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  Cloud,
  Facebook,
  GraduationCap,
  Infinity as InfinityIcon,
  Instagram,
  Linkedin,
  Plug,
  Rocket,
  Share2,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

const SOCIALCORS_URL = "https://socialcors.com";

const TRUST_ITEMS: { name: string; icon: ReactNode }[] = [
  { name: "Instagram", icon: <Instagram className="h-5 w-5" /> },
  { name: "Facebook", icon: <Facebook className="h-5 w-5" /> },
  { name: "LinkedIn", icon: <Linkedin className="h-5 w-5" /> },
  { name: "Meta", icon: <InfinityIcon className="h-5 w-5" /> },
  { name: "Cloudflare", icon: <Cloud className="h-5 w-5" /> },
  { name: "Anthropic", icon: <Sparkles className="h-5 w-5" /> },
];

const ECOSYSTEM: { name: string; description: string; active: boolean; href?: string; icon: ReactNode }[] = [
  { name: "Socialcors", description: "Automatización total de redes sociales con IA", active: true, href: SOCIALCORS_URL, icon: <Share2 className="h-6 w-6" /> },
  { name: "Mentoría", description: "Tutores IA para estudiantes", active: false, icon: <GraduationCap className="h-6 w-6" /> },
  { name: "Cazh", description: "Wallet digital inteligente", active: false, icon: <Wallet className="h-6 w-6" /> },
  { name: "Rentia", description: "Gestión inmobiliaria con IA", active: false, icon: <Building2 className="h-6 w-6" /> },
];

const STEPS: { title: string; description: string; icon: ReactNode }[] = [
  { title: "Conectas tus redes", description: "Instagram, Facebook y LinkedIn en un par de clics, con los permisos oficiales de cada plataforma.", icon: <Plug className="h-7 w-7" /> },
  { title: "La IA aprende tu negocio", description: "Los agentes estudian tu marca, tu audiencia y lo que funciona en tu nicho.", icon: <Brain className="h-7 w-7" /> },
  { title: "Publicas en piloto automático", description: "Contenido, horarios y publicación en marcha sin que tengas que tocar nada.", icon: <Rocket className="h-7 w-7" /> },
];

const METRICS: { value: string; label: string; icon: ReactNode }[] = [
  { value: "26", label: "agentes IA activos", icon: <Bot className="h-5 w-5" /> },
  { value: "3", label: "redes sociales automatizadas", icon: <Share2 className="h-5 w-5" /> },
  { value: "100%", label: "autónomo en Nivel 3", icon: <Sparkles className="h-5 w-5" /> },
  { value: "0", label: "horas de gestión manual", icon: <Timer className="h-5 w-5" /> },
];

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
                El cerebro de IA que mueve <span className="drako-gradient-text">tus redes sociales.</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-12 leading-relaxed max-w-2xl mx-auto text-balance delay-100 fade-in-up">
                Drako dirige múltiples SaaS de automatización con inteligencia artificial. Resultados reales, sin esfuerzo manual.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 delay-200 fade-in-up">
                <a href={SOCIALCORS_URL} className="btn-premium btn-primary">
                  Ver Socialcors
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a href="#como-funciona" className="btn-premium btn-secondary">
                  Cómo funciona
                </a>
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
              Tecnología que ya conoces, inteligencia que no habías visto
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
        <section className="section-spacing bg-slate-50">
          <div className="container-premium">
            <SectionHeading
              eyebrow="El ecosistema"
              title="Un holding, varios SaaS, un mismo cerebro"
              subtitle="Cada producto de Drako comparte la misma infraestructura de agentes IA. Lo que aprende uno, lo aprovechan todos."
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

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="section-spacing bg-white scroll-mt-24">
          <div className="container-premium">
            <SectionHeading eyebrow="Cómo funciona" title="Tres pasos y la IA se encarga del resto" />
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
                <h2 className="heading-lg text-slate-900">Lo último del journal</h2>
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
            <h2 className="heading-lg text-slate-900 mb-6 max-w-2xl mx-auto text-balance">¿Listo para automatizar tu marca?</h2>
            <p className="text-xl text-slate-600 mb-10 max-w-xl mx-auto">
              Socialcors pone a trabajar a los agentes de Drako en tus redes desde el primer día.
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
