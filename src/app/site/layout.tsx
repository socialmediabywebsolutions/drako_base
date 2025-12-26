import type { Metadata } from "next";
import Link from "next/link";
import SiteProviders from "./SiteProviders";

export const metadata: Metadata = {
  title: "DRĀKO • Crea tu SaaS",
  description: "Onboarding público para crear tu propio SaaS con DRĀKO",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProviders>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/site" className="flex items-center gap-3 text-sm font-semibold tracking-[0.3em] uppercase text-cyan-200">
              <span className="h-8 w-8 rounded-2xl bg-cyan-500/30" />
              DRĀKO.SYSTEMS
            </Link>
            <nav className="flex items-center gap-3 text-sm text-white/70">
              <Link href="/site/onboarding" className="hover:text-white">
                Onboarding
              </Link>
              <Link href="/site/panel" className="hover:text-white">
                Mi SaaS
              </Link>
              <Link href="/site/support" className="hover:text-white">
                Soporte
              </Link>
              <Link
                href="/site/onboarding/company"
                className="ml-2 inline-flex items-center rounded-full bg-[var(--brand,#4cc9f0)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-black shadow-[0_0_30px_rgba(76,201,240,0.35)] transition hover:-translate-y-0.5"
              >
                Comenzar
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-16">{children}</div>
        </main>
        <footer className="border-t border-white/5 bg-black/40 py-6 text-center text-xs text-white/50">DRĀKO SYSTEMS © {new Date().getFullYear()}</footer>
      </div>
    </SiteProviders>
  );
}
