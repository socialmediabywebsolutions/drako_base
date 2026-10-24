import { describe, expect, it } from "vitest";

import * as Auths from "@/lib/auths";
import type {
  AuthBoundaryValidation,
  AuthsContext,
  AuthsCookieConfig,
  AuthsSessionClaims,
} from "@/lib/auths";

describe("auths public api contract", () => {
  it("exposes the canonized minimum auth/tenant surface through the barrel", () => {
    expect(Auths).toMatchObject({
      resolveAuthsContextFromHost: expect.any(Function),
      resolveAuthsContextFromPath: expect.any(Function),
      resolveAuthsContextFromRequest: expect.any(Function),
      resolveAuthsLoginPath: expect.any(Function),
      AUTHS_COOKIE_MAX_AGE_SECONDS: expect.any(Number),
      AUTHS_COOKIE_CONFIGS: expect.any(Object),
      getAuthsCookieConfig: expect.any(Function),
      getAuthsCookieName: expect.any(Function),
      AUTHS_BOUNDARY_MISMATCH_CODE: expect.any(String),
      resolveSaasSlugForAuthContext: expect.any(Function),
      resolveExpectedAuthsContextForEndpoint: expect.any(Function),
      validateAuthBoundary: expect.any(Function),
      enforceAuthBoundary: expect.any(Function),
    });
  });

  it("keeps compatibility exports available without making them part of the minimum contract definition", () => {
    expect(Auths).toMatchObject({
      isAuthsIsolationEnabled: expect.any(Function),
      createAuthsSessionToken: expect.any(Function),
      verifyAuthsSessionToken: expect.any(Function),
      drakosAuthsFactory: expect.any(Object),
      mentoriasAuthsFactory: expect.any(Object),
      socialflowAuthsFactory: expect.any(Object),
      drakosAuths: expect.any(Object),
      mentoriasAuths: expect.any(Object),
      rejectFinalUserAuthOnBase: expect.any(Function),
    });
  });

  it("does not expose non-canonized internals through the barrel", () => {
    expect("jsonError" in Auths).toBe(false);
    expect("setAuthsSessionCookie" in Auths).toBe(false);
    expect("clearAuthsSessionCookie" in Auths).toBe(false);
    expect("resolveAuthOriginFromRequest" in Auths).toBe(false);
    expect("loginAuthsUser" in Auths).toBe(false);
    expect("registerAuthsUser" in Auths).toBe(false);
    expect("resolveAuthsDbForContext" in Auths).toBe(false);
    expect("getAuthsUserById" in Auths).toBe(false);
    expect("socialflowAuths" in Auths).toBe(false);
  });

  it("re-exports minimum contract types through the barrel", () => {
    const context: AuthsContext = "socialflow";
    const cookieConfig: AuthsCookieConfig = {
      cookieName: "__Host-socialflow_session",
      cookiePath: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAgeSeconds: Auths.AUTHS_COOKIE_MAX_AGE_SECONDS,
    };
    const claims: AuthsSessionClaims = {
      sub: "user_1",
      email: "owner@socialflow.ai",
      tenantId: "tenant_socialflow",
      role: "admin",
      saasSlug: "socialflow",
      context,
      iss: "socialflow.auths",
      aud: "socialflow.apps",
      iat: 1_712_102_400,
      exp: 1_712_131_200,
      jti: "jwt_1",
    };
    const boundary: AuthBoundaryValidation = {
      ok: true,
      expectedContext: context,
      actualContext: context,
      host: "app.socialflow.example.com",
    };

    expect(cookieConfig.cookieName).toBe("__Host-socialflow_session");
    expect(claims.context).toBe("socialflow");
    expect(boundary.ok).toBe(true);
  });
});
