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
    <div className="space-y-8 text-white">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Soporte</p>
        <h1 className="text-3xl font-semibold">¿Necesitas ayuda?</h1>
        <p className="text-sm text-white/70">Envía tickets vinculados a tu SaaS para que el Campamento Base los atienda.</p>
      </header>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {success && <p className="text-sm text-green-300">{success}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Asunto</span>
          <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Necesito activar SSL" required disabled={!canSubmit || loading} />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Descripción</span>
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cuéntanos qué pasa" rows={5} disabled={!canSubmit || loading} required />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-white/60">Prioridad</span>
          <select
            className="input w-full bg-black/40"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={!canSubmit || loading}
          >
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/50">Se enviará a /api/tickets con tus client_id y saas_id reales.</p>
          <Button type="submit" loading={loading} disabled={!canSubmit || loading}>
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </form>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-base font-semibold">Tickets recientes</h2>
        {tickets.length === 0 ? (
          <p className="mt-2 text-sm text-white/70">No hay tickets registrados todavía.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            {tickets.slice(0, 5).map((ticket) => (
              <li key={ticket.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{ticket.subject}</span>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">{ticket.status}</span>
                </div>
                <p className="text-xs text-white/60">Priority: {ticket.priority}</p>
                {ticket.description && <p className="mt-1 text-white/70 line-clamp-2">{ticket.description}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">{new Date(ticket.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
