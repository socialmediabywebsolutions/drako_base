"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/input";
import type { SaasService } from "@/lib/economy/types";
import type { CustomerPartnerSuggestion } from "@/lib/agents/customer-partner";

type BookingFormProps = {
  saasId: string;
  services: SaasService[];
};

export default function BookingForm({ saasId, services }: BookingFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredProfessional, setPreferredProfessional] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [partnerIdeas, setPartnerIdeas] = useState<CustomerPartnerSuggestion[] | null>(null);

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName || !phone || !serviceId || !startTime) return;
    setStatus("saving");
    try {
      const noteParts = [notes.trim(), preferredProfessional.trim() ? `Preferencia profesional: ${preferredProfessional.trim()}` : null].filter(
        Boolean,
      );
      const notesPayload = noteParts.length > 0 ? noteParts.join(" | ") : null;
      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saasId, fullName, phone, email: email.trim() || null }),
      });
      const customerJson = (await customerRes.json()) as { customer?: { id: string } };
      const customerId = customerJson.customer?.id;
      if (!customerId) throw new Error("No se pudo crear el cliente");
      const service = services.find((s) => s.id === serviceId);
      const start = new Date(startTime);
      const end = new Date(start.getTime() + (service?.durationMinutes ?? 60) * 60 * 1000);
      const bookingRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}/bookings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          serviceId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: notesPayload,
          status: "REQUESTED",
          priceAtBooking: service?.currentPrice ?? null,
        }),
      });
      const bookingJson = (await bookingRes.json().catch(() => null)) as { booking?: { id?: string } } | null;
      if (!bookingRes.ok || !bookingJson?.booking?.id) {
        throw new Error("No se pudo crear la reserva");
      }
      setStatus("success");
      try {
        const partnerRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}/partner?saasId=${encodeURIComponent(saasId)}`, {
          cache: "no-store",
        });
        if (partnerRes.ok) {
          const partnerJson = (await partnerRes.json()) as { suggestions?: Record<string, CustomerPartnerSuggestion[]> };
          const suggestions = partnerJson.suggestions
            ? [
                ...(partnerJson.suggestions.STYLE ?? []),
                ...(partnerJson.suggestions.COLOR ?? []),
                ...(partnerJson.suggestions.SCHEDULING ?? []),
                ...(partnerJson.suggestions.INVENTORY ?? []),
              ]
            : [];
          setPartnerIdeas(suggestions.slice(0, 4));
        }
      } catch (error) {
        console.warn("PUBLIC_BOOKING_PARTNER_ERROR", error);
        setPartnerIdeas(null);
      }
      setFullName("");
      setPhone("");
      setEmail("");
      setServiceId("");
      setStartTime("");
      setNotes("");
      setPreferredProfessional("");
    } catch (error) {
      console.error("PUBLIC_BOOKING_ERROR", error);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submitBooking} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre completo">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Tu nombre" />
        </Field>
        <Field label="Teléfono">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+34 ..." />
        </Field>
        <Field label="Email (opcional)">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@email.com" />
        </Field>
        <Field label="Servicio">
          <select
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            <option value="">Selecciona servicio</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {service.durationMinutes} min — {service.currentPrice.toFixed(2)} €
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha y hora">
          <TextInput type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </Field>
        <Field label="Preferencia de profesional (opcional)">
          <TextInput
            value={preferredProfessional}
            onChange={(e) => setPreferredProfessional(e.target.value)}
            placeholder="Ej. Laura, colorista"
          />
        </Field>
        <Field label="Notas">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferencias rápidas" rows={2} />
        </Field>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {"// TODO: conectar Stripe / pasarela por servicio"}
        <br />
        {"// TODO: permitir a la clienta subir una foto para el partner visual"}
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Reservando..." : "Reservar"}
        </Button>
        {status === "success" && <span className="text-sm text-green-500">Reserva enviada, te contactaremos.</span>}
        {status === "error" && <span className="text-sm text-red-500">No se pudo crear la reserva.</span>}
      </div>
      {status === "success" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-3 text-sm">
          <p className="font-semibold">Ideas para ti</p>
          {partnerIdeas && partnerIdeas.length > 0 ? (
            <ul className="mt-2 space-y-2 text-[var(--muted)]">
              {partnerIdeas.map((idea, idx) => (
                <li key={`${idea.title}-${idx}`}>{idea.description}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[var(--muted)]">Gracias por tu reserva, te aconsejaremos en el salon.</p>
          )}
        </div>
      )}
    </form>
  );
}
