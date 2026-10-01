import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/marketing/SiteLayout";
import { EcosystemDashboard } from "@/components/marketing/EcosystemDashboard";
import { getMarketingCopy, resolveMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

const SITE_URL = "https://drako.systems";
const TITLE = "Ecosistema Drako en Tiempo Real — Drako Systems";
const DESCRIPTION =
  "Métricas públicas de cada SaaS del holding Drako: estado de desarrollo, seguidores y engagement en Instagram, Facebook y LinkedIn, actualizados cada día.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/ecosystem` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/ecosystem`, type: "website", siteName: "Drako Systems" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function EcosystemPage({ params }: { params?: Promise<{ locale?: string }> }) {
  const resolvedParams = params ? await params : undefined;
  const locale: MarketingLocale = resolveMarketingLocale(resolvedParams?.locale);
  const copy = getMarketingCopy(locale);
  const footerLine = copy.about.content[0];

  return (
    <SiteLayout locale={locale} currentPath="/ecosystem" copy={{ nav: copy.nav, footerLine }}>
      <div>
        {/* HERO */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-blue-50 pt-32 pb-20">
          <div className="container-premium relative z-10">
            <div className="max-w-3xl mx-auto text-center fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Transparencia radical
              </span>
              <h1 className="heading-xl text-slate-900 mb-6 text-balance">
                Ecosistema Drako <span className="drako-gradient-text">en Tiempo Real</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed text-balance">
                Un holding que construye en abierto. Aquí publicamos el estado de cada SaaS y la tracción de sus redes sociales,
                sincronizada cada día desde Meta y LinkedIn — sin capturas maquilladas ni cifras a medida.
              </p>
            </div>
          </div>
        </section>

        {/* DASHBOARD + MÉTRICAS GLOBALES */}
        <section className="py-20 bg-white">
          <div className="container-premium">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <span className="text-blue-600 font-bold tracking-widest uppercase text-xs mb-4 block">Métricas globales</span>
              <h2 className="heading-lg text-slate-900 text-balance">El ecosistema en cifras</h2>
            </div>
            <EcosystemDashboard showTotals />
          </div>
        </section>

        {/* CTA */}
        <section className="section-spacing bg-gradient-to-b from-slate-50 to-blue-50 border-t border-gray-200">
          <div className="container-premium text-center">
            <h2 className="heading-lg text-slate-900 mb-6 max-w-2xl mx-auto text-balance">¿Inversor o socio estratégico?</h2>
            <p className="text-xl text-slate-600 mb-10 max-w-xl mx-auto">
              Si quieres conocer los números completos del holding o participar en el próximo SaaS, hablemos.
            </p>
            <Link href="/contact" className="btn-premium btn-primary text-lg px-10 py-5">
              Contactar con Drako
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
