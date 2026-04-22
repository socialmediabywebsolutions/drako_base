import { describe, expect, it } from "vitest";

import { composeAdaptiveTutorReply } from "@/lib/agents/mentoria/tutor-agent";
import { buildTutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import { buildDynamicStudentProfile } from "@/lib/mentoria/student-profile";
import { createInitialStudentSubjectMemory } from "@/lib/mentoria/student-subject-memory";
import { updateStudentSubjectMemory } from "@/lib/mentoria/student-subject-memory-engine";
import { buildWorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";
import type { MentoriaProgress, MentoriaStudentSubject, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";

const subject: MentoriaSubject = {
  id: "subject_matematicas",
  tenantId: "tenant_mentoria",
  slug: "matematicas",
  name: "Matematicas",
  description: "Refuerzo guiado",
  difficultyBand: "core",
  createdAt: "2026-04-03T00:00:00.000Z",
  updatedAt: "2026-04-03T00:00:00.000Z",
};

const studentSubject: MentoriaStudentSubject = {
  id: "student_subject_1",
  tenantId: "tenant_mentoria",
  studentProfileId: "student_1",
  subjectId: subject.id,
  initialLevel: "me_cuesta_mucho",
  subject,
  createdAt: "2026-04-03T00:00:00.000Z",
  updatedAt: "2026-04-03T00:00:00.000Z",
};

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
    preferredStudyMinutes: 24,
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
    frustrationLevel: 0.52,
    consistencyScore: 0.58,
    averageResponseTime: 16,
    lastSessions: 3,
    commonMistakes: ["denominadores"],
    progressionVelocity: 0.54,
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function progress(overrides?: Partial<MentoriaProgress>): MentoriaProgress {
  return {
    id: "progress_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: subject.id,
    subject,
    masteryScore: 48,
    confidenceScore: 44,
    streakDays: 1,
    sessionsCompleted: 1,
    exercisesCompleted: 0,
    weakTopics: ["fracciones"],
    strongTopics: [],
    lastActivityAt: "2026-04-03T00:00:00.000Z",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function learningMemory(overrides?: Partial<StudentLearningMemory>): StudentLearningMemory {
  return {
    studentId: "student_1",
    tenantId: "tenant_mentoria",
    strongestSubjects: [],
    weakestSubjects: ["Matematicas"],
    preferredExplanationStyle: "text_step_by_step",
    averageResponseSpeed: "medium",
    confidenceTrend: "stable",
    frustrationTrend: "stable",
    consistencyTrend: "stable",
    repetitionRiskSignals: [],
    motivationPattern: "steady",
    bestSessionLength: 20,
    bestSessionTimeWindow: "unknown",
    lastAdaptationSummary: {
      worked: "Funciono ir por pasos.",
      friction: "Aun hay dudas en fracciones.",
      nextStart: "Empezar con un ejemplo simple.",
    },
    styleEvidence: { text_step_by_step: 2 },
    timeWindowEvidence: {},
    adaptationCount: 2,
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("mentoria subject concept memory", () => {
  it("tracks recurrence, support style and reinforcement by concept", () => {
    const initial = createInitialStudentSubjectMemory({
      studentId: "student_1",
      tenantId: "tenant_mentoria",
      subjectSlug: "matematicas",
      conceptKey: "fractions_comparison",
      supportStyle: "step_by_step",
      happenedAt: "2026-04-03T10:00:00.000Z",
    });

    const afterFailure = updateStudentSubjectMemory(initial, {
      kind: "reinforcement",
      studentId: "student_1",
      tenantId: "tenant_mentoria",
      subject,
      topic: "Comparar fracciones",
      studentText: "No se cual es mayor",
      correctionFeedback: "Confundes denominador y numerador al comparar fracciones.",
      score: 40,
      success: false,
      happenedAt: "2026-04-03T10:05:00.000Z",
    });

    const afterRecovery = updateStudentSubjectMemory(afterFailure, {
      kind: "microevaluation",
      studentId: "student_1",
      tenantId: "tenant_mentoria",
      subject,
      topic: "Comparar fracciones",
      studentText: "Primero igualo denominadores y luego comparo",
      tutorReply: "Bien, lo has resuelto con apoyo visual paso a paso.",
      tutorPolicy: {
        tone: "clear",
        difficulty: "steady",
        pace: "steady",
        sessionStage: "guided_practice",
        sessionMode: "standard",
        explanationLength: "balanced",
        detailLevel: "guided",
        exampleUse: "visual_step",
        positiveReinforcement: "medium",
        directives: [],
      },
      score: 92,
      success: true,
      happenedAt: "2026-04-03T10:15:00.000Z",
    });

    expect(afterFailure.conceptKey).toBe("fractions_comparison");
    expect(afterFailure.recurrenceCount).toBeGreaterThanOrEqual(1);
    expect(afterFailure.needsReinforcement).toBe(true);
    expect(afterFailure.lastErrorType).toContain("confusion");
    expect(afterRecovery.masteryLevel === "developing" || afterRecovery.masteryLevel === "secure" || afterRecovery.masteryLevel === "mastered").toBe(true);
    expect(afterRecovery.preferredSupportStyle).toBe("visual_steps");
    expect(afterRecovery.internalSummary.revisitSoon).toBe(false);
  });

  it("changes tutor policy and reply when the active concept is fragile", () => {
    const subjectMemory = createInitialStudentSubjectMemory({
      studentId: "student_1",
      tenantId: "tenant_mentoria",
      subjectSlug: "matematicas",
      conceptKey: "fractions_comparison",
      supportStyle: "visual_steps",
      happenedAt: "2026-04-03T10:00:00.000Z",
      evidenceSummary: "Comparison de fracciones necesita pasos visuales y refuerzo.",
      errorType: "fraction_comparison_confusion",
    });

    const profile = buildDynamicStudentProfile({
      student: student(),
      studentSubjects: [studentSubject],
      progress: [progress()],
      evolution: evolution({ frustrationLevel: 0.72, consistencyScore: 0.42 }),
      learningMemory: learningMemory(),
      subjectMemories: [{ ...subjectMemory, recurrenceCount: 3, needsReinforcement: true, confidenceLevel: "low", masteryLevel: "fragile" }],
      activeSubjectSlug: "matematicas",
      activeTopic: "Comparar fracciones",
    });

    const policy = buildTutorBehaviorPolicy(profile);
    const reply = composeAdaptiveTutorReply({
      explanation: "Para comparar fracciones necesitas una referencia comun.",
      suggestedSteps: ["Mira los denominadores", "Busca una referencia comun", "Compara"],
      reinforcementQuestion: "Que referencia te ayuda a decidir cual es mayor?",
    }, "Vamos con esto.", policy);

    expect(profile.memory?.activeConceptKey).toBe("fractions_comparison");
    expect(policy.difficulty).toBe("down");
    expect(policy.pace).toBe("slow");
    expect(policy.directives.join(" ")).toContain("concepto fragil");
    expect(reply).toContain("concepto concreto");
  });

  it("makes the orchestrator adapt stage and next step by concept state", () => {
    const fragileProfile = buildDynamicStudentProfile({
      student: student(),
      studentSubjects: [studentSubject],
      progress: [progress()],
      evolution: evolution({ frustrationLevel: 0.76, consistencyScore: 0.38 }),
      learningMemory: learningMemory(),
      subjectMemories: [
        {
          ...createInitialStudentSubjectMemory({
            studentId: "student_1",
            tenantId: "tenant_mentoria",
            subjectSlug: "matematicas",
            conceptKey: "fractions_comparison",
            supportStyle: "visual_steps",
            happenedAt: "2026-04-03T10:00:00.000Z",
          }),
          recurrenceCount: 4,
          masteryLevel: "fragile",
          confidenceLevel: "low",
          needsReinforcement: true,
          evidenceSummary: "Retomar comparacion de fracciones con apoyo visual.",
        },
      ],
      activeSubjectSlug: "matematicas",
      activeTopic: "Comparar fracciones",
    });

    const secureProfile = buildDynamicStudentProfile({
      student: student({ id: "student_2" }),
      studentSubjects: [{ ...studentSubject, id: "student_subject_2", studentProfileId: "student_2", initialLevel: "se_me_da_bien" }],
      progress: [progress({ studentProfileId: "student_2", masteryScore: 90, confidenceScore: 88 })],
      evolution: evolution({ studentId: "student_2", frustrationLevel: 0.22, consistencyScore: 0.82, progressionVelocity: 0.84 }),
      learningMemory: learningMemory({ studentId: "student_2", confidenceTrend: "rising", consistencyTrend: "rising", weakestSubjects: [] }),
      subjectMemories: [
        {
          ...createInitialStudentSubjectMemory({
            studentId: "student_2",
            tenantId: "tenant_mentoria",
            subjectSlug: "matematicas",
            conceptKey: "fractions_comparison",
            supportStyle: "retrieval_check",
            happenedAt: "2026-04-03T10:00:00.000Z",
          }),
          masteryLevel: "secure",
          confidenceLevel: "high",
          needsReinforcement: false,
          evidenceSummary: "Comparacion de fracciones ya admite comprobacion corta.",
        },
      ],
      activeSubjectSlug: "matematicas",
      activeTopic: "Comparar fracciones",
    });

    const fragilePlan = buildWorkspaceOrchestratorPlan({
      nextAction: null,
      sessionState: "idle",
      selectedSubjectName: "Matematicas",
      currentTopic: "Comparar fracciones",
      dynamicProfile: fragileProfile,
    });
    const securePlan = buildWorkspaceOrchestratorPlan({
      nextAction: null,
      sessionState: "idle",
      selectedSubjectName: "Matematicas",
      currentTopic: "Comparar fracciones",
      dynamicProfile: secureProfile,
    });

    expect(fragilePlan.stage).toBe("guided_practice");
    expect(fragilePlan.message.toLowerCase()).toContain("menos carga");
    expect(fragilePlan.nextStep.toLowerCase()).toContain("fractions comparison");
    expect(securePlan.stage).toBe("light_evaluation");
    expect(securePlan.microObjective.toLowerCase()).toContain("evaluacion ligera");
  });
});
