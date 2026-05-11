import { describe, expect, it, vi } from "vitest";
import { getAuthsCookieConfig } from "@/lib/auths/cookies";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

type FakeDb = {
  label: string;
  prepare: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
};

function makeFakeDb(label: string): FakeDb {
  return {
    label,
    prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(), run: vi.fn() })) })),
    batch: vi.fn(async () => {}),
  };
}

describe("auth contextual DB selection and fail-closed behavior", () => {
  it("selects contextual D1 binding per AuthsContext", async () => {
    vi.resetModules();
    const drakosDb = makeFakeDb("drakos-db");
    const mentoriasDb = makeFakeDb("mentorias-db");
    const socialflowDb = makeFakeDb("socialflow-db");
    const basesDb = makeFakeDb("bases-db");
    const fallbackDb = makeFakeDb("fallback-db");

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRAKOS_AUTHS_DB: drakosDb,
        MENTORIAS_AUTHS_DB: mentoriasDb,
        SOCIALFLOW_AUTHS_DB: socialflowDb,
        BASES_AUTHS_DB: basesDb,
        DRACO_DB: fallbackDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsContextDbRequired: () => true,
      };
    });

    const { resolveAuthsDbForContext } = await import("@/lib/auths/repositories");
    expect(resolveAuthsDbForContext("drakos")).toBe(drakosDb);
    expect(resolveAuthsDbForContext("mentorias")).toBe(mentoriasDb);
    expect(resolveAuthsDbForContext("socialflow")).toBe(socialflowDb);
    expect(resolveAuthsDbForContext("bases")).toBe(basesDb);
  });

  it("fails closed when contextual binding is missing and AUTHS_REQUIRE_CONTEXT_DB=true", async () => {
    vi.resetModules();
    const fallbackDb = makeFakeDb("fallback-db");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRACO_DB: fallbackDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsContextDbRequired: () => true,
      };
    });

    const { resolveAuthsDbForContext, createUserWithCredential } = await import("@/lib/auths/repositories");

    expect(resolveAuthsDbForContext("drakos")).toBeNull();
    expect(resolveAuthsDbForContext("mentorias")).toBeNull();
    expect(resolveAuthsDbForContext("socialflow")).toBeNull();
    expect(resolveAuthsDbForContext("bases")).toBeNull();

    const createResult = await createUserWithCredential({
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

    expect(createResult).toEqual({ ok: false, code: "DB_UNAVAILABLE" });
    expect(fallbackDb.prepare).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "drakos",
      message: "DRAKOS_AUTHS_DB binding is required for drakos auth",
    });
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "mentorias",
      message: "MENTORIAS_AUTHS_DB binding is required for mentorias auth",
    });
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "socialflow",
      message: "SOCIALFLOW_AUTHS_DB binding is required for socialflow auth",
    });
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "bases",
      message: "BASES_AUTHS_DB binding is required for bases auth",
    });
    errorSpy.mockRestore();
  });

  it("never falls back to DRACO_DB for socialflow auth when contextual DB is missing", async () => {
    vi.resetModules();
    const fallbackDb = makeFakeDb("fallback-db");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRACO_DB: fallbackDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsContextDbRequired: () => false,
      };
    });

    const { resolveAuthsDbForContext } = await import("@/lib/auths/repositories");

    expect(resolveAuthsDbForContext("socialflow")).toBeNull();
    expect(resolveAuthsDbForContext("drakos")).toBe(fallbackDb);
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "socialflow",
      message: "SOCIALFLOW_AUTHS_DB binding is required for socialflow auth",
    });
    errorSpy.mockRestore();
  });

  it("never falls back to DRACO_DB for mentorias auth when contextual DB is missing", async () => {
    vi.resetModules();
    const fallbackDb = makeFakeDb("fallback-db");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.doMock("@/lib/cf", () => ({
      env: () => ({
        DRACO_DB: fallbackDb,
      }),
    }));
    vi.doMock("@/lib/auths/flags", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/auths/flags")>();
      return {
        ...actual,
        isAuthsContextDbRequired: () => false,
      };
    });

    const { resolveAuthsDbForContext } = await import("@/lib/auths/repositories");

    expect(resolveAuthsDbForContext("mentorias")).toBeNull();
    expect(resolveAuthsDbForContext("drakos")).toBe(fallbackDb);
    expect(errorSpy).toHaveBeenCalledWith("AUTHS_CONTEXT_DB_MISSING", {
      context: "mentorias",
      message: "MENTORIAS_AUTHS_DB binding is required for mentorias auth",
    });
    errorSpy.mockRestore();
  });
});

describe("mentoria product DB selection", () => {
  it("prefers MENTORIA_DB when present", () => {
    const mentoriaDb = makeFakeDb("mentoria-db");
    const fallbackDb = makeFakeDb("fallback-db");

    expect(
      getMentoriaDb({
        MENTORIA_DB: mentoriaDb,
        DRACO_DB: fallbackDb,
      }),
    ).toBe(mentoriaDb);
  });

  it("fails closed when MENTORIA_DB is missing even if DRACO_DB exists", () => {
    expect(() =>
      getMentoriaDb({
        DRACO_DB: makeFakeDb("fallback-db"),
      }),
    ).toThrow("MENTORIA_DB binding is required for Mentoria product runtime");
  });
});

describe("auth cookie isolation contract", () => {
  it("uses distinct cookie names per context and non-colliding name/path pairs", () => {
    const drakos = getAuthsCookieConfig("drakos");
    const mentorias = getAuthsCookieConfig("mentorias");
    const socialflow = getAuthsCookieConfig("socialflow");
    const bases = getAuthsCookieConfig("bases");

    const names = [drakos.cookieName, mentorias.cookieName, socialflow.cookieName, bases.cookieName];
    expect(new Set(names).size).toBe(4);

    const pairs = [
      `${drakos.cookieName}:${drakos.cookiePath}`,
      `${mentorias.cookieName}:${mentorias.cookiePath}`,
      `${socialflow.cookieName}:${socialflow.cookiePath}`,
      `${bases.cookieName}:${bases.cookiePath}`,
    ];
    expect(new Set(pairs).size).toBe(4);

    expect(drakos.cookiePath).toBe("/");
    expect(mentorias.cookiePath).toBe("/");
    expect(socialflow.cookiePath).toBe("/");
    expect(bases.cookiePath).toBe("/");

    expect(drakos.secure).toBe(true);
    expect(mentorias.secure).toBe(true);
    expect(socialflow.secure).toBe(true);
    expect(bases.secure).toBe(true);

    expect(drakos.httpOnly).toBe(true);
    expect(mentorias.httpOnly).toBe(true);
    expect(socialflow.httpOnly).toBe(true);
    expect(bases.httpOnly).toBe(true);

    expect(drakos.sameSite).toBe("lax");
    expect(mentorias.sameSite).toBe("lax");
    expect(socialflow.sameSite).toBe("lax");
    expect(bases.sameSite).toBe("lax");
  });
});
