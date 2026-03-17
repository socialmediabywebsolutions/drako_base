import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { products as canonicalProducts } from "@/lib/marketing/products";

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

  const matchedPath = headersList.get("x-matched-path") || headersList.get("x-invoke-path") || headersList.get("next-url") || "/";
  const pathParts = matchedPath.split("/");
  const localeFromPath = resolveMarketingLocale(resolvedParams?.locale ?? (pathParts[1] || undefined));
  const locale = localeFromPath;
  const copy = getMarketingCopy(locale);
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  const currentPath = "/";

  const liveProducts = canonicalProducts.filter((p) => p.status === "live");
  const buildingProducts = canonicalProducts.filter((p) => p.status === "building");
  const researchProducts = canonicalProducts.filter((p) => p.status === "research");

  const highlightedLive = liveProducts.filter((p) => p.highlighted);

  const ecosystemBlocks = copy.products.sections.map((section) => {
    if (section.title.toLowerCase().startsWith("activo") || section.title.toLowerCase().startsWith("active")) {
      const items = highlightedLive.length > 0 ? highlightedLive : liveProducts;
      return { ...section, items };
    }
    if (section.title.toLowerCase().startsWith("building")) {
      return { ...section, items: buildingProducts };
    }
    if (section.title.toLowerCase().startsWith("research")) {
      return { ...section, items: researchProducts };
    }
    return { ...section, items: [] as typeof canonicalProducts };
  });

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
        <section className="space-y-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{copy.nav.home}</p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{copy.home.heroTitle}</h1>
            <p className="text-lg text-slate-600">{copy.home.heroSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            {copy.home.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-800">
            <a href={`${prefix}/products`} className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300">
              {copy.home.ctas.products}
            </a>
            <a href={`${prefix}/system`} className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300">
              {copy.home.ctas.system}
            </a>
            <a href={`${prefix}/vision`} className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300">
              {copy.home.ctas.vision}
            </a>
            <a href={`${prefix}/journal`} className="rounded-full border border-slate-200 px-3 py-2 hover:border-slate-300">
              {copy.home.ctas.journal}
            </a>
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">01</p>
            <h2 className="text-2xl font-semibold text-slate-900">{copy.home.whatIs.title}</h2>
            <p className="text-slate-600">{copy.home.whatIs.body}</p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">02</p>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.home.products.title}</h2>
              <p className="text-slate-600">{copy.home.products.subtitle}</p>
            </div>
          </div>

          <div className="space-y-4">
            {ecosystemBlocks.map((section) => (
              <div key={section.title} className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{section.title}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{section.description}</h3>
                  </div>
                </div>
                {section.body ? <p className="text-sm text-slate-600">{section.body}</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {section.items.length > 0 ? (
                    section.items.map((item) => (
                      <div key={item.slug} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.shortDescription}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-500">
                      {section.empty}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">03</p>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.home.system.title}</h2>
            </div>
            <a href={`${prefix}/system`} className="text-sm font-medium text-slate-800 underline decoration-slate-300 decoration-2 underline-offset-4">
              {copy.nav.system}
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.home.system.points.map((point) => (
              <div key={point} className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">04</p>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.home.journal.title}</h2>
            </div>
            <a href={`${prefix}/journal`} className="text-sm font-medium text-slate-800 underline decoration-slate-300 decoration-2 underline-offset-4">
              {copy.nav.journal}
            </a>
          </div>
          <p className="text-slate-600">{copy.home.journal.summary}</p>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">05</p>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.home.vision.title}</h2>
            </div>
            <a href={`${prefix}/vision`} className="text-sm font-medium text-slate-800 underline decoration-slate-300 decoration-2 underline-offset-4">
              {copy.nav.vision}
            </a>
          </div>
          <p className="text-slate-600">{copy.home.vision.body}</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white/70 p-8 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">06</p>
              <h2 className="text-2xl font-semibold text-slate-900">{copy.home.closing.title}</h2>
              <p className="text-slate-600">{copy.home.closing.body}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-800">
            <a href={`${prefix}/products`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:border-slate-300">{copy.home.closing.ctas.products}</a>
            <a href={`${prefix}/system`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:border-slate-300">{copy.home.closing.ctas.system}</a>
            <a href={`${prefix}/journal`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:border-slate-300">{copy.home.closing.ctas.journal}</a>
            <a href={`${prefix}/vision`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:border-slate-300">{copy.home.closing.ctas.vision}</a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
