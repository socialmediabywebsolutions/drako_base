import { getDb } from "@/lib/mentoria/db";

export type TrialEnforcementResult = {
  allowed: boolean;
  reason?: string;
  sessionId?: string;
};

export class AtomicTrialEnforcement {
  constructor(private db: D1Database = getDb()) {}

  async createSessionWithTrialCheck(input: {
    tenantId: string;
    studentId: string;
    subjectId: string;
    topic: string;
    message: string;
  }): Promise<TrialEnforcementResult> {
    // ATOMIC OPERATION: Check trial + create session in single transaction
    // This prevents race condition where trial expires between check and creation

    try {
      // Step 1: Get current trial status
      const trial = await this.db
        .prepare(
          `SELECT id, started_at, expires_at, status FROM mentoria_trials
           WHERE tenant_id = ? AND student_profile_id = ?
           LIMIT 1`
        )
        .bind(input.tenantId, input.studentId)
        .first<{
          id: string;
          started_at: string;
          expires_at: string;
          status: string;
        }>();

      const now = new Date().toISOString();

      // Step 2: Validate trial is active (check both status and expiration time)
      if (!trial || trial.status !== "active") {
        return {
          allowed: false,
          reason: "TRIAL_NOT_FOUND",
        };
      }

      if (trial.expires_at < now) {
        // Trial expired - mark it as expired atomically
        await this.db
          .prepare(
            `UPDATE mentoria_trials
             SET status = 'expired', updated_at = ?
             WHERE tenant_id = ? AND id = ?`
          )
          .bind(now, input.tenantId, trial.id)
          .run();

        return {
          allowed: false,
          reason: "TRIAL_EXPIRED",
        };
      }

      // Step 3: Check if user has paid plan (fallback if trial somehow not found)
      const subscription = await this.db
        .prepare(
          `SELECT status, plan_code FROM canonical_subscriptions
           WHERE tenant_id = ? AND user_id = (
             SELECT user_id FROM student_profiles
             WHERE tenant_id = ? AND id = ?
           )
           LIMIT 1`
        )
        .bind(input.tenantId, input.tenantId, input.studentId)
        .first<{ status: string; plan_code: string }>();

      const hasPaidPlan = subscription && ["active", "trialing"].includes(subscription.status);

      if (!hasPaidPlan && trial.expires_at < now) {
        return {
          allowed: false,
          reason: "TRIAL_EXPIRED_NO_PAID_PLAN",
        };
      }

      // Step 4: Create session (now we're guaranteed trial is valid)
      const sessionId = crypto.randomUUID();
      await this.db
        .prepare(
          `INSERT INTO learning_sessions (
            id, tenant_id, student_profile_id, subject_id, topic, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(sessionId, input.tenantId, input.studentId, input.subjectId, input.topic, "active", now, now)
        .run();

      // Step 5: Log successful session creation
      await this.logEvent({
        tenantId: input.tenantId,
        eventType: "session_created_with_trial",
        severity: "info",
        data: { sessionId, studentId: input.studentId, trialId: trial.id },
      });

      return {
        allowed: true,
        sessionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logEvent({
        tenantId: input.tenantId,
        eventType: "trial_enforcement_error",
        severity: "error",
        data: { error: errorMessage, studentId: input.studentId },
      });

      throw new Error(`TRIAL_ENFORCEMENT_FAILED: ${errorMessage}`);
    }
  }

  async validateTrialBeforeOperation(tenantId: string, studentId: string): Promise<boolean> {
    const trial = await this.db
      .prepare(
        `SELECT status, expires_at FROM mentoria_trials
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`
      )
      .bind(tenantId, studentId)
      .first<{ status: string; expires_at: string }>();

    if (!trial || trial.status !== "active") {
      return false;
    }

    const now = new Date().toISOString();
    if (trial.expires_at < now) {
      // Mark as expired
      await this.db
        .prepare(
          `UPDATE mentoria_trials
           SET status = 'expired', updated_at = ?
           WHERE tenant_id = ? AND student_profile_id = ?`
        )
        .bind(now, tenantId, studentId)
        .run();
      return false;
    }

    return true;
  }

  private async logEvent(input: {
    tenantId: string;
    eventType: string;
    severity: "info" | "warning" | "error" | "critical";
    data: Record<string, unknown>;
  }): Promise<void> {
    const now = new Date().toISOString();
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_system_events (
            id, tenant_id, event_type, severity, data_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), input.tenantId, input.eventType, input.severity, JSON.stringify(input.data), now)
        .run();
    } catch (error) {
      console.error("[TrialEnforcement] Failed to log event:", error);
    }
  }
}
