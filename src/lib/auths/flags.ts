import { env as resolveEnv } from "@/lib/cf";

function readFlag(name: string, defaultValue = false): boolean {
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

export function isAuthsLegacyCompatEnabled(): boolean {
  return readFlag("AUTHS_LEGACY_COMPATS_ENABLED", true);
}

export function isAuthsLegacyRegisterEnabled(): boolean {
  return readFlag("AUTHS_LEGACY_REGISTER_ENABLED", false);
}

export function isRoutingsSubdomainsEnabled(): boolean {
  return readFlag("ROUTINGS_SUBDOMAINS_ENABLED", true);
}

export function isTelemetriesHoldingEnabled(): boolean {
  return readFlag("TELEMETRIES_HOLDING_ENABLED", true);
}
