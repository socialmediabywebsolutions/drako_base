"use client";

import { useState } from "react";
import type { ActiveHoursConfig, ActiveHoursDay, ConversationSettings } from "@/lib/socialflow/conversational/types";

type Props = {
  saasId: string;
  autoSendEnabled: boolean;
  initialActiveHoursJson: string | null;
  onSaved?: (settings: ConversationSettings) => void;
};

const DAY_ORDER: (keyof ActiveHoursConfig["schedule"])[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Europe/Madrid", label: "Madrid (España)" },
  { value: "Europe/Lisbon", label: "Lisboa (Portugal)" },
  { value: "Europe/London", label: "Londres (Reino Unido)" },
  { value: "Europe/Paris", label: "París (Francia)" },
  { value: "Europe/Berlin", label: "Berlín (Alemania)" },
  { value: "Europe/Rome", label: "Roma (Italia)" },
  { value: "America/Mexico_City", label: "Ciudad de México (México)" },
  { value: "America/Bogota", label: "Bogotá (Colombia)" },
  { value: "America/Lima", label: "Lima (Perú)" },
  { value: "America/Santiago", label: "Santiago (Chile)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (Argentina)" },
  { value: "America/Sao_Paulo", label: "São Paulo (Brasil)" },
  { value: "America/Caracas", label: "Caracas (Venezuela)" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/Santo_Domingo", label: "Santo Domingo (Rep. Dominicana)" },
];

function defaultDay(active: boolean): ActiveHoursDay {
  return { active, from: "09:00", to: "14:00" };
}

function defaultConfig(): ActiveHoursConfig {
  return {
    enabled: false,
    timezone: "Europe/Madrid",
    schedule: {
      monday: defaultDay(true),
      tuesday: defaultDay(true),
      wednesday: defaultDay(true),
      thursday: defaultDay(true),
      friday: defaultDay(true),
      saturday: defaultDay(false),
      sunday: defaultDay(false),
    },
    outside_hours_message: "Gracias por tu mensaje, te respondemos en horario de atención (L-V 9:00-14:00).",
  };
}

function parseConfig(json: string | null): ActiveHoursConfig {
  if (!json) return defaultConfig();
  try {
    const parsed = JSON.parse(json) as Partial<ActiveHoursConfig>;
    const base = defaultConfig();
    return {
      enabled: parsed.enabled ?? base.enabled,
      timezone: parsed.timezone ?? base.timezone,
      schedule: { ...base.schedule, ...(parsed.schedule ?? {}) },
      outside_hours_message: parsed.outside_hours_message ?? base.outside_hours_message,
    };
  } catch {
    return defaultConfig();
  }
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-blue-500" : "bg-gray-300",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function AgentSchedulePanel({ saasId, autoSendEnabled, initialActiveHoursJson, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ActiveHoursConfig>(() => parseConfig(initialActiveHoursJson));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateDay(day: (typeof DAY_ORDER)[number], patch: Partial<ActiveHoursDay>) {
    setSaved(false);
    setConfig((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], ...patch } },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/socialflow/conversations/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          autoSendEnabled,
          activeHoursJson: JSON.stringify(config),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: ConversationSettings; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el horario");
      setSaved(true);
      if (data.settings) onSaved?.(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el horario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">Horario del Agente</span>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-medium",
              config.enabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500",
            ].join(" ")}
          >
            {config.enabled ? "Activado" : "24/7"}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-200 px-5 pb-5 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Limitar respuestas automáticas a un horario</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Si está desactivado, el agente responde 24/7 (comportamiento por defecto).
              </p>
            </div>
            <Toggle
              checked={config.enabled}
              onChange={() => {
                setSaved(false);
                setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
              }}
            />
          </div>

          {config.enabled && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Zona horaria</p>
                <select
                  value={config.timezone}
                  onChange={(e) => {
                    setSaved(false);
                    setConfig((prev) => ({ ...prev, timezone: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Días y horas activas</p>
                <div className="space-y-1.5">
                  {DAY_ORDER.map((day) => {
                    const d = config.schedule[day];
                    return (
                      <div
                        key={day}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <Toggle checked={d.active} onChange={() => updateDay(day, { active: !d.active })} />
                        <span className="w-24 text-sm text-gray-600">{DAY_LABELS[day]}</span>
                        <input
                          type="time"
                          value={d.from}
                          disabled={!d.active}
                          onChange={(e) => updateDay(day, { from: e.target.value })}
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-40"
                        />
                        <span className="text-xs text-gray-400">a</span>
                        <input
                          type="time"
                          value={d.to}
                          disabled={!d.active}
                          onChange={(e) => updateDay(day, { to: e.target.value })}
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 disabled:opacity-40"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Mensaje fuera de horario (opcional)
                </p>
                <textarea
                  value={config.outside_hours_message ?? ""}
                  onChange={(e) => {
                    setSaved(false);
                    setConfig((prev) => ({ ...prev, outside_hours_message: e.target.value || null }));
                  }}
                  rows={2}
                  placeholder="Gracias por tu mensaje, te respondemos en horario de atención…"
                  className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <p className="text-xs text-gray-400">
                  Si lo dejas vacío, fuera de horario los comentarios quedan en cola para aprobación manual en vez de
                  enviarse automáticamente.
                </p>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {saved && !error && <p className="text-xs text-emerald-600">Horario guardado.</p>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      )}
    </div>
  );
}
