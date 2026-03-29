"use client";

import { ProductAuthForm } from "@/components/auth/product-auth-form";

export default function SocialFlowAuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <ProductAuthForm
        title="SocialFlow Auth"
        description="Sign in or create your SocialFlow workspace identity."
        authApiBase="/api/socialflow/auths"
        defaultMode="login"
        postLoginRedirect="/socialflow"
      />
    </div>
  );
}
