import { getDb } from "@/lib/db";

export type NotificationJobStatus = "pending" | "processing" | "delivered" | "failed" | "abandoned";

export type NotificationJob = {
  id: string;
  tenantId: string;
  studentId: string;
  parentPhone: string;
  message: string;
  status: NotificationJobStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  lastError?: string;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
};

type NotificationJobRow = {
  id: string;
  tenant_id: string;
  student_id: string;
  parent_phone: string;
  message: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  message_id: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
};

export class NotificationQueueManager {
  private db: D1Database | null = null;

  private getDb(): D1Database {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db;
  }

  constructor() {}

  async enqueueNotification(input: {
    tenantId: string;
    studentId: string;
    parentPhone: string;
    message: string;
    maxRetries?: number;
  }): Promise<NotificationJob> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const maxRetries = input.maxRetries ?? 3;

    await this.getDb()
      .prepare(
        `INSERT INTO mentoria_notification_jobs (
          id, tenant_id, student_id, parent_phone, message, status, retry_count, max_retries, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, input.tenantId, input.studentId, input.parentPhone, input.message, "pending", 0, maxRetries, now, now)
      .run();

    return {
      id,
      tenantId: input.tenantId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message: input.message,
      status: "pending",
      retryCount: 0,
      maxRetries,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getPendingJobs(limit: number = 10): Promise<NotificationJob[]> {
    const now = new Date().toISOString();
    const result = await this.getDb()
      .prepare(
        `SELECT * FROM mentoria_notification_jobs
         WHERE status = 'pending' OR (status = 'failed' AND next_retry_at <= ?)
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .bind(now, limit)
      .all<NotificationJobRow>();

    return (result.results ?? []).map(this.mapJob);
  }

  async markProcessing(jobId: string, tenantId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.getDb()
      .prepare(
        `UPDATE mentoria_notification_jobs
         SET status = 'processing', updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(now, jobId, tenantId)
      .run();
  }

  async markDelivered(jobId: string, tenantId: string, messageId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.getDb()
      .prepare(
        `UPDATE mentoria_notification_jobs
         SET status = 'delivered', message_id = ?, delivered_at = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(messageId, now, now, jobId, tenantId)
      .run();
  }

  async markFailed(jobId: string, tenantId: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    const job = await this.getDb()
      .prepare(
        `SELECT retry_count, max_retries FROM mentoria_notification_jobs
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(jobId, tenantId)
      .first<{ retry_count: number; max_retries: number }>();

    if (!job) return;

    const retryCount = job.retry_count + 1;
    const isAbandoned = retryCount >= job.max_retries;
    const nextRetryAt = isAbandoned ? null : this.calculateNextRetryTime(retryCount);

    await this.getDb()
      .prepare(
        `UPDATE mentoria_notification_jobs
         SET status = ?, retry_count = ?, last_error = ?, next_retry_at = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      )
      .bind(
        isAbandoned ? "abandoned" : "failed",
        retryCount,
        error,
        nextRetryAt,
        now,
        jobId,
        tenantId
      )
      .run();

    if (isAbandoned) {
      await this.logSystemEvent({
        tenantId,
        eventType: "notification_abandoned",
        severity: "critical",
        data: { jobId, error, retryCount },
      });
    }
  }

  private calculateNextRetryTime(retryCount: number): string {
    const baseDelayMs = 5000; // 5 seconds
    const maxDelayMs = 300000; // 5 minutes
    const delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
    const nextRetry = new Date(Date.now() + delayMs);
    return nextRetry.toISOString();
  }

  private mapJob(row: NotificationJobRow): NotificationJob {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentId: row.student_id,
      parentPhone: row.parent_phone,
      message: row.message,
      status: row.status as NotificationJobStatus,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at || undefined,
      lastError: row.last_error || undefined,
      messageId: row.message_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deliveredAt: row.delivered_at || undefined,
    };
  }

  private async logSystemEvent(input: {
    tenantId: string;
    eventType: string;
    severity: "info" | "warning" | "error" | "critical";
    data: Record<string, unknown>;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.getDb()
      .prepare(
        `INSERT INTO mentoria_system_events (
          id, tenant_id, event_type, severity, data_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), input.tenantId, input.eventType, input.severity, JSON.stringify(input.data), now)
      .run();
  }
}
