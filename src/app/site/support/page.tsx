"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/input";
import { useSiteSession } from "@/contexts/site-session-context";

type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
};

type TicketsResponse = { items?: Ticket[] };

export default function SiteSupportPage() {
  const { session } = useSiteSession();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = Boolean(session.clientId && session.saasId);

  const loadTickets = useCallback(async () => {
    if (!session.saasId) return;
    try {
      const res = await fetch(`/api/tickets?saas_id=${session.saasId}`, { cache: "no-store" });
      const data = (await res.json()) as TicketsResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron cargar los tickets");
      }
      setTickets(data.items ?? []);
    } catch (apiError) {
      console.error(apiError);
    }
  }, [session.saasId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Completa el onboarding para enviar tickets.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: session.clientId,
          saas_id: session.saasId,
          subject: subject.trim(),
          description: description.trim() || null,
          priority,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "No se pudo crear el ticket");
      }
      setSubject("");
      setDescription("");
      setPriority("normal");
      setSuccess("Ticket enviado correctamente.");
      await loadTickets();
    } catch (apiError) {
      console.error(apiError);
      setError(apiError instanceof Error ? apiError.message : "Error creando el ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Private Area Navigation */}
      <nav className="border-b border-sky-100 bg-white/90 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link href="/site" className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors group">
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide">Volver al Home</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/site/panel" className="text-sm font-bold text-slate-600 hover:text-sky-600 transition-colors uppercase tracking-wide">
              Mi Panel
            </Link>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 border-2 border-emerald-300">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-700 text-xs font-black uppercase tracking-wider">Área Privada</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-20 space-y-20 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-sky-200/20 blur-[120px] -z-10 rounded-full" />

        {/* Header Profile Style */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-sky-100 pb-12">
          <div className="space-y-6">
            <div className="inline-flex px-4 py-1.5 rounded-full bg-sky-100 border-2 border-sky-300 text-sky-700 text-[9px] font-black uppercase tracking-[0.6em]">
              Soporte Técnico
            </div>
            <h1 className="text-6xl font-black text-slate-900 italic uppercase tracking-tight leading-none">Solicitudes de <span className="text-sky-600">Ayuda</span></h1>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em] max-w-2xl">Reporta problemas técnicos o solicita asistencia para tu proyecto.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Left: Form */}
          <div className="space-y-12">
            {error && <div className="p-4 rounded-xl bg-red-100 border-2 border-red-400 text-red-700 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200">{error}</div>}
            {success && <div className="p-4 rounded-xl bg-green-100 border-2 border-green-400 text-green-700 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-200">{success}</div>}

            <form className="space-y-8 bg-white p-12 rounded-[3.5rem] border-2 border-sky-200 backdrop-blur-3xl shadow-xl relative" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Asunto del Ticket</span>
                <TextInput
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Error en despliegue de producción"
                  required
                  disabled={!canSubmit || loading}
                  className="modern-input h-14"
                />
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Descripción del Problema</span>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el problema con el máximo detalle posible..."
                  rows={5}
                  disabled={!canSubmit || loading}
                  required
                  className="modern-input"
                />
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Prioridad</span>
                <select
                  className="modern-input w-full appearance-none cursor-pointer"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={!canSubmit || loading}
                >
                  <option value="low">BAJA (Visual)</option>
                  <option value="normal">NORMAL (Funcional)</option>
                  <option value="high">ALTA (Crítico)</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                {!canSubmit ? (
                  <div className="px-4 py-2 bg-yellow-100 border-2 border-yellow-400 rounded-lg">
                    <p className="text-[10px] text-yellow-700 font-black uppercase tracking-widest italic animate-pulse">⚠️ Completa el onboarding primero</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Sistema conectado</span>
                  </div>
                )}
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!canSubmit || loading}
                  className="w-full sm:w-auto px-12 py-4 bg-sky-500 text-white font-black uppercase tracking-[0.3em] rounded-xl shadow-lg shadow-sky-500/30 hover:bg-sky-600 hover:scale-105 active:scale-95 transition-all"
                >
                  {loading ? "ENVIANDO..." : "ENVIAR TICKET"}
                </Button>
              </div>
            </form>
          </div>

          {/* Right: History */}
          <section className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="h-0.5 w-12 bg-sky-600" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 whitespace-nowrap">Historial de Tickets</h2>
              <div className="h-0.5 flex-1 bg-sky-100" />
            </div>

            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-40">
                <div className="w-20 h-20 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center text-4xl grayscale">🛰️</div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] font-black text-slate-900">Sin Tickets</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">No hay reportes en el sistema</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8 max-h-[850px] overflow-y-auto pr-6 custom-scrollbar">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="p-10 rounded-[3rem] bg-sky-50 border-2 border-sky-200 hover:border-sky-400 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none uppercase font-black text-3xl italic tracking-tighter group-hover:opacity-10 transition-opacity">
                      TKT-{ticket.id.slice(0, 4)}
                    </div>
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <span className="text-lg font-black text-slate-900 italic group-hover:text-sky-600 transition-colors tracking-tight uppercase leading-none">{ticket.subject}</span>
                      <span className={`px-3 py-1 rounded-sm text-[9px] font-black tracking-widest border-2 ${ticket.status === 'open' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : 'bg-green-100 border-green-400 text-green-700'
                        } uppercase`}>
                        {ticket.status}
                      </span>
                    </div>
                    {ticket.description && <p className="text-xs text-slate-600 font-bold uppercase tracking-wider line-clamp-2 leading-relaxed mb-8 opacity-70 group-hover:opacity-100 transition-opacity">{ticket.description}</p>}
                    <div className="flex items-center justify-between border-t border-sky-200 pt-6 relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Prioridad: <span className="text-slate-900 ml-2">{ticket.priority}</span></span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{new Date(ticket.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
