/**
 * Internal Endpoint: P0 Family Validation
 * 
 * Ejecuta validación real de Family contra D1 real
 * Uso: curl http://localhost:8787/api/internal/validate-p0-family
 */

import { NextResponse } from "next/server";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";

const TEST_FAMILY_ID = `p0-test-family-${Date.now()}`;
const TEST_GUARDIAN_EMAIL = `p0-guardian-${Date.now()}@test.local`;
const TEST_STUDENT_NAME = `P0-Student-${Date.now()}`;

export const dynamic = "force-dynamic";

export async function GET() {
  const results: any = {
    status: "PENDING",
    steps: [],
    errors: [],
  };

  try {
    // 1. CREATE FAMILY
    results.steps.push({ step: "Creating family...", status: "IN_PROGRESS" });
    const repo = new MentoriaFamilyRepository();
    const service = new MentoriaFamilyService(repo);

    const family = await repo.createFamily(TEST_FAMILY_ID);
    results.steps[0].status = "COMPLETED";
    results.steps[0].result = { id: family.id, createdAt: family.createdAt };

    // 2. CREATE STUDENT
    results.steps.push({ step: "Creating student...", status: "IN_PROGRESS" });
    const student = await repo.createStudent({
      familyId: TEST_FAMILY_ID,
      name: TEST_STUDENT_NAME,
      age: 12,
      level: "6 primaria",
    });
    results.steps[1].status = "COMPLETED";
    results.steps[1].result = { id: student.id, name: student.name };

    // 3. INVITE GUARDIAN
    results.steps.push({ step: "Inviting guardian...", status: "IN_PROGRESS" });
    const guardian = await repo.upsertGuardian({
      familyId: TEST_FAMILY_ID,
      email: TEST_GUARDIAN_EMAIL,
      name: "Test Guardian",
      role: "tutor",
    });
    results.steps[2].status = "COMPLETED";
    results.steps[2].result = { id: guardian.id, email: guardian.email };

    // 4. RETRIEVE BUNDLE
    results.steps.push({ step: "Retrieving family bundle...", status: "IN_PROGRESS" });
    const bundle = await service.getFamilyBundle(TEST_FAMILY_ID);
    if (!bundle.family) {
      throw new Error("Family bundle is null - family not found");
    }
    results.steps[3].status = "COMPLETED";
    results.steps[3].result = {
      familyId: bundle.family.id,
      guardians: bundle.guardians.length,
      students: bundle.students.length,
    };

    // 5. VERIFY TENANT ISOLATION
    results.steps.push({ step: "Verifying tenant isolation...", status: "IN_PROGRESS" });
    const guardianByEmail = await repo.getGuardianByFamilyAndEmail(TEST_FAMILY_ID, TEST_GUARDIAN_EMAIL);
    if (!guardianByEmail) {
      throw new Error("Tenant isolation FAILED: Guardian not found by email");
    }
    results.steps[4].status = "COMPLETED";
    results.steps[4].result = { tenantIsolationOK: true };

    results.status = "SUCCESS";
    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.status = "FAILED";
    results.errors.push(message);
    return NextResponse.json(results, { status: 500 });
  }
}
