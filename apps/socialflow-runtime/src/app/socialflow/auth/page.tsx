"use client";

import { Suspense } from "react";
import SocialFlowAuthForm from "./_components/socialflow-auth-form";

function SocialFlowAuthFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7f2] text-[#111827]">
      <div className="rounded-lg border border-[#d8decd] bg-[#fffdf7] px-6 py-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">
          SocialFlow secure access
        </p>
        <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-[#e2e7da]">
          <div className="h-full w-1/2 rounded-full bg-[#153b39]" />
        </div>
      </div>
    </main>
  );
}

export default function SocialFlowAuthPage() {
  return (
    <Suspense fallback={<SocialFlowAuthFallback />}>
      <SocialFlowAuthForm />
    </Suspense>
  );
}
