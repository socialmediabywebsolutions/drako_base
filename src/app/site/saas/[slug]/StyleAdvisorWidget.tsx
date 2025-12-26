"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { Field, TextInput } from "@/components/ui/input";
import type { CustomerServiceSuggestion } from "@/lib/agents/customer-partner";

type StyleAdvisorWidgetProps = {
  saasId: string;
  onSelectService?: (serviceId: string) => void;
};

type AdvisorForm = {
  fullName: string;
  email: string;
  phone: string;
  hairLength: string;
  hairType: string;
  riskLevel: string;
  eventType: string;
  budgetMin: string;
  budgetMax: string;
};

const HAIR_LENGTH = [
  { value: "SHORT", label: "Corto" },
  { value: "MEDIUM", label: "Medio" },
  { value: "LONG", label: "Largo" },
];

const HAIR_TYPE = [
  { value: "STRAIGHT", label: "Liso" },
  { value: "WAVY", label: "Ondulado" },
  { value: "CURLY", label: "Rizado" },
];

const RISK_LEVEL = [
  { value: "LOW", label: "Tranquilo" },
  { value: "MEDIUM", label: "Equilibrado" },
  { value: "HIGH", label: "Atrevido" },
];

const EVENT_TYPE = [
  { value: "daily", label: "Día a día" },
  { value: "job", label: "Trabajo" },
  { value: "party", label: "Fiesta" },
  { value: "wedding", label: "Boda" },
];

export default function StyleAdvisorWidget({ saasId, onSelectService }: StyleAdvisorWidgetProps) {
  const [form, setForm] = useState<AdvisorForm>({
    fullName: "",
    email: "",
    phone: "",
    hairLength: "MEDIUM",
    hairType: "STRAIGHT",
    riskLevel: "LOW",
    eventType: "daily",
    budgetMin: "",
    budgetMax: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [suggestions, setSuggestions] = useState<CustomerServiceSuggestion[]>([]);
  const [advice, setAdvice] = useState<string | null>(null);

  function updateField<K extends keyof AdvisorForm>(key: K, value: AdvisorForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) return;
    setStatus("saving");
    setSuggestions([]);
    setAdvice(null);
    try {
      const res = await fetch("/api/customer-partner/ensure-and-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          styleProfile: {
            hairLength: form.hairLength,
            hairType: form.hairType,
            riskLevel: form.riskLevel,
            eventType: form.eventType,
          },
          budgetRange: {
            min: form.budgetMin ? Number(form.budgetMin) : null,
            max: form.budgetMax ? Number(form.budgetMax) : null,
          },
          eventType: form.eventType,
        }),
      });
      if (!res.ok) {
        throw new Error("STYLE_ADVISOR_FAILED");
      }
      const json = (await res.json().catch(() => null)) as {
        suggestions?: CustomerServiceSuggestion[];
        advice?: string;
      } | null;
      setSuggestions(json?.suggestions ?? []);
      setAdvice(json?.advice ?? null);
      setStatus("success");
    } catch (error) {
      console.error("STYLE_ADVISOR_ERROR", error);
      setStatus("error");
    }
  }

  function renderBadge(label: string, variant: "ok" | "warn" | "err" | "neutral") {
    return <Badge variant={variant}>{label}</Badge>;
  }

  return (
    <div className="rounded-[32px] border border-[#ead2bf] bg-white/85 p-6 shadow-xl">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[#8a5c3e]">Tu asesor de estilo</p>
        <h3 className="text-2xl font-semibold text-[#2f1b13]">Define tu look ideal</h3>
        <p className="text-sm text-[#6b4c3b]">Responde 4 preguntas y recibes opciones sin riesgo de stock.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre">
            <TextInput value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required />
          </Field>
          <Field label="Email">
            <TextInput value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
          </Field>
          <Field label="Teléfono (opcional)">
            <TextInput value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
          </Field>
          <Field label="Longitud de pelo">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.hairLength}
              onChange={(event) => updateField("hairLength", event.target.value)}
            >
              {HAIR_LENGTH.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de pelo">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.hairType}
              onChange={(event) => updateField("hairType", event.target.value)}
            >
              {HAIR_TYPE.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nivel de riesgo">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.riskLevel}
              onChange={(event) => updateField("riskLevel", event.target.value)}
            >
              {RISK_LEVEL.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evento">
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={form.eventType}
              onChange={(event) => updateField("eventType", event.target.value)}
            >
              {EVENT_TYPE.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Presupuesto mínimo">
            <TextInput
              type="number"
              min="0"
              value={form.budgetMin}
              onChange={(event) => updateField("budgetMin", event.target.value)}
              placeholder="40"
            />
          </Field>
          <Field label="Presupuesto máximo">
            <TextInput
              type="number"
              min="0"
              value={form.budgetMax}
              onChange={(event) => updateField("budgetMax", event.target.value)}
              placeholder="120"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Analizando..." : "Obtener sugerencias"}
          </Button>
          {status === "success" && <span className="text-sm text-emerald-600">Listo, revisa tus opciones.</span>}
          {status === "error" && <span className="text-sm text-red-500">No se pudieron generar sugerencias.</span>}
        </div>
      </form>

      {(advice || suggestions.length > 0) && (
        <div className="mt-6 space-y-3">
          {advice && <p className="text-sm text-[#6b4c3b]">{advice}</p>}
          {suggestions.map((suggestion) => (
            <div key={suggestion.serviceId} className="rounded-2xl border border-[#f1dfcf] bg-[#fff8f2] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#2f1b13]">{suggestion.title}</p>
                  <p className="text-xs text-[#6b4c3b]">
                    {suggestion.estimatedDuration} min · {suggestion.price.toFixed(2)} €
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {renderBadge("Stock OK", "ok")}
                  {renderBadge(
                    suggestion.marginStatus === "OK" ? "OK" : suggestion.marginStatus === "LOW_MARGIN" ? "Margen bajo" : "Pérdidas",
                    suggestion.marginStatus === "OK" ? "ok" : suggestion.marginStatus === "LOW_MARGIN" ? "warn" : "err",
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-[#6b4c3b]">{suggestion.reason}</p>
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectService?.(suggestion.serviceId)}
                >
                  Reservar este servicio
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
