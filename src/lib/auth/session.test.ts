import { beforeEach, describe, expect, it, vi } from "vitest";

// 🔥 MOCKS
vi.mock("@/lib/db", () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/auths/cookies", () => ({
  getAuthsCookieName: vi.fn(() => "auth-cookie"),
}));

vi.mock("@/lib/auths/contexts", () => ({
  resolveAuthsContextFromRequest: vi.fn(),
}));

vi.mock("@/lib/auths/tokens", () => ({
  verifyAuthsSessionToken: vi.fn(),
}));

vi.mock("@/lib/auths/flags", () => ({
  isAuthsIsolationEnabled: vi.fn(() => false),
  isAuthsLegacyCompatEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/platform/surfaces", () => ({
  isLocalDemoEnabled: vi.fn(() => false),
  isTenantWorkspaceApiPath: vi.fn(() => false),
  isTenantWorkspacePath: vi.fn(() => false),
}));

// 🔥 ESTE ES EL FIX CLAVE
const mockGetWorkspaceSessionByToken = vi.fn();

vi.mock("@/lib/auth/campamento-core", () => ({
  getWorkspaceSessionByToken: (...args: any[]) =>
    mockGetWorkspaceSessionByToken(...args),
}));

// IMPORTS
import {
  SESSION_COOKIE_NAME,
  UnauthorizedError,
  createSessionValue,
  requireSession,
  requireOwnerAccess,
  requireTenantAccess,
} from "@/lib/auth/session";

// HELPERS
function makeRequest(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

function mockSession(session: {
  tenantId: string;
  email?: string;
  role?: string;
  userId?: string;
}) {
  (globalThis as any).__TEST_SESSION__ = {
    user: {
      id: session.userId ?? "user_1",
      email: session.email ?? "test@example.com",
      tenantId: session.tenantId,
      role: session.role ?? "admin",
    },
  };
}

function clearMockSession() {
  delete (globalThis as any).__TEST_SESSION__;
}

describe("requireTenantAccess", () => {
  beforeEach(() => {
    process.env.DRAKO_ENABLE_DEMO_SESSION = "0";
    clearMockSession();
  });

  it("uses session tenant and ignores untrusted tenant override headers", async () => {
    mockSession({
      tenantId: "tenant_alpha",
      email: "owner@drako.systems",
      role: "admin",
    });

    const request = makeRequest(
      "https://drako.systems/api/test?tenantId=tenant_query",
      {
        "x-tenant-id": "tenant_header",
      }
    );

    const access = await requireTenantAccess(request);
    expect(access.tenantId).toBe("tenant_alpha");
  });

  it("blocks cross-tenant access when trusted middleware tenant header mismatches session", async () => {
    mockSession({
      tenantId: "tenant_alpha",
      email: "owner@drako.systems",
      role: "admin",
    });

    const request = makeRequest("https://drako.systems/api/test", {
      "x-drako-tenant-id": "tenant_bravo",
    });

    await expect(requireTenantAccess(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "TENANT_MISMATCH",
      status: 403,
    } satisfies Partial<UnauthorizedError>);
  });
});

describe("requireOwnerAccess", () => {
  beforeEach(() => {
    process.env.DRAKO_ENABLE_DEMO_SESSION = "0";
    clearMockSession();
  });

  it("fails closed with 401 when there is no session", async () => {
    const request = makeRequest(
      "https://drako.systems/api/owner/accounting",
      {}
    );

    await expect(requireOwnerAccess(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "SESSION_REQUIRED",
      status: 401,
    } satisfies Partial<UnauthorizedError>);
  });

  it("fails closed with 403 when role is not owner-level", async () => {
    const sessionValue = await createSessionValue({
      email: "user@drako.systems",
      tenantId: "tenant_alpha",
      role: "user",
    });

    const request = makeRequest(
      "https://drako.systems/api/owner/accounting",
      {
        cookie: `${SESSION_COOKIE_NAME}=${sessionValue}`,
      }
    );

    await expect(requireOwnerAccess(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "OWNER_ROLE_REQUIRED",
      status: 403,
    } satisfies Partial<UnauthorizedError>);
  });
});

describe("workspace auth session fallback", () => {
  beforeEach(() => {
    clearMockSession();
    mockGetWorkspaceSessionByToken.mockReset();
  });

  it("accepts a NextAuth database session cookie for workspace APIs", async () => {
    mockGetWorkspaceSessionByToken.mockResolvedValue({
      userId: "user_1",
      email: "test@drako.systems",
      tenantId: "tenant_alpha",
      role: "owner",
    });

    const request = makeRequest("https://drako.systems/api/test", {
      cookie: "next-auth.session-token=valid-token",
    });

    const session = await requireSession(request);

    expect(session.tenantId).toBe("tenant_alpha");
    expect(session.authMode).toBe("nextauth_database");
  });
});

describe("workspace session hardening", () => {
  beforeEach(() => {
    process.env.DRAKO_ENABLE_DEMO_SESSION = "1";
    process.env.DRAKO_CLIENT_DEMO_TENANT_ID = "demo-tenant";
    clearMockSession();
  });

  it("does not allow local demo fallback for tenant workspace surfaces", async () => {
    const request = makeRequest(
      "http://localhost:3000/api/social/summary?saasId=saas_1",
      {
        host: "localhost:3000",
      }
    );

    await expect(requireSession(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "SESSION_REQUIRED",
      status: 401,
    } satisfies Partial<UnauthorizedError>);
  });

  it("does not allow local demo fallback for owner surfaces", async () => {
    const request = makeRequest(
      "http://localhost:3000/api/owner/factory-status",
      {
        host: "localhost:3000",
      }
    );

    await expect(requireSession(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "SESSION_REQUIRED",
      status: 401,
    } satisfies Partial<UnauthorizedError>);
  });
});