import type { ActiveHoursConfig, ActiveHoursDay } from "@/lib/socialflow/conversational/types";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function parseActiveHours(activeHoursJson: string | null): ActiveHoursConfig | null {
  if (!activeHoursJson) return null;
  try {
    return JSON.parse(activeHoursJson) as ActiveHoursConfig;
  } catch {
    return null;
  }
}

// NULL/enabled=false → true (responde siempre, comportamiento actual). Cualquier fallo
// de parseo (JSON inválido, timezone IANA inválido) también degrada a true — un
// horario mal configurado nunca debe bloquear el pipeline de respuesta, solo dejar de
// aplicar el filtro.
export function isWithinActiveHours(activeHoursJson: string | null): boolean {
  const config = parseActiveHours(activeHoursJson);
  if (!config || !config.enabled) return true;

  let parts: Record<string, string>;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  } catch {
    return true;
  }

  const weekday = parts.weekday?.toLowerCase();
  if (!weekday || !DAY_KEYS.includes(weekday as (typeof DAY_KEYS)[number])) return true;

  const dayConfig = (config.schedule as Record<string, ActiveHoursDay | undefined>)[weekday];
  if (!dayConfig || !dayConfig.active || !dayConfig.from || !dayConfig.to) return false;

  // Intl con hour12:false puede devolver "24" para medianoche en algunos runtimes —
  // se normaliza a "00" antes de comparar como string "HH:MM".
  const hourPart = parts.hour === "24" ? "00" : parts.hour;
  const currentTime = `${hourPart}:${parts.minute}`;

  return currentTime >= dayConfig.from && currentTime <= dayConfig.to;
}

export function getOutsideHoursMessage(activeHoursJson: string | null): string | null {
  const config = parseActiveHours(activeHoursJson);
  if (!config) return null;
  return config.outside_hours_message?.trim() || null;
}
