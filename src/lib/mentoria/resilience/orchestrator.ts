import { NotificationQueueManager } from "@/lib/mentoria/resilience/notification-queue";
import { NotificationWorker } from "@/lib/mentoria/resilience/notification-worker";
import { FeedbackGuarantee } from "@/lib/mentoria/resilience/feedback-guarantee";
import { SocialFlowValidation } from "@/lib/mentoria/resilience/socialflow-validation";
import { TenantGuard } from "@/lib/mentoria/resilience/tenant-guard";
import { EventLogger } from "@/lib/mentoria/resilience/event-logger";
import { IdempotencyManager } from "@/lib/mentoria/resilience/idempotency";
import { AtomicTrialEnforcement } from "@/lib/mentoria/resilience/trial-enforcement";
import { sendParentSessionNotification } from "@/lib/mentoria/parent-notifications";
import type { SessionSummary } from "@/lib/mentoria/session-summary";
import { getDb } from "@/lib/db";

type AggregateRow = {
  pending?: number;
  failed?: number;
  abandoned?: number;
  total?: number;
};

type CountRow = {
  count: number;
};

type FailedNotificationJobRow = {
  id: string;
  retry_count: number;
  max_retries: number;
};

type SilenceRecoveryCandidateRow = {
  student_id: string;
  session_id: string;
};

type StudentPhoneRow = {
  parent_phone: string;
};

/**
 * MentoriaResilienceOrchestrator
 * 
 * Coordinates all resilience systems:
 * - Notification queue with retry
 * - Feedback guarantee
 * - SocialFlow validation
 * - Tenant isolation
 * - Event logging
 * - Idempotency
 * - Atomic trial enforcement
 */
export class MentoriaResilienceOrchestrator {
  private notificationQueue: NotificationQueueManager;
  private notificationWorker: NotificationWorker;
  private feedbackGuarantee: FeedbackGuarantee;
  private socialFlowValidation: SocialFlowValidation;
  private tenantGuard: TenantGuard;
  private eventLogger: EventLogger;
  private idempotencyManager: IdempotencyManager;
  private trialEnforcement: AtomicTrialEnforcement;
  private db: D1Database;
  private workersRunning = false;
  private readonly alertCooldownMs = 30 * 60 * 1000;
  private readonly autoActionCooldownMs = 20 * 60 * 1000;
  private readonly notificationAutoRecoveryFailedThreshold = 5;
  private readonly silenceAutoRecoveryThreshold = 3;
  private readonly criticalStormThreshold = 8;
  private readonly maxNotificationJobsToRequeuePerSweep = 10;
  private readonly maxSilenceRecoveriesPerSweep = 3;
  private readonly autoModeSafeBackoffMs = 15 * 60 * 1000;
  private alertCooldownTracker = new Map<string, number>();
  private autoActionCooldownTracker = new Map<string, number>();
  private intelligenceSweepBackoffUntil = 0;

  constructor() {
    this.notificationQueue = new NotificationQueueManager();
    this.notificationWorker = new NotificationWorker();
    this.feedbackGuarantee = new FeedbackGuarantee();
    this.socialFlowValidation = new SocialFlowValidation();
    this.tenantGuard = new TenantGuard();
    this.eventLogger = new EventLogger();
    this.idempotencyManager = new IdempotencyManager();
    this.trialEnforcement = new AtomicTrialEnforcement();
    this.db = getDb();
  }

  /**
   * Send notification with guaranteed delivery
   */
  async sendNotificationGuaranteed(input: {
    tenantId: string;
    studentId: string;
    parentPhone: string;
    message: string;
  }): Promise<{ jobId: string; queued: boolean }> {
    const job = await this.notificationQueue.enqueueNotification({
      tenantId: input.tenantId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message: input.message,
      maxRetries: 3,
    });

    await this.eventLogger.logEvent({
      tenantId: input.tenantId,
      eventType: "notification_queued",
      severity: "info",
      data: { jobId: job.id, studentId: input.studentId },
    });

    return {
      jobId: job.id,
      queued: true,
    };
  }

