"use client";

import { ProductAuthForm } from "@/components/auth/product-auth-form";

export default function MentoriasLoginsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <ProductAuthForm
        title="Mentorias Login"
        description="Access your Mentorias account."
        authApiBase="/api/mentorias/auths"
        defaultMode="login"
        postLoginRedirect="/mentoria/onboarding"
      />
    </div>
  );
}
