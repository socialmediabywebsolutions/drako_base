import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
} from "@/lib/social/linkedin";

const fetchMock = vi.fn();

describe("social linkedin helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.LINKEDIN_CLIENT_ID = "client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret";
  });

  it("parses oauth state from raw json, base64url json and compact format", () => {
    expect(parseLinkedInOAuthState('{"tenantId":"tenant-1","saasId":"saas-1"}')).toEqual({
      tenantId: "tenant-1",
      saasId: "saas-1",
      redirectTo: null,
      format: "json",
    });

    const encoded = Buffer.from(JSON.stringify({ tenantId: "tenant-2", saasId: "saas-2" }), "utf8").toString("base64url");
    expect(parseLinkedInOAuthState(encoded)).toEqual({
      tenantId: "tenant-2",
      saasId: "saas-2",
      redirectTo: null,
      format: "base64url-json",
    });

    expect(parseLinkedInOAuthState("tenant_socialflow__socialflow")).toEqual({
      tenantId: "tenant_socialflow",
      saasId: "socialflow",
      redirectTo: null,
      format: "compact",
    });
  });

  it("exchanges code for access token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access-token",
        expires_in: 3600,
        scope: "openid profile email w_member_social",
        id_token: "id-token",
      }),
    });

    const token = await exchangeLinkedInCodeForAccessToken("code-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.linkedin.com/oauth/v2/accessToken",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(token.access_token).toBe("access-token");
    expect(token.id_token).toBe("id-token");
  });

  it("fetches userinfo and resolves identity", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sub: "member-1",
        given_name: "Ada",
        family_name: "Lovelace",
        email: "ada@example.com",
        email_verified: true,
      }),
    });

    const profile = await fetchLinkedInUserProfile("token-123");
    const identity = resolveLinkedInIdentity(profile);

    expect(identity.profileId).toBe("member-1");
    expect(identity.authorUrn).toBe("urn:li:person:member-1");
    expect(identity.displayName).toBe("Ada Lovelace");
    expect(identity.email).toBe("ada@example.com");
  });

  it("normalizes LinkedIn API errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: "invalid_request",
        error_description: "No se pudo recuperar el token de acceso: el código de autorización no coincide o ha caducado.",
      }),
    });

    await expect(exchangeLinkedInCodeForAccessToken("bad-code")).rejects.toMatchObject<Partial<LinkedInIntegrationError>>({
      code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
      accountStatus: "INVALID_CREDENTIALS",
      message: "LinkedIn rejected the authorization code because it expired, was already used, or does not match the redirect URI.",
      details: expect.objectContaining({
        normalizedReason: "authorization_code_expired_or_reused_or_redirect_mismatch",
      }),
    });
  });
});