  /**
   * Collect feedback with guaranteed persistence
   */
  async collectFeedbackGuaranteed(input: {
    tenantId: string;
    studentId: string;
    sessionCount: number;
    liked: string[];
    missing: string[];
    wouldRecommend: boolean;
  }): Promise<{ jobId: string; queued: boolean }> {
    const job = await this.feedbackGuarantee.enqueueFeedback({
      tenantId: input.tenantId,
      studentId: input.studentId,
      sessionCount: input.sessionCount,
      liked: input.liked,
      missing: input.missing,
      wouldRecommend: input.wouldRecommend,
    });

    await this.eventLogger.logEvent({
      tenantId: input.tenantId,
      eventType: "feedback_queued",
      severity: "info",
      data: { jobId: job.id, studentId: input.studentId },
    });

    return {
      jobId: job.id,
      queued: true,
    };
  }

  /**
   * Publish with external validation
   */
  async publishWithValidation(input: {
    tenantId: string;
    postId: string;
    channel: "linkedin" | "instagram" | "tiktok";
    content: string;
  }): Promise<{ jobId: string; queued: boolean }> {
    const job = await this.socialFlowValidation.enqueuePublish({
      tenantId: input.tenantId,
      postId: input.postId,
      channel: input.channel,
      content: input.content,
    });

    await this.eventLogger.logEvent({
      tenantId: input.tenantId,
      eventType: "publish_queued",
      severity: "info",
      data: { jobId: job.id, postId: input.postId },
    });

    return {
      jobId: job.id,
      queued: true,
    };
  }

  /**
   * Create session with atomic trial enforcement
   */
  async createSessionWithTrialGuarantee(input: {
    tenantId: string;
    studentId: string;
    subjectId: string;
    topic: string;
    message: string;
    idempotencyKey: string;
  }): Promise<{ sessionId: string; allowed: boolean; reason?: string }> {
    // Use idempotency to prevent duplicate sessions
    const result = await this.idempotencyManager.executeIdempotent({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      operationType: "create_session",
      operation: async () => {
        const enforcement = await this.trialEnforcement.createSessionWithTrialCheck({
          tenantId: input.tenantId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          topic: input.topic,
          message: input.message,
        });

        return enforcement;
      },
    });

    const enforcement = result.result;

    if (enforcement.allowed && enforcement.sessionId) {
      await this.eventLogger.logEvent({
        tenantId: input.tenantId,
        eventType: "session_created",
        severity: "info",
        data: { sessionId: enforcement.sessionId, studentId: input.studentId },
      });
    } else {
      await this.eventLogger.logEvent({
        tenantId: input.tenantId,
        eventType: "session_creation_blocked",
        severity: "warning",
        data: { reason: enforcement.reason, studentId: input.studentId },
      });
    }

    return {
      sessionId: enforcement.sessionId || "",
      allowed: enforcement.allowed,
      reason: enforcement.reason,
    };
  }

  /**
   * Track acquisition metric with tenant isolation
   */
  async trackAcquisitionClick(tenantId: string, postId: string): Promise<void> {
    await this.tenantGuard.trackAcquisitionClick(tenantId, postId);
    await this.eventLogger.logEvent({
      tenantId,
      eventType: "acquisition_click",
      severity: "info",
      data: { postId },
    });
  }

  async trackAcquisitionSignup(tenantId: string, postId: string): Promise<void> {
    await this.tenantGuard.trackAcquisitionSignup(tenantId, postId);
    await this.eventLogger.logEvent({
      tenantId,
      eventType: "acquisition_signup",
      severity: "info",
      data: { postId },
    });
  }

  async trackAcquisitionTrialStart(tenantId: string, postId: string): Promise<void> {
    await this.tenantGuard.trackAcquisitionTrialStart(tenantId, postId);
    await this.eventLogger.logEvent({
      tenantId,
      eventType: "acquisition_trial_start",
      severity: "info",
      data: { postId },
    });
  }

