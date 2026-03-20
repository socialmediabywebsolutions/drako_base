import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { ContactForm } from "@/components/marketing/ContactForm";

export default async function ContactPage({
  params,
  searchParams,
}: {
  params?: Promise<{ locale?: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = params ? await params : undefined;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialInterest = typeof resolvedSearchParams.interest === 'string' ? resolvedSearchParams.interest : "";
  
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
                    <ContactForm 
                      copy={copy.contact.form} 
                      initialInterest={initialInterest} 
                    />
                 </div>

              </div>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
