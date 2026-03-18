import { SiteLayout } from "@/components/marketing/SiteLayout";
import { OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function AboutPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;

  return (
    <SiteLayout locale={locale} currentPath="/about" copy={{ nav: copy.nav, footerLine: copy.about.paragraphs?.[0] ?? "" }}>
      <div className="min-h-screen bg-[#f6f8fb] text-slate-900 leading-tight">
        <main className="mx-auto grid max-w-6xl gap-4 p-4 sm:p-6">
          <OpsPanel variant="elevated" className="p-5 sm:p-6 fade-in">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.nav.about}</p>
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">{copy.about.title}</h1>
            </div>
          </OpsPanel>

          <OpsPanel variant="base" className="p-4 sm:p-5 fade-in">
            <div className="space-y-3 text-sm text-slate-700">
              {copy.about.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-base text-slate-800">
                  {paragraph}
                </p>
              ))}
            </div>
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
