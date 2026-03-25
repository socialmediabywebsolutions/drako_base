export function nowIso(): string {
  return new Date().toISOString();
}

export function generateId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    ? `${prefix}_${globalThis.crypto.randomUUID()}`
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}
