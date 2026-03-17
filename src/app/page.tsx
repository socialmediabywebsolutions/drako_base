import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { getMarketingCopy, resolveMarketingLocale, defaultMarketingLocale } from "@/lib/i18n/marketing";
import { products as canonicalProducts } from "@/lib/marketing/products";
import { HeroModule, LogList, OpsPanel, ProductList, StateBlock } from "@/components/ui/ops-primitives";

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

  const productItems = [
    ...liveProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "RUNNING" as const })),
    ...buildingProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "BUILD" as const })),
    ...researchProducts.map((p) => ({ name: p.name, desc: p.shortDescription ?? "", state: "RESEARCH" as const })),
  ];

  const stateCount = {
    RUNNING: productItems.filter((p) => p.state === "RUNNING").length,
    BUILD: productItems.filter((p) => p.state === "BUILD").length,
    RESEARCH: productItems.filter((p) => p.state === "RESEARCH").length,
  };

  const opEvents = [
    "[12:03:21] deploy completed — socialflow@v1.8.2",
    "[12:02:10] health check OK — api-social",
    "[12:01:44] remediation executed — agent/reliability",
    "[11:58:22] job finished — backfill analytics",
    "[11:57:03] billing sync OK — workspace-core",
  ];

  const journalEvents = [
    "[11:55:10] journal → publicado: telemetry pipeline hardening",
    "[10:21:44] research → observability baseline updated",
    "[09:48:02] ops → postmortem cerrado: incident-324",
  ];

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-5">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <HeroModule
              title="Infraestructura en operación"
              subtitle="Operando en producción"
              tags={["Holding operativo", "Control Plane", "Observability", "Governance", "Agentes"]}
              ctaHref={`${prefix}/system`}
            />

            <OpsPanel variant="elevated" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Productos</span>
              </header>
              <ProductList items={productItems} />
            </OpsPanel>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Sistema</span>
              </header>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["Identidad", "RBAC activo"],
                  ["Billing", "Cobro y límites"],
                  ["Observabilidad", "Tracing + logs"],
                  ["Agentes", "Orquestación"],
                  ["CI/CD", "Deploy automatizado"],
                  ["Gobernanza", "Policies enforced"],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded border border-[#1D2433] bg-[#0F1116] px-2 py-2 text-sm text-slate-100 hover:border-[#2A3448]">
                    <div className="font-semibold">{title}</div>
                    <div className="text-xs text-slate-400">{desc}</div>
                  </div>
                ))}
              </div>
            </OpsPanel>

            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Operación</span>
              </header>
              <LogList lines={opEvents} />
            </OpsPanel>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <OpsPanel variant="base" className="p-3 sm:p-4 flex items-center gap-3 text-sm">
              {[{ state: "RUNNING" as const, count: stateCount.RUNNING }, { state: "BUILD" as const, count: stateCount.BUILD }, { state: "RESEARCH" as const, count: stateCount.RESEARCH }].map((s) => (
                <StateBlock key={s.state} state={s.state} count={s.count} />
              ))}
            </OpsPanel>

            <OpsPanel variant="base" className="p-3 sm:p-4">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Registro</span>
              </header>
              <LogList lines={journalEvents} />
            </OpsPanel>

            <OpsPanel variant="flat" className="p-3 sm:p-4">
              <div className="text-sm text-slate-400 uppercase tracking-[0.2em]">Visión</div>
              <div className="mt-2 text-lg font-semibold text-slate-100 leading-tight">
                SaaS que se operan solos. Gobernanza y agentes por defecto.
              </div>
              <a href={`${prefix}/vision`} className="mt-2 inline-flex text-xs font-semibold text-slate-300 hover:text-emerald-100 underline">
                Ver tesis →
              </a>
            </OpsPanel>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
