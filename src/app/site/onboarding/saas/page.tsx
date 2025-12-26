"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/input";
import { useSiteSession } from "@/contexts/site-session-context";

export default function OnboardingSaasPage() {
  const router = useRouter();
  const { session, updateSession } = useSiteSession();

  const [saasName, setSaasName] = useState(session.draftSaas?.saasName ?? "");
  const [saasSlug, setSaasSlug] = useState(session.draftSaas?.saasSlug ?? "");
  const [saasDescription, setSaasDescription] = useState(session.draftSaas?.saasDescription ?? "");

  useEffect(() => {
    updateSession({ draftSaas: { saasName, saasSlug, saasDescription } });
  }, [saasDescription, saasName, saasSlug, updateSession]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/site/onboarding/review");
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Paso 2</p>
        <h1 className="mt-2 text-2xl font-semibold">Define tu SaaS</h1>
        <p className="text-sm text-white/70">Nombre, slug y descripción. Más adelante conectaremos DNS y provisión automática.</p>
      </div>
      <div className="grid gap-4">
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Nombre del SaaS</span>
          <TextInput value={saasName} onChange={(e) => setSaasName(e.target.value)} placeholder="Campamento Orion" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Slug deseado</span>
          <TextInput value={saasSlug} onChange={(e) => setSaasSlug(e.target.value)} placeholder="campamento-orion" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Descripción breve</span>
          <TextArea value={saasDescription} onChange={(e) => setSaasDescription(e.target.value)} placeholder="Qué problema resuelve tu SaaS" rows={4} />
        </label>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Button type="button" variant="outline" onClick={() => router.push("/site/onboarding/company")}>
          Atrás
        </Button>
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  );
}
