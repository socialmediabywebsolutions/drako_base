import { describe, expect, it } from "vitest";

import {
  AUTHS_BOUNDARY_MISMATCH_CODE,
  enforceAuthBoundary,
  resolveExpectedAuthsContextForEndpoint,
  resolveSaasSlugForAuthContext,
  validateAuthBoundary,
} from "@/lib/auths";

describe("auths ssot contract", () => {
  it("keeps the canonical endpoint-to-context mapping stable for known auth surfaces", () => {
    expect(resolveExpectedAuthsContextForEndpoint("/api/drakos/auths/logins")).toBe("drakos");
    expect(resolveExpectedAuthsContextForEndpoint("/api/mentorias/auths/logins")).toBe("mentorias");
    expect(resolveExpectedAuthsContextForEndpoint("/api/socialflow/auths/logins")).toBe("socialflow");
    expect(resolveExpectedAuthsContextForEndpoint("/bases/login")).toBe("bases");
    expect(resolveExpectedAuthsContextForEndpoint("/api/auth/[...nextauth]")).toBeNull();
  });

  it("keeps the canonical saas slug mapping stable by auth context", () => {
    expect(resolveSaasSlugForAuthContext("drakos")).toBe("drako");
    expect(resolveSaasSlugForAuthContext("mentorias")).toBe("mentorias");
    expect(resolveSaasSlugForAuthContext("socialflow")).toBe("socialflow");
    expect(resolveSaasSlugForAuthContext("bases")).toBe("campo_base");
  });

  it("validates a matching request boundary without coupling to HTTP response shaping", () => {
    const request = new Request("https://mentorias.drako.systems/api/mentorias/auths/logins", {
      headers: { host: "mentorias.drako.systems" },
    });

    expect(validateAuthBoundary({ request, expectedContext: "mentorias" })).toEqual({
      ok: true,
      expectedContext: "mentorias",
      actualContext: "mentorias",
      host: "mentorias.drako.systems",
    });
  });

  it("reports a canonical mismatch when the resolved context does not match the expected boundary", () => {
    const request = new Request("https://drako.systems/api/drakos/auths/logins", {
      headers: { host: "drako.systems" },
    });

    expect(validateAuthBoundary({ request, expectedContext: "socialflow" })).toEqual({
      ok: false,
      expectedContext: "socialflow",
      actualContext: "drakos",
      host: "drako.systems",
      code: AUTHS_BOUNDARY_MISMATCH_CODE,
    });
  });

  it("keeps the compatibility wrapper stable for current routes", async () => {
    const request = new Request("https://drako.systems/api/drakos/auths/logins", {
      headers: { host: "drako.systems" },
    });
    const mismatchRequest = new Request("https://drako.systems/api/drakos/auths/logins", {
      headers: { host: "drako.systems" },
    });

    const allowed = enforceAuthBoundary({
      request,
      expectedContext: "drakos",
      endpoint: "/api/drakos/auths/logins",
    });
    const denied = enforceAuthBoundary({
      request: mismatchRequest,
      expectedContext: "mentorias",
      endpoint: "/api/mentorias/auths/logins",
    });

    expect(allowed).toEqual({ ok: true, context: "drakos" });
    expect(denied.ok).toBe(false);
    expect(denied.context).toBe("drakos");
    expect(denied.response.status).toBe(403);
    await expect(denied.response.json()).resolves.toEqual({
      ok: false,
      code: AUTHS_BOUNDARY_MISMATCH_CODE,
      message: "Invalid host for mentorias auth boundary.",
    });
  });
});
