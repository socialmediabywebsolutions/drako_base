import { SiteLayout } from "@/components/marketing/SiteLayout";
import { HeroModule, OpsPanel, ProductList, StateBlock } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { products as canonicalProducts, type Product } from "@/lib/marketing/products";

export default async function ProductsPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

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

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-6">
          <HeroModule
            title={copy.products.title}
            subtitle={copy.products.subtitle}
            tags={["Holding operativo", "Servicios", "Control central", "Agentes"]}
            ctaHref="/system"
          />

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <OpsPanel variant="base" className="p-3 sm:p-4 flex items-center gap-3 text-sm">
              {[{ state: "RUNNING" as const, count: stateCount.RUNNING }, { state: "BUILD" as const, count: stateCount.BUILD }, { state: "RESEARCH" as const, count: stateCount.RESEARCH }].map((s) => (
                <StateBlock key={s.state} state={s.state} count={s.count} />
              ))}
            </OpsPanel>

            <OpsPanel variant="elevated" className="p-3 sm:p-4 lg:col-span-2">
              <header className="flex items-center justify-between text-sm text-slate-500">
                <span className="font-semibold text-slate-900">Servicios</span>
              </header>
              <ProductList items={productItems} />
            </OpsPanel>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
