import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mentoria/drako-agent-handlers", () => ({
  ensureMentoriaAgentHandlersRegistered: vi.fn(),
}));

import { MentoriaService } from "@/lib/mentoria/service";
import type { MentoriaGuardianAccessibleStudent, StudentProfile } from "@/lib/mentoria/types";

function buildStudentProfile(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    id: "student_1",
    tenantId: "tenant_mentoria",
    learningStage: "eso",
    fullName: "Alex",
    age: 13,
    schoolYear: "2 ESO",
    learningGoals: ["Comprender mejor Matematicas con ayuda guiada"],
    baseEmotionalState: "steady",
    emotionalBaseline: {
      frustration: "medium",
      motivation: "medium",
      concentration: "medium",
    },
    learningPreference: "step_by_step",
    preferredStudyMinutes: 30,
    strengths: [],
    onboardingCompleted: false,
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

function buildAccess(overrides?: Partial<MentoriaGuardianAccessibleStudent>): MentoriaGuardianAccessibleStudent {
  return {
    id: "access_1",
    familyId: "tenant_mentoria",
    guardianId: "guardian_1",
    studentId: "student_1",
    studentProfileId: "student_1",
    canViewFullProgress: true,
    canManageSchedule: true,
    dailyStudyMinutes: 30,
    supervisionLevel: "balanced",
    notificationPreferences: ["progress", "planner"],
    isPrimaryContact: true,
    studentName: "Alex",
    source: "canonical",
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

describe("MentoriaService canonical onboarding state", () => {
  it("resolves the onboarding student through guardian canonical access when the actor is not the student user", async () => {
    const student = buildStudentProfile();
    const repository = {
      seedSubjects: vi.fn().mockResolvedValue([]),
      getStudentProfileByUser: vi.fn().mockResolvedValue(null),
      listGuardianAccessibleStudents: vi.fn().mockResolvedValue([buildAccess()]),
      getStudentProfileById: vi.fn().mockResolvedValue(student),
      listSubjects: vi.fn().mockResolvedValue([]),
      listStudentSubjects: vi.fn().mockResolvedValue([]),
    };
    const familyRepository = {
      getFamilyById: vi.fn().mockResolvedValue({
        id: "tenant_mentoria",
        createdAt: "2026-04-13T10:00:00.000Z",
      }),
      getGuardianByFamilyAndEmail: vi.fn().mockResolvedValue({
        id: "guardian_1",
        email: "family@example.com",
        name: "",
        familyId: "tenant_mentoria",
        role: "mother",
        familyRelation: "mother",
        systemRole: "primary_guardian",
        createdAt: "2026-04-13T10:00:00.000Z",
      }),
      listGuardiansByFamily: vi.fn().mockResolvedValue([
        {
          id: "guardian_1",
          email: "family@example.com",
          name: "",
          familyId: "tenant_mentoria",
          role: "mother",
          familyRelation: "mother",
          systemRole: "primary_guardian",
          createdAt: "2026-04-13T10:00:00.000Z",
        },
      ]),
      listGuardianStudentAccessByStudent: vi.fn().mockResolvedValue([buildAccess()]),
    };

    const service = new MentoriaService(repository as any, familyRepository as any, {} as any, {} as any);

    const state = await service.getOnboardingState({
      userId: "guardian_user_1",
      email: "family@example.com",
      tenantId: "tenant_mentoria",
      role: "user",
    });

    expect(repository.getStudentProfileByUser).toHaveBeenCalledWith("tenant_mentoria", "guardian_user_1");
    expect(repository.listGuardianAccessibleStudents).toHaveBeenCalledWith("tenant_mentoria", "guardian_user_1");
    expect(repository.getStudentProfileById).toHaveBeenCalledWith("tenant_mentoria", "student_1");
    expect(state.primaryGuardian).toEqual({
      fullName: "",
      relation: "mother",
    });
    expect(state.student?.id).toBe("student_1");
    expect(state.profile?.id).toBe("student_1");
  });
});
