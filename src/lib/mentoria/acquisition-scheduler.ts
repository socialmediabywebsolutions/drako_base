import { getDb } from "@/lib/db";
import { generateDailyContentBatch } from "@/lib/mentoria/acquisition-content";

export type ScheduledPost = {
  id: string;
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  content: string;
  scheduledFor: string;
  status: "pending" | "published" | "failed";
  publishedAt?: string;
  error?: string;
};

type ScheduledPostRow = {
  id: string;
  post_id: string;
  channel: string;
  content: string;
  scheduled_for: string;
  status: string;
  published_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export class AcquisitionScheduler {
  private tenantId: string;
  private db: D1Database;

  constructor(params: { tenantId: string; saasId?: string | null; db?: D1Database }) {
    this.tenantId = params.tenantId;
    this.db = params.db ?? getDb();
  }

  async schedulePost(
    postId: string,
    channel: "linkedin" | "instagram" | "tiktok",
    content: string,
    scheduledFor: string
  ): Promise<ScheduledPost> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO scheduled_posts (
          id, tenant_id, post_id, channel, content, scheduled_for, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, this.tenantId, postId, channel, content, scheduledFor, "pending", now, now)
      .run();

    return {
      id,
      postId,
      channel,
      content,
      scheduledFor,
      status: "pending",
    };
  }

  async getPendingPosts(): Promise<ScheduledPost[]> {
    const now = new Date().toISOString();
    const rows = await this.db
      .prepare(
        `SELECT id, post_id, channel, content, scheduled_for, status, published_at, error
         FROM scheduled_posts
         WHERE tenant_id = ? AND status = 'pending' AND scheduled_for <= ?
         ORDER BY scheduled_for ASC
         LIMIT 10`
      )
      .bind(this.tenantId, now)
      .all<ScheduledPostRow>();

    return rows.results.map((row) => ({
      id: row.id,
      postId: row.post_id,
      channel: row.channel as "linkedin" | "instagram" | "tiktok",
      content: row.content,
      scheduledFor: row.scheduled_for,
      status: row.status as "pending" | "published" | "failed",
      publishedAt: row.published_at || undefined,
      error: row.error || undefined,
    }));
  }

  async markAsPublished(id: string, externalId?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE scheduled_posts
         SET status = 'published', published_at = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(now, now, id, this.tenantId)
      .run();
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE scheduled_posts
         SET status = 'failed', error = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(error, now, id, this.tenantId)
      .run();
  }

  async generateAndScheduleDailyPosts(): Promise<ScheduledPost[]> {
    const posts = generateDailyContentBatch(3);
    const scheduledPosts: ScheduledPost[] = [];

    // Schedule posts at different times throughout the day
    const now = new Date();
    const times = [9, 13, 18]; // 9 AM, 1 PM, 6 PM

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const scheduledTime = new Date(now);
      scheduledTime.setHours(times[i], 0, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (scheduledTime < now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const scheduled = await this.schedulePost(
        post.id,
        post.channel,
        post.content,
        scheduledTime.toISOString()
      );

      scheduledPosts.push(scheduled);
    }

    return scheduledPosts;
  }

  async getScheduledPostsForNextDays(days: number = 7): Promise<ScheduledPost[]> {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const rows = await this.db
      .prepare(
        `SELECT id, post_id, channel, content, scheduled_for, status, published_at, error
         FROM scheduled_posts
         WHERE tenant_id = ? AND status = 'pending' AND scheduled_for BETWEEN ? AND ?
         ORDER BY scheduled_for ASC`
      )
      .bind(this.tenantId, now.toISOString(), future.toISOString())
      .all<ScheduledPostRow>();

    return rows.results.map((row) => ({
      id: row.id,
      postId: row.post_id,
      channel: row.channel as "linkedin" | "instagram" | "tiktok",
      content: row.content,
      scheduledFor: row.scheduled_for,
      status: row.status as "pending" | "published" | "failed",
      publishedAt: row.published_at || undefined,
      error: row.error || undefined,
    }));
  }
}
