"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSiteSession } from "@/contexts/site-session-context";

type ItemResponse = { ok?: boolean; item?: { id: string } | null; error?: string };
type SaasResponse = { ok?: boolean; saasId?: string; error?: string; message?: string };

export default function OnboardingReviewPage() {
  const router = useRouter();
  const { session, updateSession } = useSiteSession();
  const company = session.draftCompany ?? {};
  const saas = session.draftSaas ?? {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!company.ownerName?.trim() || !company.clientName?.trim() || !saas.saasName?.trim() || !saas.saasSlug?.trim()) {
      setError("Completa los datos de empresa y SaaS antes de continuar.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const ownerPayload = {
        id: session.ownerId,
        name: company.ownerName.trim(),
        email: company.ownerEmail?.trim() || null,
        nif: company.clientNif?.trim() || null,
      };
      const ownerRes = await fetch("/api/owners", {
        method: session.ownerId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ownerPayload),
      });
      const ownerData = (await ownerRes.json()) as ItemResponse;
      if (!ownerRes.ok || ownerData.ok === false || !ownerData.item?.id) {
        throw new Error(ownerData.error || "No se pudo crear/actualizar el owner");
      }
      const ownerId = ownerData.item.id;

      const clientPayload = session.clientId
        ? {
            id: session.clientId,
            owner_id: ownerId,
            name: company.clientName.trim(),
            nif: company.clientNif?.trim() || null,
            email: company.ownerEmail?.trim() || null,
          }
        : {
            owner_id: ownerId,
            name: company.clientName.trim(),
            nif: company.clientNif?.trim() || null,
            email: company.ownerEmail?.trim() || null,
          };
      const clientRes = await fetch("/api/clients", {
        method: session.clientId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(clientPayload),
      });
      const clientData = (await clientRes.json()) as ItemResponse;
      if (!clientRes.ok || clientData.ok === false || !clientData.item?.id) {
        throw new Error(clientData.error || "No se pudo crear el cliente");
      }
      const clientId = clientData.item.id;

      let saasId = session.saasId;
      if (!saasId) {
        const saasPayload = {
          name: saas.saasName.trim(),
          slug: saas.saasSlug.trim(),
        };
        const saasRes = await fetch("/api/factory/provisioning/create-saas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(saasPayload),
        });
        const saasData = (await saasRes.json()) as SaasResponse;
        if (!saasRes.ok || saasData.ok === false || !saasData.saasId) {
          throw new Error(saasData.error || saasData.message || "No se pudo crear el SaaS");
        }
        saasId = saasData.saasId;
      }

      updateSession({ ownerId, clientId, saasId });
      router.push("/site/panel");
    } catch (apiError) {
      console.error(apiError);
      setError(apiError instanceof Error ? apiError.message : "Error inesperado en la creación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-white">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Paso 3</p>
        <h1 className="mt-2 text-2xl font-semibold">Revisa antes de crear</h1>
        <p className="text-sm text-white/70">
          Confirmaremos estos datos y luego llamaremos a las APIs de DRĀKO BASE (owner → client → saas → client_saas).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card tone="glass" title="Empresa / Owner" subtitle="Datos fiscales de referencia">
          <dl className="space-y-3 text-sm text-white/80">
            <div>
              <dt className="text-white/50">Nombre</dt>
              <dd>{company.ownerName || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Email</dt>
              <dd>{company.ownerEmail || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Cliente principal</dt>
              <dd>{company.clientName || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">NIF/CIF</dt>
              <dd>{company.clientNif || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card tone="glass" title="Tu SaaS" subtitle="Configuración inicial">
          <dl className="space-y-3 text-sm text-white/80">
            <div>
              <dt className="text-white/50">Nombre</dt>
              <dd>{saas.saasName || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Slug</dt>
              <dd>{saas.saasSlug || "—"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Descripción</dt>
              <dd className="text-white/70">{saas.saasDescription || "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Próximo paso: crear registros en DRĀKO BASE y guardar los IDs en esta sesión para mostrarlos en tu panel.
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Button type="button" variant="outline" onClick={() => router.push("/site/onboarding/saas")}>
          Atrás
        </Button>
        <Button type="button" onClick={() => void handleConfirm()} loading={loading} disabled={loading}>
          {loading ? "Creando..." : "Confirmar y crear mi SaaS"}
        </Button>
      </div>
    </div>
  );
}
