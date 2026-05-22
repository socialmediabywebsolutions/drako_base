import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthsCookieName = vi.fn();
const mockVerifyAuthsSessionToken = vi.fn();
const mockGetAuthsUserById = vi.fn();
const mockReadTenantIdFromHeaderGetter = vi.fn();
const mockValidateSocialFlowTenantIsolation = vi.fn();

let headerValues: Record<string, string | null> = {};
let cookieValues: Record<string, string | undefined> = {};

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerValues[name] ?? null,
  }),
  cookies: async () => ({
    get: (name: string) => (cookieValues[name] ? { value: cookieValues[name] } : undefined),
  }),
}));

vi.mock("@/lib/auths/cookies", () => ({
  getAuthsCookieName: (...args: unknown[]) => mockGetAuthsCookieName(...args),
  readCookieFromHeader: vi.fn(),
}));

vi.mock("@/lib/auths/tokens", () => ({
  verifyAuthsSessionToken: (...args: unknown[]) => mockVerifyAuthsSessionToken(...args),
}));

vi.mock("@/lib/auths/repositories", () => ({
  getAuthsUserById: (...args: unknown[]) => mockGetAuthsUserById(...args),
}));

vi.mock("@/lib/socialflow/auth/tenant-isolation", () => ({
  readTenantIdFromHeaderGetter: (...args: unknown[]) => mockReadTenantIdFromHeaderGetter(...args),
  validateSocialFlowTenantIsolation: (...args: unknown[]) => mockValidateSocialFlowTenantIsolation(...args),
}));

import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

describe("socialflow auth server local_demo gating", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    headerValues = {};
    cookieValues = {};
    process.env = { ...originalEnv };
    mockGetAuthsCookieName.mockReturnValue("__Host-socialflow_session");
    mockReadTenantIdFromHeaderGetter.mockReturnValue("tenant-socialflow");
    mockValidateSocialFlowTenantIsolation.mockReturnValue({ ok: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("blocks local_demo mode in production when explicit allow flag is absent", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SOCIALFLOW_ALLOW_LOCAL_DEMO_AUTH;
    headerValues["x-drako-client-entry-mode"] = "local_demo";
    headerValues["x-drako-tenant-id"] = "tenant-socialflow";

    const session = await getCurrentSocialFlowSession();

    expect(session).toBeNull();
    expect(mockVerifyAuthsSessionToken).not.toHaveBeenCalled();
    expect(mockGetAuthsUserById).not.toHaveBeenCalled();
  });

  it("allows local_demo mode in production only when explicit allow flag is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.SOCIALFLOW_ALLOW_LOCAL_DEMO_AUTH = "true";
    headerValues["x-drako-client-entry-mode"] = "local_demo";
    headerValues["x-drako-tenant-id"] = "tenant-socialflow";

    const session = await getCurrentSocialFlowSession();

    expect(session).toMatchObject({
      tenantId: "tenant-socialflow",
      role: "admin",
      authMode: "local_demo",
    });
    expect(mockVerifyAuthsSessionToken).not.toHaveBeenCalled();
  });
});
