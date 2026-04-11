import { getAuthsUserById } from "@/lib/auths/repositories";
import { env } from "@/lib/cf";
import { getDb } from "@/lib/db";
import type {
  MentoriaFamily,
  MentoriaFamilyStudent,
  MentoriaGuardian,
  MentoriaGuardianRole,
} from "@/lib/mentoria/types";

type DbLike = D1Database;

type FamilyRow = {
  id: string;
  created_at: string;
};

type GuardianRow = {
  id: string;
  email: string;
  name: string | null;
  family_id: string;
  role: MentoriaGuardianRole | null;
  created_at: string;
};

type StudentRow = {
  id: string;
  name: string;
  age: number | null;
  level: string | null;
  family_id: string;
  created_at: string;
};

function mapFamily(row: FamilyRow): MentoriaFamily {
  return {
    id: row.id,
    createdAt: row.created_at,
  };
}

function mapGuardian(row: GuardianRow): MentoriaGuardian {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    familyId: row.family_id,
    role: row.role ?? "tutor",
    createdAt: row.created_at,
  };
}

function mapStudent(row: StudentRow): MentoriaFamilyStudent {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    level: row.level,
    familyId: row.family_id,
    createdAt: row.created_at,
  };
}

function buildMentoriaTenantSlug(familyId: string): string {
  return `mentoria-${familyId}`.toLowerCase();
}

function buildMentoriaTenantName(familyId: string): string {
  return `Mentoria ${familyId.slice(0, 8)}`;
}

export class MentoriaFamilyRepository {
  constructor(private readonly db: DbLike) {
    if (!db) {
      throw new Error("DB_BINDING_REQUIRED");
    }
    console.log("DB INSTANCE", db);
  }

  async getFamilyById(familyId: string): Promise<MentoriaFamily | null> {
    const result = await this.db
      .prepare(`SELECT id, created_at FROM families WHERE id = ? LIMIT 1`)
      .bind(familyId)
      .all<FamilyRow>();
    const row = result.results?.[0];
    return row ? mapFamily(row) : null;
  }

