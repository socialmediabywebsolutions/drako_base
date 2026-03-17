import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function AboutPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;

  return (
    <SiteLayout locale={locale} currentPath="/about" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.about}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.about.title}</h1>
          <p className="text-slate-600">{copy.about.intro}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {copy.about.blocks.map((block) => (
            <div key={block.title} className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{block.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{block.body}</p>
            </div>
          ))}
        </section>
      </div>
    </SiteLayout>
  );
}
