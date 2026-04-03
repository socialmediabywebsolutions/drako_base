/**
 * Canonical minimum vocabulary for auth/tenant isolation.
 *
 * This file defines the stable contracts for:
 * - auth contexts
 * - isolated session claims
 * - cookie configuration by context
 *
 * It intentionally does not canonize runtime exceptions such as NextAuth
 * operator sessions, local demo flows, legacy cookies, or DB fallback paths.
 */
export type AuthsContext = "drakos" | "mentorias" | "socialflow" | "bases";

export type AuthsRole = "admin" | "user";

export type AuthsCookieSameSite = "lax" | "strict" | "none";

export type AuthsCookieConfig = {
  cookieName: string;
  cookiePath: string;
  sameSite: AuthsCookieSameSite;
  secure: boolean;
  httpOnly: boolean;
  maxAgeSeconds: number;
};

export type AuthsSaasSlug = "drako" | "mentorias" | "socialflow" | "campo_base";

export type AuthsSessionClaims = {
  sub: string;
  email: string;
  tenantId: string;
  role: AuthsRole;
  saasSlug: AuthsSaasSlug;
  context: AuthsContext;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

/**
 * Auxiliary telemetry contracts.
 *
 * These remain in this file for compatibility, but they are outside the
 * minimum auth/tenant isolation contract canonized in this phase.
 */
export type TelemetriesEventName = "user_registered" | "subscription_changed" | "usage_reported";

export type TelemetriesEvent = {
  eventName: TelemetriesEventName;
  saasSlug: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};
