import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { journalCategories, publishedJournalEntries } from "@/lib/marketing/journal";

export default async function JournalPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  const categoriesWithCopy = journalCategories.map((category, index) => ({
    category,
    title: copy.journal.themes[index]?.title ?? category,
    desc: copy.journal.themes[index]?.desc,
  }));

  return (
    <SiteLayout locale={locale} currentPath="/journal" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.nav.journal}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.journal.title}</h1>
          <p className="text-slate-600">{copy.journal.subtitle}</p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
          <p className="text-slate-700">{copy.journal.intro}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {categoriesWithCopy.map((theme) => (
              <div key={theme.category} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{theme.title}</h3>
                {theme.desc ? <p className="mt-1 text-sm text-slate-600">{theme.desc}</p> : null}
              </div>
            ))}
          </div>
          {publishedJournalEntries.length === 0 ? (
            <p className="text-sm text-slate-600">{copy.journal.empty}</p>
          ) : (
            <div className="space-y-3">
              {publishedJournalEntries.map((entry) => (
                <article key={entry.slug} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{entry.category}</p>
                    {entry.publishedAt ? <span className="text-xs text-slate-500">{entry.publishedAt}</span> : null}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{entry.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{entry.shortDescription}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
