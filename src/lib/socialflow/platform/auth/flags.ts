import { env as resolveEnv } from "@/lib/cf";

// Mismas vars y mismos valores por defecto que src/lib/auths/flags.ts.

function readFlag(name: string, defaultValue: boolean): boolean {
  const cfEnv = resolveEnv();
  const fromBindings = cfEnv && typeof (cfEnv as Record<string, unknown>)[name] === "string"
    ? String((cfEnv as Record<string, unknown>)[name])
    : undefined;
  const raw = fromBindings ?? (typeof process !== "undefined" ? process.env[name] : undefined);
  if (!raw) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function isAuthsIsolationEnabled(): boolean {
  return readFlag("AUTHS_ISOLATIONS_ENABLED", true);
}

export function isTelemetriesHoldingEnabled(): boolean {
  return readFlag("TELEMETRIES_HOLDING_ENABLED", true);
}
