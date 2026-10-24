import { vi } from "vitest";

class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

export const factoryCreateSaasMocks = {
  extractSessionFromRequest: vi.fn(),
  authorizeSaasAccess: vi.fn(),
  requireOwnerAccess: vi.fn(),
  requireTenantAccess: vi.fn(),
  ensureCampamentoBase: vi.fn(),
  domainFetchImpl: vi.fn(),
  UnauthorizedError,
};

vi.mock("@/lib/edge-auth", () => ({
  extractSessionFromRequest: factoryCreateSaasMocks.extractSessionFromRequest,
}));

vi.mock("@/lib/authz/saas-access", () => ({
  authorizeSaasAccess: factoryCreateSaasMocks.authorizeSaasAccess,
}));

vi.mock("@/lib/auth/session", () => ({
  requireOwnerAccess: factoryCreateSaasMocks.requireOwnerAccess,
  requireTenantAccess: factoryCreateSaasMocks.requireTenantAccess,
  UnauthorizedError: factoryCreateSaasMocks.UnauthorizedError,
}));

vi.mock("@/lib/campamento-base", () => ({
  ensureCampamentoBase: factoryCreateSaasMocks.ensureCampamentoBase,
}));

vi.mock("@/lib/domains/domain-provider", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/domains/domain-provider")>();
  return {
    ...actual,
    createDomainBinding: (input: Parameters<typeof actual.createDomainBinding>[0]) =>
      actual.createDomainBinding({
        ...input,
        fetchImpl: factoryCreateSaasMocks.domainFetchImpl as unknown as typeof fetch,
      }),
    verifyDomainBinding: (input: Parameters<typeof actual.verifyDomainBinding>[0]) =>
      actual.verifyDomainBinding({
        ...input,
        fetchImpl: factoryCreateSaasMocks.domainFetchImpl as unknown as typeof fetch,
      }),
    deleteDomainBinding: (input: Parameters<typeof actual.deleteDomainBinding>[0]) =>
      actual.deleteDomainBinding({
        ...input,
        fetchImpl: factoryCreateSaasMocks.domainFetchImpl as unknown as typeof fetch,
      }),
  };
});

export function setupFactoryCreateSaasOwnerMocks() {
  vi.clearAllMocks();
  factoryCreateSaasMocks.ensureCampamentoBase.mockResolvedValue(undefined);
  factoryCreateSaasMocks.extractSessionFromRequest.mockResolvedValue({
    userId: "owner_user",
    email: "owner@drako.systems",
    tenantId: "tenant_owner",
    role: "admin",
    iat: 1,
    exp: 9_999_999_999,
  });
  factoryCreateSaasMocks.authorizeSaasAccess.mockResolvedValue({ authorized: true });
  factoryCreateSaasMocks.requireOwnerAccess.mockResolvedValue({ tenantId: "tenant_owner" });
  factoryCreateSaasMocks.requireTenantAccess.mockResolvedValue({
    tenantId: "tenant_owner",
    session: {
      email: "owner@drako.systems",
      tenantId: "tenant_owner",
      role: "admin",
      issuedAt: Date.now(),
    },
  });
}
