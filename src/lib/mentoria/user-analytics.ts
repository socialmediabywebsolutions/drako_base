import { getDb } from "@/lib/db";

export type UserBehaviorMetrics = {
  studentProfileId: string;
  tenantId: string;
  signupAt: string;
  firstSessionAt?: string;
  timeToFirstSession?: number;
  sessionsCompleted: number;
  lastSessionAt?: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  trialConvertedAt?: string;
  isTrialConverted: boolean;
  lastActivityAt: string;
  daysActive: number;
  engagementScore: number;
};

type UserBehaviorRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  signup_at: string;
  first_session_at: string | null;
  sessions_completed: number;
  last_session_at: string | null;
  trial_started_at: string;
  trial_expires_at: string;
  trial_converted_at: string | null;
  last_activity_at: string;
  days_active: number;
  engagement_score: number;
  created_at: string;
  updated_at: string;
};

export class UserAnalytics {
  constructor(private db: D1Database = getDb()) {}

  async initializeUserMetrics(tenantId: string, studentProfileId: string, signupAt: string, trialStartedAt: string, trialExpiresAt: string): Promise<UserBehaviorMetrics> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const existing = await this.db
      .prepare(
        `SELECT id FROM user_behavior_metrics
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<{ id: string }>();

    if (existing) {
      return this.getUserMetrics(tenantId, studentProfileId) as Promise<UserBehaviorMetrics>;
    }

    await this.db
      .prepare(
        `INSERT INTO user_behavior_metrics (
          id, tenant_id, student_profile_id, signup_at, trial_started_at, trial_expires_at,
          sessions_completed, days_active, engagement_score, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        studentProfileId,
        signupAt,
        trialStartedAt,
        trialExpiresAt,
        0,
        0,
        0,
        now,
        now,
        now
      )
      .run();

    return {
      studentProfileId,
      tenantId,
      signupAt,
      trialStartedAt,
      trialExpiresAt,
      isTrialConverted: false,
      lastActivityAt: now,
      sessionsCompleted: 0,
      daysActive: 0,
      engagementScore: 0,
    };
  }

  async recordFirstSession(tenantId: string, studentProfileId: string): Promise<void> {
    const now = new Date().toISOString();
    const metrics = await this.getUserMetrics(tenantId, studentProfileId);

    if (!metrics || metrics.firstSessionAt) {
      return; // Already recorded
    }

    await this.db
      .prepare(
        `UPDATE user_behavior_metrics
         SET first_session_at = ?, sessions_completed = 1, last_session_at = ?, last_activity_at = ?, updated_at = ?
         WHERE tenant_id = ? AND student_profile_id = ?`
      )
      .bind(now, now, now, now, tenantId, studentProfileId)
      .run();
  }

  async recordSessionCompleted(tenantId: string, studentProfileId: string): Promise<void> {
    const now = new Date().toISOString();
    const metrics = await this.getUserMetrics(tenantId, studentProfileId);

    if (!metrics) return;

    const sessionsCompleted = (metrics.sessionsCompleted || 0) + 1;
    const engagementScore = this.calculateEngagementScore(sessionsCompleted, metrics.daysActive);

    await this.db
      .prepare(
        `UPDATE user_behavior_metrics
         SET sessions_completed = ?, last_session_at = ?, last_activity_at = ?, engagement_score = ?, updated_at = ?
         WHERE tenant_id = ? AND student_profile_id = ?`
      )
      .bind(sessionsCompleted, now, now, engagementScore, now, tenantId, studentProfileId)
      .run();
  }

