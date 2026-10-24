import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { listPublishedJournalArticles, type JournalArticle } from "@/lib/drako/journal-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

async function loadArticles(page: number): Promise<{ articles: JournalArticle[]; page: number; totalPages: number }> {
  try {
    return await listPublishedJournalArticles(page);
  } catch (error) {
    console.error("JOURNAL_PAGE_LOAD_ERROR", error instanceof Error ? error.message : String(error));
    return { articles: [], page: 1, totalPages: 1 };
  }
}

export default async function JournalPage({
  params,
  searchParams,
}: {
  params?: Promise<{ locale?: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const resolvedParams = params ? await params : undefined;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);

  const footerLine = copy.about.content[0];

  const { articles, page, totalPages } = await loadArticles(Number(resolvedSearch?.page ?? "1"));

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

        {/* ARTICLES GRID */}
        <section className="section-spacing bg-slate-50">
           <div className="container-premium">
              {articles.length === 0 ? (
                 <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">Pronto, el primer reportaje.</h2>
                    <p className="text-slate-600">El Journal de Drako publica análisis nuevos cada día laborable.</p>
                 </div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {articles.map((article) => (
                       <Link key={article.id} href={`/journal/${article.slug}`} className="card-premium group flex flex-col p-0">
                          {article.coverImageUrl ? (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img src={article.coverImageUrl} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                          ) : (
                             <div className="aspect-[16/9] w-full bg-gradient-to-br from-blue-100 via-slate-50 to-cyan-100" />
                          )}
                          <div className="flex flex-1 flex-col p-6">
                             <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">{article.category}</span>
                             <h2 className="text-xl font-bold text-slate-900 leading-snug mb-3 group-hover:text-blue-600 transition-colors">
                                {article.title}
                             </h2>
                             <p className="text-sm text-slate-600 mb-6 line-clamp-3">{article.excerpt}</p>
                             <div className="mt-auto flex items-center gap-2 text-xs text-slate-400 font-mono">
                                <span>{formatDate(article.publishedAt)}</span>
                                <span>•</span>
                                <span>{article.readingTime} min lectura</span>
                             </div>
                          </div>
                       </Link>
                    ))}
                 </div>
              )}

              {totalPages > 1 ? (
                 <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Paginación del Journal">
                    {page > 1 ? (
                       <Link href={`/journal?page=${page - 1}`} className="btn-premium btn-secondary py-2 px-5 text-sm">← Anteriores</Link>
                    ) : null}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                       <Link
                          key={n}
                          href={`/journal?page=${n}`}
                          aria-current={n === page ? "page" : undefined}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                             n === page ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white" : "bg-white border border-gray-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                          }`}
                       >
                          {n}
                       </Link>
                    ))}
                    {page < totalPages ? (
                       <Link href={`/journal?page=${page + 1}`} className="btn-premium btn-secondary py-2 px-5 text-sm">Siguientes →</Link>
                    ) : null}
                 </nav>
              ) : null}
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
                       className="flex-1 bg-white border border-slate-200 rounded-full px-6 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
