import type { AuthsContext, AuthsCookieConfig } from "@/lib/auths/types";

/**
 * Canonical cookie lifetime for isolated auth sessions.
 *
 * This belongs to the minimum auth/tenant isolation contract.
 */
export const AUTHS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function freezeCookieConfig(config: AuthsCookieConfig): Readonly<AuthsCookieConfig> {
  return Object.freeze({ ...config });
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

/**
 * Canonical cookie config lookup by auth context.
 */
export function getAuthsCookieConfig(context: AuthsContext): AuthsCookieConfig {
  return AUTHS_COOKIE_CONFIGS[context];
}

/**
 * Canonical isolated cookie name lookup by auth context.
 */
export function getAuthsCookieName(context: AuthsContext): string {
  return AUTHS_COOKIE_CONFIGS[context].cookieName;
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
