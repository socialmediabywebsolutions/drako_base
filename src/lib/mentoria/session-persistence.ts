import { getDb } from "@/lib/db";
import type { MentoriaSessionMessage } from "@/lib/mentoria/types";

export type SessionSnapshot = {
  sessionId: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  topic: string;
  status: "active" | "paused" | "completed";
  transcript: MentoriaSessionMessage[];
  emotionalState: string;
  lastActivityAt: string;
  aiTokensUsed: number;
  durationMinutes: number;
};

export type SessionRecoveryData = {
  sessionId: string;
  tenantId: string;
  studentProfileId: string;
  subjectId: string;
  topic: string;
  status: "active" | "paused" | "completed";
  transcript: MentoriaSessionMessage[];
  emotionalState: string;
  lastActivityAt: string;
  aiTokensUsed: number;
  durationMinutes: number;
};

type SessionStateRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  session_id: string;
  subject_id: string;
  topic: string;
  status: string;
  transcript_json: string;
  emotional_state: string;
  last_activity_at: string;
  ai_tokens_used: number;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
};

export class SessionPersistenceManager {
  constructor(private db: D1Database = getDb()) {}

  async saveSessionSnapshot(snapshot: SessionSnapshot): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db
      .prepare(
        `SELECT id FROM mentoria_session_state
         WHERE tenant_id = ? AND session_id = ?
         LIMIT 1`
      )
      .bind(snapshot.tenantId, snapshot.sessionId)
      .first<{ id: string }>();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_session_state
           SET transcript_json = ?, emotional_state = ?, last_activity_at = ?,
               ai_tokens_used = ?, duration_minutes = ?, status = ?, updated_at = ?
           WHERE tenant_id = ? AND session_id = ?`
        )
        .bind(
          JSON.stringify(snapshot.transcript),
          snapshot.emotionalState,
          snapshot.lastActivityAt,
          snapshot.aiTokensUsed,
          snapshot.durationMinutes,
          snapshot.status,
          now,
          snapshot.tenantId,
          snapshot.sessionId
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO mentoria_session_state (
            id, tenant_id, student_profile_id, session_id, subject_id, topic,
            status, transcript_json, emotional_state, last_activity_at,
            ai_tokens_used, duration_minutes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          snapshot.tenantId,
          snapshot.studentProfileId,
          snapshot.sessionId,
          snapshot.subjectId,
          snapshot.topic,
          snapshot.status,
          JSON.stringify(snapshot.transcript),
          snapshot.emotionalState,
          snapshot.lastActivityAt,
          snapshot.aiTokensUsed,
          snapshot.durationMinutes,
          now,
          now
        )
        .run();
    }
  }

  async getActiveSession(
    tenantId: string,
    studentProfileId: string
  ): Promise<SessionRecoveryData | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_session_state
         WHERE tenant_id = ? AND student_profile_id = ? AND status = 'active'
         ORDER BY last_activity_at DESC
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<SessionStateRow>();

    if (!row) return null;

    return {
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      studentProfileId: row.student_profile_id,
      subjectId: row.subject_id,
      topic: row.topic,
      status: row.status as "active" | "paused" | "completed",
      transcript: this.parseTranscript(row.transcript_json),
      emotionalState: row.emotional_state,
      lastActivityAt: row.last_activity_at,
      aiTokensUsed: row.ai_tokens_used,
      durationMinutes: row.duration_minutes,
    };
  }

  async getSessionSnapshot(
    tenantId: string,
    sessionId: string
  ): Promise<SessionRecoveryData | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM mentoria_session_state
         WHERE tenant_id = ? AND session_id = ?
         LIMIT 1`
      )
      .bind(tenantId, sessionId)
      .first<SessionStateRow>();

    if (!row) return null;

    return {
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      studentProfileId: row.student_profile_id,
      subjectId: row.subject_id,
      topic: row.topic,
      status: row.status as "active" | "paused" | "completed",
      transcript: this.parseTranscript(row.transcript_json),
      emotionalState: row.emotional_state,
      lastActivityAt: row.last_activity_at,
      aiTokensUsed: row.ai_tokens_used,
      durationMinutes: row.duration_minutes,
    };
  }

  async completeSession(tenantId: string, sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_session_state
         SET status = 'completed', updated_at = ?
         WHERE tenant_id = ? AND session_id = ?`
      )
      .bind(now, tenantId, sessionId)
      .run();
  }

  async pauseSession(tenantId: string, sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_session_state
         SET status = 'paused', updated_at = ?
         WHERE tenant_id = ? AND session_id = ?`
      )
      .bind(now, tenantId, sessionId)
      .run();
  }

  async resumeSession(tenantId: string, sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE mentoria_session_state
         SET status = 'active', last_activity_at = ?, updated_at = ?
         WHERE tenant_id = ? AND session_id = ?`
      )
      .bind(now, now, tenantId, sessionId)
      .run();
  }

  async deleteSessionState(tenantId: string, sessionId: string): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM mentoria_session_state
         WHERE tenant_id = ? AND session_id = ?`
      )
      .bind(tenantId, sessionId)
      .run();
  }

  private parseTranscript(json: string): MentoriaSessionMessage[] {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[SessionPersistence] Transcript corruption detected:", {
        error: errorMsg,
        jsonLength: json?.length ?? 0,
        jsonPreview: json?.substring(0, 100) ?? "null",
      });
      return [];
    }
  }
}
