import { normalizeHost } from "@shared-neutral/hosts";
import { getSocialFlowRuntimeCookieNames } from "../runtime-contract";

export const SOCIALFLOW_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

const { canonical: CANONICAL_COOKIE_NAME } = getSocialFlowRuntimeCookieNames();
const LOCAL_COOKIE_HOSTS = new Set(["127.0.0.1", "localhost"]);

type CookieConfig = {
  cookieName: string;
  cookiePath: string;
  sameSite: "lax";
  secure: boolean;
  httpOnly: boolean;
  maxAgeSeconds: number;
};

function getLocalCookieName(cookieName: string): string {
  return cookieName.startsWith("__Host-") ? cookieName.slice("__Host-".length) : cookieName;
}

function resolveRuntimeHosts(runtime?: Request | URL | Headers | string | null): string[] {
  if (!runtime) return [];

  if (typeof runtime === "string") {
    return [normalizeHost(runtime)];
  }

  if (runtime instanceof URL) {
    return [normalizeHost(runtime.host)];
  }

  if (runtime instanceof Headers) {
    return [
      normalizeHost(runtime.get("x-forwarded-host") ?? ""),
      normalizeHost(runtime.get("host") ?? ""),
    ];
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

function isLocalCookieRuntime(runtime?: Request | URL | Headers | string | null): boolean {
  return resolveRuntimeHosts(runtime).some((host) => LOCAL_COOKIE_HOSTS.has(host));
}

export function getSocialFlowCookieConfig(runtime?: Request | URL | Headers | string | null): CookieConfig {
  const isLocal = isLocalCookieRuntime(runtime);

  return {
    cookieName: isLocal ? getLocalCookieName(CANONICAL_COOKIE_NAME) : CANONICAL_COOKIE_NAME,
    cookiePath: "/",
    sameSite: "lax",
    secure: !isLocal,
    httpOnly: true,
    maxAgeSeconds: SOCIALFLOW_COOKIE_MAX_AGE_SECONDS,
  };
}

export function getSocialFlowCookieName(runtime?: Request | URL | Headers | string | null): string {
  return getSocialFlowCookieConfig(runtime).cookieName;
}

export function getSocialFlowCookieCandidateNames(runtime?: Request | URL | Headers | string | null): string[] {
  const canonical = CANONICAL_COOKIE_NAME;
  if (!isLocalCookieRuntime(runtime)) {
    return [canonical];
  }

  const localName = getLocalCookieName(canonical);
  return localName === canonical ? [canonical] : [localName, canonical];
}

export function readCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(/;\s*/)) {
    const [cookieName, ...rest] = part.split("=");
    if (cookieName === name) {
      return rest.join("=");
    }
  }

  return null;
}
