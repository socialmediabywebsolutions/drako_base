import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";

export default async function JournalPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  
  const footerLine = copy.about.content[0];

  const featuredArticles = [
    {
      id: 1,
      category: "Ingeniería",
      title: "Por qué la latencia es el nuevo downtime en sistemas LLM",
      excerpt: "Analizamos cómo 200ms extra pueden destruir la confianza del usuario en interfaces conversacionales.",
      author: "Equipo Drako",
      date: "Oct 2025",
      readTime: "8 min lectura",
      gradient: "from-orange-400 to-pink-500"
    },
    {
      id: 2,
      category: "Producto",
      title: "El fin del dashboard estático",
      excerpt: "Nadie quiere ver gráficos. Quieren respuestas. Así diseñamos interfaces orientadas a la acción.",
      author: "Diseño",
      date: "Sep 2025",
      readTime: "5 min lectura",
      gradient: "from-blue-400 to-indigo-500"
    },
    {
      id: 3,
      category: "Cultura",
      title: "Pragmatismo Radical: Nuestro sistema operativo cultural",
      excerpt: "Cómo evitamos el 'teatro de la innovación' y nos centramos en lo que realmente mueve la aguja.",
      author: "Founders",
      date: "Ago 2025",
      readTime: "6 min lectura",
      gradient: "from-emerald-400 to-teal-500"
    }
  ];

  return (
    <SiteLayout locale={locale} currentPath="/journal" copy={{ nav: copy.nav, footerLine }}>
      <div>
        
        {/* EDITORIAL HEADER */}
        <section className="pt-32 pb-20 border-b border-slate-200 bg-white relative overflow-hidden">
          <div className="container-premium relative z-10">
             <div className="max-w-4xl fade-in-up">
                <span className="text-slate-400 font-mono text-sm tracking-widest uppercase mb-6 block">
                  Issue 01 — The Build
                </span>
                <h1 className="heading-xl text-slate-900 mb-8 tracking-tighter">
                  {copy.journal.title}
                </h1>
                <p className="text-xl md:text-2xl text-slate-500 max-w-2xl leading-relaxed text-balance font-light">
                  {copy.journal.intro}
                </p>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 skew-x-12 opacity-50 pointer-events-none" />
        </section>

        {/* FEATURED ARTICLES GRID */}
        <section className="section-spacing">
           <div className="container-premium">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                 
                 {/* Main Featured Article */}
                 <div className="lg:col-span-8 fade-in-up delay-100">
                    <Link href="#" className="group block h-full">
                       <div className="card-premium h-full p-0 overflow-hidden bg-slate-900 text-white border-none relative group-hover:shadow-2xl transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 z-0" />
                          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/30 transition-colors duration-500" />
                          
                          <div className="relative z-10 p-8 md:p-16 flex flex-col h-full justify-between min-h-[400px]">
                             <div className="flex justify-between items-start">
                                <span className="inline-block py-1 px-3 rounded-full bg-white/10 text-indigo-300 text-xs font-bold tracking-widest uppercase backdrop-blur-sm">
                                  Destacado
                                </span>
                                <span className="text-slate-400 font-mono text-sm">Oct 12, 2025</span>
                             </div>
                             
                             <div className="max-w-2xl">
                                <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight group-hover:text-indigo-200 transition-colors">
                                   La Inteligencia Artificial no es mágica, es infraestructura.
                                </h2>
                                <p className="text-lg text-slate-400 leading-relaxed mb-8 line-clamp-3">
                                   Por qué debemos dejar de tratar a los LLMs como oráculos y empezar a integrarlos como tuberías de datos fiables en nuestros sistemas de producción.
                                </p>
                                <div className="flex items-center gap-3 text-sm font-medium text-white">
                                   <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">D</div>
                                   <span>Equipo de Ingeniería</span>
                                </div>
                             </div>
                          </div>
                       </div>
                    </Link>
                 </div>

                 {/* Sidebar / Top Picks */}
                 <div className="lg:col-span-4 space-y-8 fade-in-up delay-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Más leídos</h3>
                    </div>
                    
                    {featuredArticles.map((article, i) => (
                       <Link key={article.id} href="#" className="group block">
                          <article className="py-4 group-hover:bg-white group-hover:p-4 group-hover:rounded-2xl group-hover:shadow-lg transition-all duration-300 -mx-4">
                             <span className={`text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r ${article.gradient} mb-2 block`}>
                                {article.category}
                             </span>
                             <h4 className="text-xl font-bold text-slate-900 mb-2 leading-tight group-hover:text-sky-600 transition-colors">
                                {article.title}
                             </h4>
                             <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                                {article.excerpt}
                             </p>
                             <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <span>{article.readTime}</span>
                                <span>•</span>
                                <span>{article.date}</span>
                             </div>
                          </article>
                       </Link>
                    ))}
                 </div>

              </div>
           </div>
        </section>

        {/* NEWSLETTER */}
        <section className="py-24 bg-white border-t border-slate-200">
           <div className="container-premium">
              <div className="bg-[var(--background-alt)] rounded-3xl p-8 md:p-16 text-center max-w-4xl mx-auto border border-slate-200">
                 <h2 className="heading-lg text-slate-900 mb-6">No te pierdas el próximo issue.</h2>
                 <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto">
                    Recibe nuestros análisis técnicos y actualizaciones de producto directamente en tu bandeja de entrada. Sin spam, solo señal.
                 </p>
                 <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                    <input 
                       type="email" 
                       placeholder="tu@email.com" 
                       className="flex-1 bg-white border border-slate-200 rounded-full px-6 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                    <button type="submit" className="btn-premium btn-primary px-8">
                       Suscribirse
                    </button>
                 </form>
              </div>
           </div>
        </section>

      </div>
    </SiteLayout>
  );
}
