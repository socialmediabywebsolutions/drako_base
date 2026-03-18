import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { OpsPanel } from "@/components/ui/ops-primitives";

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
  const locale: MarketingLocale = localeFromPath;
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  const currentPath = "/";

  const productCards = copy.home.productCards ?? [];

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine: copy.about.paragraphs?.[0] ?? "" }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 font-sans leading-tight">
        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
          <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-3 fade-in">
            <OpsPanel
              variant="elevated"
              className="p-6 sm:p-7 bg-gradient-to-br from-white via-white to-sky-50/60"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <span>{copy.nav.home}</span>
              </div>
              <div className="mt-4 space-y-3">
                <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 leading-tight">
                  {copy.home.heroTitle}
                </h1>
                <p className="text-base text-slate-600 max-w-3xl">{copy.home.heroSubtitle}</p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${prefix}/products`}
                    className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(56,189,248,0.35)] transition hover:-translate-y-0.5 hover:bg-sky-600"
                  >
                    {copy.home.ctas.products}
                  </a>
                </div>
              </div>
            </OpsPanel>

            <OpsPanel variant="base" className="p-5 sm:p-6 fade-in">
              <div className="text-sm text-slate-600">{copy.home.context}</div>
            </OpsPanel>
          </section>

          <section className="grid gap-3 fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.products}</p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">{copy.home.productsIntro}</h2>
              </div>
              <a
                href={`${prefix}/products`}
                className="text-sm font-semibold text-slate-700 hover:text-sky-600"
              >
                {copy.home.ctas.products} →
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productCards.length === 0 ? (
                <OpsPanel variant="base" className="p-4 text-sm text-slate-600">
                  {locale === "es" ? "Pronto compartiremos los primeros productos aquí." : "Pronto compartiremos los primeros productos aquí."}
                </OpsPanel>
              ) : (
                productCards.map((card) => (
                  <OpsPanel key={card.name} variant="elevated" className="p-5 sm:p-6 space-y-3 transition hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">{card.name}</div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p className="text-slate-800">{card.description}</p>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Problema" : "Problem"}</div>
                        <p className="text-slate-800">{card.problem}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Qué hace" : "What it does"}</div>
                        <p className="text-slate-800">{card.does}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Qué cambia" : "What it changes"}</div>
                        <p className="text-slate-800">{card.changes}</p>
                      </div>
                    </div>
                  </OpsPanel>
                ))
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 fade-in">
            <OpsPanel variant="base" className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.system}</p>
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{copy.system.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{copy.system.subtitle}</p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {copy.system.blocks.map((block) => (
                  <div
                    key={block.title}
                    className="rounded-lg border border-[#e3e9f3] bg-white px-3 py-2 text-sm text-slate-900 hover:border-sky-100 hover:bg-sky-50/70"
                  >
                    <div className="font-semibold text-slate-900">{block.title}</div>
                    <div className="text-xs text-slate-600">{block.body}</div>
                  </div>
                ))}
              </div>
            </OpsPanel>

            <OpsPanel variant="flat" className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.vision}</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">{copy.vision.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{copy.vision.subtitle}</p>
              <a
                href={`${prefix}/vision`}
                className="mt-4 inline-flex text-sm font-semibold text-slate-800 hover:text-sky-600"
              >
                {locale === "es" ? "Ver visión" : "Ver visión"} →
              </a>
            </OpsPanel>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
