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
    <div className="max-w-7xl mx-auto px-8 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* Left: Form */}
        <div className="space-y-12">
          <header className="space-y-4">
            <div className="inline-flex px-3 py-1 rounded bg-brand/10 border border-brand/20 text-brand text-[9px] font-black uppercase tracking-[0.3em]">
              Tech Support Hub • Intake
            </div>
            <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">¿Problemas Técnicos?</h1>
            <p className="text-slate-400 font-bold max-w-xl text-sm leading-relaxed tracking-wide">
              Reporte cualquier anomalía en su infraestructura. Nuestros agentes de soporte de Nivel 3 están preparados para el escalado inmediato.
            </p>
          </header>

          {error && <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[10px] font-black uppercase tracking-widest">{error}</div>}
          {success && <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success text-[10px] font-black uppercase tracking-widest">{success}</div>}

          <form className="space-y-8 bg-slate-900/30 p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-xl" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-2">Asunto del Protocolo</span>
              <TextInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Optimización de bases de datos D1"
                required
                disabled={!canSubmit || loading}
                className="modern-input h-14"
              />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-2">Descripción de la Anomalía</span>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describa el error técnico con detalle..."
                rows={5}
                disabled={!canSubmit || loading}
                required
                className="modern-input"
              />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-2">Nivel de Prioridad</span>
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

            <div className="flex items-center justify-between pt-4">
              {!canSubmit ? (
                <p className="text-[9px] text-warning font-black uppercase tracking-widest italic">⚠️ REQUIERE ONBOARDING</p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-ping" />
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Canal Encriptado Activo</span>
                </div>
              )}
              <Button
                type="submit"
                loading={loading}
                disabled={!canSubmit || loading}
                className="px-10 py-3 bg-brand text-slate-950 font-black uppercase tracking-[0.3em] rounded-xl shadow-[0_0_15px_var(--brand-glow)] hover:scale-105 transition-transform"
              >
                {loading ? "TRANSMITIENDO..." : "ENVIAR TICKET"}
              </Button>
            </div>
          </form>
        </div>

        {/* Right: History */}
        <section className="space-y-10">
          <div className="flex items-center gap-4">
            <div className="h-0.5 flex-1 bg-white/5" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500">Log de Operaciones</h2>
            <div className="h-0.5 flex-1 bg-white/5" />
          </div>

          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30 italic">
              <div className="text-4xl">📭</div>
              <p className="text-xs uppercase tracking-[0.2em] font-bold">No se detectan incidencias previas</p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[800px] overflow-y-auto pr-4 custom-scrollbar">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-8 rounded-[2rem] bg-slate-900/40 border border-white/5 hover:border-brand/30 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none uppercase font-black text-2xl italic tracking-tighter">
                    TKT-{ticket.id.slice(0, 4)}
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-black text-white italic group-hover:text-brand transition-colors tracking-tight">{ticket.subject}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest border ${ticket.status === 'open' ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'
                      } uppercase`}>
                      {ticket.status}
                    </span>
                  </div>
                  {ticket.description && <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed mb-6">{ticket.description}</p>}
                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Priority: {ticket.priority}</span>
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
