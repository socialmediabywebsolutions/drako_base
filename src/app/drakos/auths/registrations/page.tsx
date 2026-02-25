"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function DrakosRegistrationsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-3 text-3xl font-bold text-slate-900">Drakos Registration</h1>
        <p className="mb-6 text-sm text-slate-500">Create an isolated Drakos identity.</p>
        <AuthForm context="drakos" defaultMode="register" redirectTo="/site/onboarding" />
      </div>
    </div>
  );
}
