import { describe, expect, it } from "vitest";

import { composeAdaptiveTutorReply } from "@/lib/agents/mentoria/tutor-agent";
import { buildTutorBehaviorPolicy, updateDynamicStudentProfile } from "@/lib/mentoria/profile-engine";
import { buildDynamicStudentProfile } from "@/lib/mentoria/student-profile";
import { buildWorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";
import type { MentoriaProgress, MentoriaStudentSubject, StudentProfile } from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

function student(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    id: "student_1",
    tenantId: "tenant_mentoria",
    learningStage: "eso",
    fullName: "Alex",
    age: 13,
    schoolYear: "2 ESO",
    learningGoals: ["Comprender mejor Matematicas"],
    baseEmotionalState: "steady",
    emotionalBaseline: {
      frustration: "medium",
      motivation: "medium",
      concentration: "medium",
    },
    learningPreference: "step_by_step",
    preferredStudyMinutes: 30,
    strengths: [],
    onboardingCompleted: true,
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function evolution(overrides?: Partial<StudentEvolutionProfile>): StudentEvolutionProfile {
  return {
    studentId: "student_1",
    strengths: [],
    weaknesses: [],
    frustrationLevel: 0.45,
    consistencyScore: 0.55,
    averageResponseTime: 14,
    lastSessions: 2,
    commonMistakes: [],
    progressionVelocity: 0.55,
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

const subject: MentoriaStudentSubject = {
  id: "student_subject_1",
  tenantId: "tenant_mentoria",
  studentProfileId: "student_1",
  subjectId: "subject_matematicas",
  initialLevel: "me_cuesta_mucho",
  subject: {
    id: "subject_matematicas",
    tenantId: "tenant_mentoria",
    slug: "matematicas",
    name: "Matematicas",
    description: "Refuerzo guiado",
    difficultyBand: "core",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
  createdAt: "2026-04-03T00:00:00.000Z",
  updatedAt: "2026-04-03T00:00:00.000Z",
};

const confidentSubject: MentoriaStudentSubject = {
  ...subject,
  id: "student_subject_2",
  initialLevel: "se_me_da_bien",
};

function progress(overrides?: Partial<MentoriaProgress>): MentoriaProgress {
  return {
    id: "progress_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: "subject_matematicas",
    masteryScore: 50,
    confidenceScore: 50,
    streakDays: 1,
    sessionsCompleted: 1,
    exercisesCompleted: 0,
    weakTopics: [],
    strongTopics: [],
    lastActivityAt: "2026-04-03T00:00:00.000Z",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("mentoria dynamic student profile", () => {
  it("turns course mismatch, repeated course and weak progress into active support", () => {
    const profile = buildDynamicStudentProfile({
      student: student({
        age: 15,
        schoolYear: "2 ESO",
        supportNotes: "estructura familiar padres separados | repeticion si",
      }),
      studentSubjects: [subject],
      progress: [progress({ masteryScore: 42, confidenceScore: 38 })],
      evolution: evolution({ frustrationLevel: 0.78, consistencyScore: 0.34, commonMistakes: ["fracciones"] }),
    });

    expect(profile.academic.hasRepeatedCourse).toBe(true);
    expect(profile.academic.courseAgeMismatch).toBe(true);
    expect(profile.cognitive.comprehensionLevel).toBe("low");
    expect(profile.emotional.frustrationLevel).toBe("high");
    expect(profile.contextual.familyStructure).toBe("separated_parents");
    expect(profile.contextual.supportLevel).toBe("high");

    const policy = buildTutorBehaviorPolicy(profile);
    expect(policy.tone).toBe("empathetic");
    expect(policy.difficulty).toBe("down");
    expect(policy.pace).toBe("slow");
    expect(policy.sessionStage).toBe("guided_practice");
  });

  it("updates the profile after errors, abandoned sessions and fast correct work", () => {
    const base = buildDynamicStudentProfile({
      student: student(),
      studentSubjects: [subject],
      progress: [progress({ masteryScore: 68, confidenceScore: 64 })],
      evolution: evolution(),
    });

    const afterErrors = updateDynamicStudentProfile(base, {
      kind: "exercise",
      totalAnswers: 3,
      correctAnswers: 0,
      consecutiveErrors: 3,
      responseSpeed: "slow",
    });
    expect(afterErrors.emotional.frustrationLevel).toBe("high");
    expect(afterErrors.emotional.confidenceLevel).toBe("low");

    const afterAbandon = updateDynamicStudentProfile(base, {
      kind: "session",
      abandoned: true,
    });
    expect(afterAbandon.emotional.consistency).toBe("low");

    const afterFastSuccess = updateDynamicStudentProfile(base, {
      kind: "exercise",
      totalAnswers: 4,
      correctAnswers: 4,
      responseSpeed: "fast",
    });
    expect(afterFastSuccess.cognitive.comprehensionLevel).toBe("high");
    expect(afterFastSuccess.emotional.confidenceLevel).toBe("high");
  });

  it("makes the orchestrator and tutor behave differently for two students in the same course", () => {
    const struggling = buildDynamicStudentProfile({
      student: student({ age: 13, schoolYear: "2 ESO" }),
      studentSubjects: [subject],
      progress: [progress({ masteryScore: 36, confidenceScore: 34 })],
      evolution: evolution({ frustrationLevel: 0.84, consistencyScore: 0.3, averageResponseTime: 28, commonMistakes: ["denominadores"] }),
    });
    const confident = buildDynamicStudentProfile({
      student: student({ id: "student_2", age: 13, schoolYear: "2 ESO" }),
      studentSubjects: [confidentSubject],
      progress: [progress({ masteryScore: 94, confidenceScore: 92 })],
      evolution: evolution({ progressionVelocity: 0.86, frustrationLevel: 0.18, consistencyScore: 0.82, averageResponseTime: 7 }),
    });

    const strugglingPlan = buildWorkspaceOrchestratorPlan({
      nextAction: null,
      sessionState: "idle",
      selectedSubjectName: "Matematicas",
      dynamicProfile: struggling,
    });
    const confidentPlan = buildWorkspaceOrchestratorPlan({
      nextAction: null,
      sessionState: "idle",
      selectedSubjectName: "Matematicas",
      dynamicProfile: confident,
    });

    expect(strugglingPlan.stage).toBe("guided_practice");
    expect(strugglingPlan.tutorBehavior?.tone).toBe("empathetic");
    expect(confidentPlan.stage).toBe("light_evaluation");
    expect(confidentPlan.tutorBehavior?.difficulty).toBe("up");

    const teaching = {
      explanation: "Para sumar fracciones necesitas una unidad comun.",
      suggestedSteps: ["Busca denominador comun", "Convierte cada fraccion", "Suma numeradores", "Simplifica"],
      reinforcementQuestion: "Por que necesitas el denominador comun?",
    };
    const strugglingReply = composeAdaptiveTutorReply(teaching, "Te lo organizo claro.", buildTutorBehaviorPolicy(struggling));
    const confidentReply = composeAdaptiveTutorReply(teaching, "Te lo organizo claro.", buildTutorBehaviorPolicy(confident));

    expect(strugglingReply).not.toBe(confidentReply);
    expect(strugglingReply).toContain("Vamos despacio");
    expect(confidentReply).toContain("Voy directo");
  });
});
