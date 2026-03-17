import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireTenantAccess,
  resolveSocialContext,
  listSaasSocialChannels,
  upsertSaasSocialChannel,
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
    listSaasSocialChannels: vi.fn(),
    upsertSaasSocialChannel: vi.fn(),
    UnauthorizedError: HoistedUnauthorizedError,
  };
});

vi.mock("@/lib/auth/session", () => ({ requireTenantAccess, UnauthorizedError }));
vi.mock("../../src/lib/social/repository", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/social/repository")>("../../src/lib/social/repository");
  return {
    ...actual,
    resolveSocialContext,
    listSaasSocialChannels,
    upsertSaasSocialChannel,
  };
});

import { GET as GET_CHANNELS, POST as POST_CHANNELS } from "../../src/app/api/social/channels/route";

describe("SocialFlow channels API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_1" });
    resolveSocialContext.mockResolvedValue({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
  });

  it("lists channels for workspace", async () => {
    listSaasSocialChannels.mockResolvedValue([{ id: "ch_1", name: "General" }]);

    const response = await GET_CHANNELS(new Request("https://drako.systems/api/social/channels?saasId=saas_1"));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { items: Array<{ id: string }>; count: number };
    expect(payload.items[0]?.id).toBe("ch_1");
    expect(payload.count).toBe(1);
    expect(listSaasSocialChannels).toHaveBeenCalledWith({ tenantId: "tenant_1", saasId: "saas_1", mode: "d1" });
  });

  it("requires saasId on GET", async () => {
    const response = await GET_CHANNELS(new Request("https://drako.systems/api/social/channels"));
    expect(response.status).toBe(400);
  });

  it("creates channel with trimmed name", async () => {
    upsertSaasSocialChannel.mockResolvedValue({ id: "ch_new", name: "General" });

    const response = await POST_CHANNELS(
      new Request("https://drako.systems/api/social/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1", name: "  General  " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertSaasSocialChannel).toHaveBeenCalledWith(
      { tenantId: "tenant_1", saasId: "saas_1", mode: "d1" },
      expect.objectContaining({ saasId: "saas_1", name: "General" }),
    );
  });

  it("rejects missing fields on POST", async () => {
    const response = await POST_CHANNELS(
      new Request("https://drako.systems/api/social/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId: "saas_1" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(upsertSaasSocialChannel).not.toHaveBeenCalled();
  });
});
