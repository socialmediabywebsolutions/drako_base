import { getAuthsUserById } from "@/lib/auths/repositories";
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

export class MentoriaFamilyRepository {
  constructor(private readonly db: DbLike = getDb()) {}

  async getFamilyById(familyId: string): Promise<MentoriaFamily | null> {
    const row = await this.db
      .prepare(`SELECT id, created_at FROM families WHERE id = ? LIMIT 1`)
      .bind(familyId)
      .first<FamilyRow>();
    return row ? mapFamily(row) : null;
  }

  async getGuardianByFamilyAndEmail(familyId: string, email: string): Promise<MentoriaGuardian | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, created_at
         FROM guardians
         WHERE family_id = ? AND lower(email) = lower(?)
         LIMIT 1`,
      )
      .bind(familyId, email)
      .first<GuardianRow>();
    return row ? mapGuardian(row) : null;
  }

  async getGuardianByEmail(email: string): Promise<MentoriaGuardian | null> {
    const row = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, created_at
         FROM guardians
         WHERE lower(email) = lower(?)
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(email)
      .first<GuardianRow>();
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
  }): Promise<MentoriaGuardian> {
    const existing = await this.getGuardianByFamilyAndEmail(input.familyId, input.email);
    if (existing) {
      await this.db
        .prepare(
          `UPDATE guardians
           SET name = ?, role = ?
           WHERE id = ?`,
        )
        .bind(input.name ?? existing.name ?? null, input.role ?? existing.role, existing.id)
        .run();
      return (await this.getGuardianByFamilyAndEmail(input.familyId, input.email)) as MentoriaGuardian;
    }

    const guardianId = input.id ?? crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO guardians (id, email, name, family_id, role)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(guardianId, input.email.trim().toLowerCase(), input.name ?? null, input.familyId, input.role ?? "tutor")
      .run();
    return (await this.getGuardianByFamilyAndEmail(input.familyId, input.email)) as MentoriaGuardian;
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

    const row = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(studentId, input.familyId)
      .first<StudentRow>();
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
    const existing = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(input.id, input.familyId)
      .first<StudentRow>();

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

    const row = await this.db
      .prepare(
        `SELECT id, name, age, level, family_id, created_at
         FROM students
         WHERE id = ? AND family_id = ?
         LIMIT 1`,
      )
      .bind(input.id, input.familyId)
      .first<StudentRow>();
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
    const authUser = await getAuthsUserById({ context: "mentorias", userId: params.userId });
    await this.createFamily(params.tenantId);
    await this.upsertGuardian({
      email: params.email,
      familyId: params.tenantId,
      name: authUser?.name ?? params.fallbackName ?? null,
      role: "tutor",
    });
  }
}
