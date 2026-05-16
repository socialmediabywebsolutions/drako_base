"use client";

import { Suspense } from "react";
import SocialFlowAuthForm from "./_components/socialflow-auth-form";

export default function SocialFlowAuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <Suspense fallback={<div className="text-sm text-slate-300">Loading SocialFlow auth...</div>}>
        <SocialFlowAuthForm />
      </Suspense>
    </div>
  );
}
