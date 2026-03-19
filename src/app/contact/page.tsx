import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

export default async function ContactPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/contact" copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* HERO */}
        <section className="pt-32 pb-20 md:pt-48 md:pb-32">
          <div className="container-premium">
             <div className="max-w-4xl fade-in-up">
                <span className="text-sky-500 font-bold tracking-widest uppercase text-sm mb-6 block">
                  {copy.nav.contact}
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 text-balance">
                  {copy.contact.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-600 max-w-2xl text-balance leading-relaxed">
                  {copy.contact.subtitle}
                </p>
             </div>
          </div>
        </section>

        {/* CONTENT & FORM */}
        <section className="pb-32">
           <div className="container-premium">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
                 
                 {/* Left Column: Context */}
                 <div className="md:col-span-5 fade-in-up delay-100">
                    <div className="prose prose-lg text-slate-600 leading-loose">
                       <p className="text-xl text-slate-800 font-medium mb-8">
                          {copy.contact.intro}
                       </p>
                       <div className="bg-white p-8 rounded-2xl border border-slate-200 mt-8">
                          <p className="text-base text-slate-500 italic">
                             "{copy.contact.note}"
                          </p>
                       </div>
                    </div>
                 </div>

                 {/* Right Column: Form */}
                 <div className="md:col-span-7 fade-in-up delay-200">
                    <form className="card-premium bg-white p-8 md:p-12 space-y-8">
                       <div className="grid grid-cols-1 gap-8">
                          <div className="space-y-2">
                             <label htmlFor="name" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                {copy.contact.form.name}
                             </label>
                             <input 
                                type="text" 
                                id="name"
                                name="name"
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                placeholder="Ej. Ana García"
                             />
                          </div>
                          
                          <div className="space-y-2">
                             <label htmlFor="email" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                {copy.contact.form.email}
                             </label>
                             <input 
                                type="email" 
                                id="email"
                                name="email"
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                placeholder="Ej. ana@empresa.com"
                             />
                          </div>

                          <div className="space-y-2">
                             <label htmlFor="role" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                {copy.contact.form.role}
                             </label>
                             <input 
                                type="text" 
                                id="role"
                                name="role"
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                                placeholder="Ej. Director de Operaciones"
                             />
                          </div>

                          <div className="space-y-2">
                             <label htmlFor="message" className="text-sm font-bold uppercase tracking-widest text-slate-500">
                                {copy.contact.form.message}
                             </label>
                             <textarea 
                                id="message"
                                name="message"
                                rows={5}
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
                                placeholder="Cuéntanos brevemente qué buscas resolver..."
                             />
                          </div>
                       </div>

                       <div className="pt-4">
                          <button type="submit" className="btn-premium btn-primary w-full md:w-auto text-lg px-8">
                             {copy.contact.form.submit}
                          </button>
                       </div>
                    </form>
                 </div>

              </div>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
