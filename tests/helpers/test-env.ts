import Database from "better-sqlite3";

export function createTestEnv() {
  const db = new Database(":memory:");

  // Create Mentoria tables for testing
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guardians (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      family_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tutor',
      tenant_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER,
      level TEXT,
      family_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );
  `);

  return {
    DRACO_DB: {
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);

        return {
          bind: (...args: unknown[]) => ({
            run: async () => {
              try {
                const result = stmt.run(...args);
                return { success: true, changes: result.changes };
              } catch (error) {
                console.error("DB run error:", error);
                throw error;
              }
            },
            get: async () => {
              try {
                return stmt.get(...args);
              } catch (error) {
                console.error("DB get error:", error);
                throw error;
              }
            },
            all: async () => {
              try {
                const results = stmt.all(...args);
                return { results };
              } catch (error) {
                console.error("DB all error:", error);
                throw error;
              }
            },
          }),
        };
      },
    },
  };
}
