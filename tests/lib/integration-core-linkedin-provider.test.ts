import { beforeEach, describe, expect, it, vi } from "vitest";

const registerIntegrationDefinition = vi.hoisted(() => vi.fn());
const registerIntegrationProvider = vi.hoisted(() => vi.fn());
const verifyLinkedInAccess = vi.hoisted(() => vi.fn());
const publishLinkedInMemberPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integration-core/definitions", () => ({
  registerIntegrationDefinition,
}));

vi.mock("@/lib/integration-core/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integration-core/providers")>("@/lib/integration-core/providers");
  return {
    ...actual,
    registerIntegrationProvider,
  };
});

vi.mock("@/lib/social/linkedin", () => ({
  LinkedInIntegrationError: class LinkedInIntegrationError extends Error {
    code: string;
    accountStatus: string;

    constructor(message: string, opts: { code: string; accountStatus: string }) {
      super(message);
      this.code = opts.code;
      this.accountStatus = opts.accountStatus;
    }
  },
  verifyLinkedInAccess,
  publishLinkedInMemberPost,
}));

describe("linkedin integration provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("registers the linkedin definition and provider", async () => {
    const { ensureLinkedInIntegrationAvailable } = await import("@/lib/integration-core/providers/linkedin");
    await ensureLinkedInIntegrationAvailable();

    expect(registerIntegrationDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationKey: "linkedin",
        supportedOperations: ["publish_post"],
      }),
    );
    expect(registerIntegrationProvider).toHaveBeenCalledWith(
      "linkedin",
      expect.objectContaining({
        validate: expect.any(Function),
        executeOperation: expect.any(Function),
      }),
    );
  });

  it("validates and executes the linkedin provider contract", async () => {
    verifyLinkedInAccess.mockResolvedValue({
      displayName: "LinkedIn user",
      authorUrn: "urn:li:person:123",
      profileId: "profile-1",
    });
    publishLinkedInMemberPost.mockResolvedValue({
      externalPostId: "urn:li:share:123",
      linkedinStatus: 201,
      body: { id: "urn:li:share:123" },
    });

    const { ensureLinkedInIntegrationAvailable } = await import("@/lib/integration-core/providers/linkedin");
    await ensureLinkedInIntegrationAvailable();
    const provider = registerIntegrationProvider.mock.calls[0][1] as {
      validate: Function;
      executeOperation: Function;
    };

    const validation = await provider.validate({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "linkedin",
      connection: {
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "linkedin",
        credentials: {
          accessToken: "token-123",
          authorUrn: "urn:li:person:123",
        },
        metadata: null,
      },
    });

    expect(validation.ok).toBe(true);
    expect(validation.status).toBe("CONNECTED");

    const execution = await provider.executeOperation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "linkedin",
      operationKey: "publish_post",
      payload: { title: "Hello", body: "World" },
      connection: {
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "linkedin",
        credentials: {
          accessToken: "token-123",
          authorUrn: "urn:li:person:123",
        },
        metadata: null,
      },
    });

    expect(execution.ok).toBe(true);
    expect(execution.result?.externalPostId).toBe("urn:li:share:123");
  });
});
