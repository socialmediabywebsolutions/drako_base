import { getDb } from "@/lib/db";
import type { AcquisitionPost } from "@/lib/mentoria/acquisition-content";

export type PublishedPost = {
  id: string;
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  content: string;
  publishedAt: string;
  externalId?: string;
  clicks: number;
  signups: number;
  trialStarts: number;
};

type PublishedPostRow = {
  id: string;
  post_id: string;
  channel: string;
  content: string;
  published_at: string;
  external_id: string | null;
  clicks: number;
  signups: number;
  trial_starts: number;
  created_at: string;
  updated_at: string;
};

export class AcquisitionPublisher {
  constructor(private db: D1Database = getDb()) {}

  async publishPost(post: AcquisitionPost, externalId?: string): Promise<PublishedPost> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO acquisition_posts (
          id, post_id, channel, content, published_at, external_id, clicks, signups, trial_starts, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        post.id,
        post.channel,
        post.content,
        now,
        externalId || null,
        0,
        0,
        0,
        now,
        now
      )
      .run();

    return {
      id,
      postId: post.id,
      channel: post.channel,
      content: post.content,
      publishedAt: now,
      externalId,
      clicks: 0,
      signups: 0,
      trialStarts: 0,
    };
  }

  async trackClick(publishedPostId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET clicks = clicks + 1, updated_at = ?
         WHERE id = ?`
      )
      .bind(now, publishedPostId)
      .run();
  }

  async trackSignup(publishedPostId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET signups = signups + 1, updated_at = ?
         WHERE id = ?`
      )
      .bind(now, publishedPostId)
      .run();
  }

  async trackTrialStart(publishedPostId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET trial_starts = trial_starts + 1, updated_at = ?
         WHERE id = ?`
      )
      .bind(now, publishedPostId)
      .run();
  }

  async getPublishedPost(id: string): Promise<PublishedPost | null> {
    const row = await this.db
      .prepare(`SELECT * FROM acquisition_posts WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<PublishedPostRow>();

    if (!row) return null;

    return {
      id: row.id,
      postId: row.post_id,
      channel: row.channel as "linkedin" | "instagram" | "tiktok",
      content: row.content,
      publishedAt: row.published_at,
      externalId: row.external_id || undefined,
      clicks: row.clicks,
      signups: row.signups,
      trialStarts: row.trial_starts,
    };
  }

  async getPublishedPostsByChannel(channel: "linkedin" | "instagram" | "tiktok"): Promise<PublishedPost[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM acquisition_posts
         WHERE channel = ?
         ORDER BY published_at DESC
         LIMIT 100`
      )
      .bind(channel)
      .all<PublishedPostRow>();

    return rows.results.map((row) => ({
      id: row.id,
      postId: row.post_id,
      channel: row.channel as "linkedin" | "instagram" | "tiktok",
      content: row.content,
      publishedAt: row.published_at,
      externalId: row.external_id || undefined,
      clicks: row.clicks,
      signups: row.signups,
      trialStarts: row.trial_starts,
    }));
  }

  async getPerformanceMetrics(): Promise<{
    totalPosts: number;
    totalClicks: number;
    totalSignups: number;
    totalTrialStarts: number;
    conversionRate: number;
  }> {
    const row = await this.db
      .prepare(
        `SELECT 
          COUNT(*) as total_posts,
          COALESCE(SUM(clicks), 0) as total_clicks,
          COALESCE(SUM(signups), 0) as total_signups,
          COALESCE(SUM(trial_starts), 0) as total_trial_starts
         FROM acquisition_posts`
      )
      .first<{
        total_posts: number;
        total_clicks: number;
        total_signups: number;
        total_trial_starts: number;
      }>();

    if (!row) {
      return {
        totalPosts: 0,
        totalClicks: 0,
        totalSignups: 0,
        totalTrialStarts: 0,
        conversionRate: 0,
      };
    }

    const conversionRate = row.total_clicks > 0 ? (row.total_signups / row.total_clicks) * 100 : 0;

    return {
      totalPosts: row.total_posts,
      totalClicks: row.total_clicks,
      totalSignups: row.total_signups,
      totalTrialStarts: row.total_trial_starts,
      conversionRate,
    };
  }
}
