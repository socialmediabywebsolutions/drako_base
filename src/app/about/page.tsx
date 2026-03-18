import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function AboutPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;

  return (
    <SiteLayout locale={locale} currentPath="/about" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.about}</p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.about.title}</h1>
              <p className="text-sm text-slate-600 max-w-3xl">{copy.about.intro}</p>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.about.blocks.map((block) => (
                <div key={block.title} className="rounded-xl border border-[#e3e9f3] bg-white px-4 py-3 hover:border-sky-100 hover:bg-sky-50/60 transition-colors">
                  <h3 className="text-lg font-semibold text-slate-900">{block.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{block.body}</p>
                </div>
              ))}
            </div>
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
