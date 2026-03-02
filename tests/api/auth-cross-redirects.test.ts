import path from "path";
import { describe, expect, it, vi } from "vitest";
import { runAuthSsotDriftChecks } from "../../scripts/lib/auth-ssot-audit";

describe("auth ssot drift guard", () => {
  it("rejects cross-register/cross-login redirects", () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const result = runAuthSsotDriftChecks(projectRoot);
    expect(result.ok, result.errors.join("\n")).toBe(true);
  });

  it("rejects frontend references to legacy /api/auth login/register endpoints", () => {
    const projectRoot = path.resolve(__dirname, "../..");
    const result = runAuthSsotDriftChecks(projectRoot);
    const legacyRefs = result.inventory.rows.filter((row) =>
      (row.destination === "/api/auth/login" || row.destination === "/api/auth/register")
      && row.file !== "src/app/api/auth/login/route.ts"
      && row.file !== "src/app/api/auth/register/route.ts",
    );
    expect(legacyRefs).toEqual([]);
  });

  it("writes drakos registration only to drakos auth tables", async () => {
    vi.resetModules();
    const drakosSql: string[] = [];
    const mentoriasSql: string[] = [];

    const drakosDb = {
      prepare: (sql: string) => {
        drakosSql.push(sql);
        return { bind: () => ({}) };
      },
      batch: async () => {},
    };
    const mentoriasDb = {
      prepare: (sql: string) => {
        mentoriasSql.push(sql);
        return { bind: () => ({}) };
      },
      batch: async () => {},
    };

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRAKOS_AUTHS_DB: drakosDb,
        MENTORIAS_AUTHS_DB: mentoriasDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsContextDbRequired: () => true,
    }));

    const repositories = await import("@/lib/auths/repositories");
    const result = await repositories.createUserWithCredential({
      context: "drakos",
      userId: "u1",
      credentialId: "c1",
      email: "owner@drako.systems",
      name: "Owner",
      role: "admin",
      tenantId: "tenant_1",
      hash: "hash",
      salt: "salt",
      iterations: 100000,
    });

    expect(result.ok).toBe(true);
    expect(drakosSql.some((sql) => sql.includes("drakos_users"))).toBe(true);
    expect(drakosSql.some((sql) => sql.includes("drakos_credentials"))).toBe(true);
    expect(mentoriasSql.length).toBe(0);
  });

  it("writes mentorias registration only to mentorias auth tables", async () => {
    vi.resetModules();
    const drakosSql: string[] = [];
    const mentoriasSql: string[] = [];

    const drakosDb = {
      prepare: (sql: string) => {
        drakosSql.push(sql);
        return { bind: () => ({}) };
      },
      batch: async () => {},
    };
    const mentoriasDb = {
      prepare: (sql: string) => {
        mentoriasSql.push(sql);
        return { bind: () => ({}) };
      },
      batch: async () => {},
    };

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRAKOS_AUTHS_DB: drakosDb,
        MENTORIAS_AUTHS_DB: mentoriasDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsContextDbRequired: () => true,
    }));

    const repositories = await import("@/lib/auths/repositories");
    const result = await repositories.createUserWithCredential({
      context: "mentorias",
      userId: "u2",
      credentialId: "c2",
      email: "owner@mentoria.ai",
      name: "Mentoria Owner",
      role: "admin",
      tenantId: "tenant_2",
      hash: "hash",
      salt: "salt",
      iterations: 100000,
    });

    expect(result.ok).toBe(true);
    expect(mentoriasSql.some((sql) => sql.includes("mentorias_users"))).toBe(true);
    expect(mentoriasSql.some((sql) => sql.includes("mentorias_credentials"))).toBe(true);
    expect(drakosSql.length).toBe(0);
  });

  it("drakos registration endpoint emits drako saas_slug and enforces drakos context", async () => {
    vi.resetModules();
    const registerSpy = vi.fn().mockResolvedValue({ ok: true, userId: "u-drakos" });
    const loginSpy = vi.fn().mockResolvedValue({ ok: true, token: "tok-drakos", role: "admin", tenantId: "tenant_drakos" });

    vi.doMock("@/lib/auths/drakos-auths", () => ({
      drakosAuths: {
        register: registerSpy,
        login: loginSpy,
      },
    }));
    vi.doMock("@/lib/auths/http", () => ({
      jsonError: (code: string, message: string, status = 400) =>
        new Response(JSON.stringify({ ok: false, code, message }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      setAuthsSessionCookie: () => {},
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
      isTelemetriesHoldingEnabled: () => false,
    }));
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));

    const { POST } = await import("@/app/api/drakos/auths/registrations/route");
    const response = await POST(
      new Request("https://drako.systems/api/drakos/auths/registrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "drako.systems",
        },
        body: JSON.stringify({ email: "owner@drako.systems", password: "password123", name: "Owner" }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json() as { user: { saas_slug: string } };
    expect(payload.user.saas_slug).toBe("drako");
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ context: "drakos" }));
    expect(loginSpy).toHaveBeenCalledWith(expect.objectContaining({ context: "drakos" }));
  });

  it("mentorias registration endpoint emits mentorias saas_slug and enforces mentorias context", async () => {
    vi.resetModules();
    const registerSpy = vi.fn().mockResolvedValue({ ok: true, userId: "u-mentorias" });
    const loginSpy = vi.fn().mockResolvedValue({ ok: true, token: "tok-mentorias", role: "admin", tenantId: "tenant_mentorias" });

    vi.doMock("@/lib/auths/mentorias-auths", () => ({
      mentoriasAuths: {
        register: registerSpy,
        login: loginSpy,
      },
    }));
    vi.doMock("@/lib/auths/http", () => ({
      jsonError: (code: string, message: string, status = 400) =>
        new Response(JSON.stringify({ ok: false, code, message }), {
          status,
          headers: { "content-type": "application/json" },
        }),
      setAuthsSessionCookie: () => {},
    }));
    vi.doMock("@/lib/auths/flags", () => ({
      isAuthsIsolationEnabled: () => true,
      isTelemetriesHoldingEnabled: () => false,
    }));
    vi.doMock("@/lib/empire/events", () => ({
      recordCampamentoEvent: vi.fn(),
    }));

    const { POST } = await import("@/app/api/mentorias/auths/registrations/route");
    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentorias/auths/registrations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "mentoria.drako.systems",
        },
        body: JSON.stringify({ email: "owner@mentoria.ai", password: "password123", name: "Owner" }),
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json() as { user: { saas_slug: string } };
    expect(payload.user.saas_slug).toBe("mentorias");
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ context: "mentorias" }));
    expect(loginSpy).toHaveBeenCalledWith(expect.objectContaining({ context: "mentorias" }));
  });
});
