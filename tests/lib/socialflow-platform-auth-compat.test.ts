import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Golden tests de P5: la auth propia de SocialCors (src/lib/socialflow/platform/auth) debe ser
// intercambiable con la rama "socialflow" de src/lib/auths. Si alguno falla, un despliegue
// invalidaría sesiones o contraseñas existentes.

const env = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cf", () => ({ env }));

import { createAuthsSessionToken, verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { getAuthsCookieCandidateNames, getAuthsCookieConfig } from "@/lib/auths/cookies";
import {
  createUserWithCredential,
  findUserWithCredentialByEmail,
  getAuthsUserById,
  listAuthsUsersByTenant,
  saveSessionRecord,
} from "@/lib/auths/repositories";
import { enforceAuthBoundary } from "@/lib/auths/ssot";
import { hashPassword as legacyHash, verifyPassword as legacyVerify } from "@/lib/auth/crypto";
import { isPlatformAdminEmail } from "@/lib/auth/platform-admin-allowlist";

import { createSocialFlowSessionToken, verifySocialFlowSessionToken } from "@/lib/socialflow/platform/auth/tokens";
import { getSocialFlowCookieCandidateNames, getSocialFlowCookieConfig } from "@/lib/socialflow/platform/auth/cookies";
import {
  createSocialFlowUserWithCredential,
  findSocialFlowUserWithCredentialByEmail,
  getSocialFlowAuthUserById,
  listSocialFlowAuthUsersByTenant,
  saveSocialFlowSessionRecord,
} from "@/lib/socialflow/platform/auth/repository";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { hashPassword, verifyPassword } from "@/lib/socialflow/platform/auth/crypto";
import { isSocialFlowPlatformAdminEmail } from "@/lib/socialflow/platform/auth/services";

type Captured = { sql: string; binds: unknown[] };

function recordingDb(row: Record<string, unknown> | null = null) {
  const captured: Captured[] = [];
  const statement = (sql: string) => ({
    bind: (...binds: unknown[]) => {
      captured.push({ sql, binds });
      return {
        first: async () => row,
        all: async () => ({ results: row ? [row] : [] }),
        run: async () => ({}),
      };
    },
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: unknown[]) => statements,
  };
  return { db: db as unknown as D1Database, captured };
}

function normalizeTimestamps(captured: Captured[]): Captured[] {
  return captured.map(({ sql, binds }) => ({
    sql,
    binds: binds.map((value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? "<ts>" : value)),
  }));
}

describe("SocialCors platform auth ↔ holding auths (golden)", () => {
  beforeEach(() => {
    env.mockReturnValue({ SOCIALFLOW_AUTHS_SECRET: "golden-secret" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("session tokens", () => {
    it("a token issued by the holding verifies in SocialCors with the same claims", async () => {
      const token = await createAuthsSessionToken({ context: "socialflow", sub: "u1", email: "a@b.c", tenantId: "t1", role: "admin" });
      expect(await verifySocialFlowSessionToken(token)).toEqual(await verifyAuthsSessionToken(token, "socialflow"));
      expect(await verifySocialFlowSessionToken(token)).toMatchObject({ sub: "u1", tenantId: "t1", role: "admin", iss: "socialflow.auths", aud: "socialflow.apps" });
    });

    it("a token issued by SocialCors verifies in the holding", async () => {
      const token = await createSocialFlowSessionToken({ sub: "u2", email: "x@y.z", tenantId: "t2", role: "user" });
      const legacyClaims = await verifyAuthsSessionToken(token, "socialflow");
      expect(legacyClaims).toEqual(await verifySocialFlowSessionToken(token));
      expect(legacyClaims?.exp! - legacyClaims!.iat).toBe(60 * 60 * 8);
    });

    it("both reject tampered tokens and tokens from another product signed with the same secret", async () => {
      const token = await createSocialFlowSessionToken({ sub: "u3", email: "x@y.z", tenantId: "t3", role: "user" });
      const tampered = `${token.slice(0, -2)}xx`;
      expect(await verifySocialFlowSessionToken(tampered)).toBeNull();
      expect(await verifyAuthsSessionToken(tampered, "socialflow")).toBeNull();

      env.mockReturnValue({ SOCIALFLOW_AUTHS_SECRET: "golden-secret", MENTORIAS_AUTHS_SECRET: "golden-secret" });
      const mentoriasToken = await createAuthsSessionToken({ context: "mentorias", sub: "u4", email: "m@m.m", tenantId: "t4", role: "user" });
      expect(await verifySocialFlowSessionToken(mentoriasToken)).toBeNull();
    });

    it("both fall back to SESSION_SECRET when SOCIALFLOW_AUTHS_SECRET is missing", async () => {
      env.mockReturnValue({ SESSION_SECRET: "fallback-secret" });
      const token = await createAuthsSessionToken({ context: "socialflow", sub: "u5", email: "f@f.f", tenantId: "t5", role: "user" });
      expect(await verifySocialFlowSessionToken(token)).not.toBeNull();
    });
  });

  describe("cookie", () => {
    const runtimes = [
      undefined,
      new Request("https://socialflows.drako.systems/socialflow"),
      new Request("https://socialcors.com/api/socialflow/auths/logins"),
      new Request("http://localhost:3000/socialflow"),
      new Request("http://127.0.0.1:8787/socialflow"),
    ];

    it.each(runtimes.map((runtime) => [runtime?.url ?? "no runtime", runtime] as const))(
      "same config and candidate names for %s",
      (_label, runtime) => {
        expect(getSocialFlowCookieConfig(runtime)).toEqual(getAuthsCookieConfig("socialflow", runtime));
        expect(getSocialFlowCookieCandidateNames(runtime)).toEqual(getAuthsCookieCandidateNames("socialflow", runtime));
      },
    );

    it("keeps the production cookie name", () => {
      expect(getSocialFlowCookieConfig().cookieName).toBe("__Host-socialflow_session");
    });
  });

  describe("passwords (PBKDF2)", () => {
    it("hashes are verifiable across implementations", async () => {
      const legacy = await legacyHash("correct horse battery");
      expect(await verifyPassword("correct horse battery", legacy.hash, legacy.salt, legacy.iterations)).toBe(true);
      expect(await verifyPassword("wrong", legacy.hash, legacy.salt, legacy.iterations)).toBe(false);

      const current = await hashPassword("correct horse battery");
      expect(current.iterations).toBe(legacy.iterations);
      expect(await legacyVerify("correct horse battery", current.hash, current.salt, current.iterations)).toBe(true);
    });
  });

  describe("repository (SOCIALFLOW_AUTHS_DB)", () => {
    it("issues exactly the same SQL and bindings", async () => {
      const row = { id: "u1", email: "a@b.c", name: null, role: "user", tenant_id: "t1", status: "active", user_id: "u1", type: "password", hash: "h", salt: "s", iterations: 100000, algo: "PBKDF2-SHA256" };

      const legacy = recordingDb(row);
      env.mockReturnValue({ SOCIALFLOW_AUTHS_DB: legacy.db });
      const legacyResults = [
        await getAuthsUserById({ context: "socialflow", userId: "u1" }),
        await listAuthsUsersByTenant({ context: "socialflow", tenantId: "t1" }),
        await findUserWithCredentialByEmail({ context: "socialflow", email: "a@b.c" }),
        await createUserWithCredential({ context: "socialflow", userId: "u1", credentialId: "c1", email: "a@b.c", name: null, role: "user", tenantId: "t1", hash: "h", salt: "s", iterations: 100000 }),
        await saveSessionRecord({ context: "socialflow", sessionId: "s1", userId: "u1", tenantId: "t1", tokenHash: "th", expiresAt: "2026-10-09T18:00:00.000Z" }),
      ];

      const current = recordingDb(row);
      env.mockReturnValue({ SOCIALFLOW_AUTHS_DB: current.db });
      const currentResults = [
        await getSocialFlowAuthUserById("u1"),
        await listSocialFlowAuthUsersByTenant("t1"),
        await findSocialFlowUserWithCredentialByEmail("a@b.c"),
        await createSocialFlowUserWithCredential({ userId: "u1", credentialId: "c1", email: "a@b.c", name: null, role: "user", tenantId: "t1", hash: "h", salt: "s", iterations: 100000 }),
        await saveSocialFlowSessionRecord({ sessionId: "s1", userId: "u1", tenantId: "t1", tokenHash: "th", expiresAt: "2026-10-09T18:00:00.000Z" }),
      ];

      expect(normalizeTimestamps(current.captured)).toEqual(normalizeTimestamps(legacy.captured));
      expect(currentResults).toEqual(legacyResults);
    });

    it("fails closed (null) without SOCIALFLOW_AUTHS_DB, like the holding", async () => {
      env.mockReturnValue({ DRACO_DB: recordingDb().db });
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await getSocialFlowAuthUserById("u1")).toBeNull();
      expect(await getAuthsUserById({ context: "socialflow", userId: "u1" })).toBeNull();
    });
  });

  describe("admin role allowlist", () => {
    it.each([
      ["", "owner@socialcors.com"],
      ["owner@socialcors.com", "owner@socialcors.com"],
      ["owner@socialcors.com", "other@socialcors.com"],
      [" Owner@SocialCors.com , ops@socialcors.com ", "ops@socialcors.com"],
    ])("PLATFORM_ADMIN_EMAILS=%j, email=%j → same decision", (list, email) => {
      vi.stubEnv("PLATFORM_ADMIN_EMAILS", list);
      expect(isSocialFlowPlatformAdminEmail(email)).toBe(isPlatformAdminEmail(email));
    });
  });

  describe("auth boundary", () => {
    const cases: Array<[string, Record<string, string>]> = [
      ["https://socialflows.drako.systems/api/socialflow/auths/logins", {}],
      ["https://socialcors.com/api/socialflow/auths/registrations", {}],
      ["https://socialcors.com/api/socialflow/auths/logins", { "x-drako-saas-slug": "mentorias" }],
      ["https://socialcors.com/api/socialflow/auths/logins", { "x-drako-saas-slug": "socialflow" }],
      ["https://mentorias.drako.systems/api/other", {}],
      ["https://socialflows.drako.systems/api/other", {}],
      ["https://drako.systems/socialflow/auth", {}],
      ["http://localhost:3000/api/other?__drako_host=socialflow.drako.systems", {}],
    ];

    it.each(cases)("%s %j → same verdict", (url, headers) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const request = new Request(url, { headers });
      const legacy = enforceAuthBoundary({ request, expectedContext: "socialflow", endpoint: "test" });
      const current = enforceSocialFlowAuthBoundary({ request, endpoint: "test" });
      expect(current.ok).toBe(legacy.ok);
      expect(current.context).toBe(legacy.context);
    });
  });
});
