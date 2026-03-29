import { sendWhatsAppMessage } from "@/connectors/whatsapp/client";
import type { SessionSummary } from "@/lib/mentoria/session-summary";
import { getDb } from "@/lib/db";

export type ParentNotification = {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  message: string;
  actionItems: string[];
  sentAt: string;
  success: boolean;
  error?: string;
  messageId?: string;
  retryCount?: number;
};

function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export async function sendParentSessionNotification(input: {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  summary: SessionSummary;
}): Promise<ParentNotification> {
  const now = new Date().toISOString();
  const message = buildNotificationMessage(input.summary);

  if (!validatePhoneNumber(input.parentPhone)) {
    const errorMsg = "INVALID_PHONE_NUMBER";
    console.error("[ParentNotification] Invalid phone number:", input.parentPhone);
    await logNotificationFailure({
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      error: errorMsg,
      timestamp: now,
    });
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message,
      actionItems: input.summary.actionItems,
      sentAt: now,
      success: false,
      error: errorMsg,
    };
  }

  try {
    const result = await sendWhatsAppMessage(input.parentPhone, message);

    if (!result.success) {
      console.error("[ParentNotification] WhatsApp send failed:", result.error, "Retries:", result.retryCount);
      await logNotificationFailure({
        sessionId: input.sessionId,
        studentId: input.studentId,
        parentPhone: input.parentPhone,
        error: result.error || "WhatsApp send failed",
        timestamp: now,
      });
      return {
        sessionId: input.sessionId,
        studentId: input.studentId,
        parentPhone: input.parentPhone,
        message,
        actionItems: input.summary.actionItems,
        sentAt: now,
        success: false,
        error: result.error,
        retryCount: result.retryCount,
      };
    }

    console.log("[ParentNotification] Message sent successfully:", result.messageId, "Retries:", result.retryCount);
    await logNotificationSuccess({
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      messageId: result.messageId,
      timestamp: now,
    });
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message,
      actionItems: input.summary.actionItems,
      sentAt: now,
      success: true,
      messageId: result.messageId,
      retryCount: result.retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ParentNotification] Error sending notification:", errorMessage);
    await logNotificationFailure({
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      error: errorMessage,
      timestamp: now,
    });
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message,
      actionItems: input.summary.actionItems,
      sentAt: now,
      success: false,
      error: errorMessage,
    };
  }
}

async function logNotificationSuccess(input: {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  messageId?: string;
  timestamp: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO mentoria_notification_log (
          id, session_id, student_id, parent_phone, message_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.sessionId,
        input.studentId,
        input.parentPhone,
        input.messageId || null,
        "success",
        input.timestamp
      )
      .run();
  } catch (error) {
    console.error("[NotificationLog] Failed to log success:", error);
  }
}

async function logNotificationFailure(input: {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  error: string;
  timestamp: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO mentoria_notification_log (
          id, session_id, student_id, parent_phone, error_message, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.sessionId,
        input.studentId,
        input.parentPhone,
        input.error,
        "failed",
        input.timestamp
      )
      .run();
  } catch (error) {
    console.error("[NotificationLog] Failed to log failure:", error);
  }
}

function buildNotificationMessage(summary: SessionSummary): string {
  const lines: string[] = [];

  lines.push(summary.parentMessage);
  lines.push("");

  if (summary.actionItems.length > 0) {
    lines.push("Acciones recomendadas:");
    summary.actionItems.forEach((item) => {
      lines.push(`• ${item}`);
    });
  }

  lines.push("");
  lines.push("Mentoria - Educación personalizada para tu hijo");

  return lines.join("\n");
}

export async function detectAndTriggerAlerts(input: {
  tenantId: string;
  studentId: string;
  parentPhone: string;
  performanceScore: number;
  frustrationLevel: number;
  sessionsCompleted: number;
  lastActivityAt: string;
}): Promise<string | null> {
  const now = new Date();
  const lastActivity = new Date(input.lastActivityAt);
  const inactivityHours = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

  if (input.performanceScore < 30) {
    const alertMessage = `⚠️ Alerta: ${input.studentId} está teniendo dificultades significativas. Recomendamos una sesión de refuerzo urgente.`;
    console.log("[AlertTrigger] Low performance alert:", alertMessage);
    return "low_performance_alert";
  }

  if (input.frustrationLevel >= 0.8) {
    const alertMessage = `⚠️ Alerta: Se detectó frustración alta en la última sesión. Considere tomar un descanso y retomar mañana.`;
    console.log("[AlertTrigger] High frustration alert:", alertMessage);
    return "high_frustration_alert";
  }

  if (inactivityHours > 48 && input.sessionsCompleted > 0) {
    const alertMessage = `📢 Recordatorio: ${input.studentId} no ha tenido sesiones en 2 días. ¿Volvemos a empezar?`;
    console.log("[AlertTrigger] Inactivity alert:", alertMessage);
    return "inactivity_alert";
  }

  return null;
}
