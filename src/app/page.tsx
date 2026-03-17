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

  const badgeClass = (state: "RUNNING" | "BUILD" | "RESEARCH") => {
    if (state === "RUNNING") return "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-300";
    if (state === "BUILD") return "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-amber-300";
    return "inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-sky-300";
  };

  const badgeDotClass = (state: "RUNNING" | "BUILD" | "RESEARCH") => {
    if (state === "RUNNING") return "h-2 w-2 rounded-full bg-emerald-400";
    if (state === "BUILD") return "h-2 w-2 rounded-full bg-amber-400";
    return "h-2 w-2 rounded-full bg-sky-400";
  };

  const stateBlockClass = (state: "RUNNING" | "BUILD" | "RESEARCH") => {
    if (state === "RUNNING") return "flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2";
    if (state === "BUILD") return "flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2";
    return "flex items-center gap-2 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2";
  };

  return (
    <SiteLayout locale={locale} currentPath={currentPath} copy={{ nav: copy.nav, footerLine: copy.about.intro }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-mono leading-tight">
        <main className="mx-auto grid max-w-6xl gap-3 p-4 sm:p-5">
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150 sm:p-5">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-300">
                  Running
                </span>
                <span className="text-slate-500">Operando en producción</span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Infraestructura en operación</h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
                    {["Holding operativo", "Control Plane", "Observability", "Governance", "Agentes"].map((tag) => (
                      <span key={tag} className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href={`${prefix}/system`}
                  className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-sm font-semibold text-slate-100 hover:border-slate-600 hover:bg-slate-850"
                >
                  Ver panel
                </a>
              </div>
            </div>

            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Productos</span>
                <span className="text-xs text-slate-500">servicios activos</span>
              </header>
              <div className="mt-2 divide-y divide-slate-800 text-sm">
                {productItems.length === 0 ? (
                  <div className="py-3 text-slate-400">Sin servicios públicos</div>
                ) : (
                  productItems.map((item) => (
                    <div key={`${item.state}-${item.name}`} className="flex items-center gap-3 py-1.5">
                      <span className={badgeClass(item.state)}>
                        <span className={badgeDotClass(item.state)} />
                        {item.state}
                      </span>
                      <div className="flex flex-1 items-baseline justify-between gap-2">
                        <span className="font-semibold text-slate-100">{item.name}</span>
                        <span className="text-slate-400 text-xs line-clamp-1">{item.desc}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Sistema</span>
                <span className="text-xs text-slate-500">módulos activos</span>
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
                  <div key={title} className="rounded border border-slate-800 bg-slate-900 px-2 py-2 text-sm text-slate-100 hover:border-slate-700">
                    <div className="font-semibold">{title}</div>
                    <div className="text-xs text-slate-400">{desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Operación</span>
                <span className="text-xs text-slate-500">eventos recientes</span>
              </header>
              <div className="mt-2 space-y-1 text-[12px] font-medium text-slate-200">
                {opEvents.map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1" />
                    <span className="text-slate-100">{line}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150 flex items-center gap-3 text-sm">
              {[{ label: "RUNNING", count: stateCount.RUNNING, state: "RUNNING" as const }, { label: "BUILD", count: stateCount.BUILD, state: "BUILD" as const }, { label: "RESEARCH", count: stateCount.RESEARCH, state: "RESEARCH" as const }].map((s) => (
                <div key={s.label} className={stateBlockClass(s.state)}>
                  <span className="text-xs font-semibold uppercase text-slate-50">{s.label}</span>
                  <span className="text-lg font-bold text-slate-50">{s.count}</span>
                </div>
              ))}
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150">
              <header className="flex items-center justify-between text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Registro</span>
                <span className="text-xs text-slate-500">log del sistema</span>
              </header>
              <div className="mt-2 space-y-1 text-[12px] text-slate-200 font-medium">
                {journalEvents.map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-600 mt-1" />
                    <span className="text-slate-100">{line}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 sm:p-4 shadow-none hover:border-slate-700 hover:bg-slate-900 transition-colors duration-150">
              <div className="text-sm text-slate-400 uppercase tracking-[0.2em]">Visión</div>
              <div className="mt-2 text-lg font-semibold text-slate-100 leading-tight">
                SaaS que se operan solos. Gobernanza y agentes por defecto.
              </div>
              <a href={`${prefix}/vision`} className="mt-2 inline-flex text-xs font-semibold text-slate-300 hover:text-slate-100 underline">
                Ver tesis →
              </a>
            </section>
          </section>
        </main>
      </div>
    </SiteLayout>
  );
}
