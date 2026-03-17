import { afterEach, describe, expect, it, vi } from "vitest";
import { getLinkedInPostAnalytics } from "@/lib/social/linkedin";

describe("LinkedIn live analytics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retrieves the minimal live analytics contract for one published post", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        likesSummary: { aggregatedTotalLikes: 18 },
        commentsSummary: { aggregatedTotalComments: 4 },
        sharesSummary: { aggregatedTotalShares: 2 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        elements: [
          {
            totalShareStatistics: {
              impressionCount: 740,
              shareCount: 2,
            },
          },
        ],
      }), { status: 200 }));

    const analytics = await getLinkedInPostAnalytics("urn:li:ugcPost:123456", "token-live");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(analytics.impressions).toBe(740);
    expect(analytics.likes).toBe(18);
    expect(analytics.comments).toBe(4);
    expect(analytics.shares).toBe(2);
    expect(typeof analytics.lastFetchedAt).toBe("string");
  });
});
