import { env as resolveEnv, type DracoEnv } from "@/lib/cf";

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

function resolvePolicy(envOverride?: DracoEnv | null) {
  const runtimeEnv = envOverride ?? resolveEnv();
  const enabled = isTruthyFlag(runtimeEnv?.SOCIALFLOW_PRIVATE_PILOT_MODE);
  const allowlist = parseTenantAllowlist(runtimeEnv?.SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST);

  return {
    enabled,
    allowlist,
  };
}

export function isPrivatePilotModeEnabled(envOverride?: DracoEnv | null): boolean {
  return resolvePolicy(envOverride).enabled;
}

export function isTenantAllowedInPrivatePilot(tenantId: string, envOverride?: DracoEnv | null): boolean {
  const policy = resolvePolicy(envOverride);
  if (!policy.enabled) return true;
  return policy.allowlist.has(tenantId);
}

export function isAutoPublishBlockedByPrivatePilotMode(envOverride?: DracoEnv | null): boolean {
  return resolvePolicy(envOverride).enabled;
}
