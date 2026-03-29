import { getDb } from "@/lib/db";

/**
 * TenantGuard: Enforces tenant isolation at data access layer
 * 
 * CRITICAL: Every query must be validated to include tenant_id filter
 * This prevents cross-tenant data leakage
 */
export class TenantGuard {
  constructor(private db: D1Database = getDb()) {}

  /**
   * Validate that a resource belongs to the tenant before allowing access
   */
  async validateOwnership(input: {
    tenantId: string;
    resourceType: "student" | "session" | "post" | "feedback" | "trial" | "notification";
    resourceId: string;
  }): Promise<boolean> {
    const query = this.buildValidationQuery(input.resourceType);
    if (!query) {
      throw new Error(`INVALID_RESOURCE_TYPE: ${input.resourceType}`);
    }

    const result = await this.db.prepare(query).bind(input.tenantId, input.resourceId).first<{ id: string }>();

    return !!result;
  }

  /**
   * Ensure all acquisition post queries include tenant_id
   */
  async getAcquisitionPost(tenantId: string, postId: string): Promise<any> {
    return this.db
      .prepare(
        `SELECT * FROM acquisition_posts
         WHERE tenant_id = ? AND id = ?
         LIMIT 1`
      )
      .bind(tenantId, postId)
      .first();
  }

  async trackAcquisitionClick(tenantId: string, postId: string): Promise<void> {
    // CRITICAL: Must validate ownership before updating
    const exists = await this.validateOwnership({
      tenantId,
      resourceType: "post",
      resourceId: postId,
    });

    if (!exists) {
      throw new Error("UNAUTHORIZED: Post does not belong to tenant");
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET clicks = clicks + 1, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, postId)
      .run();
  }

  async trackAcquisitionSignup(tenantId: string, postId: string): Promise<void> {
    const exists = await this.validateOwnership({
      tenantId,
      resourceType: "post",
      resourceId: postId,
    });

    if (!exists) {
      throw new Error("UNAUTHORIZED: Post does not belong to tenant");
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET signups = signups + 1, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, postId)
      .run();
  }

  async trackAcquisitionTrialStart(tenantId: string, postId: string): Promise<void> {
    const exists = await this.validateOwnership({
      tenantId,
      resourceType: "post",
      resourceId: postId,
    });

    if (!exists) {
      throw new Error("UNAUTHORIZED: Post does not belong to tenant");
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE acquisition_posts
         SET trial_starts = trial_starts + 1, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      )
      .bind(now, tenantId, postId)
      .run();
  }

  /**
   * Get all acquisition posts for tenant (safe)
   */
  async listAcquisitionPosts(tenantId: string, limit: number = 100): Promise<any[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM acquisition_posts
         WHERE tenant_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(tenantId, limit)
      .all();

    return result.results ?? [];
  }

  /**
   * Get all notification jobs for tenant (safe)
   */
  async listNotificationJobs(tenantId: string, status?: string): Promise<any[]> {
    let query = `SELECT * FROM mentoria_notification_jobs WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results ?? [];
  }

  /**
   * Get all feedback jobs for tenant (safe)
   */
  async listFeedbackJobs(tenantId: string, status?: string): Promise<any[]> {
    let query = `SELECT * FROM mentoria_feedback_jobs WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results ?? [];
  }

  /**
   * Get all publish jobs for tenant (safe)
   */
  async listPublishJobs(tenantId: string, status?: string): Promise<any[]> {
    let query = `SELECT * FROM mentoria_publish_jobs WHERE tenant_id = ?`;
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.prepare(query).bind(...params).all();
    return result.results ?? [];
  }

  private buildValidationQuery(resourceType: string): string | null {
    switch (resourceType) {
      case "student":
        return `SELECT id FROM student_profiles WHERE tenant_id = ? AND id = ? LIMIT 1`;
      case "session":
        return `SELECT id FROM learning_sessions WHERE tenant_id = ? AND id = ? LIMIT 1`;
      case "post":
        return `SELECT id FROM acquisition_posts WHERE tenant_id = ? AND id = ? LIMIT 1`;
      case "feedback":
        return `SELECT id FROM user_feedback WHERE tenant_id = ? AND id = ? LIMIT 1`;
      case "trial":
        return `SELECT id FROM mentoria_trials WHERE tenant_id = ? AND id = ? LIMIT 1`;
      case "notification":
        return `SELECT id FROM mentoria_notification_jobs WHERE tenant_id = ? AND id = ? LIMIT 1`;
      default:
        return null;
    }
  }
}
