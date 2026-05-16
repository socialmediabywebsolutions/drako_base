export type SocialFlowRole = "admin" | "user";

export type SocialFlowAuthUserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: SocialFlowRole;
  tenant_id: string;
  status: string;
};

export type SocialFlowAuthCredentialRecord = {
  user_id: string;
  hash: string;
  salt: string;
  iterations: number;
  algo: string;
};

export type SocialFlowSessionClaims = {
  sub: string;
  email: string;
  tenantId: string;
  role: SocialFlowRole;
  saasSlug: "socialflow";
  context: "socialflow";
  iss: "socialflow.auths";
  aud: "socialflow.apps";
  iat: number;
  exp: number;
  jti: string;
};

export type SocialFlowRequestSession = {
  userId: string;
  email: string;
  tenantId: string;
  role: SocialFlowRole;
};

export type SocialFlowSession = SocialFlowRequestSession & {
  name: string | null;
  authMode: "isolated";
};
