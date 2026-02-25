import type { AuthsContext, AuthsCookieConfig } from "@/lib/auths/types";

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 8;

const COOKIE_CONFIGS: Record<AuthsContext, AuthsCookieConfig> = {
  drakos: {
    cookieName: "drakos_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
  },
  mentorias: {
    cookieName: "mentorias_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
  },
  bases: {
    cookieName: "bases_session",
    cookiePath: "/",
    sameSite: "lax",
    secure: true,
    httpOnly: true,
    maxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
  },
};

export function getAuthsCookieConfig(context: AuthsContext): AuthsCookieConfig {
  return COOKIE_CONFIGS[context];
}

export function getAuthsCookieName(context: AuthsContext): string {
  return COOKIE_CONFIGS[context].cookieName;
}

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
