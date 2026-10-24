import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  resolveSocialContext,
  getSaasSocialChannelKnowledge,
  upsertSaasSocialChannelKnowledge,
  UnauthorizedError,
} = vi.hoisted(() => {
  class HoistedUnauthorizedError extends Error {
    status: number;
    constructor(message = "Unauthorized", status = 401) {
      super(message);
      this.status = status;
    }
  }

  return {
    requireTenantAccess: vi.fn(),
    resolveSocialContext: vi.fn(),
    getSaasSocialChannelKnowledge: vi.fn(),
    upsertSaasSocialChannelKnowledge: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({ requireTenantAccess, UnauthorizedError }));
vi.mock("../../src/lib/social/repository", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/social/repository")>("../../src/lib/social/repository");
  return {
    ...actual,
    resolveSocialContext,
    getSaasSocialChannelKnowledge,
    upsertSaasSocialChannelKnowledge,
  };
});

import { GET as GET_CHANNEL_KNOWLEDGE, POST as POST_CHANNEL_KNOWLEDGE, PATCH as PATCH_CHANNEL_KNOWLEDGE } from "../../src/app/api/social/channels/[id]/knowledge/route";
import type { NextRequest } from "next/server";

const baseKnowledge = {
  channelId: "ch_1",
  tenantId: "tenant_1",
  saasId: "saas_1",
  objective: "b2b",
  audience: "operators",
  tone: "direct",
  keywords: ["pilot", "loop"],
  competitors: ["alt1"],
  sources: ["brief"],
  updatedAt: "2026-03-16T00:00:00.000Z",
};

describe("SocialFlow channel knowledge API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_1" });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
  });

  it("returns knowledge for channel", async () => {
    getSaasSocialChannelKnowledge.mockResolvedValue(baseKnowledge);

    const response = await GET_CHANNEL_KNOWLEDGE(new Request("https://drako.systems/api/social/channels/ch_1/knowledge?saasId=saas_1") as unknown as NextRequest, {
      params: Promise.resolve({ id: "ch_1" }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { knowledge: typeof baseKnowledge };
    expect(payload.knowledge.channelId).toBe("ch_1");
    expect(getSaasSocialChannelKnowledge).toHaveBeenCalledWith({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" }, "ch_1");
  });

  it("requires saasId", async () => {
    const response = await GET_CHANNEL_KNOWLEDGE(new Request("https://drako.systems/api/social/channels/ch_1/knowledge") as unknown as NextRequest, {
      params: Promise.resolve({ id: "ch_1" }),
    });
    expect(response.status).toBe(400);
  });

  it("saves knowledge", async () => {
    upsertSaasSocialChannelKnowledge.mockResolvedValue({ ...baseKnowledge, keywords: ["pilot"] });

    const response = await POST_CHANNEL_KNOWLEDGE(
      new Request("https://drako.systems/api/social/channels/ch_1/knowledge?saasId=saas_1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: "b2b", audience: "ops", tone: "direct", keywords: ["alpha"], competitors: ["beta"], sources: ["gamma"] }),
      }) as unknown as NextRequest,
      { params: Promise.resolve({ id: "ch_1" }) },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { knowledge: typeof baseKnowledge };
    expect(payload.knowledge.objective).toBe("b2b");
    expect(upsertSaasSocialChannelKnowledge).toHaveBeenCalledWith(
      { tenantId: "tenant_1", saasId: "saas_1", mode: "d1" },
      expect.objectContaining({ channelId: "ch_1", objective: "b2b" }),
    );
  });

  it("patches knowledge", async () => {
    upsertSaasSocialChannelKnowledge.mockResolvedValue({ ...baseKnowledge, keywords: ["pilot"] });

    const response = await PATCH_CHANNEL_KNOWLEDGE(
      new Request("https://drako.systems/api/social/channels/ch_1/knowledge?saasId=saas_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: "b2b", audience: "ops", tone: "direct", keywords: ["alpha"], competitors: ["beta"], sources: ["gamma"] }),
      }) as unknown as NextRequest,
      { params: Promise.resolve({ id: "ch_1" }) },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { knowledge: typeof baseKnowledge };
    expect(payload.knowledge.objective).toBe("b2b");
    expect(upsertSaasSocialChannelKnowledge).toHaveBeenCalledWith(
      { tenantId: "tenant_1", saasId: "saas_1", mode: "d1" },
      expect.objectContaining({ channelId: "ch_1", objective: "b2b" }),
    );
  });
});
