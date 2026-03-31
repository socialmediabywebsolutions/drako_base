/**
 * P1 PRODUCT REAL: Event System Core
 * 
 * Sistema central de eventos para Mentoría
 * - Persistencia en D1 real
 * - Reutilizable por todo el sistema
 * - Fail-closed: requiere D1 binding
 */

import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export type EventType =
  | "student.session.started"
  | "student.session.completed"
  | "student.activity.completed"
  | "student.progress.updated"
  | "student.alert.generated"
  | "student.summary.generated"
  | "guardian.invited"
  | "guardian.accepted"
  | "teacher.feedback.sent"
  | "system.alert.generated";

export type ActorType = "student" | "guardian" | "teacher" | "system";

export interface EventPayload {
  type: EventType;
  actorType: ActorType;
  actorId: string;
  studentId?: string;
  familyId?: string;
  metadata?: Record<string, unknown>;
}

export interface Event extends EventPayload {
  id: string;
  createdAt: string;
}

/**
 * Emite un evento al sistema
 * Persiste en D1 real
 */
export async function emitEvent(payload: EventPayload): Promise<Event> {
  const db = getDb();
  const eventId = randomUUID();
  const createdAt = new Date().toISOString();

  const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;

  await db
    .prepare(
      `INSERT INTO events (id, type, actor_type, actor_id, student_id, family_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      eventId,
      payload.type,
      payload.actorType,
      payload.actorId,
      payload.studentId ?? null,
      payload.familyId ?? null,
      metadataJson,
      createdAt
    )
    .run();

  return {
    id: eventId,
    createdAt,
    ...payload,
  };
}

/**
 * Obtiene eventos por estudiante
 */
export async function getEventsByStudent(studentId: string, limit: number = 50): Promise<Event[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, type, actor_type, actor_id, student_id, family_id, metadata, created_at
       FROM events
       WHERE student_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(studentId, limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    type: row.type as EventType,
    actorType: row.actor_type as ActorType,
    actorId: row.actor_id,
    studentId: row.student_id,
    familyId: row.family_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Obtiene eventos por familia
 */
export async function getEventsByFamily(familyId: string, limit: number = 100): Promise<Event[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, type, actor_type, actor_id, student_id, family_id, metadata, created_at
       FROM events
       WHERE family_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(familyId, limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    type: row.type as EventType,
    actorType: row.actor_type as ActorType,
    actorId: row.actor_id,
    studentId: row.student_id,
    familyId: row.family_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Obtiene eventos por tipo
 */
export async function getEventsByType(type: EventType, limit: number = 50): Promise<Event[]> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, type, actor_type, actor_id, student_id, family_id, metadata, created_at
       FROM events
       WHERE type = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(type, limit)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    type: row.type as EventType,
    actorType: row.actor_type as ActorType,
    actorId: row.actor_id,
    studentId: row.student_id,
    familyId: row.family_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Genera notificaciones a partir de un evento
 */
export async function generateNotificationsFromEvent(event: Event): Promise<Array<{ type: string; message: string }>> {
  const notifications: Array<{ type: string; message: string }> = [];

  switch (event.type) {
    case "student.alert.generated":
      notifications.push({
        type: "alert",
        message: `Alert generated for student ${event.studentId}`,
      });
      break;
    case "student.summary.generated":
      notifications.push({
        type: "summary",
        message: `Summary generated for student ${event.studentId}`,
      });
      break;
    case "student.session.completed":
      notifications.push({
        type: "session",
        message: `Session completed for student ${event.studentId}`,
      });
      break;
    case "student.progress.updated":
      notifications.push({
        type: "progress",
        message: `Progress updated for student ${event.studentId}`,
      });
      break;
  }

  return notifications;
}
