import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function SystemPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  return (
    <SiteLayout locale={locale} currentPath="/system" copy={{ nav: copy.nav, footerLine: copy.about.paragraphs?.[0] ?? "" }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6 fade-in">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.system}</p>
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.system.title}</h1>
                <p className="text-sm text-slate-600 max-w-3xl">{copy.system.subtitle}</p>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-4 sm:p-5 fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {copy.system.blocks.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-[#e3e9f3] bg-white px-4 py-3 text-sm text-slate-900 transition hover:-translate-y-0.5 hover:border-sky-100 hover:bg-sky-50/70"
                >
                  <div className="text-base font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{item.body}</div>
                </div>
              ))}
            </div>
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
