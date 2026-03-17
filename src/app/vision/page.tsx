import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function VisionPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  return (
    <SiteLayout locale={locale} currentPath="/vision" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.vision}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.vision.title}</h1>
          <p className="text-slate-600">{copy.vision.subtitle}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {copy.vision.pillars.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Roadmap</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {copy.vision.roadmap.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      </div>
    </SiteLayout>
  );
}
