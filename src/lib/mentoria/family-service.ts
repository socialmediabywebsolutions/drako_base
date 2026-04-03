import type { MentoriaRequestSession } from "@/lib/mentoria/auth/request";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import type { MentoriaGuardianRole } from "@/lib/mentoria/types";

type FamilyActor = MentoriaRequestSession;

export class MentoriaFamilyService {
  constructor(private readonly repository: MentoriaFamilyRepository) {
    if (!repository) {
      throw new Error("REPOSITORY_REQUIRED");
    }
  }

  private assertActor(actor: FamilyActor): asserts actor is FamilyActor & { email: string; tenantId: string } {
    if (!actor.email || !actor.tenantId) {
      throw new Error("SESSION_REQUIRED");
    }
  }

  async getFamilyForSession(actor: FamilyActor) {
    this.assertActor(actor);
    
    // Verify actor email matches a guardian in the family
    const membership = await this.repository.getGuardianByFamilyAndEmail(actor.tenantId, actor.email);
    if (!membership) {
      throw new Error("FAMILY_ACCESS_DENIED");
    }

    const bundle = await this.repository.getFamilyBundle(actor.tenantId);
    if (!bundle.family) {
      throw new Error("FAMILY_NOT_FOUND");
    }

    return bundle;
  }

  async createStudent(
    actor: FamilyActor,
    input: { name?: string; age?: number | null; level?: string | null },
  ) {
    if (!input.name?.trim()) {
      throw new Error("INVALID_STUDENT_NAME");
    }

    const bundle = await this.getFamilyForSession(actor);
    if (!bundle.family) {
      throw new Error("FAMILY_REQUIRED");
    }

    const student = await this.repository.createStudent({
      familyId: bundle.family.id,
      name: input.name,
      age: input.age ?? null,
      level: input.level ?? null,
    });

    return {
      student,
      ...(await this.getFamilyForSession(actor)),
    };
  }

  async inviteGuardian(
    actor: FamilyActor,
    input: { email?: string; name?: string | null; role?: MentoriaGuardianRole },
  ) {
    const email = input.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("INVALID_GUARDIAN_EMAIL");
    }

    const bundle = await this.getFamilyForSession(actor);
    if (!bundle.family) {
      throw new Error("FAMILY_REQUIRED");
    }

    const guardian = await this.repository.upsertGuardian({
      email,
      familyId: bundle.family.id,
      name: input.name?.trim() || null,
      role: input.role ?? "tutor",
    });

    return {
      guardian,
      ...(await this.getFamilyForSession(actor)),
    };
  }

  async getFamilyBundle(familyId: string) {
    return this.repository.getFamilyBundle(familyId);
  }

  async resolveRegistrationFamily(input: {
    email: string;
    name?: string | null;
    preferredRole?: MentoriaGuardianRole;
  }): Promise<{
    familyId: string;
    guardianRole: MentoriaGuardianRole;
    existingGuardianId?: string;
  }> {
    const email = input.email.trim().toLowerCase();
    const existingGuardian = await this.repository.getGuardianByEmail(email);
    if (existingGuardian) {
      await this.repository.createFamily(existingGuardian.familyId);
      return {
        familyId: existingGuardian.familyId,
        guardianRole: existingGuardian.role,
        existingGuardianId: existingGuardian.id,
      };
    }

    const familyId = crypto.randomUUID();
    await this.repository.createFamily(familyId);
    return {
      familyId,
      guardianRole: input.preferredRole ?? "tutor",
    };
  }

  async finalizeRegistration(input: {
    userId: string;
    email: string;
    tenantId: string;
    name?: string | null;
    role?: MentoriaGuardianRole;
  }) {
    console.log("[MentoriaFamilyService.finalizeRegistration] ENTRADA", {
      userId: input.userId,
      email: input.email,
      tenantId: input.tenantId,
      name: input.name,
      role: input.role,
    });

    await this.repository.ensureFamilyMembershipByUser({
      userId: input.userId,
      email: input.email,
      tenantId: input.tenantId,
      fallbackName: input.name ?? null,
    });

    console.log("[MentoriaFamilyService.finalizeRegistration] ensureFamilyMembershipByUser completado");

    const result = await this.repository.upsertGuardian({
      email: input.email,
      familyId: input.tenantId,
      name: input.name ?? null,
      role: input.role ?? "tutor",
    });

    console.log("[MentoriaFamilyService.finalizeRegistration] upsertGuardian completado", {
      guardianId: result.id,
    });

    return result;
  }
}
