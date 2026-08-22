import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  resolveLinkedInCallbackUrl,
  resolveLinkedInIdentity,
} from "@/lib/social/linkedin";

const fetchMock = vi.fn();

describe("social linkedin helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.LINKEDIN_CLIENT_ID = "client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "client-secret";
    process.env.NEXTAUTH_URL = "";
    process.env.APP_URL = "";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.CF_PAGES_URL = "";
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

    const token = await exchangeLinkedInCodeForAccessToken(
      "code-123",
      new Request("http://localhost:8787/auth/linkedin/callback?code=code-123"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.linkedin.com/oauth/v2/accessToken",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(token.access_token).toBe("access-token");
    expect(token.id_token).toBe("id-token");

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((requestInit.body as URLSearchParams).get("redirect_uri")).toBe("http://localhost:8787/auth/linkedin/callback");
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

    await expect(
      exchangeLinkedInCodeForAccessToken(
        "bad-code",
        new Request("http://localhost:8787/auth/linkedin/callback?code=bad-code"),
      ),
    ).rejects.toMatchObject<Partial<LinkedInIntegrationError>>({
      code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
      accountStatus: "INVALID_CREDENTIALS",
      message: "LinkedIn rejected the authorization code because it expired, was already used, or does not match the redirect URI.",
      details: expect.objectContaining({
        normalizedReason: "authorization_code_expired",
        redirectUri: "http://localhost:8787/auth/linkedin/callback",
      }),
    });
  });

  it("resolves localhost:8787 callback from the worker request instead of inherited env", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.APP_URL = "https://drako.systems";

    expect(resolveLinkedInCallbackUrl(new Request("http://localhost:8787/api/social/linkedin/connect"))).toBe(
      "http://localhost:8787/auth/linkedin/callback",
    );
  });

  it("resolves localhost:3000 callback for next dev", () => {
    expect(resolveLinkedInCallbackUrl(new Request("http://localhost:3000/api/social/linkedin/connect"))).toBe(
      "http://localhost:3000/auth/linkedin/callback",
    );
  });
});
