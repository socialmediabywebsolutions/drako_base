import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function JournalPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/journal" copy={{ nav: copy.nav, footerLine }}>
      <div className="bg-[#f6f8fb] text-slate-900 font-sans min-h-screen">
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 border-b border-slate-200">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.journal}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.journal.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.journal.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* INTRO / MANIFESTO */}
        <section className="section-spacing">
           <div className="container-premium">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                 <div className="md:col-span-8 md:col-start-3">
                    <div className="card-premium bg-white p-8 md:p-12 fade-in-up delay-100">
                       <p className="text-xl md:text-2xl leading-loose font-medium text-slate-800">
                          {copy.journal.intro}
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* EMPTY STATE / UPCOMING */}
        <section className="pb-32">
           <div className="container-premium">
              <div className="border-t border-slate-200 pt-12">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[1, 2, 3].map((i) => (
                       <div key={i} className="card-premium h-64 flex flex-col items-center justify-center bg-slate-50 border-dashed border-slate-300 opacity-60 hover:opacity-100 transition-opacity">
                          <span className="text-4xl mb-4 text-slate-300">✎</span>
                          <span className="text-slate-400 font-medium uppercase tracking-widest text-sm">
                             Próximamente
                          </span>
                       </div>
                    ))}
                 </div>
                 <div className="text-center mt-12 fade-in-up delay-200">
                    <p className="text-slate-500 italic">
                       Estamos compilando nuestros primeros casos de estudio técnicos.
                    </p>
                 </div>
              </div>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
