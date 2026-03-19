import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function VisionPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/vision" copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.vision}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.vision.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.vision.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* MANIFESTO CONTENT */}
        <section className="pb-24">
           <div className="container-premium">
              <div className="max-w-3xl mx-auto space-y-12">
                 {copy.vision.content.map((paragraph, index) => (
                    <p key={index} className={`text-xl md:text-2xl leading-loose text-slate-700 fade-in-up delay-${(index + 1) * 100}`}>
                       {paragraph}
                    </p>
                 ))}
              </div>
           </div>
        </section>

        {/* PILLARS */}
        <section className="section-spacing bg-white border-t border-slate-200">
           <div className="container-premium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                 {copy.vision.pillars.map((pillar, index) => (
                    <div key={index} className="card-premium p-8 md:p-12 hover:border-indigo-200 group fade-in-up">
                       <h3 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors">
                          {pillar.title}
                       </h3>
                       <p className="text-lg text-slate-600 leading-relaxed">
                          {pillar.body}
                       </p>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-[var(--background-alt)] border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-8">Construyamos ese futuro.</h2>
              <a href="/contact" className="btn-premium btn-secondary text-lg px-8 py-4">
                 Unirse a Drako
              </a>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
