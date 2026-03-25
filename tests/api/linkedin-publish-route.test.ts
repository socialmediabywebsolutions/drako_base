import { beforeEach, describe, expect, it, vi } from "vitest";

const publishLinkedInMemberPost = vi.hoisted(() => vi.fn());
const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: string;
  details: Record<string, unknown> | null;

  constructor(message: string, opts: { code: string; accountStatus: string; details?: Record<string, unknown> | null }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
    this.details = opts.details ?? null;
  }
});

vi.mock("@/lib/social/linkedin", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
  publishLinkedInMemberPost,
}));

import { POST } from "@/app/api/social/linkedin/publish/route";

describe("/api/social/linkedin/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a real linkedin post when input is valid", async () => {
    publishLinkedInMemberPost.mockResolvedValue({
      linkedinStatus: 201,
      externalPostId: "urn:li:share:123",
      body: { ok: true },
    });

    const response = await POST(new Request("https://drako.local/api/social/linkedin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello LinkedIn",
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
      }),
    }) as any);

    expect(response.status).toBe(200);
    expect(publishLinkedInMemberPost).toHaveBeenCalledWith({
      content: "Hello LinkedIn",
      accessToken: "token-123",
      authorUrn: "urn:li:person:abc",
    });

    const payload = await response.json() as {
      ok: boolean;
      linkedinStatus: number;
      externalPostId: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.linkedinStatus).toBe(201);
    expect(payload.externalPostId).toBe("urn:li:share:123");
  });

  it("validates required input", async () => {
    const response = await POST(new Request("https://drako.local/api/social/linkedin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
      }),
    }) as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("LINKEDIN_PUBLISH_CONTENT_REQUIRED");
    expect(publishLinkedInMemberPost).not.toHaveBeenCalled();
  });

  it("normalizes linkedin publish errors", async () => {
    publishLinkedInMemberPost.mockRejectedValue(
      new TestLinkedInIntegrationError("Not enough permissions to access: POST ugcPosts", {
        code: "LINKEDIN_PUBLISH_FORBIDDEN",
        accountStatus: "INVALID_CREDENTIALS",
        details: { status: 403, serviceErrorCode: 100 },
      }),
    );

    const response = await POST(new Request("https://drako.local/api/social/linkedin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello LinkedIn",
        accessToken: "token-123",
        authorUrn: "urn:li:person:abc",
      }),
    }) as any);

    expect(response.status).toBe(403);
    const payload = await response.json() as {
      ok: boolean;
      code: string;
      message: string;
      details: { status: number };
    };
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("LINKEDIN_PUBLISH_FORBIDDEN");
    expect(payload.message).toContain("Not enough permissions");
    expect(payload.details.status).toBe(403);
  });
});
