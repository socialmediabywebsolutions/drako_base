"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import { useSiteSession } from "@/contexts/site-session-context";

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const { session, updateSession } = useSiteSession();

  const [ownerName, setOwnerName] = useState(session.draftCompany?.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(session.draftCompany?.ownerEmail ?? "");
  const [clientName, setClientName] = useState(session.draftCompany?.clientName ?? "");
  const [clientNif, setClientNif] = useState(session.draftCompany?.clientNif ?? "");

  useEffect(() => {
    updateSession({ draftCompany: { ownerName, ownerEmail, clientName, clientNif } });
  }, [clientName, clientNif, ownerEmail, ownerName, updateSession]);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/site/onboarding/saas");
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Paso 1</p>
        <h1 className="mt-2 text-2xl font-semibold">Datos de tu empresa</h1>
        <p className="text-sm text-white/70">Usaremos esta información para crear el owner y el cliente dentro de DRĀKO BASE.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Nombre de la empresa (owner)</span>
          <TextInput value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="DRĀKO Systems SL" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Email de contacto</span>
          <TextInput type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="founder@tu-saas.com" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Cliente principal</span>
          <TextInput value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Tu SaaS Cliente" required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">NIF / CIF del cliente</span>
          <TextInput value={clientNif} onChange={(e) => setClientNif(e.target.value)} placeholder="B12345678" />
        </label>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-white/50">Nada se creará todavía. Solo estamos guardando tus borradores.</p>
        <div className="flex gap-3">
          <Button type="submit">Siguiente</Button>
        </div>
      </div>
    </form>
  );
}
