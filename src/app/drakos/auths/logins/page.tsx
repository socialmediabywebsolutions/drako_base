"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function DrakosLoginsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-3 text-3xl font-bold text-slate-900">Drakos Login</h1>
        <p className="mb-6 text-sm text-slate-500">Access your Drakos account.</p>
        <AuthForm context="drakos" defaultMode="login" redirectTo="/site/onboarding" />
      </div>
    </div>
  );
}
