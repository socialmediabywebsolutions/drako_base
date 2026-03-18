import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function ProductsPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine: copy.about.paragraphs?.[0] ?? "" }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6 fade-in">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.products}</p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.nav.products}</h1>
              <p className="text-sm text-slate-600 max-w-3xl">{copy.products.intro}</p>
            </div>
          </OpsPanel>

          <section className="grid gap-3 fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {copy.products.items.map((item) => (
                <OpsPanel
                  key={item.name}
                  variant="elevated"
                  className="p-5 sm:p-6 space-y-3 transition hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="text-slate-800">{item.description}</p>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Problema" : "Problema"}</div>
                      <p className="text-slate-800">{item.problem}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Qué hace" : "Qué hace"}</div>
                      <p className="text-slate-800">{item.does}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "es" ? "Qué cambia" : "Qué cambia"}</div>
                      <p className="text-slate-800">{item.changes}</p>
                    </div>
                  </div>
                </OpsPanel>
              ))}
            </div>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
