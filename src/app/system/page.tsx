import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function SystemPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  // Footer line from About content
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/system" copy={{ nav: copy.nav, footerLine }}>
      <div className="bg-[#f6f8fb] text-slate-900 font-sans min-h-screen">
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.system}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.system.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.system.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* INTRO BLOCK */}
        <section className="pb-24">
           <div className="container-premium">
              <div className="card-premium bg-white p-8 md:p-12 border-l-4 border-l-sky-400 fade-in-up delay-100">
                 <p className="text-lg md:text-xl text-slate-700 leading-loose">
                    {copy.system.intro}
                 </p>
              </div>
           </div>
        </section>

        {/* STEPS - STORYTELLING LAYOUT */}
        <section className="section-spacing bg-white border-t border-slate-200">
           <div className="container-premium">
              <div className="space-y-24 md:space-y-32">
                 {copy.system.steps.map((step, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-start group fade-in-up">
                       {/* Number Column */}
                       <div className="md:col-span-2 hidden md:block sticky top-32">
                          <span className="text-6xl font-bold text-slate-200 group-hover:text-sky-200 transition-colors">
                             0{index + 1}
                          </span>
                       </div>
                       
                       {/* Content Column */}
                       <div className="md:col-span-10">
                          <div className="md:hidden text-4xl font-bold text-slate-200 mb-4">
                             0{index + 1}
                          </div>
                          <h3 className="heading-lg text-slate-900 mb-6 group-hover:text-sky-600 transition-colors">
                             {step.title} 
                          </h3>
                          <div className="prose prose-lg text-slate-600 leading-loose max-w-none">
                             <p className="text-lg md:text-xl leading-relaxed">{step.description}</p>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-[#eef4fa] border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-8">¿Listo para construir?</h2>
              <a href="/contact" className="btn-premium btn-primary text-lg px-8 py-4">
                 Hablemos del proyecto
              </a>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
