import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";
const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

export default async function Home({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const headerMode = headersList.get("x-drako-host-mode");
  const mode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);

  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");

  if (host.includes("socialflow")) redirect("/socialflow");

  const matchedPath = headersList.get("x-matched-path") || headersList.get("x-invoke-path") || headersList.get("next-url") || "/";
  const pathParts = matchedPath.split("/");
  const localeFromPath = resolveMarketingLocale(resolvedParams?.locale ?? (pathParts[1] || undefined));
  const locale: MarketingLocale = localeFromPath;
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  const currentPath = "/";

  // Using the first paragraph of About as the footer line
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* HERO SECTION */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="container-premium relative z-10">
            <div className="max-w-4xl mx-auto text-center fade-in-up">
              <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                {copy.home.hero.title}
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto text-balance delay-100 fade-in-up">
                {copy.home.hero.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 delay-200 fade-in-up">
                <Link 
                  href={`${prefix}/products`}
                  className="btn-premium btn-primary"
                >
                  {copy.home.hero.cta}
                </Link>
                <Link 
                  href={`${prefix}/system`}
                  className="btn-premium btn-secondary"
                >
                  {copy.nav.system}
                </Link>
              </div>
            </div>

            <div className="mt-20 max-w-3xl mx-auto delay-300 fade-in-up">
              <div className="card-premium !bg-white/50 backdrop-blur-sm border-slate-200/60 p-8 md:p-12">
                <p className="text-base md:text-lg text-slate-700 leading-loose">
                  {copy.home.hero.description}
                </p>
              </div>
            </div>
          </div>

          {/* Abstract decorative background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none opacity-40 z-0">
             <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-sky-200/30 rounded-full blur-3xl mix-blend-multiply filter" />
             <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-3xl mix-blend-multiply filter" />
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <section className="section-spacing bg-white border-y border-slate-200">
          <div className="container-premium">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24 items-center">
              <div>
                <h2 className="heading-lg text-slate-900 mb-6">
                  {copy.home.problem.title}
                </h2>
                <div className="h-1 w-20 bg-sky-400 mb-8" />
              </div>
              <div>
                <p className="text-lg text-slate-600 leading-relaxed">
                  {copy.home.problem.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT IS DRAKO */}
        <section className="section-spacing">
          <div className="container-premium">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-3xl bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl overflow-hidden relative">
                 {/* Dark card content */}
                 <div className="relative z-10 p-8 md:p-12">
                    <span className="inline-block py-1 px-3 rounded-full bg-white/10 text-sky-300 text-xs font-bold tracking-widest uppercase mb-6">
                      Drako Systems
                    </span>
                    <h2 className="heading-lg mb-6 text-white">
                      {copy.home.whatIs.title}
                    </h2>
                    <p className="text-lg text-slate-300 leading-relaxed mb-8">
                      {copy.home.whatIs.description}
                    </p>
                    <Link href={`${prefix}/about`} className="text-sky-400 font-semibold hover:text-sky-300 transition-colors inline-flex items-center gap-2">
                       {copy.nav.about} 
                       <span aria-hidden="true">→</span>
                    </Link>
                 </div>
                 
                 {/* Decorative gradient overlay */}
                 <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-t from-sky-500/10 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCTS PREVIEW */}
        <section className="section-spacing bg-[var(--background-alt)]">
          <div className="container-premium">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="heading-lg text-slate-900 mb-4">{copy.home.productsPreview.title}</h2>
                <p className="text-slate-600 max-w-xl">{copy.products.intro}</p>
              </div>
              <Link href={`${prefix}/products`} className="btn-premium btn-secondary shrink-0">
                {copy.home.productsPreview.cta}
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {copy.products.items.map((item) => (
                <div key={item.name} className="card-premium bg-slate-900 border-slate-800 text-white overflow-hidden p-0 shadow-2xl group">
                   <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px]">
                      <div className="p-8 md:p-12 flex flex-col justify-center relative z-10">
                         <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                         
                         {item.name === 'SocialFlow' ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-6 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
                                Pilot Program Open
                            </div>
                         ) : (
                             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-6 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
                                Live Product
                             </div>
                         )}
                         
                         <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">{item.name}</h3>
                         <p className="text-xl text-cyan-400 font-medium mb-6">{item.tagline}</p>
                         <p className="text-slate-400 mb-8 leading-relaxed text-lg max-w-md">
                            {item.solution}
                         </p>
                         
                         <div>
                            <Link 
                              href={`${prefix}/products/socialflow`} 
                              className="inline-flex items-center gap-2 bg-cyan-500 text-white hover:bg-cyan-400 px-6 py-3 rounded-lg font-bold transition-all shadow-lg shadow-cyan-500/20"
                            >
                              Ver Landing Page
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                         </div>
                      </div>
                      
                      {/* Visual Preview - Dark Theme */}
                      <div className="bg-slate-800/50 relative border-t lg:border-t-0 lg:border-l border-slate-700/50 p-8 flex items-center justify-center overflow-hidden">
                          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
                          
                          {/* Abstract UI representation */}
                          <div className="relative w-full max-w-md aspect-video bg-slate-900 rounded-xl shadow-2xl border border-slate-700 p-4 transform rotate-1 group-hover:rotate-0 transition-transform duration-500 hover:shadow-cyan-900/20">
                              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
                                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                              </div>
                              <div className="space-y-4">
                                  <div className="flex gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 border border-slate-700" />
                                      <div className="space-y-2 flex-1 pt-1">
                                          <div className="h-2 bg-slate-800 rounded w-3/4" />
                                          <div className="h-2 bg-slate-800 rounded w-1/2" />
                                      </div>
                                  </div>
                                  
                                  <div className="bg-cyan-900/20 p-3 rounded-lg border border-cyan-900/50 ml-11">
                                      <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-bold mb-1 uppercase tracking-wide">
                                          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"/>
                                          AI Response
                                      </div>
                                      <div className="h-1.5 bg-cyan-900/50 rounded w-full mb-1" />
                                      <div className="h-1.5 bg-cyan-900/50 rounded w-5/6" />
                                  </div>
                              </div>
                              
                              <div className="absolute -bottom-4 -right-4 bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                                  System Active
                              </div>
                          </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SYSTEM / VISION PREVIEW GRID */}
        <section className="section-spacing">
           <div className="container-premium">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* System Card */}
                 <Link href={`${prefix}/system`} className="card-premium group cursor-pointer h-full flex flex-col">
                    <div className="mb-6">
                       <span className="inline-block p-3 rounded-xl bg-sky-50 text-sky-600 mb-4 group-hover:bg-sky-100 transition-colors">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                       </span>
                       <h3 className="text-2xl font-bold text-slate-900 mb-2">{copy.system.title}</h3>
                       <p className="text-slate-600">{copy.system.intro}</p>
                    </div>
                    <div className="mt-auto pt-6 border-t border-slate-100">
                       <span className="text-sm font-bold text-slate-900 group-hover:text-sky-500 transition-colors flex items-center gap-2">
                          Conoce nuestro método <span aria-hidden="true">→</span>
                       </span>
                    </div>
                 </Link>

                 {/* Vision Card */}
                 <Link href={`${prefix}/vision`} className="card-premium group cursor-pointer h-full flex flex-col">
                    <div className="mb-6">
                       <span className="inline-block p-3 rounded-xl bg-indigo-50 text-indigo-600 mb-4 group-hover:bg-indigo-100 transition-colors">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                       </span>
                       <h3 className="text-2xl font-bold text-slate-900 mb-2">{copy.vision.title}</h3>
                       <p className="text-slate-600">{copy.vision.content[0]}</p>
                    </div>
                    <div className="mt-auto pt-6 border-t border-slate-100">
                       <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-500 transition-colors flex items-center gap-2">
                          Lee nuestra visión <span aria-hidden="true">→</span>
                       </span>
                    </div>
                 </Link>
              </div>
           </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 bg-white border-t border-slate-200">
           <div className="container-premium text-center">
              <h2 className="heading-lg text-slate-900 mb-6 max-w-2xl mx-auto text-balance">{copy.contact.title}</h2>
              <p className="text-xl text-slate-600 mb-10 max-w-xl mx-auto">{copy.contact.subtitle}</p>
              <Link href={`${prefix}/contact`} className="btn-premium btn-primary text-lg px-8 py-4">
                 {copy.contact.form.submit}
              </Link>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
