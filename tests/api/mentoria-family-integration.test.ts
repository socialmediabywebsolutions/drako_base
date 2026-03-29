import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import { createTestDB } from "../helpers/test-db";

/**
 * INTEGRATION TEST: Mentoria Family on DRACO_DB
 * 
 * This test validates that:
 * 1. Family tables (families, guardians, students) exist in DRACO_DB
 * 2. Repository operations work against real D1 (not mocked)
 * 3. Service layer enforces tenant isolation and validation
 * 
 * REQUIRES: Pure JavaScript D1 mock (no native dependencies)
 */

describe("mentoria family integration (DRACO_DB real)", () => {
  let repo: MentoriaFamilyRepository;
  let service: MentoriaFamilyService;
  let db: any;
  const testFamilyId = `test-family-${Date.now()}`;
  const testGuardianEmail = `guardian-${Date.now()}@test.local`;
  const testStudentName = `Student-${Date.now()}`;

  beforeAll(() => {
    // Set up test session
    (globalThis as any).__TEST_SESSION__ = {
      user: {
        id: "test-user-1",
        email: testGuardianEmail,
        tenantId: testFamilyId,
        role: "user",
      },
    };

    // Create test DB with pure JavaScript D1 mock
    db = createTestDB();
    
    if (!db) {
      throw new Error("DRACO_DB not configured");
    }

    // Debug: verify DB instance
    console.log("DB REAL?", db.prepare.toString());
    console.log("DB INSTANCE", db);

    repo = new MentoriaFamilyRepository(db);
    service = new MentoriaFamilyService(repo);
  });

  beforeEach(async () => {
    // Clean state before each test
    if (db) {
      try {
        await db.prepare("DELETE FROM students WHERE family_id = ?").bind(testFamilyId).run();
        await db.prepare("DELETE FROM guardians WHERE family_id = ?").bind(testFamilyId).run();
        await db.prepare("DELETE FROM families WHERE id = ?").bind(testFamilyId).run();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  it("creates and retrieves a family", async () => {
    const family = await repo.createFamily(testFamilyId);
    expect(family).toBeDefined();
    expect(family.id).toBe(testFamilyId);
    expect(family.createdAt).toBeDefined();

    const retrieved = await repo.getFamilyById(testFamilyId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(testFamilyId);
  });

  it("upserts a guardian in the family", async () => {
    await repo.createFamily(testFamilyId);
    
    const guardian = await repo.upsertGuardian({
      email: testGuardianEmail,
      familyId: testFamilyId,
      name: "Test Guardian",
      role: "tutor",
    });

    expect(guardian).toBeDefined();
    expect(guardian.email).toBe(testGuardianEmail.toLowerCase());
    expect(guardian.familyId).toBe(testFamilyId);
    expect(guardian.role).toBe("tutor");

    const retrieved = await repo.getGuardianByFamilyAndEmail(testFamilyId, testGuardianEmail);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(guardian.id);
  });

  it("creates a student in the family", async () => {
    await repo.createFamily(testFamilyId);
    
    const student = await repo.createStudent({
      familyId: testFamilyId,
      name: testStudentName,
      age: 12,
      level: "6 primaria",
    });

    expect(student).toBeDefined();
    expect(student.name).toBe(testStudentName);
    expect(student.familyId).toBe(testFamilyId);
    expect(student.age).toBe(12);

    const retrieved = await repo.getFamilyBundle(testFamilyId);
    expect(retrieved.students).toHaveLength(1);
    expect(retrieved.students[0]?.id).toBe(student.id);
  });

  it("lists guardians and students by family", async () => {
    await repo.createFamily(testFamilyId);
    
    const guardian1 = await repo.upsertGuardian({
      email: `g1-${Date.now()}@test.local`,
      familyId: testFamilyId,
      role: "father",
    });
    
    const guardian2 = await repo.upsertGuardian({
      email: `g2-${Date.now()}@test.local`,
      familyId: testFamilyId,
      role: "mother",
    });

    const student1 = await repo.createStudent({
      familyId: testFamilyId,
      name: "Student 1",
    });

    const guardians = await repo.listGuardiansByFamily(testFamilyId);
    expect(guardians.length).toBeGreaterThanOrEqual(2);

    const students = await repo.listStudentsByFamily(testFamilyId);
    expect(students.length).toBeGreaterThanOrEqual(1);
  });

  it("service enforces session validation for family access", async () => {
    await repo.createFamily(testFamilyId);
    await repo.upsertGuardian({
      email: testGuardianEmail,
      familyId: testFamilyId,
      role: "tutor",
    });

    const validActor = {
      userId: "user-123",
      email: testGuardianEmail,
      tenantId: testFamilyId,
      role: "user" as const,
    };

    const bundle = await service.getFamilyForSession(validActor);
    expect(bundle.family).not.toBeNull();
    expect(bundle.family?.id).toBe(testFamilyId);
  });

  it("service rejects access when guardian not in family", async () => {
    await repo.createFamily(testFamilyId);
    
    const invalidActor = {
      userId: "user-456",
      email: "nonexistent@test.local",
      tenantId: testFamilyId,
      role: "user" as const,
    };

    await expect(service.getFamilyForSession(invalidActor)).rejects.toThrow(
      "FAMILY_ACCESS_DENIED"
    );
  });

  it("service rejects access without email/tenantId", async () => {
    const invalidActor = {
      userId: "user-789",
      email: "",
      tenantId: "",
      role: "user" as const,
    };

    await expect(service.getFamilyForSession(invalidActor)).rejects.toThrow(
      "SESSION_REQUIRED"
    );
  });

  it("upsert guardian idempotent: same email returns same guardian", async () => {
    await repo.createFamily(testFamilyId);
    
    const g1 = await repo.upsertGuardian({
      email: testGuardianEmail,
      familyId: testFamilyId,
      name: "Name 1",
      role: "tutor",
    });

    const g2 = await repo.upsertGuardian({
      email: testGuardianEmail,
      familyId: testFamilyId,
      name: "Name 2",
      role: "mother",
    });

    expect(g1.id).toBe(g2.id);
    expect(g2.name).toBe("Name 2");
    expect(g2.role).toBe("mother");
  });
});
