import { getDb } from "@/lib/db";

export type FeedbackJobStatus = "pending" | "processing" | "stored" | "failed";

export type FeedbackJob = {
  id: string;
  tenantId: string;
  studentId: string;
  sessionCount: number;
  liked: string[];
  missing: string[];
  wouldRecommend: boolean;
  status: FeedbackJobStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  storedAt?: string;
};

type FeedbackJobRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  session_count: number;
  liked_json: string;
  missing_json: string;
  would_recommend: number;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  stored_at: string | null;
};

export class FeedbackGuarantee {
  constructor(private db: D1Database = getDb()) {}

  async enqueueFeedback(input: {
    tenantId: string;
    studentId: string;
    sessionCount: number;
    liked: string[];
    missing: string[];
    wouldRecommend: boolean;
  }): Promise<FeedbackJob> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db
      .prepare(
        `INSERT INTO mentoria_feedback_jobs (
          id, tenant_id, student_profile_id, session_count, liked_json, missing_json, would_recommend, status, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.tenantId,
        input.studentId,
        input.sessionCount,
        JSON.stringify(input.liked),
        JSON.stringify(input.missing),
        input.wouldRecommend ? 1 : 0,
        "pending",
        0,
        now
      )
      .run();

    return {
      id,
      tenantId: input.tenantId,
      studentId: input.studentId,
      sessionCount: input.sessionCount,
      liked: input.liked,
      missing: input.missing,
      wouldRecommend: input.wouldRecommend,
      status: "pending",
      retryCount: 0,
      createdAt: now,
    };
  }

  async processPendingFeedback(limit: number = 20): Promise<{ processed: number; stored: number; failed: number }> {
    const jobs = await this.db
      .prepare(
        `SELECT * FROM mentoria_feedback_jobs
         WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .bind(limit)
      .all<FeedbackJobRow>();

    let stored = 0;
    let failed = 0;

    for (const job of jobs.results ?? []) {
      try {
        await this.db
          .prepare(
            `UPDATE mentoria_feedback_jobs
             SET status = 'processing'
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(job.id, job.tenant_id)
          .run();

        const liked = JSON.parse(job.liked_json);
        const missing = JSON.parse(job.missing_json);
        const sentiment = this.calculateSentiment(liked, missing, job.would_recommend === 1);

        // Store feedback in permanent table
        await this.db
          .prepare(
            `INSERT INTO user_feedback (
              id, tenant_id, student_profile_id, session_count, liked_json, missing_json, overall_sentiment, would_recommend, collected_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            job.tenant_id,
            job.student_profile_id,
            job.session_count,
            job.liked_json,
            job.missing_json,
            sentiment,
            job.would_recommend,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();

        // Mark job as stored
        await this.db
          .prepare(
            `UPDATE mentoria_feedback_jobs
             SET status = 'stored', stored_at = ?
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(new Date().toISOString(), job.id, job.tenant_id)
          .run();

        stored++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const retryCount = job.retry_count + 1;

        await this.db
          .prepare(
            `UPDATE mentoria_feedback_jobs
             SET status = 'failed', retry_count = ?, last_error = ?
             WHERE id = ? AND tenant_id = ?`
          )
          .bind(retryCount, errorMessage, job.id, job.tenant_id)
          .run();

        if (retryCount >= 3) {
          await this.logEvent({
            tenantId: job.tenant_id,
            eventType: "feedback_abandoned",
            severity: "critical",
            data: { jobId: job.id, error: errorMessage },
          });
        }

        failed++;
      }
    }

    return {
      processed: jobs.results?.length ?? 0,
      stored,
      failed,
    };
  }

  private calculateSentiment(liked: string[], missing: string[], wouldRecommend: boolean): string {
    if (wouldRecommend && liked.length > 0 && missing.length === 0) {
      return "positive";
    }
    if (!wouldRecommend && missing.length > 0) {
      return "negative";
    }
    return "neutral";
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
      console.error("[FeedbackGuarantee] Failed to log event:", error);
    }
  }
}
