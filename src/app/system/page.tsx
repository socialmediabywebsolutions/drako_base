import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function SystemPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  return (
    <SiteLayout locale={locale} currentPath="/system" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-12">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.system}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.system.title}</h1>
          <p className="text-slate-600">{copy.system.intro}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {copy.system.pillars.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Prácticas</p>
              <h2 className="text-2xl font-semibold text-slate-900">Metodología de fábrica</h2>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            {copy.system.practices.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      </div>
    </SiteLayout>
  );
}
