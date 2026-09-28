import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import Link from "next/link";
import { listRevistaArticles } from "@/lib/revista/repository";
import { listHoldingSocialFeed } from "@/lib/revista/repository";
import type { RevistaArticle, HoldingSocialPost } from "@/lib/revista/repository";

const CATEGORY_GRADIENTS: Record<string, string> = {
  producto: "from-blue-500 to-indigo-500",
  campana: "from-pink-500 to-rose-500",
  logro: "from-emerald-500 to-teal-500",
  ia: "from-purple-500 to-violet-500",
  general: "from-slate-500 to-slate-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  producto: "Producto",
  campana: "Campaña",
  logro: "Logro",
  ia: "IA",
  general: "General",
};

const PROVIDER_ICONS: Record<string, string> = {
  instagram: "📸",
  twitter: "🐦",
  linkedin: "💼",
  facebook: "📘",
  tiktok: "🎵",
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPostedAt(postedAt: string | null): string {
  if (!postedAt) return "";
  const d = new Date(postedAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const PLACEHOLDER_ARTICLES: RevistaArticle[] = [
  {
    id: "placeholder-1",
    slug: "#",
    title: "Artículo generando...",
    excerpt: "Drako IA está analizando la actividad reciente de nuestros productos para generar el primer artículo editorial.",
    body: "",
    saasId: null,
    category: "ia",
    coverImageUrl: null,
    authorName: "Drako IA",
    publishedAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    status: "published",
    sourcePostIds: [],
  },
  {
    id: "placeholder-2",
    slug: "#",
    title: "Artículo generando...",
    excerpt: "El agente editorial está procesando los últimos posts publicados en las redes sociales del ecosistema.",
    body: "",
    saasId: null,
    category: "producto",
    coverImageUrl: null,
    authorName: "Drako IA",
    publishedAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    status: "published",
    sourcePostIds: [],
  },
  {
    id: "placeholder-3",
    slug: "#",
    title: "Artículo generando...",
    excerpt: "La próxima edición de Revista Drako estará disponible cuando se ejecute el agente de generación automática.",
    body: "",
    saasId: null,
    category: "general",
    coverImageUrl: null,
    authorName: "Drako IA",
    publishedAt: Math.floor(Date.now() / 1000),
    createdAt: Math.floor(Date.now() / 1000),
    status: "published",
    sourcePostIds: [],
  },
];

export default async function JournalPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  const footerLine = copy.about.content[0];

  let articles: RevistaArticle[] = [];
  let socialFeed: HoldingSocialPost[] = [];

  try {
    articles = await listRevistaArticles({ limit: 12 });
  } catch {
    // DB not available yet — use placeholders
  }

  try {
    socialFeed = await listHoldingSocialFeed({ limit: 10 });
  } catch {
    // DB not available yet — show empty feed
  }

  const displayArticles = articles.length > 0 ? articles : PLACEHOLDER_ARTICLES;
  const isPlaceholder = articles.length === 0;
  const [featuredArticle, ...restArticles] = displayArticles;

  return (
    <SiteLayout locale={locale} currentPath="/journal" copy={{ nav: copy.nav, footerLine }}>
      <div>

        {/* HEADER */}
        <section className="pt-32 pb-20 border-b border-slate-200 bg-white relative overflow-hidden">
          <div className="container-premium relative z-10">
            <div className="max-w-4xl fade-in-up">
              <span className="text-slate-400 font-mono text-sm tracking-widest uppercase mb-6 block">
                Revista Drako — Edición Digital
              </span>
              <h1 className="heading-xl text-slate-900 mb-8 tracking-tighter">
                Todo lo que está pasando<br />en el ecosistema de IA
              </h1>
              <p className="text-xl md:text-2xl text-slate-500 max-w-2xl leading-relaxed text-balance font-light">
                Artículos editoriales generados por IA sobre la actividad real de los productos Drako Systems.
              </p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 skew-x-12 opacity-50 pointer-events-none" />
        </section>

        {/* MAIN CONTENT */}
        <section className="section-spacing">
          <div className="container-premium">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

              {/* LEFT: Articles */}
              <div className="lg:col-span-8">

                {/* Featured Article */}
                {featuredArticle && (
                  <div className="mb-12 fade-in-up delay-100">
                    <Link href={isPlaceholder ? "#" : `/journal/${featuredArticle.slug}`} className="group block">
                      <div className="rounded-3xl overflow-hidden bg-slate-900 text-white relative shadow-xl group-hover:shadow-2xl transition-all duration-500 min-h-[400px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 z-0" />
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/30 transition-colors duration-500" />
                        <div className="relative z-10 p-8 md:p-16 flex flex-col justify-between h-full">
                          <div className="flex justify-between items-start mb-8">
                            <span className={`inline-block py-1 px-3 rounded-full bg-gradient-to-r ${CATEGORY_GRADIENTS[featuredArticle.category] ?? CATEGORY_GRADIENTS.general} text-white text-xs font-bold tracking-widest uppercase`}>
                              {CATEGORY_LABELS[featuredArticle.category] ?? featuredArticle.category}
                            </span>
                            <span className="text-slate-400 font-mono text-sm">{formatDate(featuredArticle.publishedAt)}</span>
                          </div>
                          <div className="max-w-2xl">
                            <h2 className={`text-3xl md:text-4xl font-bold mb-6 leading-tight group-hover:text-indigo-200 transition-colors ${isPlaceholder ? "animate-pulse" : ""}`}>
                              {featuredArticle.title}
                            </h2>
                            <p className="text-lg text-slate-400 leading-relaxed mb-8 line-clamp-3">
                              {featuredArticle.excerpt}
                            </p>
                            <div className="flex items-center gap-3 text-sm font-medium text-white">
                              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">D</div>
                              <span>{featuredArticle.authorName}</span>
                              {featuredArticle.saasId && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-indigo-300 text-xs">{featuredArticle.saasId}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                )}

                {/* Article Grid */}
                {restArticles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 fade-in-up delay-200">
                    {restArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={isPlaceholder ? "#" : `/journal/${article.slug}`}
                        className="group block"
                      >
                        <article className="h-full rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white">
                          {/* Cover placeholder */}
                          <div className={`h-36 bg-gradient-to-br ${CATEGORY_GRADIENTS[article.category] ?? CATEGORY_GRADIENTS.general} opacity-80`} />
                          <div className="p-6">
                            <span className={`text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r ${CATEGORY_GRADIENTS[article.category] ?? CATEGORY_GRADIENTS.general} mb-2 block uppercase tracking-widest`}>
                              {CATEGORY_LABELS[article.category] ?? article.category}
                            </span>
                            <h3 className={`text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-sky-600 transition-colors ${isPlaceholder ? "animate-pulse" : ""}`}>
                              {article.title}
                            </h3>
                            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                              {article.excerpt}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                              <span>{article.authorName}</span>
                              <span>•</span>
                              <span>{formatDate(article.publishedAt)}</span>
                              {article.saasId && (
                                <>
                                  <span>•</span>
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{article.saasId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                )}

                {isPlaceholder && (
                  <p className="text-center text-slate-400 text-sm mt-8">
                    Los artículos se generan automáticamente cada día a las 8:00 UTC mediante Drako IA.
                  </p>
                )}
              </div>

              {/* RIGHT: Live Feed */}
              <div className="lg:col-span-4 fade-in-up delay-300">
                <div className="sticky top-24">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-4 mb-6">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">Feed en vivo</h3>
                  </div>

                  {socialFeed.length > 0 ? (
                    <div className="space-y-4">
                      {socialFeed.map((post) => (
                        <div key={post.id} className="p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{PROVIDER_ICONS[post.provider] ?? "📣"}</span>
                            <span className="text-xs font-semibold text-slate-700">{post.saasName}</span>
                            <span className="ml-auto text-xs text-slate-400 font-mono">{formatPostedAt(post.postedAt)}</span>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                            {post.body}
                          </p>
                          <span className="mt-2 inline-block text-xs text-slate-400 uppercase tracking-wide">{post.provider}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50 animate-pulse">
                          <div className="h-3 bg-slate-200 rounded w-1/2 mb-3" />
                          <div className="h-2 bg-slate-200 rounded w-full mb-2" />
                          <div className="h-2 bg-slate-200 rounded w-4/5" />
                        </div>
                      ))}
                      <p className="text-xs text-slate-400 text-center">
                        El feed se actualiza con los últimos posts publicados en redes sociales del ecosistema.
                      </p>
                    </div>
                  )}
                </div>
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
                Recibe nuestros análisis y actualizaciones del ecosistema Drako directamente en tu bandeja de entrada.
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
