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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={locale === defaultMarketingLocale ? "/" : `/${locale}`} className="text-lg font-semibold tracking-tight">
            Drako Systems
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 sm:flex">
            {navLinks(copy.nav, locale).map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Link
              href={switchHref}
              className="rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-100"
            >
              {copy.nav.localeSwitch}
            </Link>
            <Link
              href={locale === defaultMarketingLocale ? "/contact" : `/${locale}/contact`}
              className="hidden rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 sm:inline-flex"
            >
              {copy.nav.contact}
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium text-slate-800">Drako Systems</span>
          <span className="text-slate-500">{copy.footerLine}</span>
        </div>
      </footer>
    </div>
  );
}
