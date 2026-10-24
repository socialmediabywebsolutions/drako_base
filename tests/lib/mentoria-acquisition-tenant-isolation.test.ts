import { describe, it, expect, beforeEach, vi } from "vitest";
import { AcquisitionPublisher } from "@/lib/mentoria/acquisition-publishing";

describe("AcquisitionPublisher tenant isolation", () => {
  let mockDb: any;
  let publisher: AcquisitionPublisher;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(),
          all: vi.fn(() => ({ results: [] })),
          run: vi.fn(),
        })),
      })),
    };
    publisher = new AcquisitionPublisher(mockDb);
  });

  describe("getPublishedPost", () => {
    it("filters by tenant_id in WHERE clause", async () => {
      const tenantId = "tenant_a";
      const postId = "post_123";

      await publisher.getPublishedPost(tenantId, postId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE tenant_id = ? AND id = ?")
      );
    });

    it("binds tenant_id before post_id", async () => {
      const tenantId = "tenant_a";
      const postId = "post_123";
      const mockBind = vi.fn(() => ({
        first: vi.fn(() => null),
      }));
      mockDb.prepare.mockReturnValue({ bind: mockBind });

      await publisher.getPublishedPost(tenantId, postId);

      expect(mockBind).toHaveBeenCalledWith(tenantId, postId);
    });

    it("returns null when post belongs to different tenant", async () => {
      const tenantId = "tenant_b";
      const postId = "post_123";
      const mockFirst = vi.fn(() => null);
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(() => ({ first: mockFirst })),
      });

      const result = await publisher.getPublishedPost(tenantId, postId);

      expect(result).toBeNull();
    });
  });

  describe("getPublishedPostsByChannel", () => {
    it("filters by tenant_id AND channel", async () => {
      const tenantId = "tenant_a";
      const channel = "linkedin";

      await publisher.getPublishedPostsByChannel(tenantId, channel);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE tenant_id = ? AND channel = ?")
      );
    });

    it("returns empty array when no posts for tenant", async () => {
      const tenantId = "tenant_a";
      const channel = "linkedin";
      const mockAll = vi.fn(() => ({ results: [] }));
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(() => ({ all: mockAll })),
      });

      const result = await publisher.getPublishedPostsByChannel(tenantId, channel);

      expect(result).toEqual([]);
    });
  });

  describe("getPerformanceMetrics", () => {
    it("filters aggregation by tenant_id", async () => {
      const tenantId = "tenant_a";

      await publisher.getPerformanceMetrics(tenantId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE tenant_id = ?")
      );
    });

    it("binds tenant_id to aggregation query", async () => {
      const tenantId = "tenant_a";
      const mockBind = vi.fn(() => ({
        first: vi.fn(() => ({
          total_posts: 0,
          total_clicks: 0,
          total_signups: 0,
          total_trial_starts: 0,
        })),
      }));
      mockDb.prepare.mockReturnValue({ bind: mockBind });

      await publisher.getPerformanceMetrics(tenantId);

      expect(mockBind).toHaveBeenCalledWith(tenantId);
    });

    it("returns zero metrics when no data for tenant", async () => {
      const tenantId = "tenant_a";
      const mockFirst = vi.fn(() => null);
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(() => ({ first: mockFirst })),
      });

      const result = await publisher.getPerformanceMetrics(tenantId);

      expect(result).toEqual({
        totalPosts: 0,
        totalClicks: 0,
        totalSignups: 0,
        totalTrialStarts: 0,
        conversionRate: 0,
      });
    });
  });

  describe("trackClick", () => {
    it("includes tenant_id in UPDATE WHERE clause", async () => {
      const tenantId = "tenant_a";
      const postId = "post_123";

      await publisher.trackClick(postId, tenantId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = ? AND tenant_id = ?")
      );
    });
  });

  describe("trackSignup", () => {
    it("includes tenant_id in UPDATE WHERE clause", async () => {
      const tenantId = "tenant_a";
      const postId = "post_123";

      await publisher.trackSignup(postId, tenantId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = ? AND tenant_id = ?")
      );
    });
  });

  describe("trackTrialStart", () => {
    it("includes tenant_id in UPDATE WHERE clause", async () => {
      const tenantId = "tenant_a";
      const postId = "post_123";

      await publisher.trackTrialStart(postId, tenantId);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = ? AND tenant_id = ?")
      );
    });
  });
});
