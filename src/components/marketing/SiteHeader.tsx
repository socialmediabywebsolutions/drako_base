"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { defaultMarketingLocale, type MarketingLocale } from "@/lib/i18n/marketing";

type Props = {
  locale: MarketingLocale;
  copy: {
    home: string;
    system: string;
    products: string;
    journal: string;
    vision: string;
    about: string;
    contact: string;
    localeSwitch: string;
  };
};

const navLinks = (copy: Props["copy"], locale: MarketingLocale) => {
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

export function SiteHeader({ locale, copy }: Props) {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const nextLocale: MarketingLocale = locale === "es" ? "en" : "es";
  // Simple switch logic for demo - in production use proper path replacement
  const switchHref = pathname.startsWith("/en") ? pathname.replace("/en", "") || "/" : `/en${pathname}`;

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-500 border-b ${
        isScrolled 
          ? "bg-[var(--panel)]/90 backdrop-blur-md border-[var(--border)] py-3 shadow-sm" 
          : "bg-transparent border-transparent py-5"
      }`}
    >
      <div className="container-premium flex items-center justify-between">
        <Link 
          href={locale === defaultMarketingLocale ? "/" : `/${locale}`} 
          className="relative z-10 group"
        >
          <span className="text-xl font-bold tracking-tight transition-colors duration-300 text-[var(--foreground)]">
            Drako Systems
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navLinks(copy, locale).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`relative transition-colors duration-300 hover:text-[var(--brand-strong)] ${
                  isActive ? "text-[var(--brand-strong)]" : "text-slate-600"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--brand)] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href={switchHref}
            className="text-slate-500 hover:text-[var(--brand-strong)] font-semibold transition-colors"
          >
            {copy.localeSwitch}
          </Link>
          <Link
            href={locale === defaultMarketingLocale ? "/contact" : `/${locale}/contact`}
            className={`hidden sm:inline-flex btn-premium btn-primary py-2 px-6 text-sm transition-all duration-300 ${
              isScrolled ? "shadow-md" : "shadow-none bg-slate-900"
            }`}
          >
            {copy.contact}
          </Link>
        </div>
      </div>
    </header>
  );
}
