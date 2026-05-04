import { getDb } from "@/lib/db";
import { publishSocialPost } from "@/lib/social-core/publishing";

export type PublishJobStatus = "pending_publish" | "publishing" | "pending_confirmation" | "confirmed" | "failed" | "abandoned";

export type PublishJob = {
  id: string;
  tenantId: string;
  postId: string;
  channel: "linkedin" | "instagram" | "tiktok";
  content: string;
  status: PublishJobStatus;
  externalId?: string;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  publishedAt?: string;
  confirmedAt?: string;
};

type PublishJobRow = {
  id: string;
  tenant_id: string;
  post_id: string;
  channel: string;
  content: string;
  status: string;
  external_id: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  published_at: string | null;
  confirmed_at: string | null;
};

export class SocialFlowValidation {
  constructor(private db: D1Database = getDb()) {}

  async enqueuePublish(input: {
    tenantId: string;
    postId: string;
    channel: "linkedin" | "instagram" | "tiktok";
    content: string;
  }): Promise<PublishJob> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO mentoria_publish_jobs (
          id, tenant_id, post_id, channel, content, status, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, input.tenantId, input.postId, input.channel, input.content, "pending_publish", 0, now)
      .run();

    return {
      id,
      tenantId: input.tenantId,
      postId: input.postId,
      channel: input.channel,
      content: input.content,
      status: "pending_publish",
      retryCount: 0,
      createdAt: now,
    };
  }

  async processPendingPublishes(limit: number = 5): Promise<{ processed: number; published: number; failed: number }> {
    const jobs = await this.db
      .prepare(
        `SELECT * FROM mentoria_publish_jobs
         WHERE status = 'pending_publish' OR (status = 'failed' AND retry_count < 2)
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<PublishJobRow>();

    let published = 0;
    let failed = 0;

    for (const job of jobs.results ?? []) {
      try {
        // Mark as publishing
        await this.db
          .prepare(
            `UPDATE mentoria_publish_jobs
             SET status = 'publishing'
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(job.id, job.tenant_id)
          .run();

        const result = await publishSocialPost(job.channel as "linkedin" | "instagram" | "tiktok", job.content);

        if (!result.success) {
          throw new Error(result.error || "Unknown error");
        }

        // Mark as pending confirmation (waiting for webhook/polling)
        const now = new Date().toISOString();
        await this.db
          .prepare(
            `UPDATE mentoria_publish_jobs
             SET status = 'pending_confirmation', external_id = ?, published_at = ?
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(result.externalId, now, job.id, job.tenant_id)
          .run();

        published++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryCount = job.retry_count + 1;

        await this.db
          .prepare(
            `UPDATE mentoria_publish_jobs
             SET status = 'failed', retry_count = ?, last_error = ?
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(retryCount, errorMessage, job.id, job.tenant_id)
          .run();

        if (retryCount >= 2) {
          await this.logEvent({
            tenantId: job.tenant_id,
            eventType: "publish_abandoned",
            severity: "critical",
            data: { jobId: job.id, postId: job.post_id, error: errorMessage },
          });
        }

        failed++;
      }
    }

    return {
      processed: jobs.results?.length ?? 0,
      published,
      failed,
    };
  }

  async confirmPublish(jobId: string, tenantId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_publish_jobs
         SET status = 'confirmed', confirmed_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(now, jobId, tenantId)
      .run();

    // Now safe to mark as published in acquisition_posts
    const job = await this.db
      .prepare(
        `SELECT post_id FROM mentoria_publish_jobs
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(jobId, tenantId)
      .first<{ post_id: string }>();

    if (job) {
      await this.db
        .prepare(
          `UPDATE acquisition_posts
           SET status = 'published', updated_at = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .bind(now, job.post_id, tenantId)
        .run();
    }
  }

  async handleWebhook(input: {
    externalId: string;
    status: "published" | "failed";
    error?: string;
  }): Promise<void> {
    const job = await this.db
      .prepare(
        `SELECT id, tenant_id FROM mentoria_publish_jobs
         WHERE external_id = ?
         LIMIT 1`
      )
      .bind(input.externalId)
      .first<{ id: string; tenant_id: string }>();

    if (!job) {
      console.warn("[SocialFlowValidation] Webhook received for unknown external_id:", input.externalId);
      return;
    }

    if (input.status === "published") {
      await this.confirmPublish(job.id, job.tenant_id);
    } else {
      await this.db
        .prepare(
          `UPDATE mentoria_publish_jobs
           SET status = 'failed', last_error = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .bind(input.error || "External publish failed", job.id, job.tenant_id)
        .run();
    }
  }

  private async logEvent(input: {
    tenantId: string;
    eventType: string;
    severity: "info" | "warning" | "error" | "critical";
    data: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_system_events (
            id, tenant_id, event_type, severity, data_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), input.tenantId, input.eventType, input.severity, JSON.stringify(input.data), new Date().toISOString())
        .run();
    } catch (error) {
      console.error("[SocialFlowValidation] Failed to log event:", error);
    }
  }
}
