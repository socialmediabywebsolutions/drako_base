import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { products as canonicalProducts } from "@/lib/marketing/products";
import { HeroModule, LogList, OpsPanel, ProductList, StateBlock } from "@/components/ui/ops-primitives";

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

export default async function Home({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const headerMode = headersList.get("x-drako-host-mode");
  const mode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);

  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");

  const matchedPath = headersList.get("x-matched-path") || headersList.get("x-invoke-path") || headersList.get("next-url") || "/";
  const pathParts = matchedPath.split("/");
  const localeFromPath = resolveMarketingLocale(resolvedParams?.locale ?? (pathParts[1] || undefined));
  const locale = localeFromPath;
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  const currentPath = "/";

  const liveProducts = canonicalProducts.filter((p) => p.status === "live");
  const buildingProducts = canonicalProducts.filter((p) => p.status === "building");
  const researchProducts = canonicalProducts.filter((p) => p.status === "research");

  const productItems = [
    ...liveProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "RUNNING" as const })),
    ...buildingProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "BUILD" as const })),
    ...researchProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "RESEARCH" as const })),
  ];

  const stateCount = {
    RUNNING: productItems.filter((p) => p.state === "RUNNING").length,
    BUILD: productItems.filter((p) => p.state === "BUILD").length,
    RESEARCH: productItems.filter((p) => p.state === "RESEARCH").length,
  };

  const opEvents = [
    "Actualizamos SocialFlow con mejoras en respuesta automática",
    "Probamos nueva señal de calidad para recomendaciones",
    "Preparamos siguiente piloto con un equipo de marketing",
  ];

  const journalEvents = [
    "Artículo: cómo evaluamos impacto real en un piloto",
    "Idea: IA aplicada a operaciones de servicio al cliente",
    "Nota: aprendizajes lanzando iteraciones semanales",
  ];

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 font-sans leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-6">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <HeroModule
              title={copy.home.heroTitle}
              subtitle={copy.home.heroSubtitle}
              tags={copy.home.tags}
              ctaHref={`${prefix}/system`}
              ctaLabel={copy.home.ctas.system}
            />

            <OpsPanel variant="elevated" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-500">
                <span className="font-semibold text-slate-900">Productos</span>
              </header>
              <ProductList items={productItems} />
            </OpsPanel>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-500">
                <span className="font-semibold text-slate-900">Cómo trabajamos</span>
              </header>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["Claridad", "Problema y métrica definidos"],
                  ["Automatización útil", "IA donde quita fricción"],
                  ["Ritmo", "Ciclos cortos y feedback real"],
                  ["Fiabilidad", "Entregas cuidadas"],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-lg border border-[#e3e9f3] bg-white px-3 py-2 text-sm text-slate-900 hover:border-sky-100 hover:bg-sky-50/70">
                    <div className="font-semibold">{title}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                ))}
              </div>
            </OpsPanel>

            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-500">
                <span className="font-semibold text-slate-900">Operación</span>
              </header>
              <LogList lines={opEvents} highlightFirst={false} />
            </OpsPanel>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <OpsPanel variant="base" className="p-3 sm:p-4 flex items-center gap-3 text-sm">
              {[{ state: "RUNNING" as const, count: stateCount.RUNNING }, { state: "BUILD" as const, count: stateCount.BUILD }, { state: "RESEARCH" as const, count: stateCount.RESEARCH }].map((s) => (
                <StateBlock key={s.state} state={s.state} count={s.count} />
              ))}
            </OpsPanel>

            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-500">
                <span className="font-semibold text-slate-900">Registro</span>
              </header>
              <LogList lines={journalEvents} highlightFirst={false} />
            </OpsPanel>

            <OpsPanel variant="flat" className="p-3 sm:p-4">
              <div className="text-sm text-slate-500 uppercase tracking-[0.2em]">Visión</div>
              <div className="mt-2 text-lg font-semibold text-slate-900 leading-tight">
                IA para mejorar trabajo y servicios críticos.
              </div>
              <a href={`${prefix}/vision`} className="mt-2 inline-flex text-xs font-semibold text-slate-700 hover:text-sky-600 underline">
                Ver visión →
              </a>
            </OpsPanel>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
