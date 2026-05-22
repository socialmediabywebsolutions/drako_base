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
    getIntegrationConnection.mockResolvedValue(null);
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant-1", saasId: "socialflow" });
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

  it("returns persisted when there is no existing integration or account", async () => {
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
});
