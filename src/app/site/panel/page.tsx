"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSiteSession } from "@/contexts/site-session-context";
import { MaterializationTracker } from "@/components/panel/materialization-tracker";

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
  const [interviewPhase, setInterviewPhase] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(session.saasId && session.clientId);

  useEffect(() => {
    // Read progress from localStorage if available (simulating DB sync)
    const savedPhase = localStorage.getItem("drako_interview_phase");
    if (savedPhase) setInterviewPhase(parseInt(savedPhase));
  }, []);

  const loadData = useCallback(async () => {
    if (!session.saasId || !session.clientId) return;
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

      if (saasRes.ok) {
        const currentSaas = saasData.items?.find((item) => item.id === session.saasId) ?? null;
        setSaasInfo(currentSaas);
      }

      if (invoicesRes.ok) setInvoiceCount(invoicesData.items?.length ?? 0);
      if (ticketsRes.ok) setTicketCount(ticketsData.items?.length ?? 0);

    } catch (apiError) {
      console.error(apiError);
      setError("No se pudieron cargar los datos actualizados.");
    }
  }, [session.clientId, session.saasId]);

  useEffect(() => {
    if (canLoad) void loadData();
  }, [canLoad, loadData]);

  const saasCTA = useMemo(() => {
    if (!session.saasId) return "/site";
    return `/saas/${session.saasId}/student`;
  }, [session.saasId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* 1. TOP NAVIGATION (Private Area) */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/site" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center text-white font-black text-xs">
                DP
              </div>
              <span className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Drako Partner</span>
            </Link>
            <div className="h-4 w-[1px] bg-slate-200" />
            <span className="text-sm font-medium text-slate-500">Panel de Cliente</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wide">Conectado</span>
            </div>
            <button
              onClick={() => clearSession()}
              className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

        {/* HEADER: Welcome & Context */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Bienvenido, {session.draftCompany?.ownerName?.split(' ')[0] || "Líder"}
            </h1>
            <p className="text-slate-500 text-lg">
              Aquí tienes la visión global de tu ecosistema digital.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/site/support" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm text-sm">
              Ayuda y Soporte
            </Link>
            <Link href={saasCTA} className="px-5 py-2.5 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition-all shadow-md text-sm flex items-center gap-2">
              <span>Entrar al Editor</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm font-medium flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {/* 2. MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* COLUMN 1: PROJECT STATUS (Main Card) */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8 relative group">
              {/* Status Badge */}
              <div className="absolute top-8 right-8">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${saasInfo?.status === 'active'
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                  {saasInfo?.status === 'active' ? "Activo" : "En Desarrollo"}
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proyecto Principal</span>
                  <h2 className="text-4xl font-bold text-slate-900 mt-1 mb-2">
                    {saasInfo?.name ?? session.draftSaas?.saasName ?? "Nuevo Proyecto"}
                  </h2>
                  <p className="text-slate-500 max-w-lg">
                    {session.draftSaas?.saasSlug
                      ? `https://${session.draftSaas.saasSlug}.drako.systems`
                      : "Dominio pendiente de asignación"}
                  </p>
                </div>

                {/* Progress / Steps */}
                <div className="pt-6 border-t border-slate-100 mt-6">
                  <MaterializationTracker
                    phase={interviewPhase}
                    status={saasInfo?.status ?? (canLoad ? 'active' : 'draft')}
                  />
                </div>
              </div>
            </section>

            {/* MODULES & STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4 text-slate-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider">Facturación</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">{invoiceCount ?? 0}</span>
                  <span className="text-sm text-slate-500 font-medium mb-1">facturas pendientes</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4 text-slate-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-xs font-bold uppercase tracking-wider">Soporte Técnico</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">{ticketCount ?? 0}</span>
                  <span className="text-sm text-slate-500 font-medium mb-1">tickets abiertos</span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: BUSINESS INTELLIGENCE (Sidebar) */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-bold text-slate-900">Datos Fiscales</h3>
                <p className="text-sm text-slate-500 mt-1">Información registrada en el sistema.</p>
              </div>

              <div className="space-y-4">
                <div className="py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Razón Social</p>
                  <p className="text-sm font-semibold text-slate-800">{session.draftCompany?.clientName || "—"}</p>
                </div>
                <div className="py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Titular</p>
                  <p className="text-sm font-semibold text-slate-800">{session.draftCompany?.ownerName || "—"}</p>
                </div>
                <div className="py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Identificación (NIF/CIF)</p>
                  <p className="text-sm font-semibold text-slate-800 font-mono">{session.draftCompany?.clientNif || "—"}</p>
                </div>
              </div>

              <Link href="/site" className="block w-full py-2 text-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                Editar Información
              </Link>
            </div>

            <div className="bg-white border-2 border-sky-100 p-8 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <h3 className="font-bold text-slate-900">Infraestructura</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Server Status</span>
                    <span className="text-emerald-600 font-bold">99.9% Uptime</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Región</span>
                    <span className="text-slate-900">eu-west-1 (Madrid)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base de Datos</span>
                    <span className="text-slate-900">Drako D1 (Edge)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
