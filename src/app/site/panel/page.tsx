"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useSiteSession } from "@/contexts/site-session-context";

type SaasInfo = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
};

type InvoiceResponse = { items?: { id: string }[] };
type TicketResponse = { items?: { id: string }[] };
type SaasResponse = { items?: SaasInfo[] };

export default function SitePanelPage() {
  const { session, clearSession } = useSiteSession();
  const [saasInfo, setSaasInfo] = useState<SaasInfo | null>(null);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(session.saasId && session.clientId);

  const loadData = useCallback(async () => {
    if (!session.saasId || !session.clientId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [saasRes, invoicesRes, ticketsRes] = await Promise.all([
        fetch("/api/saas", { cache: "no-store" }),
        fetch(`/api/invoices?client_id=${session.clientId}&saas_id=${session.saasId}`, { cache: "no-store" }),
        fetch(`/api/tickets?saas_id=${session.saasId}`, { cache: "no-store" }),
      ]);

      const saasData = (await saasRes.json()) as SaasResponse;
      const invoicesData = (await invoicesRes.json()) as InvoiceResponse;
      const ticketsData = (await ticketsRes.json()) as TicketResponse;

      if (!saasRes.ok) {
        throw new Error("No se pudo cargar la información del SaaS");
      }
      const currentSaas = saasData.items?.find((item) => item.id === session.saasId) ?? null;
      setSaasInfo(currentSaas);

      if (!invoicesRes.ok) {
        throw new Error("No se pudieron cargar las facturas");
      }
      setInvoiceCount(invoicesData.items?.length ?? 0);

      if (!ticketsRes.ok) {
        throw new Error("No se pudieron cargar los tickets");
      }
      setTicketCount(ticketsData.items?.length ?? 0);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError instanceof Error ? apiError.message : "Error cargando datos del panel");
    } finally {
      setLoading(false);
    }
  }, [session.clientId, session.saasId]);

  useEffect(() => {
    if (canLoad) {
      void loadData();
    }
  }, [canLoad, loadData]);

  const saasCTA = useMemo(() => {
    if (!session.saasId) return "/saas";
    return `/saas/${session.saasId}`;
  }, [session.saasId]);

  return (
    <div className="space-y-8 text-white">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Panel</p>
        <h1 className="text-3xl font-semibold">Mi SaaS</h1>
        <p className="text-sm text-white/70">Aquí verás la información sincronizada desde DRĀKO BASE una vez completemos el onboarding.</p>
      </header>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="grid gap-6 md:grid-cols-3">
        <Card tone="glass" title="SaaS" subtitle="Datos básicos" actions={<Link href={saasCTA} className="text-xs uppercase tracking-[0.3em] text-cyan-300">Ver en Admin</Link>}>
          <dl className="space-y-2 text-sm text-white/80">
            <div>
              <dt className="text-white/50">Nombre</dt>
              <dd>{saasInfo?.name ?? session.draftSaas?.saasName ?? "Pendiente"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Slug</dt>
              <dd>{saasInfo?.slug ?? session.draftSaas?.saasSlug ?? "Pendiente"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Estado</dt>
              <dd>{saasInfo?.status ?? (session.saasId ? "Registrado" : "Borrador")}</dd>
            </div>
            {saasInfo?.domain && (
              <div>
                <dt className="text-white/50">Dominio</dt>
                <dd>{saasInfo.domain}</dd>
              </div>
            )}
            {saasInfo?.subdomain && (
              <div>
                <dt className="text-white/50">Subdominio</dt>
                <dd>{saasInfo.subdomain}</dd>
              </div>
            )}
          </dl>
        </Card>
        <Card tone="glass" title="Cliente" subtitle="Owner + Client">
          <dl className="space-y-2 text-sm text-white/80">
            <div>
              <dt className="text-white/50">Owner</dt>
              <dd>{session.draftCompany?.ownerName || "Pendiente"}</dd>
            </div>
            <div>
              <dt className="text-white/50">Cliente</dt>
              <dd>{session.draftCompany?.clientName || "Pendiente"}</dd>
            </div>
            <div>
              <dt className="text-white/50">NIF/CIF</dt>
              <dd>{session.draftCompany?.clientNif || "—"}</dd>
            </div>
          </dl>
        </Card>
        <Card tone="glass" title="Resumen" subtitle="Datos provenientes de DRĀKO" actions={loading ? <span className="text-xs text-white/50">Cargando…</span> : <span className="text-xs text-white/50">Actualizado</span>}>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Facturas: {invoiceCount ?? (session.clientId ? "consultando…" : "0 (pendiente)")}</li>
            <li>Tickets: {ticketCount ?? (session.clientId ? "consultando…" : "0 (pendiente)")}</li>
            <li>Último estado: {saasInfo?.status ?? (session.saasId ? "Operativo" : "Sin registrar")}</li>
          </ul>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
        <Link
          href={saasCTA}
          className="inline-flex items-center rounded-xl bg-[var(--brand,#4cc9f0)]/20 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-[var(--brand,#4cc9f0)]/30"
        >
          Abrir en DRĀKO BASE
        </Link>
        <Button variant="outline" onClick={() => clearSession()}>
          Resetear borrador
        </Button>
      </div>
      {!canLoad && <p className="text-xs text-white/40">Completa el onboarding para ver datos reales aquí.</p>}
    </div>
  );
}
