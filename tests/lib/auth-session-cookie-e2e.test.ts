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
    process.env.SOCIALFLOW_AUTHS_SECRET = "test-socialflow-secret";
    process.env.NEXTAUTH_SECRET = "test-nextauth-secret";
    process.env.SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  // Auditoría de seguridad 2026-09-01: drako.systems es la superficie de
  // founder/admin, no un producto de autoservicio — el registro público se
  // deshabilitó sin condiciones (src/app/api/drakos/auths/registrations/route.ts).
  // Reemplaza el test anterior, que asumía que registrarse aquí debía dejar una
  // sesión válida.
  it("drakos registration endpoint is disabled — direct POST fails without setting a cookie", async () => {
    vi.resetModules();

    const { POST } = await import("@/app/api/drakos/auths/registrations/route");
    const response = await POST(new Request("https://drako.systems/api/drakos/auths/registrations", {
      method: "POST",
      headers: {
        host: "drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "owner@drako.systems", password: "password123", name: "Owner" }),
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("REGISTRATION_DISABLED");
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

    // Mock database for Mentoria family operations
    const mockDb = {
      prepare: vi.fn(function(sql: string) {
        return {
          bind: vi.fn(function(...params: unknown[]) {
            return {
              run: vi.fn().mockResolvedValue({ success: true }),
              all: vi.fn().mockResolvedValue({
                results: sql.includes("SELECT") ? [{ id: params[0], created_at: new Date().toISOString() }] : [],
              }),
            };
          }),
        };
      }),
    };

    vi.doMock("@/lib/db", () => ({
      getDb: () => mockDb as unknown as D1Database,
    }));

    // Mock MentoriaFamilyRepository
    const mockRepo = {
      getGuardianByEmail: vi.fn().mockResolvedValue({
        id: "guardian_1",
        email: "owner@mentoria.ai",
        familyId: "tenant_mentorias",
        role: "tutor",
      }),
      getGuardianByFamilyAndEmail: vi.fn().mockResolvedValue({
        id: "guardian_1",
        email: "owner@mentoria.ai",
        familyId: "tenant_mentorias",
        role: "tutor",
      }),
      createFamily: vi.fn().mockResolvedValue({ id: "tenant_mentorias", createdAt: new Date().toISOString() }),
      getFamilyBundle: vi.fn().mockResolvedValue({
        family: { id: "tenant_mentorias", createdAt: new Date().toISOString() },
        guardians: [],
        students: [],
      }),
      createStudent: vi.fn().mockResolvedValue({
        id: "student_1",
        name: "Student",
        age: null,
        level: null,
        familyId: "tenant_mentorias",
        createdAt: new Date().toISOString(),
      }),
      upsertGuardian: vi.fn().mockResolvedValue({
        id: "guardian_1",
        email: "owner@mentoria.ai",
        familyId: "tenant_mentorias",
        role: "tutor",
        createdAt: new Date().toISOString(),
      }),
      ensureFamilyMembershipByUser: vi.fn().mockResolvedValue(true),
    };

    vi.doMock("@/lib/mentoria/family-repository", () => ({
      MentoriaFamilyRepository: class {
        constructor() {
          return mockRepo;
        }
      },
    }));

    vi.doMock("@/lib/auths/mentorias-auths", () => ({
      mentoriasAuths: {
        register: vi.fn().mockResolvedValue({ ok: true, userId: "u2" }),
        login: vi.fn().mockResolvedValue({ ok: true, token, role: "admin", tenantId: "tenant_mentorias" }),
      },
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsIsolationEnabled: () => true,
        isTelemetriesHoldingEnabled: () => false,
      };
    });
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        MENTORIA_DB: mockDb as unknown as D1Database,
      }),
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

    const nextReq = new NextRequest("https://mentorias.drako.systems/socialflow", {
      headers: { host: "mentorias.drako.systems", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("owner@mentoria.ai");
    expect(session?.tenantId).toBe("tenant_mentorias");
    expect(session?.saasSlug).toBe("mentorias");
  });

  it("socialflow registration sets socialflow cookie and next request resolves session", async () => {
    vi.resetModules();
    const { createAuthsSessionToken } = await import("@/lib/auths/tokens");
    const token = await createAuthsSessionToken({
      context: "socialflow",
      sub: "socialflow:u3",
      email: "owner@socialflow.app",
      tenantId: "tenant_socialflow",
      role: "user",
    });
    vi.doMock("@/lib/auths/socialflow-auths", () => ({
      socialflowAuths: {
        register: vi.fn().mockResolvedValue({ ok: true, userId: "u3" }),
        login: vi.fn().mockResolvedValue({ ok: true, token, role: "user", tenantId: "tenant_socialflow" }),
      },
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsIsolationEnabled: () => true,
        isTelemetriesHoldingEnabled: () => false,
      };
    });
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));
    vi.doMock("@/lib/db", () => ({
      run: vi.fn().mockResolvedValue(undefined),
    }));

    const { POST } = await import("@/app/api/socialflow/auths/registrations/route");
    const response = await POST(new Request("https://app.socialflow.example.com/api/socialflow/auths/registrations", {
      method: "POST",
      headers: {
        host: "app.socialflow.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "owner@socialflow.app", password: "password123", name: "Owner" }),
    }));

    expect(response.status).toBe(201);
    const cookiePair = extractCookiePair(response.headers.get("set-cookie"));
    expect(cookiePair.startsWith("__Host-socialflow_session=")).toBe(true);

    const nextReq = new NextRequest("https://app.socialflow.example.com/socialflow", {
      headers: { host: "app.socialflow.example.com", cookie: cookiePair },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("owner@socialflow.app");
    expect(session?.tenantId).toBe("tenant_socialflow");
    expect(session?.saasSlug).toBe("socialflow");
  });

  it("bases auth endpoint is deprecated in favor of NextAuth operator auth", async () => {
    vi.resetModules();

    const { POST } = await import("@/app/api/bases/auths/logins/route");
    const response = await POST(new Request("https://bases.drako.systems/api/bases/auths/logins", {
      method: "POST",
      headers: {
        host: "bases.drako.systems",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "admin@bases.drako.systems", password: "bases-password" }),
    }));

    expect(response.status).toBe(410);
  });

  it("bases admin routes accept NextAuth database sessions without custom bases cookies", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/campamento-core", async () => {
      const actual = await vi.importActual<typeof import("@/lib/auth/campamento-core")>("@/lib/auth/campamento-core");
      return {
        ...actual,
        getWorkspaceSessionByToken: vi.fn().mockResolvedValue({
          userId: "operator_1",
          email: "operator@drako.systems",
          name: "Operator",
          tenantId: "tenant_holding",
          tenantName: "Holding",
          tenantSlug: "holding",
          role: "OWNER",
          sessionToken: "nextauth-token",
          expires: new Date(Date.now() + 60_000).toISOString(),
        }),
      };
    });

    const nextReq = new NextRequest("https://bases.drako.systems/admin", {
      headers: { host: "bases.drako.systems", cookie: "__Secure-next-auth.session-token=nextauth-token" },
    });
    const { extractSessionFromRequest } = await import("@/lib/edge-auth");
    const session = await extractSessionFromRequest(nextReq);

    expect(session?.email).toBe("operator@drako.systems");
    expect(session?.tenantId).toBe("tenant_holding");
  });
});
