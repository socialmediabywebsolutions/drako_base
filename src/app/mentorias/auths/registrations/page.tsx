"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function MentoriasRegistrationsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="w-full max-w-md">
        <h1 className="mb-3 text-3xl font-bold">Mentorias Registration</h1>
        <p className="mb-6 text-sm text-slate-400">Create an isolated Mentorias identity.</p>
        <AuthForm context="mentorias" defaultMode="register" redirectTo="/client/sessions" />
      </div>
    </div>
  );
}
