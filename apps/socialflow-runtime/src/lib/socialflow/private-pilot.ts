import { getSocialFlowRuntimeEnv } from "../runtime-env";

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseTenantAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function readEnvString(name: string) {
  const env = getSocialFlowRuntimeEnv() as Record<string, unknown> | null;
  const value = env?.[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof process !== "undefined" && process.env) {
    const fromProcess = process.env[name];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }
  }

  return undefined;
}

function resolveRuntimePrivatePilotPolicy() {
  const enabled = isTruthyFlag(readEnvString("SOCIALFLOW_PRIVATE_PILOT_MODE"));
  const allowlist = parseTenantAllowlist(readEnvString("SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST"));
  return { enabled, allowlist };
}

export function isRuntimePrivatePilotModeEnabled(): boolean {
  return resolveRuntimePrivatePilotPolicy().enabled;
}

export function isRuntimeTenantAllowedInPrivatePilot(tenantId: string): boolean {
  const policy = resolveRuntimePrivatePilotPolicy();
  if (!policy.enabled) return true;
  return policy.allowlist.has(tenantId);
}

export function isRuntimeAutoPublishBlockedByPrivatePilotMode(): boolean {
  return resolveRuntimePrivatePilotPolicy().enabled;
}