  /**
   * Start background workers
   */
  async startWorkers(config?: { notificationIntervalMs?: number; feedbackIntervalMs?: number; publishIntervalMs?: number }): Promise<void> {
    if (this.workersRunning) {
      return;
    }

    this.workersRunning = true;

    const notificationInterval = config?.notificationIntervalMs ?? 30000;
    const feedbackInterval = config?.feedbackIntervalMs ?? 60000;
    const publishInterval = config?.publishIntervalMs ?? 45000;

    // Notification worker
    setInterval(async () => {
      try {
        const result = await this.notificationWorker.processQueue();
        if (result.delivered > 0 || result.failed > 0) {
          console.log("[MentoriaOrchestrator] Notifications processed:", result);
        }
      } catch (error) {
        console.error("[MentoriaOrchestrator] Notification worker error:", error);
      }
    }, notificationInterval);

    // Feedback worker
    setInterval(async () => {
      try {
        const result = await this.feedbackGuarantee.processPendingFeedback();
        if (result.stored > 0 || result.failed > 0) {
          console.log("[MentoriaOrchestrator] Feedback processed:", result);
        }
      } catch (error) {
        console.error("[MentoriaOrchestrator] Feedback worker error:", error);
      }
    }, feedbackInterval);

    // Publish worker
    setInterval(async () => {
      try {
        const result = await this.socialFlowValidation.processPendingPublishes();
        if (result.published > 0 || result.failed > 0) {
          console.log("[MentoriaOrchestrator] Publishes processed:", result);
        }
      } catch (error) {
        console.error("[MentoriaOrchestrator] Publish worker error:", error);
      }
    }, publishInterval);

    // Idempotency cleanup
    setInterval(async () => {
      try {
        const cleaned = await this.idempotencyManager.cleanup();
        if (cleaned > 0) {
          console.log("[MentoriaOrchestrator] Cleaned up", cleaned, "idempotency keys");
        }
      } catch (error) {
        console.error("[MentoriaOrchestrator] Idempotency cleanup error:", error);
      }
    }, 3600000); // 1 hour

    // Resilience intelligence sweep
    setInterval(async () => {
      try {
        const result = await this.runIntelligenceSweep();
        if (result.triggeredAlerts > 0) {
          console.log("[MentoriaOrchestrator] Resilience alerts triggered:", result);
        }
      } catch (error) {
        console.error("[MentoriaOrchestrator] Resilience intelligence sweep error:", error);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Get system health status
   */
  async getHealthStatus(tenantId: string): Promise<{
    notifications: { pending: number; failed: number; abandoned: number; total: number };
    feedback: { pending: number; failed: number; total: number };
    publishes: { pending: number; failed: number; abandoned: number; total: number };
    criticalEvents: number;
    silence: {
      studentsWithoutRecentFeedback: number;
      studentsWithoutRecentParentNotification: number;
      studentsWithoutRecentAcademicActivity: number;
    };
  }> {
    const [notification, feedback, publish, criticalEvents, silence] = await Promise.all([
      this.getNotificationCounts(tenantId),
      this.getFeedbackCounts(tenantId),
      this.getPublishCounts(tenantId),
      this.eventLogger.getEventCount({ tenantId, severity: "critical" }),
      this.getSilenceSignals(tenantId),
    ]);

    return {
      notifications: notification,
      feedback,
      publishes: publish,
      criticalEvents,
      silence,
    };
  }

  async runIntelligenceSweep(): Promise<{ tenantsEvaluated: number; triggeredAlerts: number }> {
    if (Date.now() < this.intelligenceSweepBackoffUntil) {
      return {
        tenantsEvaluated: 0,
        triggeredAlerts: 0,
      };
    }

    const tenantIds = await this.listRecentTenantIds();
    let triggeredAlerts = 0;

    for (const tenantId of tenantIds) {
      triggeredAlerts += await this.evaluateTenantResilienceAlerts(tenantId);
    }

    return {
      tenantsEvaluated: tenantIds.length,
      triggeredAlerts,
    };
  }

  private async evaluateTenantResilienceAlerts(tenantId: string): Promise<number> {
    const [notification, feedback, publish, recentCriticalEvents, silence] = await Promise.all([
      this.getNotificationCounts(tenantId),
      this.getFeedbackCounts(tenantId),
      this.getPublishCounts(tenantId),
      this.eventLogger.getEventCount({
        tenantId,
        severity: "critical",
        since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        excludeEventTypePrefix: "resilience_",
      }),
      this.getSilenceSignals(tenantId),
    ]);

    let triggered = 0;

    const repeatedFailures = notification.failed + feedback.failed + publish.failed;
    if (repeatedFailures >= 5 && this.shouldEmitAlert(`${tenantId}:repeated_failures`)) {
      await this.eventLogger.logEvent({
        tenantId,
        eventType: "resilience_repeated_failures_detected",
        severity: "warning",
        data: {
          repeatedFailures,
          notificationFailed: notification.failed,
          feedbackFailed: feedback.failed,
          publishFailed: publish.failed,
        },
      });
      triggered += 1;
    }

    const abandonedJobs = notification.abandoned + publish.abandoned;
    if (abandonedJobs > 0 && this.shouldEmitAlert(`${tenantId}:abandoned_jobs`)) {
      await this.eventLogger.logEvent({
        tenantId,
        eventType: "resilience_abandoned_jobs_detected",
        severity: "critical",
        data: {
          abandonedJobs,
          notificationAbandoned: notification.abandoned,
          publishAbandoned: publish.abandoned,
        },
      });
      triggered += 1;
    }

    if (recentCriticalEvents >= 5 && this.shouldEmitAlert(`${tenantId}:critical_spike`)) {
      await this.eventLogger.logEvent({
        tenantId,
        eventType: "resilience_critical_events_spike",
        severity: "critical",
        data: {
          criticalEventsLastHour: recentCriticalEvents,
        },
      });
      triggered += 1;
    }

    const silenceTotal =
      silence.studentsWithoutRecentFeedback +
      silence.studentsWithoutRecentParentNotification +
      silence.studentsWithoutRecentAcademicActivity;

    if (silenceTotal > 0 && this.shouldEmitAlert(`${tenantId}:silence_detected`)) {
      await this.eventLogger.logEvent({
        tenantId,
        eventType: "resilience_silence_detected",
        severity: "warning",
        data: {
          studentsWithoutRecentFeedback: silence.studentsWithoutRecentFeedback,
          studentsWithoutRecentParentNotification: silence.studentsWithoutRecentParentNotification,
          studentsWithoutRecentAcademicActivity: silence.studentsWithoutRecentAcademicActivity,
        },
      });
      triggered += 1;
    }

    await this.runSafeAutoActions({
      tenantId,
      notification,
      recentCriticalEvents,
      silence,
    });

    return triggered;
  }

  private async runSafeAutoActions(input: {
    tenantId: string;
    notification: { pending: number; failed: number; abandoned: number; total: number };
    recentCriticalEvents: number;
    silence: {
      studentsWithoutRecentFeedback: number;
      studentsWithoutRecentParentNotification: number;
      studentsWithoutRecentAcademicActivity: number;
    };
  }): Promise<void> {
    await this.safeAutoAction(async () => {
      await this.runFailedNotificationRecovery(input.tenantId, input.notification.failed);
    });

    await this.safeAutoAction(async () => {
      await this.runSilenceRecovery(input.tenantId, input.silence.studentsWithoutRecentFeedback);
    });

    await this.safeAutoAction(async () => {
      await this.runCriticalStormControl(input.tenantId, input.recentCriticalEvents);
    });
  }

  private async runFailedNotificationRecovery(tenantId: string, notificationFailed: number): Promise<void> {
    if (notificationFailed <= this.notificationAutoRecoveryFailedThreshold) {
      return;
    }
    if (!this.shouldRunAutoAction(`${tenantId}:auto_recovery_notification_retry`)) {
      return;
    }

    const candidates = await this.db
      .prepare(
        `SELECT id, retry_count, max_retries
         FROM mentoria_notification_jobs
         WHERE tenant_id = ?
           AND status = 'failed'
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .bind(tenantId, this.maxNotificationJobsToRequeuePerSweep)
      .all<FailedNotificationJobRow>();

    const requeueIds = (candidates.results ?? [])
      .filter((row) => Number(row.retry_count ?? 0) < Number(row.max_retries ?? 0))
      .map((row) => row.id)
      .filter(Boolean);

    if (requeueIds.length > 0) {
      const now = new Date().toISOString();
      const placeholders = requeueIds.map(() => "?").join(",");
      await this.db
        .prepare(
          `UPDATE mentoria_notification_jobs
           SET status = 'pending', updated_at = ?
           WHERE tenant_id = ?
             AND id IN (${placeholders})`
        )
        .bind(now, tenantId, ...requeueIds)
        .run();
    }

    await this.eventLogger.logEvent({
      tenantId,
      eventType: "auto_recovery_notification_retry",
      severity: "warning",
      data: {
        failedDetected: notificationFailed,
        requeuedJobs: requeueIds.length,
      },
    });
  }

  private async runSilenceRecovery(tenantId: string, studentsWithoutFeedback: number): Promise<void> {
    if (studentsWithoutFeedback <= this.silenceAutoRecoveryThreshold) {
      return;
    }
    if (!this.shouldRunAutoAction(`${tenantId}:auto_recovery_silence`)) {
      return;
    }

    const candidates = await this.getSilenceRecoveryCandidates(tenantId, this.maxSilenceRecoveriesPerSweep);
    let triggeredCount = 0;

    for (const candidate of candidates) {
      const studentCooldownKey = `${tenantId}:auto_recovery_silence:${candidate.student_id}`;
      if (!this.shouldRunAutoAction(studentCooldownKey)) {
        continue;
      }

      const parentPhone = await this.getLatestParentPhoneForStudent(tenantId, candidate.student_id);
      if (!parentPhone) {
        continue;
      }

      const summary = this.buildAutoSilenceSummary(candidate.session_id, candidate.student_id);
      const result = await sendParentSessionNotification({
        tenantId,
        sessionId: candidate.session_id,
        studentId: candidate.student_id,
        parentPhone,
        summary,
      });

      if (result.success) {
        triggeredCount += 1;
      }
    }

    await this.eventLogger.logEvent({
      tenantId,
      eventType: "auto_recovery_silence",
      severity: "warning",
      data: {
        studentsWithoutFeedback,
        attemptedStudents: candidates.length,
        notificationsTriggered: triggeredCount,
      },
    });
  }

  private async runCriticalStormControl(tenantId: string, recentCriticalEvents: number): Promise<void> {
    if (recentCriticalEvents <= this.criticalStormThreshold) {
      return;
    }
    if (!this.shouldRunAutoAction(`${tenantId}:auto_mode_safe`)) {
      return;
    }

    this.intelligenceSweepBackoffUntil = Math.max(
      this.intelligenceSweepBackoffUntil,
      Date.now() + this.autoModeSafeBackoffMs,
    );

    await this.eventLogger.logEvent({
      tenantId,
      eventType: "auto_mode_safe",
      severity: "warning",
      data: {
        recentCriticalEvents,
        backoffUntil: new Date(this.intelligenceSweepBackoffUntil).toISOString(),
      },
    });
  }

  private async safeAutoAction(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch {
      // fail silently to avoid blocking sweep and existing flows
    }
  }

  private shouldRunAutoAction(key: string, cooldownMs: number = this.autoActionCooldownMs): boolean {
    const now = Date.now();
    const last = this.autoActionCooldownTracker.get(key);
    if (last && now - last < cooldownMs) {
      return false;
    }
    this.autoActionCooldownTracker.set(key, now);
    return true;
  }

  private shouldEmitAlert(key: string): boolean {
    const now = Date.now();
    const last = this.alertCooldownTracker.get(key);
    if (last && now - last < this.alertCooldownMs) {
      return false;
    }
    this.alertCooldownTracker.set(key, now);
    return true;
  }

  private async getNotificationCounts(tenantId: string): Promise<{ pending: number; failed: number; abandoned: number; total: number }> {
    const row = await this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'failed' AND retry_count >= 2 THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned,
          COUNT(*) AS total
         FROM mentoria_notification_jobs
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first<AggregateRow>();

    return {
      pending: Number(row?.pending ?? 0),
      failed: Number(row?.failed ?? 0),
      abandoned: Number(row?.abandoned ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  private async getFeedbackCounts(tenantId: string): Promise<{ pending: number; failed: number; total: number }> {
    const row = await this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'failed' AND retry_count >= 2 THEN 1 ELSE 0 END) AS failed,
          COUNT(*) AS total
         FROM mentoria_feedback_jobs
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first<AggregateRow>();

    return {
      pending: Number(row?.pending ?? 0),
      failed: Number(row?.failed ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  private async getPublishCounts(tenantId: string): Promise<{ pending: number; failed: number; abandoned: number; total: number }> {
    const row = await this.db
      .prepare(
        `SELECT
          SUM(CASE WHEN status IN ('pending_publish', 'pending_confirmation') THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'failed' AND retry_count >= 1 THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'abandoned' THEN 1 ELSE 0 END) AS abandoned,
          COUNT(*) AS total
         FROM mentoria_publish_jobs
         WHERE tenant_id = ?`
      )
      .bind(tenantId)
      .first<AggregateRow>();

    return {
      pending: Number(row?.pending ?? 0),
      failed: Number(row?.failed ?? 0),
      abandoned: Number(row?.abandoned ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  private async getSilenceSignals(tenantId: string): Promise<{
    studentsWithoutRecentFeedback: number;
    studentsWithoutRecentParentNotification: number;
    studentsWithoutRecentAcademicActivity: number;
  }> {
    const feedbackCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const notificationCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const activityCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [feedbackSilence, notificationSilence, activitySilence] = await Promise.all([
      this.db
        .prepare(
          `SELECT COUNT(DISTINCT ls.student_profile_id) AS count
           FROM learning_sessions ls
           WHERE ls.tenant_id = ?
             AND ls.student_profile_id IS NOT NULL
             AND ls.completed_at IS NOT NULL
             AND ls.completed_at >= ?
             AND NOT EXISTS (
               SELECT 1
               FROM mentoria_feedback_jobs fj
               WHERE fj.tenant_id = ls.tenant_id
                 AND fj.student_profile_id = ls.student_profile_id
                 AND fj.status = 'stored'
                 AND fj.created_at >= ?
             )`
        )
        .bind(tenantId, feedbackCutoff, feedbackCutoff)
        .first<CountRow>(),
      this.db
        .prepare(
          `SELECT COUNT(DISTINCT ls.student_profile_id) AS count
           FROM learning_sessions ls
           WHERE ls.tenant_id = ?
             AND ls.student_profile_id IS NOT NULL
             AND ls.completed_at IS NOT NULL
             AND ls.completed_at >= ?
             AND NOT EXISTS (
               SELECT 1
               FROM mentoria_notification_log nl
               WHERE nl.tenant_id = ls.tenant_id
                 AND nl.student_id = ls.student_profile_id
                 AND nl.status = 'success'
                 AND nl.created_at >= ?
             )`
        )
        .bind(tenantId, notificationCutoff, notificationCutoff)
        .first<CountRow>(),
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM student_profiles sp
           WHERE sp.tenant_id = ?
             AND sp.onboarding_completed = 1
             AND NOT EXISTS (
               SELECT 1
               FROM learning_sessions ls
               WHERE ls.tenant_id = sp.tenant_id
                 AND ls.student_profile_id = sp.id
                 AND ls.created_at >= ?
             )`
        )
        .bind(tenantId, activityCutoff)
        .first<CountRow>(),
    ]);

    return {
      studentsWithoutRecentFeedback: Number(feedbackSilence?.count ?? 0),
      studentsWithoutRecentParentNotification: Number(notificationSilence?.count ?? 0),
      studentsWithoutRecentAcademicActivity: Number(activitySilence?.count ?? 0),
    };
  }

  private async getSilenceRecoveryCandidates(tenantId: string, limit: number): Promise<SilenceRecoveryCandidateRow[]> {
    const feedbackCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const result = await this.db
      .prepare(
        `SELECT ls.student_profile_id AS student_id, MAX(ls.id) AS session_id
         FROM learning_sessions ls
         WHERE ls.tenant_id = ?
           AND ls.student_profile_id IS NOT NULL
           AND ls.completed_at IS NOT NULL
           AND ls.completed_at >= ?
           AND NOT EXISTS (
             SELECT 1
             FROM mentoria_feedback_jobs fj
             WHERE fj.tenant_id = ls.tenant_id
               AND fj.student_profile_id = ls.student_profile_id
               AND fj.status = 'stored'
               AND fj.created_at >= ?
           )
         GROUP BY ls.student_profile_id
         ORDER BY MAX(ls.completed_at) DESC
         LIMIT ?`
      )
      .bind(tenantId, feedbackCutoff, feedbackCutoff, limit)
      .all<SilenceRecoveryCandidateRow>();

    return (result.results ?? []).filter((row) => Boolean(row.student_id) && Boolean(row.session_id));
  }

  private async getLatestParentPhoneForStudent(tenantId: string, studentId: string): Promise<string | null> {
    const fromQueue = await this.db
      .prepare(
        `SELECT parent_phone
         FROM mentoria_notification_jobs
         WHERE tenant_id = ?
           AND student_id = ?
           AND parent_phone IS NOT NULL
           AND TRIM(parent_phone) <> ''
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, studentId)
      .first<StudentPhoneRow>();

    if (fromQueue?.parent_phone) {
      return fromQueue.parent_phone;
    }

    const fromLog = await this.db
      .prepare(
        `SELECT parent_phone
         FROM mentoria_notification_log
         WHERE tenant_id = ?
           AND student_id = ?
           AND parent_phone IS NOT NULL
           AND TRIM(parent_phone) <> ''
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, studentId)
      .first<StudentPhoneRow>();

    return fromLog?.parent_phone ?? null;
  }

  private buildAutoSilenceSummary(sessionId: string, studentId: string): SessionSummary {
    return {
      sessionId,
      studentName: studentId,
      subjectName: "Mentoria",
      topic: "Seguimiento de continuidad",
      durationMinutes: 0,
      performanceScore: 50,
      emotionalState: "unknown",
      emotionalSignal: "silence_detection",
      detectedDifficulty: "slow_progress",
      recommendation: "Retomar actividad guiada y confirmar próximos pasos.",
      parentMessage: `Detectamos silencio académico reciente en ${studentId}. Recomendamos retomar la continuidad de sesiones esta semana.`,
      actionItems: [
        "Confirmar disponibilidad para próxima sesión",
        "Reforzar último tema trabajado",
      ],
    };
  }

  private async listRecentTenantIds(): Promise<string[]> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await this.db
      .prepare(
        `SELECT DISTINCT tenant_id FROM (
          SELECT tenant_id FROM mentoria_notification_jobs WHERE created_at >= ?
          UNION
          SELECT tenant_id FROM mentoria_feedback_jobs WHERE created_at >= ?
          UNION
          SELECT tenant_id FROM mentoria_publish_jobs WHERE created_at >= ?
          UNION
          SELECT tenant_id FROM mentoria_system_events WHERE created_at >= ?
          UNION
          SELECT tenant_id FROM learning_sessions WHERE created_at >= ?
        )
        WHERE tenant_id IS NOT NULL`
      )
      .bind(cutoff, cutoff, cutoff, cutoff, cutoff)
      .all<{ tenant_id: string }>();

    return (result.results ?? []).map((row) => row.tenant_id).filter(Boolean);
  }
}

// Singleton instance
let orchestrator: MentoriaResilienceOrchestrator | null = null;

export function getMentoriaOrchestrator(): MentoriaResilienceOrchestrator {
  if (!orchestrator) {
    orchestrator = new MentoriaResilienceOrchestrator();
  }
  return orchestrator;
}
