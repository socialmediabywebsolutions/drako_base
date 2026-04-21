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
    const relation = searchParams.get("relation");
    if (ref) params.set("ref", ref);
    if (invite) params.set("invite", invite);
    if (relation) params.set("relation", relation);
    const suffix = params.toString();
    return suffix ? `/mentoria/onboarding?${suffix}` : "/mentoria/onboarding";
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <ProductAuthForm
        title="Alta del tutor principal"
        description="Crea el acceso principal de la familia. Después añadiremos al alumno y su primera ayuda real en pocos pasos."
        authApiBase="/api/mentorias/auths"
        defaultMode="register"
        postLoginRedirect={redirect}
        registerSelectField={{
          name: "relation",
          label: "Rol",
          defaultValue: "tutor",
          options: [
            { value: "mother", label: "Madre" },
            { value: "father", label: "Padre" },
            { value: "tutor", label: "Tutor" },
          ],
        }}
      />
    </div>
  );
}
