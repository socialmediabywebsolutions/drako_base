export type SocialFlowTenantIsolationFailureReason =
  | "HEADER_TENANT_MISMATCH"
  | "AUTH_USER_MISSING"
  | "AUTH_USER_TENANT_MISMATCH";

export type SocialFlowTenantIsolationInput = {
  sessionTenantId: string;
  headerTenantId?: string | null;
  authUserTenantId?: string | null;
  requireAuthUser?: boolean;
};

export type SocialFlowTenantIsolationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: SocialFlowTenantIsolationFailureReason;
      details: {
        sessionTenantId: string;
        headerTenantId: string | null;
        authUserTenantId: string | null;
      };
    };

export function readTenantIdFromHeaderGetter(
  getHeader: (name: string) => string | null | undefined,
): string | null {
  return getHeader("x-drako-tenant-id") ?? getHeader("x-tenant-id") ?? null;
}

export function validateSocialFlowTenantIsolation(
  input: SocialFlowTenantIsolationInput,
): SocialFlowTenantIsolationResult {
  const headerTenantId = input.headerTenantId ?? null;
  const authUserTenantId = input.authUserTenantId ?? null;

  if (headerTenantId && headerTenantId !== input.sessionTenantId) {
    return {
      ok: false,
      reason: "HEADER_TENANT_MISMATCH",
      details: {
        sessionTenantId: input.sessionTenantId,
        headerTenantId,
        authUserTenantId,
      },
    };
  }

  if (input.requireAuthUser && !authUserTenantId) {
    return {
      ok: false,
      reason: "AUTH_USER_MISSING",
      details: {
        sessionTenantId: input.sessionTenantId,
        headerTenantId,
        authUserTenantId,
      },
    };
  }

  if (authUserTenantId && authUserTenantId !== input.sessionTenantId) {
    return {
      ok: false,
      reason: "AUTH_USER_TENANT_MISMATCH",
      details: {
        sessionTenantId: input.sessionTenantId,
        headerTenantId,
        authUserTenantId,
      },
    };
  }

  return { ok: true };
}
