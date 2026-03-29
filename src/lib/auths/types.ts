export type AuthsContext = "drakos" | "mentorias" | "socialflow" | "bases";

export type AuthsRole = "admin" | "user";

export type AuthsCookieConfig = {
  cookieName: string;
  cookiePath: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  httpOnly: boolean;
  maxAgeSeconds: number;
};

export type AuthsSessionClaims = {
  sub: string;
  email: string;
  tenantId: string;
  role: AuthsRole;
  saasSlug: "drako" | "mentorias" | "socialflow" | "campo_base";
  context: AuthsContext;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type TelemetriesEventName = "user_registered" | "subscription_changed" | "usage_reported";

export type TelemetriesEvent = {
  eventName: TelemetriesEventName;
  saasSlug: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};
