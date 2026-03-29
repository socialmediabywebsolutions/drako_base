import { sendWhatsAppAlert } from "@/connectors/whatsapp/agent";
import type { SessionSummary } from "@/lib/mentoria/session-summary";

export type ParentNotification = {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  message: string;
  actionItems: string[];
  sentAt: string;
  success: boolean;
  error?: string;
};

export async function sendParentSessionNotification(input: {
  sessionId: string;
  studentId: string;
  parentPhone: string;
  summary: SessionSummary;
}): Promise<ParentNotification> {
  const now = new Date().toISOString();

  try {
    const message = buildNotificationMessage(input.summary);
    
    const result = await sendWhatsAppAlert(message);

    if (!result.success) {
      console.error("[ParentNotification] WhatsApp send failed:", result.error);
      return {
        sessionId: input.sessionId,
        studentId: input.studentId,
        parentPhone: input.parentPhone,
        message,
        actionItems: input.summary.actionItems,
        sentAt: now,
        success: false,
        error: result.error || "WhatsApp send failed",
      };
    }

    console.log("[ParentNotification] Message sent successfully:", result.messageId);
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message,
      actionItems: input.summary.actionItems,
      sentAt: now,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ParentNotification] Error sending notification:", errorMessage);
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message: input.summary.parentMessage,
      actionItems: input.summary.actionItems,
      sentAt: now,
      success: false,
      error: errorMessage,
    };
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
    try {
      await sendWhatsAppAlert(alertMessage);
      return "low_performance_alert";
    } catch (error) {
      console.error("[AlertTrigger] Failed to send low performance alert:", error);
    }
  }

  if (input.frustrationLevel >= 0.8) {
    const alertMessage = `⚠️ Alerta: Se detectó frustración alta en la última sesión. Considere tomar un descanso y retomar mañana.`;
    try {
      await sendWhatsAppAlert(alertMessage);
      return "high_frustration_alert";
    } catch (error) {
      console.error("[AlertTrigger] Failed to send frustration alert:", error);
    }
  }

  if (inactivityHours > 48 && input.sessionsCompleted > 0) {
    const alertMessage = `📢 Recordatorio: ${input.studentId} no ha tenido sesiones en 2 días. ¿Volvemos a empezar?`;
    try {
      await sendWhatsAppAlert(alertMessage);
      return "inactivity_alert";
    } catch (error) {
      console.error("[AlertTrigger] Failed to send inactivity alert:", error);
    }
  }

  return null;
}
