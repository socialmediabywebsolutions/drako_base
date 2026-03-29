import { NotificationQueueManager } from "@/lib/mentoria/resilience/notification-queue";
import { NotificationWorker } from "@/lib/mentoria/resilience/notification-worker";
import { FeedbackGuarantee } from "@/lib/mentoria/resilience/feedback-guarantee";
import { SocialFlowValidation } from "@/lib/mentoria/resilience/socialflow-validation";
import { TenantGuard } from "@/lib/mentoria/resilience/tenant-guard";
import { EventLogger } from "@/lib/mentoria/resilience/event-logger";
import { IdempotencyManager } from "@/lib/mentoria/resilience/idempotency";
import { AtomicTrialEnforcement } from "@/lib/mentoria/resilience/trial-enforcement";

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

  constructor() {
    this.notificationQueue = new NotificationQueueManager();
    this.notificationWorker = new NotificationWorker();
    this.feedbackGuarantee = new FeedbackGuarantee();
    this.socialFlowValidation = new SocialFlowValidation();
    this.tenantGuard = new TenantGuard();
    this.eventLogger = new EventLogger();
    this.idempotencyManager = new IdempotencyManager();
    this.trialEnforcement = new AtomicTrialEnforcement();
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
  }

  /**
   * Get system health status
   */
  async getHealthStatus(tenantId: string): Promise<{
    notifications: { pending: number; failed: number };
    feedback: { pending: number; failed: number };
    publishes: { pending: number; failed: number };
    criticalEvents: number;
  }> {
    const [notificationJobs, feedbackJobs, publishJobs, criticalEvents] = await Promise.all([
      this.notificationQueue.getPendingJobs(1000),
      this.feedbackGuarantee.processPendingFeedback(0),
      this.socialFlowValidation.processPendingPublishes(0),
      this.eventLogger.getCriticalEvents(tenantId),
    ]);

    return {
      notifications: {
        pending: notificationJobs.filter((j) => j.status === "pending").length,
        failed: notificationJobs.filter((j) => j.status === "failed").length,
      },
      feedback: {
        pending: 0, // Would need to query
        failed: 0,
      },
      publishes: {
        pending: 0, // Would need to query
        failed: 0,
      },
      criticalEvents: criticalEvents.length,
    };
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
