import { SiteLayout } from "@/components/marketing/SiteLayout";
import { HeroModule, LogList, OpsPanel } from "@/components/ui/ops-primitives";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function VisionPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  return (
    <SiteLayout locale={locale} currentPath="/vision" copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-mono leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-5 font-sans">
          <HeroModule
            title={copy.vision.title}
            subtitle={copy.vision.subtitle}
            tags={["Visión", "Autonomía", "Gobernanza", "Agentes"]}
            ctaHref="/system"
          />

          <OpsPanel variant="base" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Pilares</span>
            </header>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {copy.vision.pillars.map((item) => (
                <div key={item.title} className="rounded border border-[#1D2433] bg-[#0F1116] px-3 py-2">
                  <div className="text-sm font-semibold text-slate-100">{item.title}</div>
                  <p className="text-xs text-slate-400 mt-1">{item.body}</p>
                </div>
              ))}
            </div>
          </OpsPanel>

          <OpsPanel variant="flat" className="p-3 sm:p-4">
            <header className="flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Roadmap</span>
            </header>
            <LogList lines={copy.vision.roadmap.map((item) => `• ${item}`)} highlightFirst={false} />
          </OpsPanel>
        </main>
      </div>
    </SiteLayout>
  );
}
