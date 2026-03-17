import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { products as canonicalProducts, type Product } from "@/lib/marketing/products";

export default async function ProductsPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  const liveProducts = canonicalProducts.filter((p) => p.status === "live");
  const buildingProducts = canonicalProducts.filter((p) => p.status === "building");
  const researchProducts = canonicalProducts.filter((p) => p.status === "research");

  const [liveCopy, buildingCopy, researchCopy] = copy.products.sections;

  const blocks: { title: string; description: string; body?: string; items: Product[]; empty: string }[] = [
    {
      title: liveCopy.title,
      description: liveCopy.description,
      body: liveCopy.body,
      items: liveProducts,
      empty: liveCopy.empty,
    },
    {
      title: buildingCopy.title,
      description: buildingCopy.description,
      body: buildingCopy.body,
      items: buildingProducts,
      empty: buildingCopy.empty,
    },
    {
      title: researchCopy.title,
      description: researchCopy.description,
      body: researchCopy.body,
      items: researchProducts,
      empty: researchCopy.empty,
    },
  ];

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.products}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.products.title}</h1>
          <p className="text-slate-600">{copy.products.subtitle}</p>
        </header>

        <div className="space-y-8">
          {blocks.map((section) => (
            <section key={section.title} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{section.title}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{section.description}</h2>
                </div>
              </div>
              {section.body ? <p className="text-sm text-slate-600">{section.body}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                {section.items.length > 0 ? (
                  section.items.map((item) => (
                    <div key={item.slug} className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-2 text-sm text-slate-600">{item.shortDescription}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500">
                    {section.empty}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
