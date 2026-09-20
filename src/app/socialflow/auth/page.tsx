import { Suspense } from "react";
import SocialFlowAuthExperience from "./_components/socialflow-auth-experience";

function SocialFlowAuthFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6fa] text-[#1a1a2e]">
      <div className="rounded-2xl border border-black/10 bg-white px-6 py-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#64748b]">
          Acceso a SocialCors
        </p>
        <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-[#e2e8f0]">
          <div className="h-full w-1/2 rounded-full bg-[#4338ca]" />
        </div>
      </div>
    </main>
  );
}

export default function SocialFlowAuthPage() {
  return (
    <Suspense fallback={<SocialFlowAuthFallback />}>
      <SocialFlowAuthExperience />
    </Suspense>
  );
}
