import { getDb } from "@/lib/db";

export type TrialStatus = "active" | "expired" | "converted";

export type StudentTrial = {
  studentProfileId: string;
  tenantId: string;
  startedAt: string;
  expiresAt: string;
  status: TrialStatus;
  convertedAt?: string;
};

type StudentTrialRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  started_at: string;
  expires_at: string;
  status: string;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

export class TrialManager {
  constructor(private db: D1Database = getDb()) {}

  async startTrial(tenantId: string, studentProfileId: string): Promise<StudentTrial> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const existing = await this.db
      .prepare(
        `SELECT id FROM student_trials
         WHERE tenant_id = ? AND student_profile_id = ?
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<{ id: string }>();

    if (existing) {
      const trial = await this.getTrial(tenantId, studentProfileId);
      if (trial) return trial;
    }

    await this.db
      .prepare(
        `INSERT INTO student_trials (
          id, tenant_id, student_profile_id, started_at, expires_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        tenantId,
        studentProfileId,
        now.toISOString(),
        expiresAt.toISOString(),
        "active",
        now.toISOString(),
        now.toISOString()
      )
      .run();

    return {
      studentProfileId,
      tenantId,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: "active",
    };
  }

  async getTrial(tenantId: string, studentProfileId: string): Promise<StudentTrial | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM student_trials
         WHERE tenant_id = ? AND student_profile_id = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(tenantId, studentProfileId)
      .first<StudentTrialRow>();

    if (!row) return null;

    return {
      studentProfileId: row.student_profile_id,
      tenantId: row.tenant_id,
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      status: row.status as TrialStatus,
      convertedAt: row.converted_at || undefined,
    };
  }

  async isTrialActive(tenantId: string, studentProfileId: string): Promise<boolean> {
    const trial = await this.getTrial(tenantId, studentProfileId);
    if (!trial) return false;

    const now = new Date();
    const expiresAt = new Date(trial.expiresAt);

    if (trial.status === "converted") return false;
    if (trial.status === "expired") return false;
    if (now > expiresAt) {
      await this.expireTrial(tenantId, studentProfileId);
      return false;
    }

    return true;
  }

  async getTrialDaysRemaining(tenantId: string, studentProfileId: string): Promise<number> {
    const trial = await this.getTrial(tenantId, studentProfileId);
    if (!trial) return 0;

    const now = new Date();
    const expiresAt = new Date(trial.expiresAt);
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, daysRemaining);
  }

  async expireTrial(tenantId: string, studentProfileId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE student_trials
         SET status = 'expired', updated_at = ?
         WHERE tenant_id = ? AND student_profile_id = ?`
      )
      .bind(now, tenantId, studentProfileId)
      .run();
  }

  async convertTrial(tenantId: string, studentProfileId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE student_trials
         SET status = 'converted', converted_at = ?, updated_at = ?
         WHERE tenant_id = ? AND student_profile_id = ?`
      )
      .bind(now, now, tenantId, studentProfileId)
      .run();
  }
}
