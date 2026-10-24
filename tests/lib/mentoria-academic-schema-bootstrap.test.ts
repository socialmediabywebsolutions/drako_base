import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("mentoria academic schema bootstrap", () => {
  it("includes canonical academic migrations in the isolated mentorias local migrator", () => {
    const bootstrapScript = readFileSync("scripts/local/mentoria-local-bootstrap.mjs", "utf8");
    const workerLocalMigrator = readFileSync("scripts/local/mentoria-worker-local-migrate.mjs", "utf8");
    const recordsMigration = readFileSync("migrations/0176_mentoria_academic_records.sql", "utf8");
    const documentsMigration = readFileSync("migrations/0177_mentoria_academic_documents.sql", "utf8");
    const extractionsMigration = readFileSync("migrations/0178_mentoria_academic_extractions.sql", "utf8");
    const analysesMigration = readFileSync("migrations/0179_mentoria_academic_analyses.sql", "utf8");
    const snapshotsMigration = readFileSync("migrations/0180_mentoria_subject_performance_snapshots.sql", "utf8");

    expect(bootstrapScript).toContain('const applyRootMigrations = process.argv.includes("--with-root-migrations");');
    expect(bootstrapScript).toContain('run("node", ["scripts/local/mentoria-worker-local-migrate.mjs", "all"]);');
    expect(workerLocalMigrator).toContain('const productBinding = "MENTORIA_DB";');
    expect(workerLocalMigrator).toContain('const authBinding = "MENTORIAS_AUTHS_DB";');
    expect(workerLocalMigrator).toContain("migrations/0176_mentoria_academic_records.sql");
    expect(workerLocalMigrator).toContain("migrations/0177_mentoria_academic_documents.sql");
    expect(workerLocalMigrator).toContain("migrations/0178_mentoria_academic_extractions.sql");
    expect(workerLocalMigrator).toContain("migrations/0179_mentoria_academic_analyses.sql");
    expect(workerLocalMigrator).toContain("migrations/0180_mentoria_subject_performance_snapshots.sql");

    expect(recordsMigration).toContain("CREATE TABLE IF NOT EXISTS mentoria_academic_records");
    expect(documentsMigration).toContain("CREATE TABLE IF NOT EXISTS mentoria_academic_documents");
    expect(extractionsMigration).toContain("CREATE TABLE IF NOT EXISTS mentoria_academic_extractions");
    expect(analysesMigration).toContain("CREATE TABLE IF NOT EXISTS mentoria_academic_analyses");
    expect(snapshotsMigration).toContain("CREATE TABLE IF NOT EXISTS mentoria_subject_performance_snapshots");
  });
});