  async recordTrialConversion(tenantId: string, studentProfileId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE user_behavior_metrics
         SET trial_converted_at = ?, last_activity_at = ?, updated_at = ?
         WHERE tenant_id = ? AND student_profile_id = ?`
      )
      .bind(now, now, now, tenantId, studentProfileId)
      .run();
  }

  async getUserMetrics(tenantId: string, studentProfileId: string): Promise<UserBehaviorMetrics | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM user_behavior_metrics
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<UserBehaviorRow>();

    if (!row) return null;

    const signupDate = new Date(row.signup_at);
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

    let timeToFirstSession: number | undefined;
    if (row.first_session_at) {
      const firstSessionDate = new Date(row.first_session_at);
      timeToFirstSession = Math.floor((firstSessionDate.getTime() - signupDate.getTime()) / (1000 * 60));
    }

    return {
      studentProfileId: row.student_profile_id,
      tenantId: row.tenant_id,
      signupAt: row.signup_at,
      firstSessionAt: row.first_session_at || undefined,
      timeToFirstSession,
      sessionsCompleted: row.sessions_completed,
      lastSessionAt: row.last_session_at || undefined,
      trialStartedAt: row.trial_started_at,
      trialExpiresAt: row.trial_expires_at,
      trialConvertedAt: row.trial_converted_at || undefined,
      isTrialConverted: !!row.trial_converted_at,
      lastActivityAt: row.last_activity_at,
      daysActive,
      engagementScore: row.engagement_score,
    };
  }

  async getConversionMetrics(): Promise<{
    totalSignups: number;
    totalFirstSessions: number;
    totalConversions: number;
    conversionRate: number;
    avgTimeToFirstSession: number;
    avgSessionsBeforeConversion: number;
  }> {
    const row = await this.db
      .prepare(
        `SELECT
          COUNT(*) as total_signups,
          COUNT(CASE WHEN first_session_at IS NOT NULL THEN 1 END) as total_first_sessions,
          COUNT(CASE WHEN trial_converted_at IS NOT NULL THEN 1 END) as total_conversions,
          AVG(CASE WHEN first_session_at IS NOT NULL THEN CAST((julianday(first_session_at) - julianday(signup_at)) * 24 * 60 AS INTEGER) END) as avg_time_to_first_session,
          AVG(CASE WHEN trial_converted_at IS NOT NULL THEN sessions_completed END) as avg_sessions_before_conversion
         FROM user_behavior_metrics`
      )
      .first<{
        total_signups: number;
        total_first_sessions: number;
        total_conversions: number;
        avg_time_to_first_session: number;
        avg_sessions_before_conversion: number;
      }>();

    if (!row) {
      return {
        totalSignups: 0,
        totalFirstSessions: 0,
        totalConversions: 0,
        conversionRate: 0,
        avgTimeToFirstSession: 0,
        avgSessionsBeforeConversion: 0,
      };
    }

    const conversionRate = row.total_signups > 0 ? (row.total_conversions / row.total_signups) * 100 : 0;

    return {
      totalSignups: row.total_signups,
      totalFirstSessions: row.total_first_sessions,
      totalConversions: row.total_conversions,
      conversionRate,
      avgTimeToFirstSession: Math.round(row.avg_time_to_first_session || 0),
      avgSessionsBeforeConversion: Math.round(row.avg_sessions_before_conversion || 0),
    };
  }

  async getDropoffAnalysis(): Promise<{
    neverStartedTrial: number;
    startedButNoFirstSession: number;
    completedButNotConverted: number;
    converted: number;
  }> {
    const rows = await this.db
      .prepare(
        `SELECT
          COUNT(CASE WHEN first_session_at IS NULL THEN 1 END) as never_started,
          COUNT(CASE WHEN first_session_at IS NOT NULL AND trial_converted_at IS NULL THEN 1 END) as started_not_converted,
          COUNT(CASE WHEN trial_converted_at IS NOT NULL THEN 1 END) as converted
         FROM user_behavior_metrics`
      )
      .first<{
        never_started: number;
        started_not_converted: number;
        converted: number;
      }>();

    if (!rows) {
      return {
        neverStartedTrial: 0,
        startedButNoFirstSession: 0,
        completedButNotConverted: 0,
        converted: 0,
      };
    }

    return {
      neverStartedTrial: rows.never_started,
      startedButNoFirstSession: 0,
      completedButNotConverted: rows.started_not_converted,
      converted: rows.converted,
    };
  }

  private calculateEngagementScore(sessionsCompleted: number, daysActive: number): number {
    const sessionScore = Math.min(sessionsCompleted * 10, 50);
    const consistencyScore = daysActive > 0 ? Math.min((sessionsCompleted / daysActive) * 20, 50) : 0;
    return Math.round(sessionScore + consistencyScore);
  }
}
