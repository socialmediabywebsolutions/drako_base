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
      <div className="flex min-h-screen flex-col bg-[#020617] text-slate-200">
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-8 py-5">
            <Link href="/site" className="flex items-center gap-4 text-xs font-black tracking-[0.3em] uppercase italic text-white group">
              <span className="h-8 w-8 rounded-xl bg-brand shadow-[0_0_15px_var(--brand-glow)] group-hover:scale-110 transition-transform" />
              DRĀKO.SYSTEMS
            </Link>
            <nav className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em]">
              <Link href="/site/panel" className="text-slate-400 hover:text-brand transition-colors">
                Módulos de Élite
              </Link>
              <Link href="/site/support" className="text-slate-400 hover:text-brand transition-colors">
                Protocolos Activos
              </Link>
              <Link
                href="/site"
                className="ml-4 inline-flex items-center rounded-xl bg-brand px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-950 shadow-[0_0_20px_var(--brand-glow)] transition hover:scale-105 active:scale-95"
              >
                Comenzar
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-white/5 bg-slate-950/50 py-16 text-center backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-center mb-8 opacity-20 grayscale">
              <span className="h-6 w-6 rounded bg-white" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">
              DRĀKO SYSTEMS B 2026 • THE NEW STANDARD OF SAAS MATERIALIZATION
            </p>
          </div>
        </footer>
      </div>
    </SiteProviders>
  );
}

