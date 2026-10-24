import { AppProviders } from "@shared-ui-neutral/app-providers";
import { getLocalizedPath } from "@shared-neutral/marketing-locales";

export default function HomePage() {
  return (
    <AppProviders>
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            SocialFlow Runtime Canary
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Scaffold only. Runtime not activated.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            This app root exists to prepare a separate OpenNext runtime for SocialFlow without changing
            production traffic, active workers or preview activation state.
          </p>
          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            Future canonical entry example: <code>{getLocalizedPath("es", "/socialflow")}</code>
          </div>
        </div>
      </main>
    </AppProviders>
  );
}
