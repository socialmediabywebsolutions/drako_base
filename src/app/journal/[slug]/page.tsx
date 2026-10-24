import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale } from "@/lib/i18n/marketing";
import { getPublishedJournalArticleBySlug } from "@/lib/drako/journal-repository";

export const dynamic = "force-dynamic";

const SITE_URL = "https://drako.systems";

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

async function loadArticle(slug: string) {
  try {
    return await getPublishedJournalArticleBySlug(slug);
  } catch (error) {
    console.error("JOURNAL_ARTICLE_LOAD_ERROR", { slug, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) return { title: "Artículo no encontrado — Drako Journal" };

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const url = `${SITE_URL}/journal/${article.slug}`;
  return {
    title: `${title} — Drako Journal`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      publishedTime: article.publishedAt,
      tags: article.tags,
      images: article.coverImageUrl ? [{ url: article.coverImageUrl, width: 1344, height: 768 }] : undefined,
    },
    twitter: {
      card: article.coverImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    },
  };
}

export default async function JournalArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) notFound();

  const copy = getMarketingCopy(resolveMarketingLocale(undefined));
  const footerLine = copy.about.content[0];

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    datePublished: article.publishedAt,
    keywords: article.tags.join(", "),
    articleSection: article.category,
    mainEntityOfPage: `${SITE_URL}/journal/${article.slug}`,
    author: { "@type": "Organization", name: "Drako Systems", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Drako Systems", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-drako.png` } },
  };

  return (
    <SiteLayout locale="es" currentPath="/journal" copy={{ nav: copy.nav, footerLine }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />

      <article className="bg-white">
        <header className="bg-gradient-to-b from-slate-50 to-blue-50 border-b border-gray-200 pt-20 pb-16">
          <div className="container-premium max-w-3xl">
            <Link href="/journal" className="text-sm font-semibold text-blue-600 hover:text-cyan-600 transition-colors">
              ← Volver al Journal
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 font-bold uppercase tracking-widest text-blue-600">
                {article.category}
              </span>
              <span className="font-mono text-slate-500">{formatDate(article.publishedAt)}</span>
              <span className="font-mono text-slate-400">· {article.readingTime} min de lectura</span>
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight text-slate-900 text-balance">{article.title}</h1>
            <p className="mt-6 text-xl text-slate-600 leading-relaxed">{article.excerpt}</p>
          </div>
        </header>

        {article.coverImageUrl ? (
          <div className="container-premium max-w-4xl -mt-2 pt-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImageUrl}
              alt=""
              width={1344}
              height={768}
              className="w-full rounded-3xl border border-gray-200 shadow-sm object-cover aspect-[16/9]"
            />
          </div>
        ) : null}

        <div className="container-premium max-w-3xl py-16">
          <div
            className="journal-content text-lg leading-relaxed text-slate-700 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-slate-900 [&_p]:mb-6 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:text-slate-900 [&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-500 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_a]:text-blue-600 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {article.tags.length ? (
            <div className="mt-12 flex flex-wrap gap-2 border-t border-gray-200 pt-8">
              {article.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">#{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </SiteLayout>
  );
}
