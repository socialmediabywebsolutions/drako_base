import { describe, expect, it } from "vitest";

import { MentoriaRepository } from "@/lib/mentoria/repository";

type EvolutionRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_slug: string;
  strengths_json: string;
  weaknesses_json: string;
  frustration_level: number;
  consistency_score: number;
  average_response_time: number;
  last_sessions: number;
  common_mistakes_json: string;
  progression_velocity: number;
  created_at: string;
  updated_at: string;
};

class FakePreparedStatement {
  private params: unknown[] = [];

  constructor(
    private db: FakeEvolutionDb,
    private sql: string,
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    return this.db.first<T>(this.sql, this.params);
  }

  async run() {
    return this.db.run(this.sql, this.params);
  }
}

class FakeEvolutionDb {
  rows: EvolutionRow[] = [];

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  async first<T>(sql: string, params: unknown[]) {
    if (sql.includes("SELECT * FROM mentoria_student_evolution")) {
      const [tenantId, studentId, subjectSlug] = params as [string, string, string];
      return (this.rows.find((row) =>
        row.tenant_id === tenantId
        && row.student_profile_id === studentId
        && row.subject_slug === subjectSlug,
      ) ?? null) as T | null;
    }
    if (sql.includes("SELECT id FROM mentoria_student_evolution")) {
      const [tenantId, studentId, subjectSlug] = params as [string, string, string];
      const row = this.rows.find((item) =>
        item.tenant_id === tenantId
        && item.student_profile_id === studentId
        && item.subject_slug === subjectSlug,
      );
      return (row ? { id: row.id } : null) as T | null;
    }
    return null;
  }

  async run(sql: string, params: unknown[]) {
    if (sql.includes("INSERT INTO mentoria_student_evolution")) {
      const [
        id,
        tenantId,
        studentId,
        subjectSlug,
        strengthsJson,
        weaknessesJson,
        frustrationLevel,
        consistencyScore,
        averageResponseTime,
        lastSessions,
        commonMistakesJson,
        progressionVelocity,
        createdAt,
        updatedAt,
      ] = params as [string, string, string, string, string, string, number, number, number, number, string, number, string, string];

      const duplicate = this.rows.find((row) =>
        row.tenant_id === tenantId
        && row.student_profile_id === studentId
        && row.subject_slug === subjectSlug,
      );
      if (duplicate) {
        throw new Error("UNIQUE_SCOPE_VIOLATION");
      }

      this.rows.push({
        id,
        tenant_id: tenantId,
        student_profile_id: studentId,
        subject_slug: subjectSlug,
        strengths_json: strengthsJson,
        weaknesses_json: weaknessesJson,
        frustration_level: frustrationLevel,
        consistency_score: consistencyScore,
        average_response_time: averageResponseTime,
        last_sessions: lastSessions,
        common_mistakes_json: commonMistakesJson,
        progression_velocity: progressionVelocity,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return;
    }

    if (sql.includes("UPDATE mentoria_student_evolution")) {
      const [
        subjectSlug,
        strengthsJson,
        weaknessesJson,
        frustrationLevel,
        consistencyScore,
        averageResponseTime,
        lastSessions,
        commonMistakesJson,
        progressionVelocity,
        updatedAt,
        tenantId,
        id,
      ] = params as [string, string, string, number, number, number, number, string, number, string, string, string];
      const row = this.rows.find((item) => item.tenant_id === tenantId && item.id === id);
      if (!row) return;
      Object.assign(row, {
        subject_slug: subjectSlug,
        strengths_json: strengthsJson,
        weaknesses_json: weaknessesJson,
        frustration_level: frustrationLevel,
        consistency_score: consistencyScore,
        average_response_time: averageResponseTime,
        last_sessions: lastSessions,
        common_mistakes_json: commonMistakesJson,
        progression_velocity: progressionVelocity,
        updated_at: updatedAt,
      });
    }
  }
}

describe("mentoria evolution repository", () => {
  it("stores independent evolution rows per subject and reads the requested classroom only", async () => {
    const db = new FakeEvolutionDb();
    const repository = new MentoriaRepository(db as unknown as D1Database);

    await repository.saveStudentEvolutionProfile("tenant_1", {
      studentId: "student_1",
      subjectSlug: "matematicas",
      strengths: [],
      weaknesses: ["fracciones"],
      frustrationLevel: 0.7,
      consistencyScore: 0.4,
      averageResponseTime: 18,
      lastSessions: 2,
      commonMistakes: ["denominadores"],
      progressionVelocity: 0.3,
      updatedAt: "2026-04-25T10:00:00.000Z",
    });

    await repository.saveStudentEvolutionProfile("tenant_1", {
      studentId: "student_1",
      subjectSlug: "historia",
      strengths: ["Edad Moderna"],
      weaknesses: [],
      frustrationLevel: 0.2,
      consistencyScore: 0.8,
      averageResponseTime: 9,
      lastSessions: 4,
      commonMistakes: [],
      progressionVelocity: 0.82,
      updatedAt: "2026-04-25T10:00:00.000Z",
    });

    const matematicas = await repository.getStudentEvolutionProfile("tenant_1", "student_1", "matematicas");
    const historia = await repository.getStudentEvolutionProfile("tenant_1", "student_1", "historia");

    expect(matematicas?.subjectSlug).toBe("matematicas");
    expect(matematicas?.commonMistakes).toEqual(["denominadores"]);
    expect(historia?.subjectSlug).toBe("historia");
    expect(historia?.strengths).toEqual(["Edad Moderna"]);
  });

  it("requires subject scope and rejects silent global fallback", async () => {
    const db = new FakeEvolutionDb();
    const repository = new MentoriaRepository(db as unknown as D1Database);

    await expect(
      repository.getStudentEvolutionProfile("tenant_1", "student_1", ""),
    ).rejects.toThrow("SUBJECT_REQUIRED");

    await expect(
      repository.saveStudentEvolutionProfile("tenant_1", {
        studentId: "student_1",
        subjectSlug: "",
        strengths: [],
        weaknesses: [],
        frustrationLevel: 0.4,
        consistencyScore: 0.4,
        averageResponseTime: 12,
        lastSessions: 0,
        commonMistakes: [],
        progressionVelocity: 0.4,
        updatedAt: "2026-04-25T10:00:00.000Z",
      }),
    ).rejects.toThrow("SUBJECT_REQUIRED");
  });
});
