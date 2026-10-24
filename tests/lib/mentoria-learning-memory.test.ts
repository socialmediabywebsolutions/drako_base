import { describe, expect, it } from "vitest";

import { composeAdaptiveTutorReply } from "@/lib/agents/mentoria/tutor-agent";
import { buildTutorBehaviorPolicy } from "@/lib/mentoria/profile-engine";
import {
  adaptDailyPlanWithLearningMemory,
  updateStudentLearningMemory,
} from "@/lib/mentoria/student-memory-engine";
import type { StudentLearningMemory } from "@/lib/mentoria/student-learning-memory";
import { buildDynamicStudentProfile } from "@/lib/mentoria/student-profile";
import type { DailyPlan, LearningSession, MentoriaProgress, MentoriaStudentSubject, MentoriaSubject, StudentProfile } from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

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
  initialLevel: "voy_normal",
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
    learningGoals: ["Comprender Matematicas"],
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
    frustrationLevel: 0.48,
    consistencyScore: 0.58,
    averageResponseTime: 14,
    lastSessions: 3,
    commonMistakes: [],
    progressionVelocity: 0.56,
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
    masteryScore: 58,
    confidenceScore: 56,
    streakDays: 2,
    sessionsCompleted: 2,
    exercisesCompleted: 1,
    weakTopics: [],
    strongTopics: [],
    lastActivityAt: "2026-04-03T00:00:00.000Z",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function memory(overrides?: Partial<StudentLearningMemory>): StudentLearningMemory {
  return {
    studentId: "student_1",
    tenantId: "tenant_mentoria",
    strongestSubjects: [],
    weakestSubjects: [],
    preferredExplanationStyle: "text_step_by_step",
    averageResponseSpeed: "medium",
    confidenceTrend: "stable",
    frustrationTrend: "stable",
    consistencyTrend: "stable",
    repetitionRiskSignals: [],
    motivationPattern: "steady",
    bestSessionLength: 22,
    bestSessionTimeWindow: "unknown",
    lastAdaptationSummary: {
      worked: "Funciono explicar paso a paso.",
      friction: "Sin friccion fuerte.",
      nextStart: "Empezar con comprobacion corta.",
    },
    styleEvidence: { text_step_by_step: 1 },
    timeWindowEvidence: {},
    adaptationCount: 0,
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function session(overrides?: Partial<LearningSession>): LearningSession {
  return {
    id: "session_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: subject.id,
    mentorId: "mentor",
    clientId: "student_1",
    topic: "Fracciones",
    status: "completed",
    durationMinutes: 16,
    aiTokensUsed: 120,
    emotionalState: "confident",
    tutorSummary: "Sesion adaptada",
    recommendedNextStep: "Practicar",
    transcript: [],
    createdAt: "2026-04-03T15:00:00.000Z",
    completedAt: "2026-04-03T15:16:00.000Z",
    updatedAt: "2026-04-03T15:16:00.000Z",
    ...overrides,
  };
}

describe("mentoria persistent learning memory", () => {
  it("learns persistent style, time window and session length from repeated outcomes", () => {
    const first = updateStudentLearningMemory(memory({ bestSessionLength: 24 }), {
      kind: "guided_session",
      subject,
      session: session(),
      tutorReply: "Hicimos un esquema visual con partes, flechas y comprobacion.",
      allProgress: [progress({ masteryScore: 78, confidenceScore: 76 })],
    });
    const second = updateStudentLearningMemory(first, {
      kind: "guided_session",
      subject,
      session: session({ id: "session_2", durationMinutes: 14, createdAt: "2026-04-04T16:00:00.000Z" }),
      tutorReply: "Otro esquema visual corto antes de resolver.",
      allProgress: [progress({ masteryScore: 82, confidenceScore: 80 })],
    });

    expect(second.preferredExplanationStyle).toBe("visual_step_by_step");
    expect(second.bestSessionTimeWindow).toBe("afternoon");
    expect(second.bestSessionLength).toBeLessThan(24);
    expect(second.lastAdaptationSummary.nextStart).toContain("Matematicas");

    const afterAbandon = updateStudentLearningMemory(second, {
      kind: "guided_session",
      subject,
      session: session({ id: "session_3", durationMinutes: 31, emotionalState: "blocked" }),
      abandoned: true,
    });
    expect(afterAbandon.bestSessionLength).toBeLessThan(second.bestSessionLength);
    expect(afterAbandon.motivationPattern).toBe("avoidant");
  });

  it("combines memory with the dynamic profile so future tutor policy changes before the next message", () => {
    const fragileMemory = memory({
      preferredExplanationStyle: "short_guided",
      frustrationTrend: "rising",
      consistencyTrend: "falling",
      bestSessionLength: 12,
      weakestSubjects: ["Matematicas"],
      repetitionRiskSignals: ["recurring_errors"],
    });

    const profile = buildDynamicStudentProfile({
      student: student(),
      studentSubjects: [studentSubject],
      progress: [progress({ masteryScore: 52, confidenceScore: 46 })],
      evolution: evolution({ frustrationLevel: 0.68, consistencyScore: 0.42, commonMistakes: ["denominadores"] }),
      learningMemory: fragileMemory,
    });
    const policy = buildTutorBehaviorPolicy(profile);

    expect(profile.memory?.preferredExplanationStyle).toBe("short_guided");
    expect(profile.contextual.supportSignals).toContain("frustration_trend_rising");
    expect(policy.tone).toBe("empathetic");
    expect(policy.sessionMode).toBe("soft_reentry");
    expect(policy.explanationLength).toBe("short");
    expect(policy.bestSessionLength).toBe(12);
  });

  it("gives two students in the same course different persistent tutor behavior", () => {
    const visualProfile = buildDynamicStudentProfile({
      student: student(),
      studentSubjects: [studentSubject],
      progress: [progress({ masteryScore: 62, confidenceScore: 58 })],
      evolution: evolution({ frustrationLevel: 0.62, consistencyScore: 0.5 }),
      learningMemory: memory({
        preferredExplanationStyle: "visual_step_by_step",
        frustrationTrend: "rising",
        bestSessionLength: 12,
        styleEvidence: { visual_step_by_step: 4 },
      }),
    });
    const challengeProfile = buildDynamicStudentProfile({
      student: student({ id: "student_2" }),
      studentSubjects: [{ ...studentSubject, id: "student_subject_2", initialLevel: "se_me_da_bien" }],
      progress: [progress({ masteryScore: 94, confidenceScore: 92 })],
      evolution: evolution({ frustrationLevel: 0.16, consistencyScore: 0.86, progressionVelocity: 0.9, averageResponseTime: 7 }),
      learningMemory: memory({
        studentId: "student_2",
        preferredExplanationStyle: "challenge_first",
        averageResponseSpeed: "fast",
        confidenceTrend: "rising",
        frustrationTrend: "falling",
        consistencyTrend: "rising",
        bestSessionLength: 26,
        styleEvidence: { challenge_first: 5 },
      }),
    });
    const teaching = {
      explanation: "Para sumar fracciones necesitas una unidad comun.",
      suggestedSteps: ["Busca denominador comun", "Convierte", "Suma", "Simplifica"],
      reinforcementQuestion: "Por que necesitas denominador comun?",
    };

    const visualReply = composeAdaptiveTutorReply(teaching, "Vamos con esto.", buildTutorBehaviorPolicy(visualProfile));
    const challengeReply = composeAdaptiveTutorReply(teaching, "Vamos con esto.", buildTutorBehaviorPolicy(challengeProfile));

    expect(visualReply).toContain("esquema visual");
    expect(visualReply).toContain("bloque corto");
    expect(challengeReply).toContain("Primero intentas");
    expect(buildTutorBehaviorPolicy(challengeProfile).sessionStage).toBe("light_evaluation");
  });

  it("uses memory to adapt future daily plan duration and challenge level without adding UI state", () => {
    const plan: DailyPlan = {
      id: "daily_1",
      tenantId: "tenant_mentoria",
      studentId: "student_1",
      planDate: "2026-04-03",
      recommendedDuration: 24,
      tasks: [
        {
          id: "task_1",
          subject: "Matematicas",
          type: "challenge",
          difficulty: 4,
          completed: false,
        },
      ],
      priority: "medium",
      adaptationReason: "Inicio",
      generatedAt: "2026-04-03T00:00:00.000Z",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      completedTaskIds: [],
      completionRate: 0,
    };
    const adapted = adaptDailyPlanWithLearningMemory(plan, memory({
      bestSessionLength: 11,
      frustrationTrend: "rising",
      weakestSubjects: ["Matematicas"],
    }));

    expect(adapted.recommendedDuration).toBe(11);
    expect(adapted.priority).toBe("high");
    expect(adapted.tasks[0]?.difficulty).toBe(3);
  });
});
