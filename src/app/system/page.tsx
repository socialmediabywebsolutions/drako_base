import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function SystemPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  return (
    <SiteLayout locale={locale} currentPath="/system" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.system}</p>
                <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.system.title}</h1>
                <p className="text-sm text-slate-600 max-w-3xl">{copy.system.intro}</p>
              </div>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-500">
              <span className="font-semibold text-slate-900">Cómo trabajamos</span>
            </header>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {copy.system.pillars.map((item) => (
                <div key={item.title} className="rounded-lg border border-[#e3e9f3] bg-white px-3 py-2 text-sm text-slate-900 hover:border-sky-100 hover:bg-sky-50/70">
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-xs text-slate-500">{item.body}</div>
                </div>
              ))}
            </div>
          </OpsPanel>

          <OpsPanel variant="flat" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-500">
              <span className="font-semibold text-slate-900">Prácticas</span>
            </header>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
              {copy.system.practices.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 mt-1" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
