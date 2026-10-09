import { beforeEach, describe, expect, it, vi } from "vitest";

// P6: reglas de los ejecutores reales de acciones del operator en SocialCors.

const resolveSocialContext = vi.hoisted(() => vi.fn());
const listSaasSocialPosts = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const schedulePost = vi.hoisted(() => vi.fn());
const upsertSaasSocialCampaign = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({ env }));
vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  listSaasSocialPosts,
  listSaasSocialAccounts,
  schedulePost,
  upsertSaasSocialCampaign,
}));
vi.mock("@/lib/socialflow/profile/repository", () => ({
  getChannelProfile: vi.fn(async () => ({ toneOfVoice: "divertido" })),
  getChannelKnowledge: vi.fn(),
}));

import {
  checkTenantConnections,
  launchOperatorCampaign,
  runPostRecoveryAction,
} from "@/lib/socialflow/internal-api/operator-actions";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");

function post(overrides: Record<string, unknown>) {
  return { id: "p", title: "T", status: "FAILED", externalPostId: null, scheduledAt: null, updatedAt: "2026-10-09T11:00:00.000Z", ...overrides };
}

describe("SocialCors operator action executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSocialContext.mockResolvedValue({ tenantId: "t1", saasId: "socialflow" });
    schedulePost.mockImplementation(async (_ctx, input) => ({ id: input.id, status: "SCHEDULED" }));
  });

  it("retry_failed_posts never retries a post that already reached the network", async () => {
    listSaasSocialPosts.mockResolvedValue([post({ id: "a" }), post({ id: "b", externalPostId: "ig_123" })]);

    const result = await runPostRecoveryAction({ action: "retry_failed_posts", tenantId: "t1", saasId: "socialflow", now: NOW });

    expect(schedulePost).toHaveBeenCalledTimes(1);
    expect(schedulePost).toHaveBeenCalledWith(expect.anything(), { id: "a", scheduledAt: new Date(NOW).toISOString() });
    expect(result).toMatchObject({ scanned: 2, affected: 1, skipped: 1, message: "Queued 1 failed post(s) for retry." });
    expect(result.items.find((item) => item.id === "b")?.reason).toBe("EXTERNAL_POST_ID_PRESENT");
  });

  it("recover_stale_publishing only touches PUBLISHING posts older than 15 minutes", async () => {
    listSaasSocialPosts.mockResolvedValue([
      post({ id: "stale", status: "PUBLISHING", updatedAt: "2026-10-09T11:30:00.000Z" }),
      post({ id: "fresh", status: "PUBLISHING", updatedAt: "2026-10-09T11:55:00.000Z" }),
    ]);

    const result = await runPostRecoveryAction({ action: "recover_stale_publishing", tenantId: "t1", saasId: "socialflow", now: NOW });

    expect(listSaasSocialPosts).toHaveBeenCalledWith(expect.anything(), { status: "PUBLISHING" });
    expect(result.affected).toBe(1);
    expect(result.items.find((item) => item.id === "fresh")?.reason).toBe("NOT_ELIGIBLE");
  });

  it("launch_campaign creates the campaign and queues the AI job per tenant, reporting failures per tenant", async () => {
    const send = vi.fn(async () => undefined);
    env.mockReturnValue({ SOCIALFLOW_AI_QUEUE: { send } });
    upsertSaasSocialCampaign.mockImplementationOnce(async () => undefined).mockRejectedValueOnce(new Error("DB_DOWN"));

    const { results } = await launchOperatorCampaign({ tenants: ["t1", "t2"], saasId: "socialflow", title: "Navidad", scheduledAt: "2026-12-01T10:00:00Z" });

    expect(results[0]).toMatchObject({ tenantId: "t1", ok: true });
    expect(results[1]).toEqual({ tenantId: "t2", ok: false, error: "DB_DOWN" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "campaign", tenantId: "t1", niche: "Navidad", tone: "divertido", startDate: "2026-12-01" }));
  });

  it("launch_campaign fails per tenant without a queue binding", async () => {
    env.mockReturnValue({});
    const { results } = await launchOperatorCampaign({ tenants: ["t1"], saasId: "socialflow", title: "X", scheduledAt: null });
    expect(results).toEqual([{ tenantId: "t1", ok: false, error: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE" }]);
  });

  it("validate_connections flags expired, expiring and non-real connections", async () => {
    listSaasSocialAccounts.mockResolvedValue([
      { id: "ok", provider: "INSTAGRAM", status: "CONNECTED_REAL", authMeta: { expiresAt: "2026-12-31T00:00:00.000Z" } },
      { id: "soon", provider: "LINKEDIN", status: "CONNECTED_REAL", authMeta: { expiresAt: "2026-10-12T00:00:00.000Z" } },
      { id: "expired", provider: "FACEBOOK", status: "CONNECTED_REAL", authMeta: { expiresAt: "2026-10-01T00:00:00.000Z" } },
      { id: "demo", provider: "THREADS", status: "CONNECTED_DEMO", authMeta: null },
      { id: "gone", provider: "INSTAGRAM", status: "DISCONNECTED", authMeta: null },
    ]);

    const result = await checkTenantConnections({ tenantId: "t1", saasId: "socialflow", now: NOW });

    expect(result.checksPassed).toBe(1);
    expect(result.checksFailed).toBe(3);
    expect(Object.fromEntries(result.accounts.map((account) => [account.id, account.reason]))).toEqual({
      ok: null,
      soon: "TOKEN_EXPIRING_SOON",
      expired: "TOKEN_EXPIRED",
      demo: "STATUS_CONNECTED_DEMO",
    });
  });
});
