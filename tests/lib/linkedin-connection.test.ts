import { beforeEach, describe, expect, it, vi } from "vitest";

const connectIntegration = vi.hoisted(() => vi.fn());
const getIntegrationConnection = vi.hoisted(() => vi.fn());
const validateIntegrationConnection = vi.hoisted(() => vi.fn());
const ensureLinkedInIntegrationAvailable = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const upsertSaasSocialAccount = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const encryptToken = vi.hoisted(() => vi.fn());
const socialOwnershipReadState = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  readError: null as Error | null,
  readCalls: 0,
}));
const createSocialFlowLinkedInOAuthSocialOwnershipPrepContract = vi.hoisted(() =>
  vi.fn(() => ({
    getPreparedLinkedInOAuthConnection: vi.fn(async () => {
      socialOwnershipReadState.readCalls += 1;
      if (socialOwnershipReadState.readError) {
        throw socialOwnershipReadState.readError;
      }
      return socialOwnershipReadState.row;
    }),
    upsertPreparedLinkedInOAuthConnection: vi.fn(async () => {}),
  })),
);

vi.mock("@/lib/integration-core", () => ({
  connectIntegration,
  getIntegrationConnection,
  validateIntegrationConnection,
}));

vi.mock("@/lib/integration-core/providers/linkedin", () => ({
  LINKEDIN_INTEGRATION_KEY: "linkedin",
  ensureLinkedInIntegrationAvailable,
}));

vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  listSaasSocialAccounts,
  upsertSaasSocialAccount,
}));

vi.mock("@/lib/socialflow/contracts/linkedin-oauth-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socialflow/contracts/linkedin-oauth-runtime")>();
  return {
    ...actual,
    createSocialFlowLinkedInOAuthSocialOwnershipPrepContract,
  };
});

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
}));

vi.mock("@/lib/socialflow/token-encryption", () => ({
  encryptToken,
}));

import { persistLinkedInConnection } from "@/lib/social/linkedin-connection";

describe("persistLinkedInConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socialOwnershipReadState.row = null;
    socialOwnershipReadState.readError = null;
    socialOwnershipReadState.readCalls = 0;
    delete process.env.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH;
    delete process.env.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH;
    getIntegrationConnection.mockResolvedValue(null);
    resolveSocialContext.mockResolvedValue({
      tenantId: "tenant-1",
      saasId: "socialflow",
      socialDb: {} as D1Database,
    });
    listSaasSocialAccounts.mockResolvedValue([]);
    validateIntegrationConnection.mockResolvedValue({
      ok: true,
      status: "CONNECTED",
      checkedAt: "2026-03-25T10:00:00.000Z",
      connection: {},
      error: null,
    });
    upsertSaasSocialAccount.mockResolvedValue({
      id: "account-1",
      status: "CONNECTED_REAL",
    });
    encryptToken.mockImplementation(async (value: string | null | undefined) => (
      value ? `encrypted:v1:aes-gcm:test:${value}` : null
    ));
  });

  it("keeps core-backed behavior when switch is off", async () => {
    socialOwnershipReadState.row = {
      id: "oauth-social-row",
      tenant_id: "tenant-1",
      saas_id: "socialflow",
      provider: "LINKEDIN",
      external_profile_id: "member-1",
      author_urn: "urn:li:person:member-1",
      encrypted_access_token: "encrypted-access-token-social",
      encrypted_refresh_token: null,
      encrypted_id_token: "encrypted-id-token-social",
      scopes: "openid profile email",
      expires_at: "2026-03-25T11:00:00.000Z",
      token_type: "Bearer",
      status: "CONNECTED_REAL",
      metadata_json: "{}",
      last_validated_at: "2026-03-25T10:00:00.000Z",
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-03-25T10:00:00.000Z",
      updated_at: "2026-03-25T10:00:00.000Z",
    };

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(result.status).toBe("persisted");
    expect(connectIntegration).toHaveBeenCalled();
    expect(upsertSaasSocialAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: "LINKEDIN",
        status: "CONNECTED_REAL",
        authMeta: expect.objectContaining({
          accessToken: expect.stringMatching(/^encrypted:v1:aes-gcm:/),
        }),
      }),
    );
    expect(socialOwnershipReadState.readCalls).toBe(0);
  });

  it("returns updated when integration or account already exists", async () => {
    getIntegrationConnection.mockResolvedValue({ id: "connection-1" });
    listSaasSocialAccounts.mockResolvedValue([{ id: "account-existing", provider: "LINKEDIN" }]);

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(result.status).toBe("updated");
    expect(upsertSaasSocialAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "account-existing",
      }),
    );
  });

  it("does not fail when observability activity cannot be recorded", async () => {
    recordObservabilityActivity.mockRejectedValue(new Error("DRACO_DB binding is missing in environment."));

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(result.status).toBe("persisted");
    expect(upsertSaasSocialAccount).toHaveBeenCalled();
  });

  it("uses SOCIAL_DB prepared connection when read switch is ON and row is valid", async () => {
    process.env.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1";
    socialOwnershipReadState.row = {
      id: "oauth-social-row",
      tenant_id: "tenant-1",
      saas_id: "socialflow",
      provider: "LINKEDIN",
      external_profile_id: "member-1",
      author_urn: "urn:li:person:member-1",
      encrypted_access_token: "encrypted-access-token-social",
      encrypted_refresh_token: null,
      encrypted_id_token: "encrypted-id-token-social",
      scopes: "openid profile email",
      expires_at: "2026-03-25T11:00:00.000Z",
      token_type: "Bearer",
      status: "CONNECTED_REAL",
      metadata_json: "{}",
      last_validated_at: "2026-03-25T10:00:00.000Z",
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-03-25T10:00:00.000Z",
      updated_at: "2026-03-25T10:00:00.000Z",
    };

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(socialOwnershipReadState.readCalls).toBe(1);
    expect(connectIntegration).not.toHaveBeenCalled();
    expect(validateIntegrationConnection).not.toHaveBeenCalled();
    expect(result.status).toBe("updated");
    expect(upsertSaasSocialAccount).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "CONNECTED_REAL",
        authMeta: expect.objectContaining({
          accessToken: expect.stringMatching(/^encrypted:v1:aes-gcm:/),
          idToken: null,
        }),
      }),
    );
  });

  it("falls back to core-backed projection when switch is ON and SOCIAL_DB row is missing", async () => {
    process.env.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1";
    socialOwnershipReadState.row = null;

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(socialOwnershipReadState.readCalls).toBe(1);
    expect(connectIntegration).toHaveBeenCalled();
    expect(validateIntegrationConnection).toHaveBeenCalled();
    expect(result.status).toBe("persisted");
  });

  it("falls back to core-backed projection when switch is ON and SOCIAL_DB read fails", async () => {
    process.env.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1";
    socialOwnershipReadState.readError = new Error("SOCIAL_DB_READ_FAILED");

    const result = await persistLinkedInConnection({
      tenantId: "tenant-1",
      saasId: "socialflow",
      token: {
        access_token: "token-123",
        expires_in: 3600,
      },
      profile: {
        sub: "member-1",
      },
      identity: {
        profileId: "member-1",
        authorUrn: "urn:li:person:member-1",
        displayName: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        picture: null,
        locale: null,
      },
    });

    expect(socialOwnershipReadState.readCalls).toBe(1);
    expect(connectIntegration).toHaveBeenCalled();
    expect(validateIntegrationConnection).toHaveBeenCalled();
    expect(result.status).toBe("persisted");
  });
});
