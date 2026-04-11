import type { AuthsContext, AuthsCookieConfig } from "@/lib/auths/types";
import { normalizeHost } from "@/lib/hosts";

/**
 * Canonical cookie lifetime for isolated auth sessions.
 *
 * This belongs to the minimum auth/tenant isolation contract.
 */
export const AUTHS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function freezeCookieConfig(config: AuthsCookieConfig): Readonly<AuthsCookieConfig> {
  return Object.freeze({ ...config });
}

const LOCAL_COOKIE_HOSTS = new Set(["127.0.0.1", "localhost"]);

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

/**
 * Canonical isolated cookie configs by auth context.
 *
 * This map is the official naming/config reference for the minimum
 * auth/tenant isolation contract. Legacy cookies and compatibility modes are
 * intentionally outside this surface.
 */
export const AUTHS_COOKIE_CONFIGS: Readonly<Record<AuthsContext, Readonly<AuthsCookieConfig>>> = Object.freeze({
  drakos: freezeCookieConfig({
    cookieName: "__Host-drakos_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
  }),
  mentorias: freezeCookieConfig({
    cookieName: "__Host-mentorias_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
  }),
  socialflow: freezeCookieConfig({
    cookieName: "__Host-socialflow_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
  }),
  bases: freezeCookieConfig({
    cookieName: "__Host-bases_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
  }),
});

function buildRuntimeCookieConfig(
  config: Readonly<AuthsCookieConfig>,
  runtime?: Request | URL | Headers | string | null,
): AuthsCookieConfig {
  if (!isLocalCookieRuntime(runtime)) {
    return { ...config };
  }

  return {
    ...config,
    cookieName: getLocalCookieName(config.cookieName),
    secure: false,
  };
}

/**
 * Canonical cookie config lookup by auth context.
 */
export function getAuthsCookieConfig(
  context: AuthsContext,
  runtime?: Request | URL | Headers | string | null,
): AuthsCookieConfig {
  return buildRuntimeCookieConfig(AUTHS_COOKIE_CONFIGS[context], runtime);
}

/**
 * Canonical isolated cookie name lookup by auth context.
 */
export function getAuthsCookieName(
  context: AuthsContext,
  runtime?: Request | URL | Headers | string | null,
): string {
  return getAuthsCookieConfig(context, runtime).cookieName;
}

export function getAuthsCookieCandidateNames(
  context: AuthsContext,
  runtime?: Request | URL | Headers | string | null,
): string[] {
  const canonicalName = AUTHS_COOKIE_CONFIGS[context].cookieName;
  if (!isLocalCookieRuntime(runtime)) {
    return [canonicalName];
  }

  const localName = getLocalCookieName(canonicalName);
  return localName === canonicalName ? [canonicalName] : [localName, canonicalName];
}

/**
 * Compatibility helper for reading cookies from raw headers.
 *
 * This helper remains useful for current runtime code, but it is not part of
 * the minimum canonized naming/config contract.
 */
export function readCookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(/;\s*/);
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName === name) {
      return rest.join("=");
    }
  }
  return null;
}
