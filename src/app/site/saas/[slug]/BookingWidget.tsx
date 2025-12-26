"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/button";
import { Field, TextArea, TextInput } from "@/components/ui/input";
import type { SaasService } from "@/lib/economy/types";
import type { CustomerServiceSuggestion } from "@/lib/agents/customer-partner";

type BookingWidgetProps = {
  saasId: string;
  services: SaasService[];
  prefillServiceId?: string | null;
  campaignId?: string | null;
  postId?: string | null;
  sourceChannel?: "SOCIAL" | "EMAIL" | "DIRECT" | "REFERRAL" | "OTHER" | null;
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  serviceId: string;
  startTime: string;
  notes: string;
  eventType: string;
  budgetMax: string;
};

const EVENT_OPTIONS = [
  { value: "", label: "Sin ocasión especial" },
  { value: "wedding", label: "Boda" },
  { value: "party", label: "Fiesta" },
  { value: "job", label: "Trabajo" },
  { value: "event", label: "Evento especial" },
];

export default function BookingWidget({ saasId, services, prefillServiceId, campaignId, postId, sourceChannel }: BookingWidgetProps) {
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    serviceId: "",
    startTime: "",
    notes: "",
    eventType: "",
    budgetMax: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [suggestions, setSuggestions] = useState<CustomerServiceSuggestion[]>([]);

  const activeServices = useMemo(() => services.filter((service) => service.isActive), [services]);

  useEffect(() => {
    if (!prefillServiceId) return;
    setForm((prev) => ({ ...prev, serviceId: prefillServiceId }));
  }, [prefillServiceId]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName || !form.phone || !form.serviceId || !form.startTime) return;
    setStatus("saving");
    setSuggestions([]);
    try {
      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          fullName: form.fullName,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          preferredServices: [form.serviceId],
          styleProfile: {
            eventType: form.eventType || null,
          },
        }),
      });
      const customerJson = (await customerRes.json().catch(() => null)) as { customer?: { id?: string } } | null;
      const customerId = customerJson?.customer?.id;
      if (!customerId) {
        throw new Error("CUSTOMER_CREATE_FAILED");
      }

      const service = activeServices.find((item) => item.id === form.serviceId);
      const start = new Date(form.startTime);
      const end = new Date(start.getTime() + (service?.durationMinutes ?? 60) * 60 * 1000);

      const appointmentRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          serviceId: form.serviceId,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          clientContact: form.email.trim() || form.phone.trim() || null,
          socialCampaignId: campaignId ?? null,
          socialPostId: postId ?? null,
          sourceChannel: sourceChannel ?? null,
          notes: form.notes.trim() || null,
          priceAtBooking: service?.currentPrice ?? null,
        }),
      });
      if (!appointmentRes.ok) {
        throw new Error("APPOINTMENT_CREATE_FAILED");
      }

      try {
        const params = new URLSearchParams({
          saasId,
          referenceServiceId: form.serviceId,
        });
        if (form.eventType) params.set("eventType", form.eventType);
        if (form.budgetMax) params.set("budgetMax", form.budgetMax);
        const suggestionRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}/suggestions?${params.toString()}`);
        const suggestionJson = (await suggestionRes.json().catch(() => null)) as { suggestions?: CustomerServiceSuggestion[] } | null;
        setSuggestions(suggestionJson?.suggestions ?? []);
      } catch (error) {
        console.warn("CUSTOMER_SUGGESTIONS_ERROR", error);
      }

      setStatus("success");
      setForm({
        fullName: "",
        email: "",
        phone: "",
        serviceId: "",
        startTime: "",
        notes: "",
        eventType: "",
        budgetMax: "",
      });
    } catch (error) {
      console.error("PUBLIC_BOOKING_ERROR", error);
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submitBooking} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nombre completo">
          <TextInput
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            required
            placeholder="Tu nombre"
          />
        </Field>
        <Field label="Teléfono">
          <TextInput value={form.phone} onChange={(event) => updateField("phone", event.target.value)} required placeholder="+34 ..." />
        </Field>
        <Field label="Email (opcional)">
          <TextInput value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="nombre@email.com" />
        </Field>
        <Field label="Servicio">
          <select
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={form.serviceId}
            onChange={(event) => updateField("serviceId", event.target.value)}
            required
          >
            <option value="">Selecciona servicio</option>
            {activeServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {service.durationMinutes} min — {service.currentPrice.toFixed(2)} €
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha y hora">
          <TextInput type="datetime-local" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} required />
        </Field>
        <Field label="Ocasión">
          <select
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            value={form.eventType}
            onChange={(event) => updateField("eventType", event.target.value)}
          >
            {EVENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Presupuesto máximo (€)">
          <TextInput
            type="number"
            min="0"
            value={form.budgetMax}
            onChange={(event) => updateField("budgetMax", event.target.value)}
            placeholder="80"
          />
        </Field>
        <Field label="Notas">
          <TextArea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Preferencias rápidas" rows={2} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Enviando..." : "Confirmar solicitud"}
        </Button>
        {status === "success" && <span className="text-sm text-emerald-600">Solicitud enviada, te confirmamos por WhatsApp/Email.</span>}
        {status === "error" && <span className="text-sm text-red-500">No se pudo enviar la solicitud.</span>}
      </div>

      {status === "success" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-4 text-sm">
          <p className="font-semibold">Tu asesor de estilo</p>
          {suggestions.length > 0 ? (
            <ul className="mt-2 space-y-2 text-[var(--muted)]">
              {suggestions.map((suggestion) => (
                <li key={suggestion.serviceId}>
                  <span className="font-medium text-[var(--foreground)]">{suggestion.title}.</span> {suggestion.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[var(--muted)]">Gracias por tu solicitud. Te enviaremos sugerencias personalizadas.</p>
          )}
        </div>
      )}
    </form>
  );
}
