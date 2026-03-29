/**
 * P1 PRODUCT REAL: Notification Engine
 * 
 * Escucha eventos y genera notificaciones automáticas
 * - Decide a quién notificar
 * - Elige canal (app/whatsapp)
 * - Persiste en D1 real
 */

import { getDb } from "@/lib/db";
import { Event, EventType } from "@/lib/mentoria/event-system";
import { getWhatsAppContacts } from "@/lib/notifications/whatsapp-service";
import { crypto } from "@cloudflare/workers-types";

export type NotificationChannel = "app" | "whatsapp";
export type NotificationStatus = "pending" | "sent" | "failed" | "delivered";
export type NotificationTargetType = "guardian" | "student" | "teacher";

export interface NotificationPayload {
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  eventId: string;
  targetType: NotificationTargetType;
  targetId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: NotificationPayload;
  sentAt?: string;
  createdAt: string;
}

/**
 * Reglas de notificación por tipo de evento
 */
const NOTIFICATION_RULES: Record<EventType, Array<{ targetType: NotificationTargetType; channels: NotificationChannel[] }>> = {
  "student.session.started": [
    { targetType: "guardian", channels: ["app"] },
  ],
  "student.session.completed": [
    { targetType: "guardian", channels: ["app", "whatsapp"] },
  ],
  "student.activity.completed": [
    { targetType: "guardian", channels: ["app"] },
  ],
  "student.progress.updated": [
    { targetType: "guardian", channels: ["app", "whatsapp"] },
  ],
  "guardian.invited": [
    { targetType: "guardian", channels: ["app", "whatsapp"] },
  ],
  "guardian.accepted": [
    { targetType: "student", channels: ["app"] },
  ],
  "teacher.feedback.sent": [
    { targetType: "guardian", channels: ["app", "whatsapp"] },
    { targetType: "student", channels: ["app"] },
  ],
  "system.alert.generated": [
    { targetType: "guardian", channels: ["app", "whatsapp"] },
  ],
};

/**
 * Genera notificaciones basadas en evento
 */
export async function generateNotificationsFromEvent(event: Event): Promise<Notification[]> {
  const db = getDb();
  const rules = NOTIFICATION_RULES[event.type] || [];
  const notifications: Notification[] = [];

  for (const rule of rules) {
    // Obtener IDs de destinatarios según tipo
    const targetIds = await getTargetIds(event, rule.targetType);

    for (const targetId of targetIds) {
      for (const channel of rule.channels) {
        const notification = await createNotification(
          db,
          event.id,
          rule.targetType,
          targetId,
          channel,
          event
        );
        notifications.push(notification);
      }
    }
  }

  return notifications;
}

/**
 * Obtiene IDs de destinatarios según tipo
 */
async function getTargetIds(event: Event, targetType: NotificationTargetType): Promise<string[]> {
  const db = getDb();

  if (targetType === "guardian" && event.studentId) {
    // Obtener guardianes del estudiante
    const result = await db
      .prepare(
        `SELECT DISTINCT guardian_id FROM student_guardians WHERE student_id = ?`
      )
      .bind(event.studentId)
      .all<any>();
    return (result.results ?? []).map((row) => row.guardian_id);
  }

  if (targetType === "student" && event.studentId) {
    return [event.studentId];
  }

  if (targetType === "teacher" && event.familyId) {
    // Obtener profesores de la familia (si existe tabla)
    return [];
  }

  return [];
}

/**
 * Crea notificación en D1
 */
async function createNotification(
  db: D1Database,
  eventId: string,
  targetType: NotificationTargetType,
  targetId: string,
  channel: NotificationChannel,
  event: Event
): Promise<Notification> {
  const notificationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const payload = generateNotificationPayload(event, channel);
  const payloadJson = JSON.stringify(payload);

  await db
    .prepare(
      `INSERT INTO notifications (id, event_id, target_type, target_id, channel, status, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      notificationId,
      eventId,
      targetType,
      targetId,
      channel,
      "pending",
      payloadJson,
      createdAt
    )
    .run();

  return {
    id: notificationId,
    eventId,
    targetType,
    targetId,
    channel,
    status: "pending",
    payload,
    createdAt,
  };
}

/**
 * Genera contenido de notificación según tipo de evento y canal
 */
function generateNotificationPayload(event: Event, channel: NotificationChannel): NotificationPayload {
  const basePayloads: Record<EventType, NotificationPayload> = {
    "student.session.started": {
      title: "Sesión iniciada",
      body: "Tu hijo ha iniciado una sesión en Mentoría",
      actionUrl: "/dashboard",
    },
    "student.session.completed": {
      title: "Sesión completada",
      body: "Tu hijo ha completado una sesión de aprendizaje",
      actionUrl: "/student/progress",
    },
    "student.activity.completed": {
      title: "Actividad completada",
      body: "Tu hijo ha completado una actividad",
      actionUrl: "/student/activities",
    },
    "student.progress.updated": {
      title: "Progreso actualizado",
      body: "El progreso de tu hijo ha sido actualizado",
      actionUrl: "/student/progress",
    },
    "guardian.invited": {
      title: "Invitación aceptada",
      body: "Has sido invitado a ser tutor en Mentoría",
      actionUrl: "/family/setup",
    },
    "guardian.accepted": {
      title: "Nuevo tutor",
      body: "Un nuevo tutor se ha unido a tu familia",
      actionUrl: "/family",
    },
    "teacher.feedback.sent": {
      title: "Feedback del profesor",
      body: "Tu profesor ha dejado un comentario",
      actionUrl: "/messages",
    },
    "system.alert.generated": {
      title: "Alerta importante",
      body: "Hay una alerta importante que requiere tu atención",
      actionUrl: "/alerts",
    },
  };

  return basePayloads[event.type] || {
    title: "Nueva notificación",
    body: "Tienes una nueva notificación",
  };
}

/**
 * Obtiene notificaciones pendientes
 */
export async function getPendingNotifications(limit: number = 100): Promise<Notification[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, event_id, target_type, target_id, channel, status, payload, sent_at, created_at
       FROM notifications
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    targetType: row.target_type as NotificationTargetType,
    targetId: row.target_id,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationStatus,
    payload: JSON.parse(row.payload),
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
}

/**
 * Marca notificación como enviada
 */
export async function markNotificationAsSent(notificationId: string): Promise<void> {
  const db = getDb();

  await db
    .prepare(
      `UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?`
    )
    .bind(new Date().toISOString(), notificationId)
    .run();
}

/**
 * Marca notificación como fallida
 */
export async function markNotificationAsFailed(notificationId: string): Promise<void> {
  const db = getDb();

  await db
    .prepare(
      `UPDATE notifications SET status = 'failed' WHERE id = ?`
    )
    .bind(notificationId)
    .run();
}

/**
 * Obtiene notificaciones de un guardián
 */
export async function getGuardianNotifications(
  guardianId: string,
  limit: number = 50
): Promise<Notification[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, event_id, target_type, target_id, channel, status, payload, sent_at, created_at
       FROM notifications
       WHERE target_type = 'guardian' AND target_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(guardianId, limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    targetType: row.target_type as NotificationTargetType,
    targetId: row.target_id,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationStatus,
    payload: JSON.parse(row.payload),
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
}
