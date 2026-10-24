/**
 * Auth propia de SocialCors (P5). Copia de la rama "socialflow" de src/lib/auths/*,
 * sin el multi-contexto del holding.
 *
 * Contrato que NO puede cambiar mientras convivan ambas implementaciones (los golden
 * tests de tests/lib/socialflow-platform-auth-compat.test.ts lo verifican):
 * - cookie __Host-socialflow_session (socialflow_session en localhost)
 * - JWT HS256 firmado con SOCIALFLOW_AUTHS_SECRET (fallback SESSION_SECRET)
 * - iss "socialflow.auths", aud "socialflow.apps", context "socialflow", saasSlug "socialflow"
 * - tablas socialflow_users / socialflow_credentials / socialflow_sessions en SOCIALFLOW_AUTHS_DB
 * - PBKDF2-SHA256, 100.000 iteraciones, sal de 16 bytes
 */
export type SocialFlowAuthRole = "owner" | "admin" | "user";

export type SocialFlowSessionClaims = {
  sub: string;
  email: string;
  tenantId: string;
  role: SocialFlowAuthRole;
  saasSlug: "socialflow";
  context: "socialflow";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type SocialFlowCookieConfig = {
  cookieName: string;
  cookiePath: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  httpOnly: boolean;
  maxAgeSeconds: number;
};

export type SocialFlowAuthUserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: SocialFlowAuthRole;
  tenant_id: string;
  status: string;
};

export type SocialFlowAuthCredentialRecord = {
  id: string;
  user_id: string;
  type: string;
  hash: string;
  salt: string;
  iterations: number;
  algo: string;
};
