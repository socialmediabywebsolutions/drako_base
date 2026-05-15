import { describe, expect, it } from "vitest";
import {
  readTenantIdFromHeaderGetter,
  validateSocialFlowTenantIsolation,
} from "@/lib/socialflow/auth/tenant-isolation";

describe("SocialFlow tenant isolation guards", () => {
  it("prefers trusted tenant headers in canonical order", () => {
    const headers = new Map<string, string>([
      ["x-tenant-id", "tenant-legacy"],
      ["x-drako-tenant-id", "tenant-canonical"],
    ]);

    expect(readTenantIdFromHeaderGetter((name) => headers.get(name))).toBe("tenant-canonical");
  });

  it("accepts matching header and auth user tenant context", () => {
    expect(validateSocialFlowTenantIsolation({
      sessionTenantId: "tenant-alpha",
      headerTenantId: "tenant-alpha",
      authUserTenantId: "tenant-alpha",
      requireAuthUser: true,
    })).toEqual({ ok: true });
  });

  it("rejects header tenant mismatches", () => {
    expect(validateSocialFlowTenantIsolation({
      sessionTenantId: "tenant-alpha",
      headerTenantId: "tenant-bravo",
      authUserTenantId: "tenant-alpha",
      requireAuthUser: true,
    })).toMatchObject({
      ok: false,
      reason: "HEADER_TENANT_MISMATCH",
    });
  });

  it("rejects missing auth user resolution when auth consistency is required", () => {
    expect(validateSocialFlowTenantIsolation({
      sessionTenantId: "tenant-alpha",
      headerTenantId: "tenant-alpha",
      authUserTenantId: null,
      requireAuthUser: true,
    })).toMatchObject({
      ok: false,
      reason: "AUTH_USER_MISSING",
    });
  });

  it("rejects auth user tenant mismatches", () => {
    expect(validateSocialFlowTenantIsolation({
      sessionTenantId: "tenant-alpha",
      headerTenantId: "tenant-alpha",
      authUserTenantId: "tenant-bravo",
      requireAuthUser: true,
    })).toMatchObject({
      ok: false,
      reason: "AUTH_USER_TENANT_MISMATCH",
    });
  });
});
