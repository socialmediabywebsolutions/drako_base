import { getAuthsUserById } from "@/lib/auths/repositories";
import { env } from "@/lib/cf";
import { getDb } from "@/lib/db";
import type {
  MentoriaFamily,
  MentoriaFamilyStudent,
  MentoriaGuardian,
  MentoriaGuardianFamilyRelation,
  MentoriaGuardianRole,
  MentoriaGuardianStudentAccess,
  MentoriaGuardianSystemRole,
  MentoriaSupervisionLevel,
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
  system_role?: MentoriaGuardianSystemRole | null;
  family_relation?: MentoriaGuardianFamilyRelation | null;
  tenant_id?: string | null;
  created_at: string;
};

type GuardianStudentAccessRow = {
  id: string;
  family_id: string;
  guardian_id: string;
  student_id: string;
  student_profile_id: string | null;
  can_view_full_progress: number;
  can_manage_schedule: number;
  daily_study_minutes: number | null;
  supervision_level: MentoriaSupervisionLevel | null;
  notification_preferences_json: string | null;
  is_primary_contact: number;
  created_at: string;
  updated_at: string;
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
  const familyRelation = row.family_relation ?? row.role ?? "tutor";
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    familyId: row.family_id,
    role: familyRelation,
    systemRole: row.system_role ?? "secondary_guardian",
    familyRelation,
    tenantId: row.tenant_id ?? null,
    createdAt: row.created_at,
  };
}

