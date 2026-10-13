import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-[#0d1322] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        <div className="lg:col-span-6 bg-gradient-to-br from-[#0a0f1d] via-[#10172a] to-[#181132] p-8 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-indigo-400">SocialCors</h2>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              SocialCors analiza, crea, publica y aprende por ti.
            </h1>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <p>• <strong>Analiza:</strong> Tus fotos, marca y audiencia.</p>
            <p>• <strong>Crea:</strong> Textos y hashtags a tu estilo.</p>
            <p>• <strong>Publica:</strong> Directamente sin esfuerzo.</p>
          </div>
          <div className="text-xs text-slate-500">© 2026 SocialCors</div>
        </div>

        <div className="lg:col-span-6 p-6 md:p-12 flex items-center justify-center bg-[#0d1322]/50">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

      </div>
    </div>
  );
}
