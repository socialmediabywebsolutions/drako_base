import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "../..");
const migration = fs.readFileSync(path.join(projectRoot, "migrations/0152_mentoria_schema_convergence.sql"), "utf8");
const repository = fs.readFileSync(path.join(projectRoot, "src/lib/mentoria/repository.ts"), "utf8");

describe("mentoria schema convergence", () => {
  it("aligns canonical runtime columns required by MentoriaRepository", () => {
    const migrationColumns = [
      "difficulty_band TEXT NOT NULL",
      "week_end TEXT NOT NULL",
      "goals_summary TEXT",
      "blocks_json TEXT NOT NULL",
      "ended_at TEXT",
      "distractions_count INTEGER NOT NULL DEFAULT 0",
      "confidence_score REAL NOT NULL DEFAULT 50",
      "sessions_completed INTEGER NOT NULL DEFAULT 0",
      "exercises_completed INTEGER NOT NULL DEFAULT 0",
      "weak_topics_json TEXT NOT NULL DEFAULT '[]'",
      "strong_topics_json TEXT NOT NULL DEFAULT '[]'",
      "answer_format TEXT NOT NULL",
      "correction_feedback TEXT",
      "status TEXT NOT NULL",
    ];

    for (const column of migrationColumns) {
      expect(migration).toContain(column);
    }

    const repositoryColumns = [
      "difficulty_band",
      "week_end",
      "goals_summary",
      "blocks_json",
      "ended_at",
      "distractions_count",
      "confidence_score",
      "sessions_completed",
      "exercises_completed",
      "weak_topics_json",
      "strong_topics_json",
      "answer_format",
      "correction_feedback",
      "status",
    ];

    for (const column of repositoryColumns) {
      expect(repository).toContain(column);
    }
  });

  it("replaces duplicated legacy storage shapes for study plans, focus, progress and exercises", () => {
    expect(migration).toContain("ALTER TABLE mentoria_study_plans RENAME TO mentoria_study_plans_legacy_0152;");
    expect(migration).toContain("ALTER TABLE mentoria_focus_sessions RENAME TO mentoria_focus_sessions_legacy_0152;");
    expect(migration).toContain("ALTER TABLE mentoria_progress RENAME TO mentoria_progress_legacy_0152;");
    expect(migration).toContain("ALTER TABLE mentoria_exercises RENAME TO mentoria_exercises_legacy_0152;");

    expect(migration).toContain("DROP TABLE mentoria_study_plans_legacy_0152;");
    expect(migration).toContain("DROP TABLE mentoria_focus_sessions_legacy_0152;");
    expect(migration).toContain("DROP TABLE mentoria_progress_legacy_0152;");
    expect(migration).toContain("DROP TABLE mentoria_exercises_legacy_0152;");
  });
});
