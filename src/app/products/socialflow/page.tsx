import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";

export default async function SocialFlowPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const content = copy.products.socialFlow;
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/products/socialflow" copy={{ nav: copy.nav, footerLine }}>
      <div className="bg-white selection:bg-cyan-100 selection:text-cyan-900 overflow-hidden">
        
        {/* 1. HERO SECTION */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 relative border-b border-slate-100 bg-slate-50/50">
          <div className="container-premium relative z-10">
             <div className="flex flex-col lg:flex-row items-center gap-16">
                
                {/* Text Content */}
                <div className="lg:w-1/2 fade-in-up">
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-cyan-100 text-cyan-700 text-xs font-bold tracking-widest uppercase mb-8 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"/>
                      {content.badge}
                   </div>
                   <h1 className="heading-xl text-slate-900 mb-8 text-balance tracking-tight leading-[1.1]">
                      {content.hero.title}
                   </h1>
                   <p className="text-xl text-slate-500 max-w-xl leading-relaxed mb-10">
                      {content.hero.subtitle}
                   </p>
                   <div className="flex flex-col sm:flex-row gap-4 mb-12">
                      <Link href="/contact?interest=Solicitar%20Piloto%20SocialFlow" className="btn-premium bg-cyan-600 text-white hover:bg-cyan-500 shadow-xl shadow-cyan-200/50 px-8 py-4 text-lg border-none">
                         {content.hero.cta}
                      </Link>
                      <Link href="/contact" className="btn-premium bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-8 py-4 text-lg">
                         {content.hero.ctaSecondary}
                      </Link>
                   </div>
                   
                   <div className="pt-8 border-t border-slate-200/60">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        {content.hero.trustedBy}
                      </p>
                      <div className="flex gap-6 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Placeholder Logos */}
                        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse delay-75"></div>
                        <div className="h-8 w-24 bg-slate-200 rounded animate-pulse delay-150"></div>
                      </div>
                   </div>
                </div>

                {/* Hero Mockup */}
                <div className="lg:w-1/2 w-full fade-in-up delay-200 perspective-1000">
                   <div className="relative w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-0 transition-transform duration-700 ease-out">
                      {/* Mockup Header */}
                      <div className="h-12 border-b border-slate-100 flex items-center px-4 justify-between bg-slate-50/50">
                         <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-200" />
                            <div className="w-3 h-3 rounded-full bg-slate-200" />
                         </div>
                         <div className="flex gap-4 text-[10px] font-medium text-slate-400">
                            <span className="text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">Live</span>
                            <span>Queue: 12</span>
                         </div>
                      </div>
                      
                      {/* Mockup Content - Feed */}
                      <div className="p-6 space-y-4 bg-white">
                         {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-xl border border-slate-100 hover:border-cyan-100 hover:bg-cyan-50/30 transition-colors group cursor-default">
                               <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-lg">
                                  {['👋', '🚀', '💡'][i-1]}
                               </div>
                               <div className="flex-1 space-y-2">
                                  <div className="flex justify-between items-center">
                                     <div className="w-24 h-2 bg-slate-200 rounded-full" />
                                     <span className="text-[10px] text-slate-300 font-mono">Just now</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full" />
                                  <div className="w-3/4 h-2 bg-slate-100 rounded-full" />
                                  
                                  {/* Auto-response badge */}
                                  <div className="pt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="px-2 py-1 bg-cyan-100 text-cyan-700 text-[10px] font-bold rounded flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        AI Response Ready
                                     </div>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>

                      {/* Floating Notification */}
                      <div className="absolute bottom-6 right-6 bg-slate-900 text-white p-4 rounded-xl shadow-xl flex items-center gap-3 animate-bounce-slow z-20">
                         <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                         <span className="text-sm font-medium">Tone check passed</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Background Gradients */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </section>

        {/* 2. PROBLEM SECTION */}
        <section className="py-32 bg-white relative">
           <div className="container-premium">
              <div className="max-w-3xl mx-auto text-center fade-in-up mb-20">
                 <h2 className="heading-lg text-slate-900 mb-6">
                    {content.problem.title}
                 </h2>
                 <p className="text-xl text-slate-600 leading-relaxed">
                    {content.problem.subtitle}
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {content.problem.cards.map((card, i) => (
                      <div key={i} className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all duration-300 fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                          <div className="text-4xl mb-6">{card.icon}</div>
                          <h3 className="text-xl font-bold text-slate-900 mb-4">{card.title}</h3>
                          <p className="text-slate-600 leading-relaxed text-balance">{card.text}</p>
                      </div>
                  ))}
              </div>
           </div>
        </section>

        {/* 2.5 REAL FUNCTIONALITY (NEW) */}
        <section className="py-24 bg-slate-50 border-t border-slate-100">
           <div className="container-premium">
              <div className="max-w-3xl mx-auto mb-16 text-center fade-in-up">
                 <h2 className="heading-lg text-slate-900 mb-4">{content.realFunctionality.title}</h2>
                 <p className="text-xl text-slate-600">{content.realFunctionality.subtitle}</p>
              </div>
              <div className="max-w-4xl mx-auto grid grid-cols-1 gap-6">
                 {content.realFunctionality.features.map((feature, i) => (
                    <div key={i} className="flex gap-6 p-8 bg-white rounded-2xl border border-slate-200 shadow-sm items-start fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                       <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold shrink-0 mt-1 text-lg">
                          {i + 1}
                       </div>
                       <div>
                          <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                          <p className="text-lg text-slate-600 leading-relaxed">{feature.desc}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </section>

        {/* 3. SOLUTION GRID */}
        <section className="py-32 bg-slate-900 text-white relative overflow-hidden">
           <div className="container-premium relative z-10">
              <div className="mb-20 fade-in-up">
                 <h2 className="heading-lg mb-6 text-white">
                    {content.solution.title}
                 </h2>
                 <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
                    {content.solution.subtitle}
                 </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {content.solution.features.map((feature, i) => (
                    <div key={i} className="flex gap-6 p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                       <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-3xl flex-shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                          {feature.icon}
                       </div>
                       <div>
                          <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                          <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
           
           {/* Dark Theme Gradients */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        </section>

        {/* 4. HOW IT WORKS */}
        <section className="py-32 bg-slate-50">
            <div className="container-premium">
                <div className="text-center mb-20 fade-in-up">
                    <h2 className="heading-lg text-slate-900">{content.howItWorks.title}</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-200 z-0"></div>

                    {content.howItWorks.steps.map((step, i) => (
                        <div key={i} className="relative z-10 fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
                            <div className="w-24 h-24 rounded-full bg-white border-4 border-slate-100 flex items-center justify-center text-2xl font-bold text-cyan-600 shadow-sm mb-8 mx-auto relative group">
                                <span className="relative z-10">{step.num}</span>
                                <div className="absolute inset-0 rounded-full bg-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">{step.title}</h3>
                            <p className="text-slate-600 text-center leading-relaxed">{step.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* 4.5 INTEGRATIONS (NEW) */}
        <section className="py-24 bg-white border-y border-slate-100">
            <div className="container-premium text-center">
                <h2 className="heading-md text-slate-900 mb-6 fade-in-up">{content.integrations.title}</h2>
                <p className="text-lg text-slate-500 mb-12 fade-in-up delay-100">{content.integrations.subtitle}</p>
                <div className="flex flex-wrap justify-center gap-4 fade-in-up delay-200">
                    {content.integrations.items.map((item, i) => (
                        <div key={i} className="px-8 py-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-bold hover:border-cyan-200 hover:text-cyan-700 hover:bg-cyan-50 transition-colors cursor-default">
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* 5. IMPACT METRICS & VIZ */}
        <section className="py-32 bg-white border-t border-slate-100">
           <div className="container-premium">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                 <div className="fade-in-up">
                    <h2 className="heading-lg text-slate-900 mb-6">
                       {content.impact.title}
                    </h2>
                    <p className="text-xl text-slate-600 mb-12 leading-relaxed">
                       {content.impact.text}
                    </p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-12">
                       {content.impact.metrics.map((metric, i) => (
                          <div key={i}>
                             <div className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">{metric.value}</div>
                             <div className="text-sm font-bold text-cyan-600 uppercase tracking-wider mb-2">{metric.label}</div>
                             <p className="text-sm text-slate-500 leading-normal">{metric.desc}</p>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 {/* Abstract Impact Viz - Light Mode */}
                 <div className="relative h-[500px] w-full bg-slate-50 rounded-3xl border border-slate-100 p-8 fade-in-up delay-200 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                    
                    <div className="flex items-end justify-between h-full gap-4 px-4 pb-4 relative z-10">
                       {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                          <div key={i} className="w-full bg-slate-200 rounded-t-lg relative group overflow-hidden" style={{ height: `${h}%` }}>
                             <div className="absolute bottom-0 w-full bg-cyan-500 transition-all duration-1000 ease-out group-hover:bg-cyan-400" style={{ height: i > 2 ? '100%' : '0%' }} />
                          </div>
                       ))}
                    </div>
                    
                    <div className="absolute top-8 left-8 right-8 z-20 bg-white/80 backdrop-blur p-4 rounded-xl border border-slate-100 shadow-sm">
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-mono text-slate-500 uppercase">Efficiency Delta</span>
                          <span className="text-sm font-bold text-green-500 flex items-center gap-1">
                             ▲ 145%
                          </span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* 5.5 ICP (NEW) */}
        <section className="py-32 bg-slate-900 text-white">
            <div className="container-premium">
                <div className="text-center mb-20 fade-in-up">
                    <h2 className="heading-lg text-white mb-6">{content.icp.title}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                    {/* For */}
                    <div className="p-10 rounded-3xl bg-white/5 border border-white/10 fade-in-up delay-100">
                        <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                            <span className="text-green-400 bg-green-400/10 p-2 rounded-lg">✅</span> Para quién es
                        </h3>
                        <ul className="space-y-6">
                            {content.icp.for.map((item, i) => (
                                <li key={i} className="flex gap-4 text-slate-300">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2.5 shrink-0 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                                    <span className="text-lg">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Not For */}
                    <div className="p-10 rounded-3xl bg-white/5 border border-white/10 relative overflow-hidden fade-in-up delay-200">
                        <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
                        <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                            <span className="text-red-400 bg-red-400/10 p-2 rounded-lg">❌</span> Para quién NO es
                        </h3>
                        <ul className="space-y-6">
                            {content.icp.notFor.map((item, i) => (
                                <li key={i} className="flex gap-4 text-slate-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2.5 shrink-0 shadow-[0_0_10px_rgba(248,113,113,0.5)]" />
                                    <span className="text-lg">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        {/* 6. CASE STUDY */}
        <section className="py-32 bg-slate-50 relative overflow-hidden">
            <div className="container-premium relative z-10">
                <div className="text-center mb-16 fade-in-up">
                    <span className="text-cyan-600 font-bold tracking-widest uppercase text-xs mb-4 block">Case Study</span>
                    <h2 className="heading-lg text-slate-900 mb-4">{content.caseStudy.title}</h2>
                    <p className="text-xl text-slate-600">{content.caseStudy.subtitle}</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row fade-in-up">
                    <div className="md:w-1/2 p-10 border-b md:border-b-0 md:border-r border-slate-100 bg-red-50/30">
                        <div className="flex items-center gap-3 mb-6 text-red-800 font-bold uppercase tracking-wider text-xs">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {content.caseStudy.before.title}
                        </div>
                        <ul className="space-y-4">
                            {content.caseStudy.before.items.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-slate-600">
                                    <span className="text-red-400 mt-1">✕</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="md:w-1/2 p-10 bg-green-50/30">
                        <div className="flex items-center gap-3 mb-6 text-green-800 font-bold uppercase tracking-wider text-xs">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {content.caseStudy.after.title}
                        </div>
                        <ul className="space-y-4">
                            {content.caseStudy.after.items.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-slate-900 font-medium">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                
                <div className="mt-12 text-center max-w-4xl mx-auto fade-in-up delay-200">
                    <blockquote className="text-2xl md:text-3xl font-serif text-slate-800 italic leading-relaxed">
                        "{content.caseStudy.quote}"
                    </blockquote>
                </div>
            </div>
        </section>

        {/* 6.5 PILOT OFFER (NEW) */}
        <section className="py-32 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-cyan-900/10 pattern-grid-lg opacity-20" />
            <div className="container-premium relative z-10">
                <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-12 md:p-16 text-center fade-in-up">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold tracking-widest uppercase mb-8">
                        {content.pilot.badge}
                    </div>
                    <h2 className="heading-md text-white mb-6">{content.pilot.title}</h2>
                    <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                        {content.pilot.subtitle}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left mb-12">
                        <div className="space-y-6">
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Incluye:</div>
                            <ul className="space-y-4">
                                {content.pilot.features.map((feature, i) => (
                                    <li key={i} className="flex gap-3 text-slate-200">
                                        <span className="text-cyan-400 mt-1">✓</span>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col justify-center items-center md:items-start p-8 rounded-2xl bg-white/5 border border-white/10">
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Inversión</div>
                            <div className="text-2xl font-bold text-white mb-2">{content.pilot.price}</div>
                            <p className="text-sm text-slate-400 mb-8 text-center md:text-left">Sin compromiso de permanencia posterior.</p>
                            <Link href="/contact?interest=Solicitar%20Piloto%20SocialFlow" className="w-full btn-premium bg-cyan-500 text-white hover:bg-cyan-400 border-none justify-center">
                                {content.pilot.cta}
                            </Link>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/10">
                        <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                            <span className="text-2xl">🛡️</span>
                            <span>{content.pilot.guarantee}</span>
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* 7. FAQ */}
        <section className="py-32 bg-white">
            <div className="container-premium">
                <h2 className="heading-lg text-slate-900 mb-16 text-center">{content.faq.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
                    {content.faq.items.map((item, i) => (
                        <div key={i} className="fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                            <h3 className="text-lg font-bold text-slate-900 mb-3">{item.q}</h3>
                            <p className="text-slate-600 leading-relaxed">{item.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* 8. FINAL CTA */}
        <section className="py-32 bg-slate-900 text-white relative overflow-hidden">
           <div className="container-premium relative z-10 text-center">
              <h2 className="heading-xl mb-8 text-white max-w-4xl mx-auto">
                 {content.ctaFinal.title}
              </h2>
              <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto">
                 {content.ctaFinal.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                 <Link href="/contact?interest=Solicitar%20Piloto%20SocialFlow" className="btn-premium bg-cyan-500 text-white hover:bg-cyan-400 border-none shadow-lg shadow-cyan-500/25 px-10 py-5 text-lg">
                    {content.ctaFinal.buttons[0]}
                 </Link>
                 <Link href="/contact" className="btn-premium bg-transparent text-white border border-slate-700 hover:border-white hover:bg-white/5 px-10 py-5 text-lg">
                    {content.ctaFinal.buttons[1]}
                 </Link>
              </div>
           </div>
           
           {/* Decorative */}
           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        </section>

      </div>
    </SiteLayout>
  );
}
