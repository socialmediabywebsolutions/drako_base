import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) throw new Error("Missing Set-Cookie header");
  return setCookieHeader.split(";")[0]!;
}

describe("auth cookie/session e2e by context", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DRAKOS_AUTHS_SECRET = "test-drakos-secret";
    process.env.MENTORIAS_AUTHS_SECRET = "test-mentorias-secret";
    process.env.BASES_AUTHS_SECRET = "test-bases-secret";
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
    process.env.SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("drakos registration sets drakos cookie and next request resolves session", async () => {
    vi.resetModules();
    const { createAuthsSessionToken } = await import("@/lib/auths/tokens");
    const token = await createAuthsSessionToken({
      context: "drakos",
      sub: "drakos:u1",
      email: "owner@drako.systems",
      tenantId: "tenant_drako",
      role: "admin",
    });

    vi.doMock("@/lib/auths/drakos-auths", () => ({
      drakosAuths: {
        register: vi.fn().mockResolvedValue({ ok: true, userId: "u1" }),
        login: vi.fn().mockResolvedValue({ ok: true, token, role: "admin", tenantId: "tenant_drako" }),
      },
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
      isTelemetriesHoldingEnabled: () => false,
    }));
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));

    const { POST } = await import("@/app/api/drakos/auths/registrations/route");
    const response = await POST(new Request("https://drako.systems/api/drakos/auths/registrations", {
      method: "POST",
      headers: {
        host: "drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "owner@drako.systems", password: "password123", name: "Owner" }),
    }));

    const cookiePair = extractCookiePair(response.headers.get("set-cookie"));
    expect(cookiePair.startsWith("__Host-drakos_session=")).toBe(true);

    const nextReq = new NextRequest("https://drako.systems/client", {
      headers: { host: "drako.systems", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("owner@drako.systems");
    expect(session?.tenantId).toBe("tenant_drako");
    expect(session?.saasSlug).toBe("drako");
  });

  it("mentorias registration sets mentorias cookie and next request resolves session", async () => {
    vi.resetModules();
    const { createAuthsSessionToken } = await import("@/lib/auths/tokens");
    const token = await createAuthsSessionToken({
      context: "mentorias",
      sub: "mentorias:u2",
      email: "owner@mentoria.ai",
      tenantId: "tenant_mentorias",
      role: "admin",
    });

    vi.doMock("@/lib/auths/mentorias-auths", () => ({
      mentoriasAuths: {
        register: vi.fn().mockResolvedValue({ ok: true, userId: "u2" }),
        login: vi.fn().mockResolvedValue({ ok: true, token, role: "admin", tenantId: "tenant_mentorias" }),
      },
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
      isTelemetriesHoldingEnabled: () => false,
    }));
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));

    const { POST } = await import("@/app/api/mentorias/auths/registrations/route");
    const response = await POST(new Request("https://mentorias.drako.systems/api/mentorias/auths/registrations", {
      method: "POST",
      headers: {
        host: "mentorias.drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "owner@mentoria.ai", password: "password123", name: "Owner" }),
    }));

    const cookiePair = extractCookiePair(response.headers.get("set-cookie"));
    expect(cookiePair.startsWith("__Host-mentorias_session=")).toBe(true);

    const nextReq = new NextRequest("https://mentorias.drako.systems/client", {
      headers: { host: "mentorias.drako.systems", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("owner@mentoria.ai");
    expect(session?.tenantId).toBe("tenant_mentorias");
    expect(session?.saasSlug).toBe("mentorias");
  });

  it("bases login sets bases cookie and next request resolves session", async () => {
    vi.resetModules();
    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        ADMIN_EMAIL: "admin@bases.drako.systems",
        ADMIN_PASSWORD: "bases-password",
        DEFAULT_TENANT_ID: "tenant_bases",
        BASES_AUTHS_SECRET: "test-bases-secret",
      }),
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
    }));

    const { POST } = await import("@/app/api/bases/auths/logins/route");
    const response = await POST(new Request("https://bases.drako.systems/api/bases/auths/logins", {
      method: "POST",
      headers: {
        host: "bases.drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "admin@bases.drako.systems", password: "bases-password" }),
    }));

    expect(response.status).toBe(200);
    const cookiePair = extractCookiePair(response.headers.get("set-cookie"));
    expect(cookiePair.startsWith("__Host-bases_session=")).toBe(true);

    const nextReq = new NextRequest("https://bases.drako.systems/admin", {
      headers: { host: "bases.drako.systems", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("admin@bases.drako.systems");
    expect(session?.tenantId).toBe("tenant_bases");
    expect(session?.saasSlug).toBe("campo_base");
  });

  it("bases session can enter the tenant workspace on base host without using drakos auth", async () => {
    vi.resetModules();
    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        ADMIN_EMAIL: "admin@bases.drako.systems",
        ADMIN_PASSWORD: "bases-password",
        DEFAULT_TENANT_ID: "tenant_bases",
        BASES_AUTHS_SECRET: "test-bases-secret",
      }),
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
    }));

    const { POST } = await import("@/app/api/bases/auths/logins/route");
    const response = await POST(new Request("https://bases.drako.systems/api/bases/auths/logins", {
      method: "POST",
      headers: {
        host: "bases.drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "admin@bases.drako.systems", password: "bases-password" }),
    }));

    const cookiePair = extractCookiePair(response.headers.get("set-cookie"));
    const nextReq = new NextRequest("https://bases.drako.systems/client", {
      headers: { host: "bases.drako.systems", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.tenantId).toBe("tenant_bases");
    expect(session?.saasSlug).toBe("campo_base");
  });
});
