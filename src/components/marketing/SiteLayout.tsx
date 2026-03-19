import Link from "next/link";
import type { ReactNode } from "react";
import { defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";
import { SiteHeader } from "./SiteHeader";

type Props = {
  children: ReactNode;
  locale: MarketingLocale;
  currentPath: string;
  copy: {
    nav: {
      home: string;
      system: string;
      products: string;
      journal: string;
      vision: string;
      about: string;
      contact: string;
      localeSwitch: string;
    };
    footerLine: string;
  };
};

export function SiteLayout({ children, locale, currentPath, copy }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans antialiased selection:bg-sky-100 selection:text-sky-900">
      <SiteHeader locale={locale} copy={copy.nav} />

      <main className="flex-grow pt-24">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-white relative z-10">
        <div className="container-premium py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
             <div className="md:col-span-2 space-y-6">
                <Link href="/" className="text-2xl font-bold tracking-tight text-[var(--foreground)] block mb-4">
                  Drako Systems
                </Link>
                <p className="text-lg text-slate-500 max-w-md leading-relaxed text-balance">
                  {copy.footerLine}
                </p>
             </div>
             
             <div className="space-y-6">
                <h4 className="font-semibold text-slate-900">Explorar</h4>
                <ul className="space-y-4 text-slate-600">
                   <li><Link href="/products" className="hover:text-sky-600 transition-colors">{copy.nav.products}</Link></li>
                   <li><Link href="/system" className="hover:text-sky-600 transition-colors">{copy.nav.system}</Link></li>
                   <li><Link href="/journal" className="hover:text-sky-600 transition-colors">{copy.nav.journal}</Link></li>
                </ul>
             </div>

             <div className="space-y-6">
                <h4 className="font-semibold text-slate-900">Compañía</h4>
                <ul className="space-y-4 text-slate-600">
                   <li><Link href="/about" className="hover:text-sky-600 transition-colors">{copy.nav.about}</Link></li>
                   <li><Link href="/vision" className="hover:text-sky-600 transition-colors">{copy.nav.vision}</Link></li>
                   <li><Link href="/contact" className="hover:text-sky-600 transition-colors">{copy.nav.contact}</Link></li>
                </ul>
             </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} Drako Systems Inc. Todos los derechos reservados.</p>
            <div className="flex gap-6">
               <a href="#" className="hover:text-slate-600 transition-colors">Privacidad</a>
               <a href="#" className="hover:text-slate-600 transition-colors">Términos</a>
               <a href="#" className="hover:text-slate-600 transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