  async getGuardianByFamilyAndEmail(familyId: string, email: string): Promise<MentoriaGuardian | null> {
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, created_at
         FROM guardians
         WHERE family_id = ? AND lower(email) = lower(?)
         LIMIT 1`,
      )
      .bind(familyId, email)
      .all<GuardianRow>();
    const row = result.results?.[0];
    return row ? mapGuardian(row) : null;
  }

  async getGuardianByEmail(email: string): Promise<MentoriaGuardian | null> {
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, created_at
         FROM guardians
         WHERE lower(email) = lower(?)
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(email)
      .all<GuardianRow>();
    const row = result.results?.[0];
    return row ? mapGuardian(row) : null;
  }

  async listGuardiansByFamily(familyId: string): Promise<MentoriaGuardian[]> {
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, created_at
         FROM guardians
         WHERE family_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(familyId)
      .all<GuardianRow>();
    return (result.results ?? []).map(mapGuardian);
  }

  async listStudentsByFamily(familyId: string): Promise<MentoriaFamilyStudent[]> {
    const result = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE family_id = ?
         ORDER BY created_at ASC`,
      )
      .bind(familyId)
      .all<StudentRow>();
    return (result.results ?? []).map(mapStudent);
  }

  async createFamily(familyId: string): Promise<MentoriaFamily> {
    await this.db
      .prepare(`INSERT OR IGNORE INTO families (id) VALUES (?)`)
      .bind(familyId)
      .run();

    await this.db
      .prepare(
        `INSERT OR IGNORE INTO tenants (id, slug, name, plan, status, created_at, updated_at)
         VALUES (?, ?, ?, 'starter', 'active', ?, ?)`,
      )
      .bind(
        familyId,
        buildMentoriaTenantSlug(familyId),
        buildMentoriaTenantName(familyId),
        new Date().toISOString(),
        new Date().toISOString(),
      )
      .run();
    
    // Fetch the family to verify it was created or already exists
    const family = await this.getFamilyById(familyId);
    if (!family) {
      throw new Error("FAMILY_CREATE_FAILED");
    }
    return family;
  }

  async upsertGuardian(input: {
    id?: string;
    email: string;
    name?: string | null;
    familyId: string;
    role?: MentoriaGuardianRole;
    tenantId?: string;
  }): Promise<MentoriaGuardian> {
    const email = input.email.trim().toLowerCase();
    const tenantId = input.tenantId ?? input.familyId;
    
    // Check existing by email + family_id
    const existingResult = await this.db
      .prepare(
        `SELECT * FROM guardians
         WHERE email = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(email, input.familyId)
      .all<GuardianRow>();
    
    const existing = existingResult.results?.[0];
    
    if (existing) {
      // Update existing
      await this.db
        .prepare(
          `UPDATE guardians
           SET name = ?, role = ?
           WHERE id = ?`,
        )
        .bind(input.name ?? null, input.role ?? "tutor", existing.id)
        .run();
      
      // Re-fetch updated record
      const updatedResult = await this.db
        .prepare(`SELECT * FROM guardians WHERE id = ?`)
        .bind(existing.id)
        .all<GuardianRow>();
      
      const updated = updatedResult.results?.[0];
      return updated ? mapGuardian(updated) : mapGuardian(existing);
    }

    // Insert new
    const guardianId = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    
    await this.db
      .prepare(
        `INSERT INTO guardians (id, email, name, family_id, role, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(guardianId, email, input.name ?? null, input.familyId, input.role ?? "tutor", tenantId, now)
      .run();
    
    return (await this.getGuardianByFamilyAndEmail(input.familyId, email)) as MentoriaGuardian;
  }

  async createStudent(input: {
    id?: string;
    familyId: string;
    name: string;
    age?: number | null;
    level?: string | null;
  }): Promise<MentoriaFamilyStudent> {
    const studentId = input.id ?? crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO students (id, name, age, level, family_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(studentId, input.name.trim(), input.age ?? null, input.level ?? null, input.familyId)
      .run();

    const result = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(studentId, input.familyId)
      .all<StudentRow>();
    const row = result.results?.[0];
    if (!row) {
      throw new Error("STUDENT_CREATE_FAILED");
    }
    return mapStudent(row);
  }

  async upsertStudent(input: {
    id: string;
    familyId: string;
    name: string;
    age?: number | null;
    level?: string | null;
  }): Promise<MentoriaFamilyStudent> {
    const existingResult = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(input.id, input.familyId)
      .all<StudentRow>();
    const existing = existingResult.results?.[0];

    if (existing) {
      await this.db
        .prepare(
          `UPDATE students
           SET name = ?, age = ?, level = ?
           WHERE id = ? AND family_id = ?`,
        )
        .bind(input.name.trim(), input.age ?? null, input.level ?? null, input.id, input.familyId)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO students (id, name, age, level, family_id)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(input.id, input.name.trim(), input.age ?? null, input.level ?? null, input.familyId)
        .run();
    }

    const result = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(input.id, input.familyId)
      .all<StudentRow>();
    const row = result.results?.[0];
    if (!row) {
      throw new Error("STUDENT_UPSERT_FAILED");
    }
    return mapStudent(row);
  }

  async getFamilyBundle(familyId: string): Promise<{
    family: MentoriaFamily | null;
    guardians: MentoriaGuardian[];
    students: MentoriaFamilyStudent[];
  }> {
    const [family, guardians, students] = await Promise.all([
      this.getFamilyById(familyId),
      this.listGuardiansByFamily(familyId),
      this.listStudentsByFamily(familyId),
    ]);

    return { family, guardians, students };
  }

  async ensureFamilyMembershipByUser(params: {
    userId: string;
    email: string;
    tenantId: string;
    fallbackName?: string | null;
  }): Promise<void> {
    console.log("[ensureFamilyMembershipByUser] ENTRADA", {
      userId: params.userId,
      email: params.email,
      tenantId: params.tenantId,
      fallbackName: params.fallbackName,
    });

    const authUser = await getAuthsUserById({ context: "mentorias", userId: params.userId });
    console.log("[ensureFamilyMembershipByUser] getAuthsUserById resultado", {
      authUser,
      authUserName: authUser?.name,
    });

    await this.createFamily(params.tenantId);
    console.log("[ensureFamilyMembershipByUser] createFamily completado", {
      tenantId: params.tenantId,
    });

    const guardianResult = await this.upsertGuardian({
      email: params.email,
      familyId: params.tenantId,
      name: authUser?.name ?? params.fallbackName ?? null,
      role: "tutor",
    });
    console.log("[ensureFamilyMembershipByUser] upsertGuardian completado", {
      guardianId: guardianResult.id,
      guardianEmail: guardianResult.email,
    });

    console.log("[ensureFamilyMembershipByUser] SALIDA exitosa");
  }

  async getStudentById(studentId: string): Promise<MentoriaFamilyStudent | null> {
    const result = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(studentId)
      .all<StudentRow>();
    const row = result.results?.[0];
    return row ? mapStudent(row) : null;
  }
}
