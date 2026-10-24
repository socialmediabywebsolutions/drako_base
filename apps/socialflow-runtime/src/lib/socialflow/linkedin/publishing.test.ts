import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublishLinkedInMemberPost = vi.hoisted(() => vi.fn());
const mockVerifyLinkedInAccess = vi.hoisted(() => vi.fn());
const mockDecryptToken = vi.hoisted(() => vi.fn());
const mockIsEncryptedToken = vi.hoisted(() => vi.fn());

const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";

  constructor(message: string, opts: { code: string; accountStatus: "INVALID_CREDENTIALS" | "PENDING" }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
  }
});

vi.mock("./core", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
  publishLinkedInMemberPost: (...args: unknown[]) => mockPublishLinkedInMemberPost(...args),
  verifyLinkedInAccess: (...args: unknown[]) => mockVerifyLinkedInAccess(...args),
}));

vi.mock("../token-encryption", () => ({
  decryptToken: (...args: unknown[]) => mockDecryptToken(...args),
  isEncryptedToken: (...args: unknown[]) => mockIsEncryptedToken(...args),
}));

import { publishRuntimeLinkedInPost, validateRuntimeLinkedInAccount } from "./publishing";

function buildAccount(token: string) {
  return {
    id: "acc-1",
    tenantId: "tenant-socialflow",
    saasId: "socialflow",
    provider: "LINKEDIN",
    handle: "sf",
    displayName: "SocialFlow",
    status: "CONNECTED_REAL",
    authMeta: {
      accessToken: token,
      authorUrn: "urn:li:person:123",
      scope: "openid profile email w_member_social",
    },
    isPrimary: true,
    createdAt: "2026-05-21T10:00:00.000Z",
    updatedAt: "2026-05-21T10:00:00.000Z",
  } as any;
}

describe("runtime linkedin publishing token hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptToken.mockImplementation(async (value: string) => value);
    mockIsEncryptedToken.mockReturnValue(true);
    mockPublishLinkedInMemberPost.mockResolvedValue({ externalPostId: "ext-1" });
    mockVerifyLinkedInAccess.mockResolvedValue({ profileId: "profile-1" });
  });

  it("blocks live publish when token is plaintext", async () => {
    mockIsEncryptedToken.mockReturnValue(false);

    await expect(publishRuntimeLinkedInPost(buildAccount("plain-token"), "hello"))
      .rejects
      .toMatchObject({ code: "LINKEDIN_ACCESS_TOKEN_NOT_ENCRYPTED" });
    expect(mockPublishLinkedInMemberPost).not.toHaveBeenCalled();
  });

  it("keeps validation path compatible for plaintext migration checks", async () => {
    mockIsEncryptedToken.mockReturnValue(false);

    await validateRuntimeLinkedInAccount(buildAccount("plain-token"));

    expect(mockDecryptToken).toHaveBeenCalledWith("plain-token");
    expect(mockVerifyLinkedInAccess).toHaveBeenCalledWith("plain-token");
  });

  it("requires w_member_social for member publish", async () => {
    const account = {
      ...buildAccount("encrypted:v1:aes-gcm:iv:cipher"),
      authMeta: {
        ...buildAccount("encrypted:v1:aes-gcm:iv:cipher").authMeta,
        scope: "openid profile email",
      },
    } as any;

    await expect(publishRuntimeLinkedInPost(account, "hello")).rejects.toMatchObject({
      code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
    });
    expect(mockPublishLinkedInMemberPost).not.toHaveBeenCalled();
  });

  it("uses resolved author urn for member publish", async () => {
    await publishRuntimeLinkedInPost(buildAccount("encrypted:v1:aes-gcm:iv:cipher"), "hello");

    expect(mockPublishLinkedInMemberPost).toHaveBeenCalledWith(expect.objectContaining({
      authorUrn: "urn:li:person:123",
      content: "hello",
    }));
  });

  it("blocks organization publish without w_organization_social scope", async () => {
    const account = {
      ...buildAccount("encrypted:v1:aes-gcm:iv:cipher"),
      authMeta: {
        ...buildAccount("encrypted:v1:aes-gcm:iv:cipher").authMeta,
        authorUrn: "urn:li:organization:999",
        scope: "openid profile email w_member_social",
      },
    } as any;

    await expect(publishRuntimeLinkedInPost(account, "hello")).rejects.toMatchObject({
      code: "LINKEDIN_SCOPE_MISSING_W_ORGANIZATION_SOCIAL",
    });
  });

  it("blocks organization publish when org role is missing", async () => {
    const account = {
      ...buildAccount("encrypted:v1:aes-gcm:iv:cipher"),
      authMeta: {
        ...buildAccount("encrypted:v1:aes-gcm:iv:cipher").authMeta,
        authorUrn: "urn:li:organization:999",
        scope: "openid profile email w_member_social w_organization_social",
      },
    } as any;

    await expect(publishRuntimeLinkedInPost(account, "hello")).rejects.toMatchObject({
      code: "LINKEDIN_ORGANIZATION_ROLE_MISSING",
    });
  });
});
