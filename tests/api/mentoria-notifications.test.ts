import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mentoria notification system (end-to-end style in-memory test)
 *
 * Validates:
 * - parent alert trigger
 * - queue persistence
 * - retry behavior
 * - idempotency / no duplicate alerts
 * - multi-tenant isolation
 * - multiple channels
 * - status transitions
 */

type AlertType = "low_engagement" | "missing_homework" | "behavior_issue";
type NotificationChannel = "whatsapp" | "email";
type NotificationStatus = "pending" | "sent" | "failed";

interface NotificationAlert {
  id: string;
  familyId: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  alertType: AlertType;
  message: string;
  parentEmail: string;
  createdAt: string;
  idempotencyKey: string;
}

interface QueuedNotification {
  id: string;
  alertId: string;
  tenantId: string;
  channel: NotificationChannel;
  recipientPhone?: string;
  recipientEmail?: string;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

interface ProcessQueueResult {
  processed: number;
  failed: number;
  retried: number;
}

const createIdFactory = () => {
  let counter = 0;
  return () => `id_${++counter}`;
};

describe("mentoria notification system (end-to-end)", () => {
  let makeId: () => string;
  let alerts: NotificationAlert[];
  let queue: QueuedNotification[];
  let webhookCalls: Array<{ email: string; subject: string; body: string }>;
  let whatsappCalls: Array<{ phone: string; message: string }>;

  const createService = () => {
    const getAlertIdempotencyKey = (input: {
      familyId: string;
      studentId: string;
      alertType: string;
    }): string => {
      return `${input.familyId}:${input.studentId}:${input.alertType}`;
    };

    const triggerParentAlert = async (input: {
      familyId: string;
      tenantId: string;
      studentId: string;
      studentName: string;
      alertType: AlertType;
      message: string;
      parentEmail: string;
    }): Promise<NotificationAlert> => {
      const idempotencyKey = getAlertIdempotencyKey({
        familyId: input.familyId,
        studentId: input.studentId,
        alertType: input.alertType,
      });

      const existing = alerts.find(alert => alert.idempotencyKey === idempotencyKey);
      if (existing) {
        return existing;
      }

      const alert: NotificationAlert = {
        id: makeId(),
        familyId: input.familyId,
        tenantId: input.tenantId,
        studentId: input.studentId,
        studentName: input.studentName,
        alertType: input.alertType,
        message: input.message,
        parentEmail: input.parentEmail,
        createdAt: new Date().toISOString(),
        idempotencyKey,
      };

      alerts.push(alert);
      return alert;
    };

    const queueNotification = async (input: {
      alertId: string;
      tenantId: string;
      channel: NotificationChannel;
      recipientPhone?: string;
      recipientEmail?: string;
      maxRetries?: number;
    }): Promise<QueuedNotification> => {
      const notification: QueuedNotification = {
        id: makeId(),
        alertId: input.alertId,
        tenantId: input.tenantId,
        channel: input.channel,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        status: "pending",
        retryCount: 0,
        maxRetries: input.maxRetries ?? 3,
        createdAt: new Date().toISOString(),
      };

      queue.push(notification);
      return notification;
    };

    const processQueue = async (
      sender?: {
        sendWhatsapp?: (notification: QueuedNotification) => Promise<void>;
        sendEmail?: (notification: QueuedNotification) => Promise<void>;
      }
    ): Promise<ProcessQueueResult> => {
      let processed = 0;
      let failed = 0;
      let retried = 0;

      for (const notification of queue) {
        if (notification.status !== "pending") {
          continue;
        }

        try {
          if (notification.channel === "whatsapp") {
            if (sender?.sendWhatsapp) {
              await sender.sendWhatsapp(notification);
            } else {
              whatsappCalls.push({
                phone: notification.recipientPhone ?? "",
                message: `Alert: ${notification.alertId}`,
              });
            }
          }

          if (notification.channel === "email") {
            if (sender?.sendEmail) {
              await sender.sendEmail(notification);
            } else {
              webhookCalls.push({
                email: notification.recipientEmail ?? "",
                subject: "Mentoria Alert",
                body: `Alert: ${notification.alertId}`,
              });
            }
          }

          notification.status = "sent";
          notification.sentAt = new Date().toISOString();
          processed++;
        } catch (error) {
          notification.retryCount += 1;

          if (notification.retryCount >= notification.maxRetries) {
            notification.status = "failed";
            notification.lastError = error instanceof Error ? error.message : String(error);
            failed++;
          } else {
            retried++;
          }
        }
      }

      return { processed, failed, retried };
    };

    const getAlertsByFamily = async (familyId: string): Promise<NotificationAlert[]> => {
      return alerts.filter(alert => alert.familyId === familyId);
    };

    const getQueueByTenant = async (tenantId: string): Promise<QueuedNotification[]> => {
      return queue.filter(notification => notification.tenantId === tenantId);
    };

    return {
      triggerParentAlert,
      queueNotification,
      processQueue,
      getAlertsByFamily,
      getQueueByTenant,
      getAlertIdempotencyKey,
    };
  };

  beforeEach(() => {
    makeId = createIdFactory();
    alerts = [];
    queue = [];
    webhookCalls = [];
    whatsappCalls = [];
  });

  it("triggers parent alert for low engagement", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "low_engagement",
      message: "Juan has not completed assignments this week",
      parentEmail: "parent@example.com",
    });

    expect(alert).toBeDefined();
    expect(alert.id).toBeDefined();
    expect(alert.familyId).toBe("family-123");
    expect(alert.tenantId).toBe("tenant-socialflow");
    expect(alert.studentName).toBe("Juan García");
    expect(alert.alertType).toBe("low_engagement");
    expect(alert.createdAt).toBeDefined();
    expect(alert.idempotencyKey).toBe("family-123:student-456:low_engagement");
  });

  it("queues notification after alert trigger", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "missing_homework",
      message: "Missing homework submission",
      parentEmail: "parent@example.com",
    });

    const notification = await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "whatsapp",
      recipientPhone: "+34612345678",
    });

    expect(notification).toBeDefined();
    expect(notification.alertId).toBe(alert.id);
    expect(notification.status).toBe("pending");
    expect(notification.retryCount).toBe(0);
    expect(notification.maxRetries).toBe(3);
  });

  it("persists queue and processes notifications", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "behavior_issue",
      message: "Behavior concern reported",
      parentEmail: "parent@example.com",
    });

    await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "email",
      recipientEmail: "parent@example.com",
    });

    const result = await service.processQueue();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.retried).toBe(0);
    expect(webhookCalls).toHaveLength(1);
    expect(webhookCalls[0].email).toBe("parent@example.com");
  });

  it("retries failed notifications up to maxRetries", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "low_engagement",
      message: "Low engagement alert",
      parentEmail: "parent@example.com",
    });

    const notification = await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "whatsapp",
      recipientPhone: "+34612345678",
      maxRetries: 3,
    });

    const sendWhatsapp = vi.fn<(_: QueuedNotification) => Promise<void>>().mockRejectedValue(
      new Error("WHATSAPP_SEND_FAILED")
    );

    const firstAttempt = await service.processQueue({ sendWhatsapp });
    expect(firstAttempt.processed).toBe(0);
    expect(firstAttempt.failed).toBe(0);
    expect(firstAttempt.retried).toBe(1);
    expect(notification.retryCount).toBe(1);
    expect(notification.status).toBe("pending");

    const secondAttempt = await service.processQueue({ sendWhatsapp });
    expect(secondAttempt.processed).toBe(0);
    expect(secondAttempt.failed).toBe(0);
    expect(secondAttempt.retried).toBe(1);
    expect(notification.retryCount).toBe(2);
    expect(notification.status).toBe("pending");

    const thirdAttempt = await service.processQueue({ sendWhatsapp });
    expect(thirdAttempt.processed).toBe(0);
    expect(thirdAttempt.failed).toBe(1);
    expect(thirdAttempt.retried).toBe(0);
    expect(notification.retryCount).toBe(3);
    expect(notification.status).toBe("failed");
    expect(notification.lastError).toBe("WHATSAPP_SEND_FAILED");
  });

  it("prevents duplicate alerts via idempotency key", async () => {
    const service = createService();

    const familyId = "family-123";
    const studentId = "student-456";
    const alertType: AlertType = "low_engagement";

    const alert1 = await service.triggerParentAlert({
      familyId,
      tenantId: "tenant-socialflow",
      studentId,
      studentName: "Juan García",
      alertType,
      message: "Low engagement",
      parentEmail: "parent@example.com",
    });

    const alert2 = await service.triggerParentAlert({
      familyId,
      tenantId: "tenant-socialflow",
      studentId,
      studentName: "Juan García",
      alertType,
      message: "Low engagement",
      parentEmail: "parent@example.com",
    });

    const key = service.getAlertIdempotencyKey({
      familyId,
      studentId,
      alertType,
    });

    expect(alert1.id).toBe(alert2.id);
    expect(alert1.idempotencyKey).toBe(key);

    const familyAlerts = await service.getAlertsByFamily(familyId);
    expect(familyAlerts).toHaveLength(1);
  });

  it("enforces multi-tenant isolation", async () => {
    const service = createService();

    const alert1 = await service.triggerParentAlert({
      familyId: "family-tenant1",
      tenantId: "tenant-socialflow",
      studentId: "student-1",
      studentName: "Student One",
      alertType: "low_engagement",
      message: "Alert for tenant 1",
      parentEmail: "parent1@example.com",
    });

    await service.queueNotification({
      alertId: alert1.id,
      tenantId: "tenant-socialflow",
      channel: "email",
      recipientEmail: "parent1@example.com",
    });

    const alert2 = await service.triggerParentAlert({
      familyId: "family-tenant2",
      tenantId: "tenant-other",
      studentId: "student-2",
      studentName: "Student Two",
      alertType: "missing_homework",
      message: "Alert for tenant 2",
      parentEmail: "parent2@example.com",
    });

    await service.queueNotification({
      alertId: alert2.id,
      tenantId: "tenant-other",
      channel: "email",
      recipientEmail: "parent2@example.com",
    });

    const tenant1Queue = await service.getQueueByTenant("tenant-socialflow");
    const tenant2Queue = await service.getQueueByTenant("tenant-other");

    expect(tenant1Queue).toHaveLength(1);
    expect(tenant2Queue).toHaveLength(1);
    expect(tenant1Queue[0].alertId).toBe(alert1.id);
    expect(tenant2Queue[0].alertId).toBe(alert2.id);
    expect(tenant1Queue[0].tenantId).toBe("tenant-socialflow");
    expect(tenant2Queue[0].tenantId).toBe("tenant-other");
  });

  it("handles multiple notification channels (WhatsApp + Email)", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "behavior_issue",
      message: "Behavior alert",
      parentEmail: "parent@example.com",
    });

    await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "whatsapp",
      recipientPhone: "+34612345678",
    });

    await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "email",
      recipientEmail: "parent@example.com",
    });

    const result = await service.processQueue();

    expect(result.processed).toBe(2);
    expect(whatsappCalls).toHaveLength(1);
    expect(webhookCalls).toHaveLength(1);
    expect(whatsappCalls[0].phone).toBe("+34612345678");
    expect(webhookCalls[0].email).toBe("parent@example.com");
  });

  it("tracks notification status transitions", async () => {
    const service = createService();

    const alert = await service.triggerParentAlert({
      familyId: "family-123",
      tenantId: "tenant-socialflow",
      studentId: "student-456",
      studentName: "Juan García",
      alertType: "low_engagement",
      message: "Status tracking test",
      parentEmail: "parent@example.com",
    });

    const notification = await service.queueNotification({
      alertId: alert.id,
      tenantId: "tenant-socialflow",
      channel: "email",
      recipientEmail: "parent@example.com",
    });

    expect(notification.status).toBe("pending");
    expect(notification.sentAt).toBeUndefined();

    await service.processQueue();

    const queuedNotif = queue.find(item => item.id === notification.id);
    expect(queuedNotif?.status).toBe("sent");
    expect(queuedNotif?.sentAt).toBeDefined();
  });
});