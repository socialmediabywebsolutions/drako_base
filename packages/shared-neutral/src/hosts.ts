export function normalizeHost(value: string): string {
  const raw = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = raw.split(":")[0] ?? "";
  return host.startsWith("www.") ? host.slice(4) : host;
}

export type HostMode = "PUBLIC_SAAS" | "CAMPAMENTO_BASE" | "PREVIEW";

export function resolveHostMode(
  hostname: string,
  pagesEnvironment: string | null | undefined = null,
): HostMode {
  const normalizedEnv = (pagesEnvironment ?? "").trim().toLowerCase();
  if (normalizedEnv === "preview") {
    return "PREVIEW";
  }

  const host = normalizeHost(hostname);
  if (host === "base.drako.systems" || host === "bases.drako.systems" || host === "admin.drako.systems") {
    return "CAMPAMENTO_BASE";
  }

  return "PUBLIC_SAAS";
}
