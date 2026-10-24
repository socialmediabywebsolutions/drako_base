import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">

        <div className="lg:col-span-6 bg-gradient-to-br from-[#3b82f6]/5 via-white to-[#06b6d4]/5 p-8 md:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#3b82f6]">SocialCors</h2>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              SocialCors analiza, crea, publica y aprende por ti.
            </h1>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <p>• <strong className="text-slate-900">Analiza:</strong> Tus fotos, marca y audiencia.</p>
            <p>• <strong className="text-slate-900">Crea:</strong> Textos y hashtags a tu estilo.</p>
            <p>• <strong className="text-slate-900">Publica:</strong> Directamente sin esfuerzo.</p>
          </div>
          <div className="text-xs text-slate-400">© 2026 SocialCors</div>
        </div>

        <div className="lg:col-span-6 p-6 md:p-12 flex items-center justify-center bg-slate-50/50">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

      </div>
    </div>
  );
}
