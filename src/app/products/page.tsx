import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";

export default async function ProductsPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/products" copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* HERO */}
        <section className="pt-20 pb-20 md:pt-32 md:pb-32 overflow-hidden relative">
          <div className="container-premium relative z-10">
             <div className="max-w-5xl fade-in-up">
                <span className="inline-block py-1 px-3 rounded-full bg-sky-100 text-sky-700 text-xs font-bold tracking-widest uppercase mb-8 border border-sky-200">
                  {copy.nav.products}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance tracking-tight">
                  {copy.products.title}
                </h1>
                <p className="text-xl md:text-3xl text-slate-500 max-w-3xl text-balance leading-relaxed font-light">
                  {copy.products.subtitle}
                </p>
             </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-sky-50 to-transparent opacity-50 pointer-events-none" />
        </section>

        {/* FEATURED PRODUCT: SOCIALFLOW */}
        <section className="pb-32">
           <div className="container-premium">
              <div className="card-premium bg-white p-0 overflow-hidden border-slate-200 shadow-xl fade-in-up delay-100">
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2">
                    {/* Content Side */}
                    <div className="p-8 md:p-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-100">
                       <div className="mb-8">
                          <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-sky-200">
                             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                             </svg>
                          </div>
                          <h2 className="heading-lg text-slate-900 mb-4 tracking-tight">
                             {copy.products.socialFlow.name}
                          </h2>
                          <p className="text-xl text-sky-600 font-medium mb-6">
                             {copy.products.socialFlow.tagline}
                          </p>
                          <p className="text-lg text-slate-600 leading-relaxed mb-8">
                             {copy.products.socialFlow.solution}
                          </p>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="flex items-start gap-4">
                             <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-1">
                                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Problema</h4>
                                <p className="text-slate-600 text-sm mt-1">{copy.products.socialFlow.problem}</p>
                             </div>
                          </div>
                          
                          <div className="flex items-start gap-4">
                             <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Impacto</h4>
                                <p className="text-slate-600 text-sm mt-1">{copy.products.socialFlow.impact}</p>
                             </div>
                          </div>
                       </div>

                       <div className="mt-12">
                          <Link href="/contact" className="btn-premium btn-primary w-full sm:w-auto text-center">
                             Solicitar Demo
                          </Link>
                       </div>
                    </div>

                    {/* Visual Side - Abstract Interface Mockup */}
                    <div className="bg-slate-50 relative overflow-hidden min-h-[400px] lg:min-h-full p-8 md:p-12 flex items-center justify-center">
                       <div className="absolute inset-0 ui-grid-bg opacity-50" />
                       
                       {/* Abstract Interface Card */}
                       <div className="relative w-full max-w-md aspect-[4/5] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                          {/* Header */}
                          <div className="h-14 border-b border-slate-100 flex items-center px-6 justify-between bg-white">
                             <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400" />
                                <div className="w-3 h-3 rounded-full bg-amber-400" />
                                <div className="w-3 h-3 rounded-full bg-green-400" />
                             </div>
                             <div className="w-24 h-2 bg-slate-100 rounded-full" />
                          </div>
                          
                          {/* Body */}
                          <div className="p-6 space-y-6 bg-[#fafafa] flex-1">
                             <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                                <div className="space-y-2 w-full">
                                   <div className="w-3/4 h-3 bg-slate-200 rounded-md" />
                                   <div className="w-1/2 h-3 bg-slate-100 rounded-md" />
                                </div>
                             </div>
                             
                             <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 space-y-3">
                                <div className="w-full h-32 bg-sky-50 rounded-lg flex items-center justify-center">
                                   <span className="text-sky-200 text-4xl">Aa</span>
                                </div>
                                <div className="space-y-2">
                                   <div className="w-full h-2 bg-slate-100 rounded-full" />
                                   <div className="w-5/6 h-2 bg-slate-100 rounded-full" />
                                   <div className="w-4/6 h-2 bg-slate-100 rounded-full" />
                                </div>
                             </div>

                             <div className="flex justify-between items-center pt-2">
                                <div className="flex -space-x-2">
                                   <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                                   <div className="w-8 h-8 rounded-full bg-slate-300 border-2 border-white" />
                                   <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-white" />
                                </div>
                                <div className="px-4 py-2 bg-sky-500 text-white text-xs font-bold rounded-lg">
                                   Approved
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Floating Elements */}
                       <div className="absolute top-1/4 right-8 p-4 bg-white rounded-xl shadow-lg border border-slate-100 animate-bounce duration-[3000ms]">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">✓</div>
                       </div>
                       <div className="absolute bottom-1/4 left-8 p-4 bg-white rounded-xl shadow-lg border border-slate-100">
                          <div className="flex gap-2 items-center">
                             <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                             <span className="text-xs font-bold text-slate-500">AI Processing</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* ROADMAP / BUILDING */}
        <section className="section-spacing bg-white border-t border-slate-200">
           <div className="container-premium">
              <div className="flex flex-col md:flex-row items-start justify-between mb-16 gap-8">
                 <div>
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 block">
                      En el laboratorio
                    </span>
                    <h2 className="heading-lg text-slate-900">
                       {copy.products.future.title}
                    </h2>
                 </div>
                 <p className="text-xl text-slate-500 max-w-xl leading-relaxed">
                    {copy.products.future.description}
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {[
                    { title: "Logística Inteligente", desc: "Optimización de rutas y stock en tiempo real.", color: "bg-orange-500" },
                    { title: "Finanzas Predictivas", desc: "Detección de anomalías y proyección de flujo.", color: "bg-emerald-500" },
                    { title: "Talento & Cultura", desc: "Matching de skills y análisis de sentimiento.", color: "bg-purple-500" }
                 ].map((item, i) => (
                    <div key={i} className="card-premium group p-8 hover:bg-slate-50 transition-colors">
                       <div className={`w-12 h-1 mb-6 ${item.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
                       <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                       <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* CTA */}
        <section className="py-32 bg-[var(--background-alt)] border-t border-slate-200">
           <div className="container-premium text-center fade-in-up">
              <h2 className="heading-lg mb-8 text-slate-900">¿Tu operación necesita esto?</h2>
              <Link href="/contact" className="btn-premium btn-secondary text-lg px-10 py-5">
                 Hablemos de ingeniería
              </Link>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
