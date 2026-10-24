import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
} from "@/lib/socialflow/linkedin/core";

const fetchMock = vi.fn();

describe("publishLinkedInMemberPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts to linkedin ugcPosts with the real member payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      headers: {
        get: (key: string) => (key === "x-restli-id" ? "urn:li:share:123" : "application/json"),
      },
      json: async () => ({ id: "urn:li:share:123" }),
      text: async () => "",
    });

    const result = await publishLinkedInMemberPost({
      accessToken: "token-123",
      authorUrn: "urn:li:person:abc",
      content: "Hello LinkedIn",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linkedin.com/v2/ugcPosts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "X-Restli-Protocol-Version": "2.0.0",
        }),
        body: JSON.stringify({
          author: "urn:li:person:abc",
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: "Hello LinkedIn" },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      }),
    );
    expect(result.linkedinStatus).toBe(201);
    expect(result.externalPostId).toBe("urn:li:share:123");
  });

  it("normalizes linkedin publish http errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        message: "Not enough permissions to access: POST ugcPosts",
        serviceErrorCode: 100,
      }),
    });

    await expect(
      publishLinkedInMemberPost({
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
        content: "Hello LinkedIn",
      }),
    ).rejects.toMatchObject<Partial<LinkedInIntegrationError>>({
      code: "LINKEDIN_PUBLISH_FORBIDDEN",
      details: expect.objectContaining({
        status: 403,
        serviceErrorCode: 100,
      }),
    });
  });
});
