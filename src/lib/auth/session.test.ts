import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/cf";
import {
  SESSION_COOKIE_NAME,
  UnauthorizedError,
  createSessionValue,
  requireOwnerAccess,
  requireTenantAccess,
} from "@/lib/auth/session";

function makeRequest(url: string, headers: Record<string, string>) {
  return new Request(url, { headers });
}

describe("requireTenantAccess", () => {
  beforeEach(() => {
    vi.mocked(env).mockReturnValue({
      DRACO_DB: {} as D1Database,
      SESSION_SECRET: "test-session-secret-32chars-min",
    } as any);
    process.env.DRAKO_ENABLE_DEMO_SESSION = "0";
  });

  it("uses session tenant and ignores untrusted tenant override headers", async () => {
    const sessionValue = await createSessionValue({
      email: "owner@drako.systems",
      tenantId: "tenant_alpha",
      role: "admin",
    });
    const request = makeRequest("https://drako.systems/api/test?tenantId=tenant_query", {
      cookie: `${SESSION_COOKIE_NAME}=${sessionValue}`,
      "x-tenant-id": "tenant_header",
    });

    const access = await requireTenantAccess(request);
    expect(access.tenantId).toBe("tenant_alpha");
  });

  it("blocks cross-tenant access when trusted middleware tenant header mismatches session", async () => {
    const sessionValue = await createSessionValue({
      email: "owner@drako.systems",
      tenantId: "tenant_alpha",
      role: "admin",
    });
    const request = makeRequest("https://drako.systems/api/test", {
      cookie: `${SESSION_COOKIE_NAME}=${sessionValue}`,
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
    vi.mocked(env).mockReturnValue({
      DRACO_DB: {} as D1Database,
      SESSION_SECRET: "test-session-secret-32chars-min",
    } as any);
    process.env.DRAKO_ENABLE_DEMO_SESSION = "0";
  });

  it("fails closed with 401 when there is no session", async () => {
    const request = makeRequest("https://drako.systems/api/owner/accounting", {});

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
    const request = makeRequest("https://drako.systems/api/owner/accounting", {
      cookie: `${SESSION_COOKIE_NAME}=${sessionValue}`,
    });

    await expect(requireOwnerAccess(request)).rejects.toMatchObject({
      name: "UnauthorizedError",
      message: "OWNER_ROLE_REQUIRED",
      status: 403,
    } satisfies Partial<UnauthorizedError>);
  });
});
