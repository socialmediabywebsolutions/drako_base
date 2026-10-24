import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("mentoria evolution schema scope", () => {
  it("adds subject_slug and a subject-scoped unique index", () => {
    const migration = readFileSync("migrations/0182_mentoria_student_evolution_subject_scope.sql", "utf8");

    expect(migration).toContain("ADD COLUMN subject_slug TEXT NOT NULL DEFAULT 'general'");
    expect(migration).toContain("UPDATE mentoria_student_evolution");
    expect(migration).toContain("DROP INDEX IF EXISTS idx_mentoria_student_evolution_tenant_student");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_evolution_tenant_student_subject");
    expect(migration).toContain("tenant_id, student_profile_id, subject_slug");
  });
});
