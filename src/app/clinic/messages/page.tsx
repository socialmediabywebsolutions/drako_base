"use client";

import { useEffect, useState } from "react";
import { ClinicNoSubscriptionState } from "@/components/clinic/no-subscription-state";
import { isNoSubscriptionError, unwrapClinicResponse } from "@/app/clinic/api-client";
import type { ClinicAppointment, ClinicLead } from "@/lib/clinic/types";

type Suggestion = { title: string; body: string; action: string };

export default function ClinicMessagesPage() {
  const [leads, setLeads] = useState<ClinicLead[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSubscription, setNoSubscription] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [leadJson, apptJson] = await Promise.all([
          unwrapClinicResponse<{ items: ClinicLead[] }>(
            await fetch("/api/clinic/leads"),
            { fallbackMessage: "No se pudieron cargar los leads" },
          ),
          unwrapClinicResponse<{ items: ClinicAppointment[] }>(
            await fetch("/api/clinic/appointments"),
            { fallbackMessage: "No se pudieron cargar las citas" },
          ),
        ]);
        if (!mounted) return;
        setLeads(leadJson?.items ?? []);
        setAppointments(apptJson?.items ?? []);
        setError(null);
        setNoSubscription(false);
      } catch (err) {
        if (!mounted) return;
        if (isNoSubscriptionError(err)) {
          setNoSubscription(true);
          setLeads([]);
          setAppointments([]);
          setError(null);
        } else {
          setError((err as Error).message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const suggestions = buildSuggestions(leads, appointments);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-5">
        <h1 className="text-xl font-semibold mb-2">Mensajes sugeridos por Drako</h1>
        <p className="text-sm text-[var(--muted)]">
          Plantillas rápidas generadas a partir de leads en frío y citas recientes. Activa estas frases en WhatsApp o correo.
        </p>
      </div>
      {noSubscription ? (
        <ClinicNoSubscriptionState />
      ) : (
        <>
          {error && <div className="rounded-2xl border border-red-400/40 bg-red-900/20 px-4 py-3 text-sm text-red-100">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            {(loading ? [] : suggestions).map((suggestion) => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => setSelected(suggestion)}
                className="rounded-3xl border border-[var(--border)] bg-[var(--background)]/80 p-4 text-left transition hover:border-[var(--brand)]/40"
              >
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{suggestion.action}</p>
              </button>
            ))}
            {!loading && suggestions.length === 0 && <p className="text-sm text-[var(--muted)]">Sin sugerencias por ahora.</p>}
          </div>

          {selected && (
            <div className="rounded-3xl border border-[var(--brand)]/50 bg-[var(--panel)]/80 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <button type="button" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>
              <textarea
                className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed"
                rows={5}
                value={selected.body}
                readOnly
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Copia el texto y pégalo en tu canal preferido.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function buildSuggestions(leads: ClinicLead[], appointments: ClinicAppointment[]): Suggestion[] {
  const coldLeads = leads.filter((lead) => lead.status === "new").slice(0, 2);
  const noShows = appointments.filter((appt) => appt.status === "no-show").slice(0, 2);
  const doneYesterday = appointments
    .filter((appt) => appt.status === "done" && Date.now() - new Date(appt.startsAt).getTime() < 1000 * 60 * 60 * 24 * 3)
    .slice(0, 2);

  const suggestions: Suggestion[] = [];

  coldLeads.forEach((lead) => {
    suggestions.push({
      title: `Lead frío · ${lead.name}`,
      action: "Mensaje de activación para lead sin respuesta",
      body: `Hola ${lead.name?.split(" ")[0] ?? ""}, soy del equipo de Drako Clinic. Nos dejaste tus datos para ${lead.interest ?? "un tratamiento"} y hoy tenemos huecos preferentes. ¿Te viene bien una llamada rápida para reservar?`,
    });
  });

  noShows.forEach((appt) => {
    suggestions.push({
      title: `No-show · ${appt.patientName}`,
      action: "Mensaje de reenganche",
      body: `Hola ${appt.patientName}, notamos que no pudiste asistir a tu cita. Guardamos un hueco esta semana para que puedas retomar sin penalización. ¿Te confirmo alguno de estos horarios?`,
    });
  });

  doneYesterday.forEach((appt) => {
    suggestions.push({
      title: `Post-tratamiento · ${appt.patientName}`,
      action: "Solicitar feedback / review",
      body: `Hola ${appt.patientName}, ¿cómo sigues tras tu sesión? Nos ayuda mucho tu feedback. Si te sentiste bien atendida, ¿podrías dejarnos una reseña rápida en Google?`,
    });
  });

  return suggestions;
}
