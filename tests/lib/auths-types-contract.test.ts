import { describe, expect, it } from "vitest";

import type {
  AuthsContext,
  AuthsCookieConfig,
  AuthsCookieSameSite,
  AuthsRole,
  AuthsSaasSlug,
  AuthsSessionClaims,
  TelemetriesEvent,
} from "@/lib/auths";

describe("auths types contract", () => {
  it("keeps the canonical auth vocabulary stable through the public barrel", () => {
    const context: AuthsContext = "mentorias";
    const role: AuthsRole = "admin";
    const sameSite: AuthsCookieSameSite = "lax";
    const saasSlug: AuthsSaasSlug = "mentorias";

    const cookieConfig: AuthsCookieConfig = {
      cookieName: "__Host-mentorias_session",
      cookiePath: "/",
      sameSite,
      secure: true,
      httpOnly: true,
      maxAgeSeconds: 60 * 60 * 8,
    };

    const claims: AuthsSessionClaims = {
      sub: "user_1",
      email: "owner@mentoria.ai",
      tenantId: "tenant_mentorias",
      role,
      saasSlug,
      context,
      iss: "mentorias.auths",
      aud: "mentorias.apps",
      iat: 1_712_102_400,
      exp: 1_712_131_200,
      jti: "jwt_1",
    };

    expect(cookieConfig.cookieName).toBe("__Host-mentorias_session");
    expect(claims.context).toBe("mentorias");
    expect(claims.saasSlug).toBe("mentorias");
  });

  it("keeps auxiliary telemetry types compatible without making them part of the minimum contract", () => {
    const event: TelemetriesEvent = {
      eventName: "usage_reported",
      saasSlug: "socialflow",
      tenantId: "tenant_socialflow",
      occurredAt: "2026-04-03T00:00:00.000Z",
      payload: { metric: "posts" },
    };

    expect(event.eventName).toBe("usage_reported");
    expect(event.saasSlug).toBe("socialflow");
  });
});
