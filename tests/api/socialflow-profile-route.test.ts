import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentSocialFlowSession = vi.hoisted(() => vi.fn());
const getChannelKnowledge = vi.hoisted(() => vi.fn());
const upsertChannelProfile = vi.hoisted(() => vi.fn());
const upsertChannelCompetitor = vi.hoisted(() => vi.fn());

const MockSocialContextError = vi.hoisted(() => class MockSocialContextError extends Error {});

vi.mock("@/lib/socialflow/auth/request", () => ({
  requireCurrentSocialFlowSession,
}));

vi.mock("@/lib/socialflow/profile/repository", () => ({
  getChannelKnowledge,
  upsertChannelProfile,
  upsertChannelCompetitor,
}));

vi.mock("@/lib/socialflow/repository", () => ({
  SocialContextError: MockSocialContextError,
}));

import { GET, PATCH, POST } from "@/app/api/socialflow/profile/route";

describe("/api/socialflow/profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant-socialflow",
      role: "admin",
      userId: "u1",
      email: "staff@drako.systems",
    });
    getChannelKnowledge.mockResolvedValue({
      profile: {
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        channelId: "socialflow_primary_channel",
        brandName: "",
      },
      competitors: [],
      assets: [],
    });
    upsertChannelProfile.mockResolvedValue({
      tenantId: "tenant-socialflow",
      saasId: "socialflow",
      channelId: "socialflow_primary_channel",
      brandName: "Brand X",
    });
    upsertChannelCompetitor.mockResolvedValue({
      id: "comp_1",
      name: "Comp",
      channelId: "socialflow_primary_channel",
    });
  });

  it("returns 401 when session is missing", async () => {
    requireCurrentSocialFlowSession.mockRejectedValue(new Error("SESSION_REQUIRED"));
    const response = await GET(new Request("https://socialflow.drako.systems/api/socialflow/profile"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for tenant mismatch", async () => {
    const response = await GET(
      new Request("https://socialflow.drako.systems/api/socialflow/profile?tenantId=other"),
    );
    expect(response.status).toBe(403);
  });

  it("returns 200 with safe empty-state when no row exists", async () => {
    getChannelKnowledge.mockResolvedValue({
      profile: {
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        channelId: "socialflow_primary_channel",
        brandName: "",
      },
      competitors: [],
      assets: [],
    });

    const response = await GET(new Request("https://socialflow.drako.systems/api/socialflow/profile"));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.profile).toBeTruthy();
    expect(body.competitors).toEqual([]);
    expect(body.assets).toEqual([]);
  });

  it("passes saasId to repository", async () => {
    const response = await GET(new Request("https://socialflow.drako.systems/api/socialflow/profile?saasId=p2-24i-saas"));
    expect(response.status).toBe(200);
    expect(getChannelKnowledge).toHaveBeenCalledWith("tenant-socialflow", "p2-24i-saas");
  });

  it("persists profile update on POST", async () => {
    const response = await POST(new Request("https://socialflow.drako.systems/api/socialflow/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ saasId: "socialflow", profile: { brandName: "Brand X" } }),
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(upsertChannelProfile).toHaveBeenCalledWith(
      "tenant-socialflow",
      expect.objectContaining({ brandName: "Brand X" }),
      "socialflow",
    );
  });

  it("blocks POST tenant mismatch with 403", async () => {
    const response = await POST(new Request("https://socialflow.drako.systems/api/socialflow/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "other", profile: { brandName: "Brand X" } }),
    }));
    expect(response.status).toBe(403);
  });

  it("supports PATCH by delegating to POST flow", async () => {
    const response = await PATCH(new Request("https://socialflow.drako.systems/api/socialflow/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { brandName: "Brand X" } }),
    }));
    expect(response.status).toBe(200);
  });
});
