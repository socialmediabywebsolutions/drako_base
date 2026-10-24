import { sendWhatsAppMessage } from "@/connectors/whatsapp/client";
import type { SessionSummary } from "@/lib/mentoria/session-summary";
import { getDb } from "@/lib/mentoria/db";

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
  tenantId?: string;
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
      tenantId: input.tenantId,
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
      actionItems: input.summary.actionItems ?? [],
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
        tenantId: input.tenantId,
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
        actionItems: input.summary.actionItems ?? [],
        sentAt: now,
        success: false,
        error: result.error,
        retryCount: result.retryCount,
      };
    }

    console.log("[ParentNotification] Message sent successfully:", result.messageId, "Retries:", result.retryCount);
    await logNotificationSuccess({
      tenantId: input.tenantId,
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
      actionItems: input.summary.actionItems ?? [],
      sentAt: now,
      success: true,
      messageId: result.messageId,
      retryCount: result.retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ParentNotification] Error sending notification:", errorMessage);
    await logNotificationFailure({
      tenantId: input.tenantId,
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
      actionItems: input.summary.actionItems ?? [],
      sentAt: now,
      success: false,
      error: errorMessage,
    };
  }
}

async function logNotificationSuccess(input: {
  tenantId?: string;
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
          id, tenant_id, session_id, student_id, parent_phone, message_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.tenantId ?? null,
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
  tenantId?: string;
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
          id, tenant_id, session_id, student_id, parent_phone, error_message, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.tenantId ?? null,
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

  lines.push(summary.parentMessage ?? "");
  lines.push("");

  const actionItems = summary.actionItems ?? [];
  if (actionItems.length > 0) {
    lines.push("Acciones recomendadas:");
    actionItems.forEach((item: string) => {
      lines.push(`• ${item}`);
    });
  }

  lines.push("");
  lines.push("Mentoria - Educación personalizada para tu hijo");

  return lines.join("\n");
}

// ─── Alerta de seguridad al padre/tutor ──────────────────────────────────────

export type SafetyAlertLevel = "medium" | "high";
export type SafetyAlertCategory =
  | "bullying_disclosure"
  | "emotional_distress"
  | "self_harm_ideation"
  | "suicidal_ideation"
  | "abuse_disclosure";

/**
 * Envía un mensaje de WhatsApp al padre/tutor cuando el protocolo de seguridad
 * detecta una señal que requiere atención adulta.
 *
 * PRINCIPIO: el mensaje NO revela el contenido exacto del alumno.
 * Solo señala que puede necesitar apoyo y sugiere hablar con él.
 */
export async function sendSafetyAlertToParent(input: {
  tenantId?: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  parentPhone: string;
  level: SafetyAlertLevel;
  category: SafetyAlertCategory;
}): Promise<ParentNotification> {
  const now = new Date().toISOString();
  const message = buildSafetyAlertMessage(input.studentName, input.level, input.category);

  if (!validatePhoneNumber(input.parentPhone)) {
    const errorMsg = "INVALID_PHONE_NUMBER";
    console.error("[SafetyAlert] Invalid phone number:", input.parentPhone);
    await logNotificationFailure({
      tenantId: input.tenantId,
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
      actionItems: [],
      sentAt: now,
      success: false,
      error: errorMsg,
    };
  }

  try {
    const result = await sendWhatsAppMessage(input.parentPhone, message);
    if (!result.success) {
      console.error("[SafetyAlert] WhatsApp send failed:", result.error);
      await logNotificationFailure({
        tenantId: input.tenantId,
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
        actionItems: [],
        sentAt: now,
        success: false,
        error: result.error,
      };
    }
    console.log("[SafetyAlert] Alert sent to parent:", result.messageId, "level:", input.level, "category:", input.category);
    await logNotificationSuccess({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      messageId: result.messageId,
      timestamp: now,
    });
    await logSafetyAlert({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      level: input.level,
      category: input.category,
      messageId: result.messageId,
      sendStatus: "success",
      timestamp: now,
    });
    return {
      sessionId: input.sessionId,
      studentId: input.studentId,
      parentPhone: input.parentPhone,
      message,
      actionItems: [],
      sentAt: now,
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SafetyAlert] Error sending alert:", errorMessage);
    await logNotificationFailure({
      tenantId: input.tenantId,
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
      actionItems: [],
      sentAt: now,
      success: false,
      error: errorMessage,
    };
  }
}

function buildSafetyAlertMessage(
  studentName: string,
  level: SafetyAlertLevel,
  category: SafetyAlertCategory,
): string {
  const name = studentName.split(" ")[0] ?? studentName;

  if (level === "high") {
    switch (category) {
      case "suicidal_ideation":
        return [
          `🔴 Aviso importante sobre ${name} — Mentoría`,
          "",
          `Durante la sesión de hoy, ${name} ha expresado algo que nos preocupa y que merece tu atención lo antes posible.`,
          "",
          "Por favor, habla con él/ella hoy. Si crees que puede necesitar apoyo profesional, el Teléfono de la Esperanza (717 003 717) es un recurso confidencial y gratuito.",
          "",
          "Hemos pausado la sesión para que puedas estar con él/ella.",
          "",
          "Mentoría — Educación personalizada para tu hijo",
        ].join("\n");
      case "self_harm_ideation":
        return [
          `🔴 Aviso importante sobre ${name} — Mentoría`,
          "",
          `${name} ha compartido algo durante su sesión que requiere atención. Te lo comunicamos con discreción y respeto.`,
          "",
          "Habla con él/ella hoy con calma, sin presión. Si ves que necesita apoyo adicional, su médico de cabecera o un psicólogo pueden ayudar.",
          "",
          "Hemos pausado la sesión.",
          "",
          "Mentoría — Educación personalizada para tu hijo",
        ].join("\n");
      case "abuse_disclosure":
        return [
          `🔴 Aviso urgente sobre ${name} — Mentoría`,
          "",
          `Durante la sesión, ${name} ha expresado algo que nos genera preocupación por su bienestar. Es importante que hables con él/ella y, si es necesario, con alguien de confianza fuera del entorno familiar.`,
          "",
          "El teléfono 016 es confidencial y gratuito y puede orientarte.",
          "",
          "Hemos pausado la sesión.",
          "",
          "Mentoría — Educación personalizada para tu hijo",
        ].join("\n");
      default:
        return [
          `🔴 Aviso importante sobre ${name} — Mentoría`,
          "",
          `${name} ha compartido algo durante su sesión que requiere tu atención. Habla con él/ella hoy.`,
          "",
          "Hemos pausado la sesión.",
          "",
          "Mentoría — Educación personalizada para tu hijo",
        ].join("\n");
    }
  }

  // MEDIUM — bullying o distress
  switch (category) {
    case "bullying_disclosure":
      return [
        `🟡 Aviso sobre ${name} — Mentoría`,
        "",
        `${name} mencionó durante su sesión que puede estar pasándolo mal en el colegio. No hemos entrado en detalles, pero creemos que merece una conversación tranquila contigo.`,
        "",
        "A veces hablar con alguien de confianza marca la diferencia. El orientador del colegio también puede ayudar.",
        "",
        "La sesión ha continuado con normalidad.",
        "",
        "Mentoría — Educación personalizada para tu hijo",
      ].join("\n");
    default:
      return [
        `🟡 Aviso sobre ${name} — Mentoría`,
        "",
        `${name} parece estar pasando por un momento difícil emocionalmente. Durante la sesión de hoy lo hemos notado y queremos que lo sepas.`,
        "",
        "Un pequeño momento de atención y escucha puede ayudar mucho.",
        "",
        "Mentoría — Educación personalizada para tu hijo",
      ].join("\n");
  }
}

// ─── Registro en tabla de alertas de seguridad ───────────────────────────────

async function logSafetyAlert(input: {
  tenantId?: string;
  sessionId: string;
  studentId: string;
  parentPhone: string;
  level: SafetyAlertLevel;
  category: SafetyAlertCategory;
  messageId?: string;
  sendStatus: "success" | "failed";
  timestamp: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO mentoria_safety_alerts (
          id, tenant_id, session_id, student_id, parent_phone, level, category, message_id, send_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        input.tenantId ?? null,
        input.sessionId,
        input.studentId,
        input.parentPhone,
        input.level,
        input.category,
        input.messageId ?? null,
        input.sendStatus,
        input.timestamp,
      )
      .run();
  } catch (error) {
    console.error("[SafetyAlertLog] Failed to log safety alert:", error);
  }
}

/**
 * Devuelve true si hay una alerta de seguridad HIGH o MEDIUM registrada
 * para este alumno en las últimas `windowHours` horas (default: 72h).
 *
 * El Cerebro Académico usa este dato para forzar tono empático y check-in
 * emocional al inicio de la siguiente sesión.
 */
export async function hasRecentSafetyAlertForStudent(input: {
  studentId: string;
  windowHours?: number;
}): Promise<boolean> {
  const windowHours = input.windowHours ?? 72;
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  try {
    const db = getDb();
    const result = await db
      .prepare(
        `SELECT id FROM mentoria_safety_alerts
         WHERE student_id = ?
           AND created_at >= ?
           AND send_status = 'success'
         LIMIT 1`
      )
      .bind(input.studentId, cutoff)
      .first<{ id: string }>();

    return result !== null;
  } catch (error) {
    // Si la tabla no existe todavía (post-migración), no bloqueamos
    console.error("[SafetyAlertLog] Error checking recent safety alert:", error);
    return false;
  }
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
