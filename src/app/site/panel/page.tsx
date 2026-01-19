"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(session.saasId && session.clientId);

  const loadData = useCallback(async () => {
    if (!session.saasId || !session.clientId) {
      return;
    }
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
      // Data load complete
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
    <div className="max-w-7xl mx-auto px-8 py-20 space-y-20 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] -z-10 rounded-full" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-white/5 blur-[120px] -z-10 rounded-full" />

      {/* Commander Profile Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-white pb-12">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand to-white rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-24 h-24 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-4xl shadow-2xl overflow-hidden">
              <span className="grayscale group-hover:grayscale-0 transition-all duration-500">👨‍✈️</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-brand text-slate-950 text-[8px] font-black px-2 py-1 rounded-sm border border-white shadow-lg uppercase tracking-widest">Elite</div>
          </div>
          <div className="space-y-2">
            <div className="inline-flex px-3 py-1 rounded bg-brand/10 border border-brand/20 text-brand text-[8px] font-black uppercase tracking-[0.4em]">
              Sincronización Neural Activa
            </div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Comandante de Proyecto</h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.3em]">ID Terminal: {session.clientId?.slice(0, 12) || "ANONYMOUS-HUB"}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => clearSession()}
            className="px-6 py-2 rounded-xl border border-white/20 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 hover:border-white hover:text-white transition-all bg-white/5"
          >
            Cerrar Protocolo
          </button>
        </div>
      </header>

      {error && <div className="p-6 rounded-2xl bg-danger/10 border-2 border-danger text-danger text-xs font-black uppercase tracking-widest animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]">{error}</div>}

      {/* Active Materialization Unit */}
      <section className="space-y-12">
        <div className="flex items-center gap-4">
          <div className="h-0.5 w-12 bg-brand shadow-[0_0_10px_var(--brand-glow)]" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Unidad de Materialización Activa</h2>
        </div>

        <div className="bg-slate-950/50 backdrop-blur-3xl p-12 rounded-[3.5rem] border-2 border-white shadow-[0_0_60px_-15px_rgba(255,255,255,0.1)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-[15rem] font-black italic select-none group-hover:opacity-[0.05] transition-opacity">DRAKO</div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
            {/* Massive Title Section */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-4">
                <p className="text-brand text-xs font-black uppercase tracking-[0.5em] opacity-80">Protocolo Operativo</p>
                <h3 className="text-6xl md:text-8xl font-black text-white italic uppercase tracking-tighter leading-none break-words drop-shadow-2xl">
                  {saasInfo?.name ?? session.draftSaas?.saasName ?? "PROTOTIPO"}
                </h3>
              </div>

              <div className="flex flex-wrap gap-4">
                <span className="px-4 py-2 bg-slate-900 border border-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Slug: <span className="text-brand ml-2">{saasInfo?.slug ?? session.draftSaas?.saasSlug ?? "PENDIENTE"}</span>
                </span>
                <span className="px-4 py-2 bg-slate-900 border border-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Status: <span className="text-success ml-2 animate-pulse">{saasInfo?.status ?? (session.saasId ? "MATERIALIZADO" : "BORRADOR")}</span>
                </span>
              </div>

              <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-xl opacity-80 italic">
                &quot;Arquitectura de grado militar desplegada en el Edge. Este activo digital está orquestado por agentes de inteligencia autónomos para garantizar rendimiento máximo.&quot;
              </p>
            </div>

            {/* Stats Sidebar */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Facturación</p>
                  <p className="text-3xl font-black text-white">{invoiceCount ?? "0"}</p>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Incidencias</p>
                  <p className="text-3xl font-black text-white">{ticketCount ?? "0"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Link
                  href={saasCTA}
                  className="w-full inline-flex items-center justify-center rounded-2xl bg-white px-8 py-5 text-sm font-black uppercase tracking-[0.4em] text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
                >
                  ENTRAR AL FOUNDRY
                </Link>
                <div className="flex items-center justify-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-500 px-4">
                  <span className="h-0.5 flex-1 bg-white/5" />
                  MATERIALIZACIÓN NIVEL 1
                  <span className="h-0.5 flex-1 bg-white/5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auxiliary Modules Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-10">
        <div className="bg-slate-900/40 p-10 rounded-[3rem] border-2 border-white/10 hover:border-white transition-colors group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-8xl font-black italic">FISCAL</div>
          <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 border-b border-white/5 pb-4">Telemetría de Negocio</h4>
          <dl className="space-y-6">
            <div className="flex justify-between items-center group/item">
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/item:text-brand transition-colors">Entidad Titular</dt>
              <dd className="text-sm font-black text-white uppercase tracking-tight">{session.draftCompany?.ownerName || "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between items-center group/item">
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/item:text-brand transition-colors">Razón Social</dt>
              <dd className="text-sm font-black text-white uppercase tracking-tight">{session.draftCompany?.clientName || "PENDIENTE"}</dd>
            </div>
            <div className="flex justify-between items-center group/item">
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover/item:text-brand transition-colors">Identificación</dt>
              <dd className="text-mono text-sm font-black text-white uppercase tracking-tight">{session.draftCompany?.clientNif || "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-slate-900/40 p-10 rounded-[3rem] border-2 border-white/10 hover:border-brand transition-colors group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] text-8xl font-black italic">CORE</div>
          <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 border-b border-white/5 pb-4">Estatus de Plataforma</h4>
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-4xl shadow-[0_0_20px_var(--brand-glow)]">🛰️</div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white">SaaS Engine v2.0</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand">Sincronización al 100%</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
              Todos sus activos digitales están aislados y protegidos bajo el ecosistema Drako. El despliegue automático de SSL y CDN se encuentra activo.
            </p>
          </div>
        </div>
      </section>

      {!canLoad && (
        <div className="p-12 rounded-[4rem] bg-brand/5 border-2 border-white flex flex-col items-center gap-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0px,transparent_100%)] opacity-50" />
          <div className="h-1 w-24 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
          <div className="space-y-4 relative z-10">
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Protocolo Incompleto</h3>
            <p className="text-slate-400 font-bold max-w-lg text-sm uppercase tracking-widest leading-none">Finalice el Onboarding Estratégico para activar la monitorización en tiempo real.</p>
          </div>
          <Link href="/site" className="relative z-10 px-10 py-4 bg-brand text-slate-950 font-black uppercase tracking-[0.3em] rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_var(--brand-glow)]">
            INICIAR SECUENCIA
          </Link>
        </div>
      )}
    </div>
  );
}
