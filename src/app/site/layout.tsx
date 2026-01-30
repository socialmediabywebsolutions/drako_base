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
      <div className="flex min-h-screen flex-col bg-[#020617] text-slate-200 relative overflow-hidden">
        {/* Global Elite Overlay */}
        <div className="cyber-scanline" />
        <div className="absolute inset-0 carbon-grid pointer-events-none opacity-20" />

        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/40 backdrop-blur-3xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-10 py-6">
            <Link href="/site" className="flex items-center gap-6 group">
              <div className="relative">
                <div className="h-12 w-12 rounded-xl bg-brand/10 border-2 border-brand/50 shadow-[0_0_20px_var(--brand-glow)] group-hover:scale-110 transition-all flex items-center justify-center text-xl">
                  🐲
                </div>
                <div className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-brand border-2 border-[#020617]"></span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-[0.5em] uppercase italic text-white leading-none">DRĀKO.SYSTEMS</span>
                <span className="text-[8px] font-black text-brand uppercase tracking-[0.3em] mt-1 opacity-60">Elite Project Foundry</span>
              </div>
            </Link>

            <nav className="flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.3em]">
              <Link href="/site/panel" className="text-slate-400 hover:text-brand transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-800 group-hover/nav:bg-brand transition-colors" />
                Módulos de Élite
              </Link>
              <Link href="/site/marketplace" className="text-slate-400 hover:text-brand transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-800 group-hover/nav:bg-brand transition-colors" />
                Marketplace
              </Link>
              <Link href="/site/support" className="text-slate-400 hover:text-brand transition-colors flex items-center gap-2 group/nav">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-800 group-hover/nav:bg-brand transition-colors" />
                Protocolos Activos
              </Link>
              <Link
                href="/site"
                className="ml-4 inline-flex items-center rounded-xl bg-white px-8 py-3 text-[10px] font-black uppercase tracking-[0.4em] text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all hover:bg-brand hover:shadow-[0_0_30px_var(--brand-glow)] hover:scale-105 active:scale-95 italic"
              >
                Comenzar
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 relative z-10">
          {children}
        </main>

        <footer className="border-t border-white/5 bg-slate-950/80 py-20 text-center backdrop-blur-3xl relative z-10">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex justify-center mb-10">
              <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs opacity-40">
                DRKO
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-500 italic">
              DRĀKO SYSTEMS B 2026 • THE NEW STANDARD OF SAAS MATERIALIZATION
            </p>
            <div className="mt-4 text-[8px] text-slate-700 font-bold uppercase tracking-widest">
              Secure Channel Encrypted • End-to-End Materialization v3.0
            </div>
          </div>
        </footer>
      </div>
    </SiteProviders>
  );
}

