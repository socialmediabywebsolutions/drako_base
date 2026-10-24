import { SOCIALFLOW_SESSION_MAX_AGE_SECONDS } from "@/lib/socialflow/platform/auth/tokens";
import type { SocialFlowCookieConfig } from "@/lib/socialflow/platform/auth/types";

// Copia de src/lib/auths/cookies.ts para el contexto "socialflow": mismo nombre y
// atributos de cookie, y la misma variante sin prefijo __Host- en localhost.

export const SOCIALFLOW_SESSION_COOKIE: Readonly<SocialFlowCookieConfig> = Object.freeze({
  cookieName: "__Host-socialflow_session",
  cookiePath: "/",
  sameSite: "lax",
  secure: true,
  httpOnly: true,
  maxAgeSeconds: SOCIALFLOW_SESSION_MAX_AGE_SECONDS,
});

type CookieRuntime = Request | URL | Headers | string | null | undefined;

const LOCAL_COOKIE_HOSTS = new Set(["127.0.0.1", "localhost"]);

// Igual que normalizeHost de src/lib/hosts.ts.
function normalizeHost(value: string): string {
  const raw = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = raw.split(":")[0] ?? "";
  return host.startsWith("www.") ? host.slice(4) : host;
}

function resolveRuntimeHosts(runtime: CookieRuntime): string[] {
  if (!runtime) return [];
  if (typeof runtime === "string") return [normalizeHost(runtime)];
  if (runtime instanceof URL) return [normalizeHost(runtime.host)];
  if (runtime instanceof Headers) {
    return [normalizeHost(runtime.get("x-forwarded-host") ?? ""), normalizeHost(runtime.get("host") ?? "")];
  }
  const urlHost = (() => {
    try {
      return normalizeHost(new URL(runtime.url).host);
    } catch {
      return "";
    }
  })();
  return [
    normalizeHost(runtime.headers.get("x-forwarded-host") ?? ""),
    normalizeHost(runtime.headers.get("host") ?? ""),
    urlHost,
  ];
}

function isLocalCookieRuntime(runtime: CookieRuntime): boolean {
  return resolveRuntimeHosts(runtime).some((host) => LOCAL_COOKIE_HOSTS.has(host));
}

function getLocalCookieName(cookieName: string): string {
  return cookieName.startsWith("__Host-") ? cookieName.slice("__Host-".length) : cookieName;
}

export function getSocialFlowCookieConfig(runtime?: CookieRuntime): SocialFlowCookieConfig {
  if (!isLocalCookieRuntime(runtime)) return { ...SOCIALFLOW_SESSION_COOKIE };
  return {
    ...SOCIALFLOW_SESSION_COOKIE,
    cookieName: getLocalCookieName(SOCIALFLOW_SESSION_COOKIE.cookieName),
    secure: false,
  };
}

export function getSocialFlowCookieName(runtime?: CookieRuntime): string {
  return getSocialFlowCookieConfig(runtime).cookieName;
}

export function getSocialFlowCookieCandidateNames(runtime?: CookieRuntime): string[] {
  const canonicalName = SOCIALFLOW_SESSION_COOKIE.cookieName;
  if (!isLocalCookieRuntime(runtime)) return [canonicalName];
  const localName = getLocalCookieName(canonicalName);
  return localName === canonicalName ? [canonicalName] : [localName, canonicalName];
}

export function readCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const cookie of header.split(/;\s*/)) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) return rest.join("=");
  }
  return null;
}
