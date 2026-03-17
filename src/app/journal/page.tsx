import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel, LogList } from "@/components/ui/ops-primitives";
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
      <div className="min-h-screen bg-slate-950 text-slate-100 font-mono leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-5 font-sans">
          <OpsPanel variant="elevated" className="p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.nav.journal}</p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-50">{copy.journal.title}</h1>
              <p className="text-sm text-slate-300 max-w-3xl">{copy.journal.subtitle}</p>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Temas</span>
            </header>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {categoriesWithCopy.map((theme) => (
                <div key={theme.category} className="rounded border border-[#1D2433] bg-[#0F1116] px-3 py-2">
                  <div className="text-sm font-semibold text-slate-100">{theme.title}</div>
                  {theme.desc ? <p className="text-xs text-slate-400 mt-1">{theme.desc}</p> : null}
                </div>
              ))}
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Registro</span>
            </header>
            {publishedJournalEntries.length === 0 ? (
              <div className="mt-2 text-xs text-slate-400">{copy.journal.empty}</div>
            ) : (
              <LogList
                lines={publishedJournalEntries.map((entry) =>
                  [
                    entry.publishedAt ? `[${entry.publishedAt}]` : "[—]",
                    entry.category,
                    "→",
                    entry.title,
                  ].join(" ")
                )}
              />
            )}
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