function mapGuardianStudentAccess(row: GuardianStudentAccessRow): MentoriaGuardianStudentAccess {
  let notificationPreferences: string[] = [];
  try {
    const parsed = JSON.parse(row.notification_preferences_json ?? "[]");
    notificationPreferences = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    notificationPreferences = [];
  }

  return {
    id: row.id,
    familyId: row.family_id,
    guardianId: row.guardian_id,
    studentId: row.student_id,
    studentProfileId: row.student_profile_id ?? row.student_id,
    canViewFullProgress: Boolean(row.can_view_full_progress),
    canManageSchedule: Boolean(row.can_manage_schedule),
    dailyStudyMinutes: Number(row.daily_study_minutes ?? 0),
    supervisionLevel: row.supervision_level ?? "balanced",
    notificationPreferences,
    isPrimaryContact: Boolean(row.is_primary_contact),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.db.prepare(`PRAGMA table_info(${tableName})`).bind().all<{ name: string }>();
    const columns = result.results ?? [];
    return columns.some((column) => (column.name ?? "").toLowerCase() === columnName.toLowerCase());
  }

  private async hasTable(tableName: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name = ?
         LIMIT 1`,
      )
      .bind(tableName)
      .all<{ name: string }>()
      .catch(() => ({ results: [] as Array<{ name: string }> }));
    const row = result.results?.[0] ?? null;
    return Boolean(row?.name);
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
    const hasSystemRole = await this.hasColumn("guardians", "system_role");
    const hasFamilyRelation = await this.hasColumn("guardians", "family_relation");
    const hasTenantId = await this.hasColumn("guardians", "tenant_id");
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, ${hasSystemRole ? "system_role" : "NULL AS system_role"}, ${hasFamilyRelation ? "family_relation" : "NULL AS family_relation"}, ${hasTenantId ? "tenant_id" : "NULL AS tenant_id"}, created_at
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
    const hasSystemRole = await this.hasColumn("guardians", "system_role");
    const hasFamilyRelation = await this.hasColumn("guardians", "family_relation");
    const hasTenantId = await this.hasColumn("guardians", "tenant_id");
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, ${hasSystemRole ? "system_role" : "NULL AS system_role"}, ${hasFamilyRelation ? "family_relation" : "NULL AS family_relation"}, ${hasTenantId ? "tenant_id" : "NULL AS tenant_id"}, created_at
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
    const hasSystemRole = await this.hasColumn("guardians", "system_role");
    const hasFamilyRelation = await this.hasColumn("guardians", "family_relation");
    const hasTenantId = await this.hasColumn("guardians", "tenant_id");
    const result = await this.db
      .prepare(
        `SELECT id, email, name, family_id, role, ${hasSystemRole ? "system_role" : "NULL AS system_role"}, ${hasFamilyRelation ? "family_relation" : "NULL AS family_relation"}, ${hasTenantId ? "tenant_id" : "NULL AS tenant_id"}, created_at
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
    familyRelation?: MentoriaGuardianFamilyRelation;
    systemRole?: MentoriaGuardianSystemRole;
    tenantId?: string;
  }): Promise<MentoriaGuardian> {
    const email = input.email.trim().toLowerCase();
    const tenantId = input.tenantId ?? input.familyId;
    const familyRelation = input.familyRelation ?? input.role ?? "tutor";
    const hasTenantId = await this.hasColumn("guardians", "tenant_id");
    const hasSystemRole = await this.hasColumn("guardians", "system_role");
    const hasFamilyRelation = await this.hasColumn("guardians", "family_relation");
    
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
      const existingGuardian = mapGuardian(existing);
      const resolvedSystemRole = input.systemRole ?? existingGuardian.systemRole;
      // Update existing
      const sets = ["name = ?", "role = ?"];
      const binds: Array<string | null> = [input.name ?? null, familyRelation];
      if (hasSystemRole) {
        sets.push("system_role = ?");
        binds.push(resolvedSystemRole);
      }
      if (hasFamilyRelation) {
        sets.push("family_relation = ?");
        binds.push(familyRelation);
      }
      if (hasTenantId) {
        sets.push("tenant_id = ?");
        binds.push(tenantId);
      }
      binds.push(existing.id);
      await this.db.prepare(`UPDATE guardians SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
      
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
    const defaultSystemRole =
      input.systemRole ?? ((await this.listGuardiansByFamily(input.familyId)).length === 0 ? "primary_guardian" : "secondary_guardian");
    const columns = ["id", "email", "name", "family_id", "role", "created_at"];
    const placeholders = ["?", "?", "?", "?", "?", "?"];
    const binds: Array<string | null> = [guardianId, email, input.name ?? null, input.familyId, familyRelation, now];
    if (hasTenantId) {
      columns.push("tenant_id");
      placeholders.push("?");
      binds.push(tenantId);
    }
    if (hasSystemRole) {
      columns.push("system_role");
      placeholders.push("?");
      binds.push(defaultSystemRole);
    }
    if (hasFamilyRelation) {
      columns.push("family_relation");
      placeholders.push("?");
      binds.push(familyRelation);
    }
    
    await this.db
      .prepare(
        `INSERT INTO guardians (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})`,
      )
      .bind(...binds)
      .run();
    
    return (await this.getGuardianByFamilyAndEmail(input.familyId, email)) as MentoriaGuardian;
  }

  async upsertGuardianStudentAccess(input: {
    familyId: string;
    guardianId: string;
    studentId: string;
    studentProfileId?: string | null;
    canViewFullProgress?: boolean;
    canManageSchedule?: boolean;
    dailyStudyMinutes?: number;
    supervisionLevel?: MentoriaSupervisionLevel;
    notificationPreferences?: string[];
    isPrimaryContact?: boolean;
  }): Promise<MentoriaGuardianStudentAccess> {
    if (!(await this.hasTable("guardian_student_access"))) {
      const now = new Date().toISOString();
      return {
        id: `synthetic:${input.familyId}:${input.guardianId}:${input.studentId}`,
        familyId: input.familyId,
        guardianId: input.guardianId,
        studentId: input.studentId,
        studentProfileId: input.studentProfileId ?? input.studentId,
        canViewFullProgress: input.canViewFullProgress === false ? false : true,
        canManageSchedule: Boolean(input.canManageSchedule),
        dailyStudyMinutes: input.dailyStudyMinutes ?? 0,
        supervisionLevel: input.supervisionLevel ?? "balanced",
        notificationPreferences: input.notificationPreferences ?? [],
        isPrimaryContact: Boolean(input.isPrimaryContact),
        createdAt: now,
        updatedAt: now,
      };
    }

    const now = new Date().toISOString();
    const existing = await this.db
      .prepare(
        `SELECT *
         FROM guardian_student_access
         WHERE family_id = ? AND guardian_id = ? AND student_id = ?
         LIMIT 1`,
      )
      .bind(input.familyId, input.guardianId, input.studentId)
      .first<GuardianStudentAccessRow>();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE guardian_student_access
           SET student_profile_id = ?, can_view_full_progress = ?, can_manage_schedule = ?,
               daily_study_minutes = ?, supervision_level = ?, notification_preferences_json = ?,
               is_primary_contact = ?, updated_at = ?
           WHERE family_id = ? AND guardian_id = ? AND student_id = ?`,
        )
        .bind(
          input.studentProfileId ?? input.studentId,
          input.canViewFullProgress === false ? 0 : 1,
          input.canManageSchedule ? 1 : 0,
          input.dailyStudyMinutes ?? 0,
          input.supervisionLevel ?? "balanced",
          JSON.stringify(input.notificationPreferences ?? []),
          input.isPrimaryContact ? 1 : 0,
          now,
          input.familyId,
          input.guardianId,
          input.studentId,
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO guardian_student_access (
             id, family_id, guardian_id, student_id, student_profile_id, can_view_full_progress,
             can_manage_schedule, daily_study_minutes, supervision_level, notification_preferences_json,
             is_primary_contact, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          input.familyId,
          input.guardianId,
          input.studentId,
          input.studentProfileId ?? input.studentId,
          input.canViewFullProgress === false ? 0 : 1,
          input.canManageSchedule ? 1 : 0,
          input.dailyStudyMinutes ?? 0,
          input.supervisionLevel ?? "balanced",
          JSON.stringify(input.notificationPreferences ?? []),
          input.isPrimaryContact ? 1 : 0,
          now,
          now,
        )
        .run();
    }

    const row = await this.db
      .prepare(
        `SELECT *
         FROM guardian_student_access
         WHERE family_id = ? AND guardian_id = ? AND student_id = ?
         LIMIT 1`,
      )
      .bind(input.familyId, input.guardianId, input.studentId)
      .first<GuardianStudentAccessRow>();

    if (!row) {
      throw new Error("GUARDIAN_STUDENT_ACCESS_UPSERT_FAILED");
    }

    return mapGuardianStudentAccess(row);
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
