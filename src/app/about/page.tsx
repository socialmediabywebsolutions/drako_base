import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function AboutPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/about" copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.about}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.about.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.about.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* STORY CONTENT */}
        <section className="pb-24">
           <div className="container-premium">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                 <div className="md:col-span-8 md:col-start-3 space-y-12">
                    {copy.about.content.map((paragraph, index) => (
                       <div key={index} className={`card-premium bg-white p-8 md:p-12 fade-in-up delay-${(index + 1) * 100}`}>
                          <p className="text-xl leading-loose text-slate-700 font-medium">
                             {paragraph}
                          </p>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </section>

        {/* TEAM / CULTURE (Placeholder for future) */}
        <section className="section-spacing bg-white border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-12">Nuestros Valores</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="p-8 rounded-2xl bg-slate-50">
                    <h3 className="text-xl font-bold mb-4 text-slate-900">Pragmatismo Radical</h3>
                    <p className="text-slate-600">Construimos lo que funciona, no lo que está de moda.</p>
                 </div>
                 <div className="p-8 rounded-2xl bg-slate-50">
                    <h3 className="text-xl font-bold mb-4 text-slate-900">Velocidad y Calidad</h3>
                    <p className="text-slate-600">No elegimos una. Exigimos ambas en cada entrega.</p>
                 </div>
                 <div className="p-8 rounded-2xl bg-slate-50">
                    <h3 className="text-xl font-bold mb-4 text-slate-900">Transparencia Total</h3>
                    <p className="text-slate-600">Sin cajas negras. Entiendes lo que construimos.</p>
                 </div>
              </div>
           </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-[var(--background-alt)] border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-8">Trabaja con nosotros</h2>
              <a href="/contact" className="btn-premium btn-primary text-lg px-8 py-4">
                 Ver posiciones abiertas
              </a>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
