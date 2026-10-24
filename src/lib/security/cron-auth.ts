import { env as resolveEnv } from "@/lib/cf";

export class CronAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "CronAuthError";
    this.status = status;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function readSecret(name: "CRON_SECRET" | "INTERNAL_API_SECRET"): string | null {
  const runtimeEnv = resolveEnv();
  const envValue = runtimeEnv
    ? (runtimeEnv as Record<string, unknown>)[name]
    : undefined;
  const raw =
    typeof envValue === "string"
      ? envValue
      : (typeof process !== "undefined" ? process.env[name] : undefined);
  if (!raw) return null;
  const value = raw.trim();
  if (value.length < 16) {
    throw new CronAuthError(`${name} is too short for production-grade auth`, 503);
  }
  return value;
}

function resolveIncomingToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const internalHeader = request.headers.get("x-drako-internal-token")?.trim();
  if (internalHeader) return internalHeader;

  const legacyHeader = request.headers.get("x-drako-origin-secret")?.trim();
  if (legacyHeader) return legacyHeader;

  return null;
}

export function verifyCronAuth(request: Request): { ok: true } {
  const incomingToken = resolveIncomingToken(request);
  if (!incomingToken) {
    throw new CronAuthError("Missing internal auth token", 401);
  }

  const configuredSecrets = [readSecret("CRON_SECRET"), readSecret("INTERNAL_API_SECRET")].filter(
    (value): value is string => Boolean(value),
  );

  if (configuredSecrets.length === 0) {
    throw new CronAuthError("CRON_SECRET or INTERNAL_API_SECRET must be configured", 503);
  }

  const matched = configuredSecrets.some((secret) => constantTimeEqual(secret, incomingToken));
  if (!matched) {
    throw new CronAuthError("Invalid internal auth token", 401);
  }

  return { ok: true };
}
