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
    <div className="max-w-7xl mx-auto px-8 py-20 space-y-16">
      <header className="space-y-4">
        <div className="inline-flex px-3 py-1 rounded bg-brand/10 border border-brand/20 text-brand text-[9px] font-black uppercase tracking-[0.3em]">
          Control Panel • Terminal
        </div>
        <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">Mi Fábrica <span className="text-brand">SaaS</span></h1>
        <p className="text-slate-400 font-bold max-w-2xl text-sm leading-relaxed tracking-wide">
          Sincronización activa con Drako Neural Engine. Aquí puede monitorear la salud y el progreso de sus activos digitales.
        </p>
      </header>

      {error && <div className="p-6 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold uppercase tracking-widest animate-pulse">{error}</div>}

      <div className="grid gap-10 md:grid-cols-3">
        {/* SaaS Module */}
        <div className="bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/5 border-l-brand border-l-4 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black italic">MOD-01</div>
          <div className="flex justify-between items-start mb-10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-mono">Infraestructura</h4>
            <Link href={saasCTA} className="text-[9px] font-black uppercase tracking-[0.2em] text-brand hover:scale-110 transition-transform underline underline-offset-4">ADMIN ACCESS</Link>
          </div>
          <dl className="space-y-6 text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Nombre</dt>
              <dd className="text-white font-black">{saasInfo?.name ?? session.draftSaas?.saasName ?? "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Protocolo (Slug)</dt>
              <dd className="text-white font-mono">{saasInfo?.slug ?? session.draftSaas?.saasSlug ?? "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Status Operativo</dt>
              <dd className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <span className="text-brand font-black uppercase tracking-widest">{saasInfo?.status ?? (session.saasId ? "REGISTRADO" : "BORRADOR")}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Client Module */}
        <div className="bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/5 border-l-cyan-500 border-l-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black italic">MOD-02</div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-10 font-mono">Entidad Fiscal</h4>
          <dl className="space-y-6 text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Owner</dt>
              <dd className="text-white font-black">{session.draftCompany?.ownerName || "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Entidad</dt>
              <dd className="text-white font-black">{session.draftCompany?.clientName || "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <dt className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">ID Fiscal</dt>
              <dd className="text-white font-mono">{session.draftCompany?.clientNif || "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Stats Module */}
        <div className="bg-slate-900/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/5 border-l-indigo-500 border-l-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl font-black italic">MOD-03</div>
          <div className="flex justify-between items-start mb-10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-mono">Telemetría</h4>
            {loading ? <span className="text-[9px] text-brand animate-pulse font-black">SYNCING...</span> : <span className="text-[9px] text-success font-black">SYNC OK</span>}
          </div>
          <ul className="space-y-8">
            <li className="flex items-end gap-3">
              <span className="text-4xl font-black text-white">{invoiceCount ?? "—"}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">FACTURAS PEND.</span>
            </li>
            <li className="flex items-end gap-3">
              <span className="text-4xl font-black text-white">{ticketCount ?? "—"}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">TICKETS OPS.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-10 border-t border-white/5">
        <Link
          href={saasCTA}
          className="inline-flex items-center rounded-xl bg-brand px-8 py-3 text-xs font-black uppercase tracking-[0.3em] text-slate-950 transition hover:scale-105 active:scale-95 shadow-[0_0_20px_var(--brand-glow)]"
        >
          MATERIALIZAR EN FOUNDRY
        </Link>
        <button
          onClick={() => clearSession()}
          className="px-8 py-3 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:bg-white/5 transition-colors"
        >
          RESETEAR PROTOCOLO
        </button>
      </div>
      {!canLoad && (
        <div className="p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-6">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">ℹ️</div>
          <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Protocolo incompleto. Finalice el Onboarding Estratégico para activar la monitorización.</p>
        </div>
      )}
    </div>
  );
}
