import type { Metadata } from "next";
import Link from "next/link";
import SiteProviders from "./SiteProviders";

export const metadata: Metadata = {
  title: "DRĀKO • Crea tu SaaS",
  description: "De Idea a Proyecto Llave en Mano con DRĀKO",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProviders>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/site" className="flex items-center gap-3 text-sm font-black tracking-[0.2em] uppercase text-slate-900">
              <span className="h-8 w-8 rounded-xl bg-cyan-400 shadow-[0_4px_12px_rgba(76,201,240,0.4)]" />
              DRĀKO.SYSTEMS
            </Link>
            <nav className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-slate-500">
              <Link href="/site/panel" className="hover:text-cyan-500 transition-colors">
                Marketplace
              </Link>
              <Link href="/site/support" className="hover:text-cyan-500 transition-colors">
                Casos de Éxito
              </Link>
              <Link
                href="/site"
                className="ml-2 inline-flex items-center rounded-full bg-slate-900 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-cyan-500"
              >
                Comenzar
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-12 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
            DRĀKO SYSTEMS © {new Date().getFullYear()} • THE NEW STANDARD OF SAAS
          </p>
        </footer>
      </div>
    </SiteProviders>
  );
}

