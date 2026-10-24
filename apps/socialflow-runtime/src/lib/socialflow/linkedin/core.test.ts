import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedInIntegrationError, publishLinkedInMemberPost } from "./core";

const fetchMock = vi.fn();

describe("runtime linkedin core publish error sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("captures forbidden details in redacted-safe shape", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: (key: string) => (key.toLowerCase() === "x-li-request-id" ? "li-req-123" : null),
      },
      json: async () => ({
        message: "Not enough permissions to access: ugcPosts.CREATE.NO_VERSION",
        serviceErrorCode: 100,
        errorCode: "ugcPosts.CREATE.NO_VERSION",
        debug: {
          traceId: "trace-1",
          accessToken: "token-should-not-be-persisted",
        },
      }),
      text: async () => "",
    });

    await expect(
      publishLinkedInMemberPost({
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
        content: "hello",
      }),
    ).rejects.toMatchObject({
      code: "LINKEDIN_PUBLISH_FORBIDDEN",
      details: expect.objectContaining({
        status: 403,
        serviceErrorCode: 100,
        errorCode: "ugcPosts.CREATE.NO_VERSION",
        requestId: "li-req-123",
        endpoint: "/v2/ugcPosts",
      }),
    });

    try {
      await publishLinkedInMemberPost({
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
        content: "hello",
      });
    } catch (error) {
      const details = (error as LinkedInIntegrationError).details ?? {};
      const serialized = JSON.stringify(details);
      expect(serialized).not.toContain("token-should-not-be-persisted");
      expect(serialized).not.toContain("trace-1");
      expect(serialized).not.toContain("debug");
    }
  });
});
