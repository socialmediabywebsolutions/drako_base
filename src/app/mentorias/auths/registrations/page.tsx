"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProductAuthForm } from "@/components/auth/product-auth-form";

export default function MentoriasRegistrationsPage() {
  const searchParams = useSearchParams();
  const redirect = useMemo(() => {
    const params = new URLSearchParams();
    const ref = searchParams.get("ref");
    const invite = searchParams.get("invite");
    if (ref) params.set("ref", ref);
    if (invite) params.set("invite", invite);
    const suffix = params.toString();
    return suffix ? `/mentoria/onboarding?${suffix}` : "/mentoria/onboarding";
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <ProductAuthForm
        title="Mentorias Registration"
        description="Create an isolated Mentorias identity."
        authApiBase="/api/mentorias/auths"
        defaultMode="register"
        postLoginRedirect={redirect}
      />
    </div>
  );
}
