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
      <div className="flex min-h-screen flex-col bg-white text-slate-900 relative overflow-hidden">
        {/* Global Subtle Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50/30 to-transparent pointer-events-none opacity-50" />

        <header className="sticky top-0 z-50 border-b border-sky-100 bg-white/90 backdrop-blur-xl shadow-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-10 py-6">
            <Link href="/site" className="flex items-center gap-6 group">
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-sky-100 border-2 border-sky-300 shadow-lg group-hover:scale-110 transition-all flex items-center justify-center text-xl">
                  🐲
                </div>
                <div className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500 border-2 border-white"></span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-[0.5em] uppercase italic text-slate-900 leading-none">DRĀKO.SYSTEMS</span>
                <span className="text-[8px] font-black text-sky-600 uppercase tracking-[0.3em] mt-1">Elite Project Foundry</span>
              </div>
            </Link>

            <nav className="flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.3em]">
              <Link href="/site/panel" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300 group-hover/nav:bg-sky-600 transition-colors" />
                Mi Panel
              </Link>
              <Link href="/site/marketplace" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300 group-hover/nav:bg-sky-600 transition-colors" />
                Plantillas
              </Link>
              <Link href="/site/support" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300 group-hover/nav:bg-sky-600 transition-colors" />
                Soporte
              </Link>
              <Link
                href="/site/panel"
                className="ml-4 inline-flex items-center rounded-xl bg-sky-500 px-8 py-3 text-[10px] font-black uppercase tracking-[0.4em] text-white shadow-lg shadow-sky-500/30 transition-all hover:bg-sky-600 hover:shadow-sky-600/40 hover:scale-105 active:scale-95 italic"
              >
                Comenzar
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 relative z-10">
          {children}
        </main>

        <footer className="border-t border-sky-100 bg-white py-20 text-center backdrop-blur-xl relative z-10 shadow-inner">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-center mb-10">
              <div className="h-10 w-10 rounded-lg bg-sky-100 border-2 border-sky-200 flex items-center justify-center text-xs text-sky-700 font-bold">
                DRKO
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 italic">
              DRĀKO SYSTEMS © 2026 • THE NEW STANDARD OF SAAS MATERIALIZATION
            </p>
            <div className="mt-4 text-[8px] text-slate-400 font-bold uppercase tracking-widest">
              Secure Channel Encrypted • End-to-End Materialization v3.0
            </div>
          </div>
        </footer>
      </div>
    </SiteProviders>
  );
}
