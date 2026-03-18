import Link from "next/link";
import type { ReactNode } from "react";
import { defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

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

const navLinks = (copy: Props["copy"]["nav"], locale: MarketingLocale) => {
  const prefix = locale === defaultMarketingLocale ? "" : `/${locale}`;
  return [
    { href: copy.home ? `/${locale}` : "/", label: copy.home ?? "Inicio" },
    { href: `${prefix}/system`, label: copy.system ?? "Cómo trabajamos" },
    { href: `${prefix}/products`, label: copy.products ?? "Productos" },
    { href: `${prefix}/journal`, label: copy.journal ?? "Journal" },
    { href: `${prefix}/vision`, label: copy.vision ?? "Visión" },
    { href: `${prefix}/about`, label: copy.about ?? "Sobre Drako" },
    { href: `${prefix}/contact`, label: copy.contact ?? "Contacto" },
  ];
};

export function SiteLayout({ children, locale, currentPath, copy }: Props) {
  const nextLocale: MarketingLocale = locale === "es" ? "en" : "es";
  const normalizedPath = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const basePath = normalizedPath === "" ? "/" : normalizedPath;
  const switchHref =
    locale === defaultMarketingLocale
      ? `/${nextLocale}${basePath === "/" ? "" : basePath}`
      : basePath;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] font-sans">
      <header className="fixed top-0 w-full z-50 border-b border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-md transition-all duration-300">
        <div className="container-premium flex items-center justify-between h-16 md:h-20">
          <Link href={locale === defaultMarketingLocale ? "/" : `/${locale}`} className="text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--brand-strong)] transition-colors">
            Drako Systems
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {navLinks(copy.nav, locale).map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                className="hover:text-[var(--brand-strong)] transition-colors relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--brand)] transition-all group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <Link
              href={switchHref}
              className="text-slate-500 hover:text-[var(--brand-strong)] font-semibold transition-colors"
            >
              {copy.nav.localeSwitch}
            </Link>
            <Link
              href={locale === defaultMarketingLocale ? "/contact" : `/${locale}/contact`}
              className="hidden sm:inline-flex btn-premium btn-primary py-2 px-5 text-sm"
            >
              {copy.nav.contact}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="border-t border-[var(--border)] bg-[var(--panel)] mt-auto">
        <div className="container-premium py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-lg font-bold text-[var(--foreground)]">Drako Systems</span>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                {copy.footerLine}
              </p>
            </div>
            <div className="flex gap-6 text-sm text-slate-500">
              <span>&copy; {new Date().getFullYear()} Drako Systems</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
