import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function ProductsPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine }}>
      <div className="bg-[#f6f8fb] text-slate-900 font-sans min-h-screen">
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.products}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.products.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.products.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* INTRO */}
        <section className="pb-20">
           <div className="container-premium">
              <div className="card-premium bg-white p-8 md:p-12 fade-in-up delay-100">
                 <p className="text-lg md:text-xl text-slate-700 leading-loose max-w-4xl">
                    {copy.products.intro}
                 </p>
              </div>
           </div>
        </section>

        {/* ACTIVE PRODUCTS - SOCIALFLOW */}
        <section className="section-spacing bg-white border-t border-slate-200">
           <div className="container-premium">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-12 block">
                Operativo
              </span>
              
              <div className="grid gap-20">
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start fade-in-up">
                    <div className="lg:col-span-5 sticky top-32">
                       <h2 className="heading-lg text-slate-900 mb-4">
                          {copy.products.socialFlow.name}
                       </h2>
                       <p className="text-xl text-sky-600 font-medium mb-8 text-balance">
                          {copy.products.socialFlow.tagline}
                       </p>
                       <div className="hidden lg:block">
                          <a href="/contact" className="btn-premium btn-primary">
                             Solicitar acceso
                          </a>
                       </div>
                    </div>
                    
                    <div className="lg:col-span-7 space-y-16">
                       <div className="prose prose-lg max-w-none text-slate-600">
                          <div className="pl-6 border-l-2 border-slate-200 mb-12">
                             <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">El Problema</h3>
                             <p className="text-lg leading-relaxed">{copy.products.socialFlow.problem}</p>
                          </div>
                          
                          <div className="pl-6 border-l-2 border-sky-400 mb-12">
                             <h3 className="text-sm font-bold uppercase tracking-widest text-sky-500 mb-3">La Solución</h3>
                             <p className="text-lg leading-relaxed text-slate-800">{copy.products.socialFlow.solution}</p>
                          </div>
                          
                          <div className="bg-[#eef4fa] p-8 rounded-2xl">
                             <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3">Impacto Real</h3>
                             <p className="text-lg leading-relaxed">{copy.products.socialFlow.impact}</p>
                          </div>
                       </div>
                       
                       <div className="lg:hidden">
                          <a href="/contact" className="btn-premium btn-primary w-full">
                             Solicitar acceso
                          </a>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* FUTURE / BUILDING */}
        <section className="section-spacing bg-[#f6f8fb] border-t border-slate-200">
           <div className="container-premium">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-12 block">
                Roadmap
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center fade-in-up">
                 <div>
                    <h2 className="heading-lg text-slate-900 mb-6">
                       {copy.products.future.title}
                    </h2>
                    <div className="h-1 w-20 bg-indigo-300 mb-8" />
                 </div>
                 <div>
                    <p className="text-lg md:text-xl text-slate-600 leading-relaxed">
                       {copy.products.future.description}
                    </p>
                 </div>
              </div>
           </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-white border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-8">¿Tienes un problema operativo?</h2>
              <a href="/contact" className="btn-premium btn-secondary text-lg px-8 py-4">
                 Cuéntanoslo
              </a>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
