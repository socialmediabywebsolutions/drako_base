type Row = Record<string, any>;

interface PreparedStatement {
  bind(...args: any[]): {
    run(): Promise<{ success: boolean; changes?: number }>;
    get(): Promise<Row | null>;
    all(): Promise<{ results: Row[] }>;
  };
}

interface TestDB {
  prepare(sql: string): PreparedStatement;
}

const tables: Record<string, Row[]> = {
  families: [],
  guardians: [],
  students: [],
};

export function createTestDB(): TestDB {
  return {
    prepare(sql: string): PreparedStatement {
      return {
        bind(...args: any[]) {
          return {
            async run() {
              try {
                // Handle INSERT OR IGNORE INTO families
                if (sql.includes("INSERT OR IGNORE INTO families")) {
                  const familyId = args[0] as string;
                  if (!tables.families.find(f => f.id === familyId)) {
                    tables.families.push({
                      id: familyId,
                      created_at: new Date().toISOString(),
                    });
                  }
                  return { success: true };
                }

                // Handle INSERT INTO guardians
                if (sql.includes("INSERT INTO guardians") && !sql.includes("OR IGNORE")) {
                  const [id, email, name, familyId, role, tenantId, createdAt] = args;
                  tables.guardians.push({
                    id,
                    email: (email as string).toLowerCase(),
                    name,
                    family_id: familyId,
                    role,
                    tenant_id: tenantId,
                    created_at: createdAt,
                  });
                  return { success: true };
                }

                // Handle UPDATE guardians
                if (sql.includes("UPDATE guardians")) {
                  const [name, role, guardianId] = args;
                  const guardian = tables.guardians.find(g => g.id === guardianId);
                  if (guardian) {
                    guardian.name = name;
                    guardian.role = role;
                  }
                  return { success: true };
                }

                // Handle INSERT INTO students
                if (sql.includes("INSERT INTO students")) {
                  const [id, name, age, level, familyId, createdAt] = args;
                  tables.students.push({
                    id,
                    name,
                    age,
                    level,
                    family_id: familyId,
                    created_at: createdAt,
                  });
                  return { success: true };
                }

                // Handle DELETE statements
                if (sql.includes("DELETE FROM")) {
                  if (sql.includes("DELETE FROM students")) {
                    const familyId = args[0];
                    tables.students = tables.students.filter(s => s.family_id !== familyId);
                  } else if (sql.includes("DELETE FROM guardians")) {
                    const familyId = args[0];
                    tables.guardians = tables.guardians.filter(g => g.family_id !== familyId);
                  } else if (sql.includes("DELETE FROM families")) {
                    const familyId = args[0];
                    tables.families = tables.families.filter(f => f.id !== familyId);
                  }
                  return { success: true };
                }

                return { success: true };
              } catch (error) {
                console.error("DB run error:", error);
                throw error;
              }
            },

            async get() {
              try {
                // Handle SELECT from families by id
                if (sql.includes("SELECT") && sql.includes("FROM families")) {
                  const familyId = args[0];
                  return tables.families.find(f => f.id === familyId) || null;
                }

                // Handle SELECT from guardians by email
                if (sql.includes("SELECT") && sql.includes("FROM guardians") && sql.includes("WHERE lower(email)")) {
                  const email = (args[0] as string).toLowerCase();
                  return tables.guardians.find(g => g.email === email) || null;
                }

                // Handle SELECT from guardians by id
                if (sql.includes("SELECT") && sql.includes("FROM guardians") && sql.includes("WHERE id")) {
                  const guardianId = args[0];
                  return tables.guardians.find(g => g.id === guardianId) || null;
                }

                return null;
              } catch (error) {
                console.error("DB get error:", error);
                throw error;
              }
            },

            async all() {
              try {
                // Handle SELECT from families
                if (sql.includes("SELECT") && sql.includes("FROM families")) {
                  const familyId = args[0];
                  const family = tables.families.find(f => f.id === familyId);
                  return { results: family ? [family] : [] };
                }

                // Handle SELECT from guardians by family and email
                if (sql.includes("SELECT") && sql.includes("FROM guardians") && sql.includes("WHERE email") && sql.includes("family_id")) {
                  const [email, familyId] = args;
                  const guardians = tables.guardians.filter(
                    g => g.family_id === familyId && g.email === (email as string).toLowerCase()
                  );
                  return { results: guardians };
                }

                // Handle SELECT from guardians by family only
                if (sql.includes("SELECT") && sql.includes("FROM guardians") && sql.includes("WHERE family_id")) {
                  const familyId = args[0];
                  const guardians = tables.guardians.filter(g => g.family_id === familyId);
                  return { results: guardians };
                }

                // Handle SELECT from guardians by email only
                if (sql.includes("SELECT") && sql.includes("FROM guardians") && sql.includes("WHERE lower(email)")) {
                  const email = (args[0] as string).toLowerCase();
                  const guardians = tables.guardians.filter(g => g.email === email);
                  return { results: guardians };
                }

                // Handle SELECT from students by id and family
                if (sql.includes("SELECT") && sql.includes("FROM students") && sql.includes("WHERE id")) {
                  const [studentId, familyId] = args;
                  const students = tables.students.filter(
                    s => s.id === studentId && s.family_id === familyId
                  );
                  return { results: students };
                }

                // Handle SELECT from students by family
                if (sql.includes("SELECT") && sql.includes("FROM students") && sql.includes("WHERE family_id")) {
                  const familyId = args[0];
                  const students = tables.students.filter(s => s.family_id === familyId);
                  return { results: students };
                }

                return { results: [] };
              } catch (error) {
                console.error("DB all error:", error);
                throw error;
              }
            },
          };
        },
      };
    },
  };
}
