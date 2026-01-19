"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
    <div className="max-w-7xl mx-auto px-8 py-20 space-y-20 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand/5 blur-[120px] -z-10 rounded-full" />

      {/* Header Profile Style */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b-2 border-white pb-12">
        <div className="space-y-4">
          <div className="inline-flex px-3 py-1 rounded bg-brand/10 border border-brand/20 text-brand text-[8px] font-black uppercase tracking-[0.4em]">
            Canal de Soporte Directo
          </div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Canal de <span className="text-brand">Anomalías</span></h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.3em] max-w-xl">Apertura de tickets críticos y escalado de infraestructura.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* Left: Form */}
        <div className="space-y-12">
          {error && <div className="p-4 rounded-xl bg-danger/10 border-2 border-danger text-danger text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">{error}</div>}
          {success && <div className="p-4 rounded-xl bg-success/10 border-2 border-success text-success text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.2)]">{success}</div>}

          <form className="space-y-8 bg-slate-950/50 p-12 rounded-[3.5rem] border-2 border-white backdrop-blur-3xl shadow-[0_0_50px_-15px_rgba(255,255,255,0.1)] relative" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Asunto del Protocolo</span>
              <TextInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Despliegue de SSL Critico"
                required
                disabled={!canSubmit || loading}
                className="modern-input h-14"
              />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Descripción de la Anomalía</span>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Introduzca los datos técnicos del error..."
                rows={5}
                disabled={!canSubmit || loading}
                required
                className="modern-input"
              />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 pl-2">Prioridad de Escalado</span>
              <select
                className="modern-input w-full appearance-none cursor-pointer"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={!canSubmit || loading}
              >
                <option value="low">BAJA (Estético)</option>
                <option value="normal">NORMAL (Funcional)</option>
                <option value="high">ALTA (Bloqueo)</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
              {!canSubmit ? (
                <div className="px-4 py-2 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-[10px] text-warning font-black uppercase tracking-widest italic animate-pulse">⚠️ BLOQUEO: REQUIERE ONBOARDING</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Protocolo de Enlace Activo</span>
                </div>
              )}
              <Button
                type="submit"
                loading={loading}
                disabled={!canSubmit || loading}
                className="w-full sm:w-auto px-12 py-4 bg-white text-slate-950 font-black uppercase tracking-[0.3em] rounded-xl shadow-[0_10px_30px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
              >
                {loading ? "TRANSMITIENDO..." : "ENVIAR TICKET"}
              </Button>
            </div>
          </form>
        </div>

        {/* Right: History */}
        <section className="space-y-12">
          <div className="flex items-center gap-4">
            <div className="h-0.5 w-12 bg-white" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 whitespace-nowrap">Reportes de Estado</h2>
            <div className="h-0.5 flex-1 bg-white/5" />
          </div>

          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 opacity-40">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-4xl grayscale">🛰️</div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] font-black text-white">Sin Anomalías</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">No se detectan reportes en el log</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-h-[850px] overflow-y-auto pr-6 custom-scrollbar">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-10 rounded-[3rem] bg-slate-900/40 border-2 border-white/5 hover:border-white transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none uppercase font-black text-3xl italic tracking-tighter group-hover:opacity-10 transition-opacity">
                    TKT-{ticket.id.slice(0, 4)}
                  </div>
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <span className="text-lg font-black text-white italic group-hover:text-brand transition-colors tracking-tight uppercase leading-none">{ticket.subject}</span>
                    <span className={`px-3 py-1 rounded-sm text-[9px] font-black tracking-widest border-2 ${ticket.status === 'open' ? 'bg-warning/10 border-warning text-warning shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'bg-success/10 border-success text-success shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                      } uppercase`}>
                      {ticket.status}
                    </span>
                  </div>
                  {ticket.description && <p className="text-xs text-slate-400 font-bold uppercase tracking-wider line-clamp-2 leading-relaxed mb-8 opacity-70 group-hover:opacity-100 transition-opacity">{ticket.description}</p>}
                  <div className="flex items-center justify-between border-t border-white/5 pt-6 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Prioridad: <span className="text-white ml-2">{ticket.priority}</span></span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">{new Date(ticket.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
