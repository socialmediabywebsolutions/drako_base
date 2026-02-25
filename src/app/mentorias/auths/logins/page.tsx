"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function MentoriasLoginsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md">
        <h1 className="mb-3 text-3xl font-bold">Mentorias Login</h1>
        <p className="mb-6 text-sm text-slate-400">Access your Mentorias account.</p>
        <AuthForm context="mentorias" defaultMode="login" redirectTo="/client/sessions" />
      </div>
    </div>
  );
}
