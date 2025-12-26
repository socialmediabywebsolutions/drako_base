"use client";

import { useState } from "react";

type LeadFormProps = {
  slug: string;
  services: Array<{ id: string; name: string }>;
};

export default function LeadCaptureForm({ slug, services }: LeadFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: services[0]?.name ?? "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/site/clinic/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          service: form.service || null,
          message: form.message || null,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      setStatus("success");
      setForm({ name: "", email: "", phone: "", service: services[0]?.name ?? "", message: "" });
    } catch (err) {
      console.error("LEAD_FORM_ERROR", err);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-md">
      <label className="text-sm font-medium text-white/90">
        Nombre completo
        <input
          className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder-white/60"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-white/90">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder-white/60"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label className="text-sm font-medium text-white/90">
          Teléfono
          <input
            className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder-white/60"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </label>
      </div>
      <label className="text-sm font-medium text-white/90">
        Servicio
        <select
          className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder-white/60"
          value={form.service}
          onChange={(e) => setForm((prev) => ({ ...prev, service: e.target.value }))}
        >
          {services.map((service) => (
            <option key={service.id} value={service.name}>
              {service.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-white/90">
        Comentario
        <textarea
          className="mt-1 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-base text-white placeholder-white/60"
          rows={4}
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/80 disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Reservar consulta"}
      </button>
      {status === "success" && <p className="text-sm text-emerald-100">Gracias, te contactaremos en minutos.</p>}
      {status === "error" && <p className="text-sm text-red-100">No se pudo enviar tu solicitud. Inténtalo de nuevo.</p>}
    </form>
  );
}
