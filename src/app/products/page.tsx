import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";

export default async function ProductsHubPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const content = copy.products;
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine }}>
      <div className="bg-slate-50 min-h-screen">
        
        {/* Header Section */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-24 bg-white border-b border-slate-200">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-cyan-600 font-bold tracking-widest uppercase text-xs mb-6 block">
                  Drako Systems Ecosystem
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                   {content.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-500 leading-relaxed mb-10 max-w-2xl">
                   {content.subtitle}
                </p>
                <div className="w-20 h-1 bg-cyan-500 rounded-full" />
             </div>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-20 bg-slate-50">
          <div className="container-premium">
             <p className="text-lg text-slate-600 max-w-3xl leading-relaxed mb-20 fade-in-up">
                {content.intro}
             </p>

             {/* Products Grid */}
             <div className="space-y-24">
                {content.items.map((item, i) => (
                   <div key={i} className="group fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-cyan-200 transition-all duration-500">
                         <div className="order-2 lg:order-1">
                            {item.name === 'SocialFlow' ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 border border-cyan-100 rounded-full text-xs font-bold text-cyan-700 mb-6 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"/>
                                    Pilot Program Open
                                </div>
                            ) : (
                                <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 mb-6 uppercase tracking-wider">
                                   Live Product
                                </div>
                            )}
                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                               {item.name}
                            </h2>
                            <p className="text-xl text-cyan-600 font-medium mb-8">
                               {item.tagline}
                            </p>
                            
                            <div className="space-y-6 mb-10">
                               <div>
                                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">El Problema</h4>
                                  <p className="text-slate-600 leading-relaxed">{item.problem}</p>
                               </div>
                               <div>
                                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">La Solución</h4>
                                  <p className="text-slate-600 leading-relaxed">{item.solution}</p>
                               </div>
                               <div>
                                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">Impacto</h4>
                                  <p className="text-slate-600 leading-relaxed">{item.impact}</p>
                               </div>
                            </div>

                            <Link 
                               href="/products/socialflow" 
                               className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-cyan-600 px-8 py-4 rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-cyan-500/30"
                            >
                               Explorar SocialFlow
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                         </div>
                         
                         <div className="order-1 lg:order-2 h-full">
                            <div className="aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden relative group-hover:scale-[1.02] transition-transform duration-500 border border-slate-100 h-full">
                               {/* Abstract Product Preview - CSS Only */}
                               <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100" />
                               
                               {/* SocialFlow Specific Preview */}
                               {item.name === 'SocialFlow' && (
                                  <div className="absolute inset-8 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transform rotate-3 group-hover:rotate-0 transition-all duration-500">
                                     <div className="h-10 border-b border-slate-100 bg-slate-50/50 flex items-center px-4 gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"/>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"/>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"/>
                                     </div>
                                     <div className="p-6 space-y-4 bg-white flex-1">
                                        {/* Mockup Items */}
                                        <div className="flex gap-4 items-start">
                                           <div className="w-10 h-10 rounded-full bg-cyan-100 flex-shrink-0" />
                                           <div className="space-y-2 flex-1 pt-1">
                                              <div className="h-2.5 bg-slate-200 rounded w-3/4" />
                                              <div className="h-2 bg-slate-100 rounded w-1/2" />
                                           </div>
                                        </div>
                                        
                                        <div className="pl-14 space-y-3 opacity-60">
                                           <div className="flex gap-3">
                                               <div className="w-8 h-8 rounded-full bg-slate-100" />
                                               <div className="space-y-2 flex-1 pt-1">
                                                  <div className="h-2 bg-slate-100 rounded w-full" />
                                               </div>
                                           </div>
                                        </div>

                                        <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100 mt-4 ml-14 transform translate-x-2">
                                            <div className="flex items-center gap-2 text-cyan-700 text-xs font-bold mb-2 uppercase tracking-wide">
                                                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"/>
                                                AI Response Draft
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-2 bg-cyan-200/50 rounded w-full"/>
                                                <div className="h-2 bg-cyan-200/50 rounded w-5/6"/>
                                            </div>
                                        </div>
                                     </div>
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </section>

        {/* Future Lab Section */}
        <section className="py-24 bg-slate-900 text-white overflow-hidden relative mt-20">
           <div className="container-premium relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                 <div>
                    <span className="text-cyan-400 font-bold tracking-widest uppercase text-xs mb-6 block">
                       Drako Labs
                    </span>
                    <h2 className="heading-lg mb-6 text-white">{content.future.title}</h2>
                    <p className="text-xl text-slate-400 leading-relaxed mb-8">
                       {content.future.description}
                    </p>
                    <Link href="/contact" className="text-white border-b border-cyan-500 pb-1 hover:text-cyan-400 transition-colors inline-block mt-4">
                       ¿Tienes un reto operativo complejo? Hablemos.
                    </Link>
                 </div>
                 
                 <div className="grid gap-4">
                    {content.future.items.map((item, i) => (
                       <div key={i} className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-4 group cursor-default">
                          <div className={`w-3 h-3 rounded-full ${item.color} shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform`} />
                          <div>
                             <h3 className="font-bold text-white text-lg">{item.title}</h3>
                             <p className="text-slate-400 text-sm">{item.desc}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
           
           {/* Background Decorations */}
           <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
           <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        </section>

        {/* General CTA */}
        <section className="py-32 bg-white text-center">
           <div className="container-premium">
              <h2 className="heading-lg text-slate-900 mb-12 max-w-3xl mx-auto">{content.cta.title}</h2>
              <Link href="/contact" className="btn-premium bg-slate-900 text-white hover:bg-slate-800 px-10 py-5 text-lg shadow-xl shadow-slate-200">
                 {content.cta.button}
              </Link>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
