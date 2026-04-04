import { describe, expect, it } from "vitest";

import {
  buildDailyClosureSummary,
  buildGuardianHookEvents,
  buildStudentMemorySummary,
  buildWorkspaceEntry,
  inferSubjectAndTopic,
  summarizeImagePurpose,
} from "@/lib/mentoria/product-experience";
import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaProgress,
  MentoriaSubject,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";

function createStudent(): StudentProfile {
  return {
    id: "student_1",
    tenantId: "tenant_1",
    fullName: "Alex",
    age: 13,
    schoolYear: "2 ESO",
    learningGoals: ["Mejorar matematicas"],
    baseEmotionalState: "steady",
    emotionalBaseline: { frustration: "medium", motivation: "medium", concentration: "medium" },
    learningPreference: "step_by_step",
    preferredStudyMinutes: 30,
    strengths: ["lectura"],
    onboardingCompleted: true,
    learningStage: "eso",
    createdAt: "2026-03-29T08:00:00.000Z",
    updatedAt: "2026-03-29T08:00:00.000Z",
  };
}

function createSubjects(): MentoriaSubject[] {
  return [
    {
      id: "subject_math",
      tenantId: "tenant_1",
      slug: "matematicas",
      name: "Matematicas",
      description: "",
      difficultyBand: "core",
      createdAt: "2026-03-29T08:00:00.000Z",
      updatedAt: "2026-03-29T08:00:00.000Z",
    },
    {
      id: "subject_language",
      tenantId: "tenant_1",
      slug: "lengua",
      name: "Lengua",
      description: "",
      difficultyBand: "core",
      createdAt: "2026-03-29T08:00:00.000Z",
      updatedAt: "2026-03-29T08:00:00.000Z",
    },
  ];
}

function createDailyPlan(): DailyPlan {
  return {
    id: "plan_1",
    tenantId: "tenant_1",
    studentId: "student_1",
    planDate: "2026-03-29",
    recommendedDuration: 35,
    tasks: [
      {
        id: "task_1",
        subject: "Matematicas",
        subjectId: "subject_math",
        type: "challenge",
        difficulty: 4,
        completed: false,
      },
    ],
    priority: "high",
    adaptationReason: "Necesita reforzar fracciones",
    generatedAt: "2026-03-29T08:00:00.000Z",
    createdAt: "2026-03-29T08:00:00.000Z",
    updatedAt: "2026-03-29T08:00:00.000Z",
    completedTaskIds: [],
    completionRate: 0.2,
  };
}

function createEvolution(): StudentEvolutionProfile {
  return {
    studentId: "student_1",
    strengths: ["Comprension lectora"],
    weaknesses: ["matematicas", "fracciones"],
    frustrationLevel: 0.61,
    consistencyScore: 0.58,
    averageResponseTime: 11,
    lastSessions: 5,
    commonMistakes: ["Confunde numerador y denominador"],
    progressionVelocity: 0.42,
    updatedAt: "2026-03-29T08:00:00.000Z",
  };
}

function createProgress(subjects: MentoriaSubject[]): MentoriaProgress[] {
  return [
    {
      id: "progress_math",
      tenantId: "tenant_1",
      studentProfileId: "student_1",
      subjectId: subjects[0].id,
      subject: subjects[0],
      masteryScore: 48,
      confidenceScore: 41,
      streakDays: 3,
      sessionsCompleted: 6,
      exercisesCompleted: 14,
      strongTopics: [],
      weakTopics: ["Fracciones"],
      lastActivityAt: "2026-03-29T08:20:00.000Z",
      createdAt: "2026-03-29T08:00:00.000Z",
      updatedAt: "2026-03-29T08:20:00.000Z",
    },
    {
      id: "progress_language",
      tenantId: "tenant_1",
      studentProfileId: "student_1",
      subjectId: subjects[1].id,
      subject: subjects[1],
      masteryScore: 76,
      confidenceScore: 71,
      streakDays: 4,
      sessionsCompleted: 5,
      exercisesCompleted: 9,
      strongTopics: ["Resumen"],
      weakTopics: [],
      lastActivityAt: "2026-03-28T18:00:00.000Z",
      createdAt: "2026-03-28T18:00:00.000Z",
      updatedAt: "2026-03-28T18:00:00.000Z",
    },
  ];
}

describe("mentoria product experience", () => {
  it("selects a subject automatically from the message and learning memory", () => {
    const subjects = createSubjects();
    const result = inferSubjectAndTopic({
      message: "No entiendo las fracciones y me atasco al simplificar",
      subjects,
      dailyPlan: createDailyPlan(),
      evolution: createEvolution(),
    });

    expect(result.subject.slug).toBe("matematicas");
    expect(result.topic).toContain("fracciones");
    expect(["message_match", "daily_plan_priority", "memory_priority"]).toContain(result.reason);
  });

  it("builds a memory summary and a clear workspace entry", () => {
    const subjects = createSubjects();
    const progress = createProgress(subjects);
    const memory = buildStudentMemorySummary({
      evolution: createEvolution(),
      progress,
      dailyPlan: createDailyPlan(),
    });
    const entry = buildWorkspaceEntry({
      student: createStudent(),
      subjects,
      progress,
      dailyPlan: createDailyPlan(),
      memory,
      analysis: {
        weakSubjects: ["Matematicas"],
        strongSubjects: ["Lengua"],
        nextActions: ["Repasar fracciones antes de pasar a problemas largos."],
      },
    });

    expect(memory.watchouts).toContain("matematicas");
    expect(memory.suggestedDifficulty).toBe("steady");
    expect(entry.recommendedSubjectSlug).toBe("matematicas");
    expect(entry.quickActions).toHaveLength(3);
    expect(entry.recommendedPrompt).toContain("Matematicas");
  });

  it("derives a visible daily closure with carry-over from the current day", () => {
    const subjects = createSubjects();
    const progress = createProgress(subjects);
    const closure = buildDailyClosureSummary({
      student: createStudent(),
      progress,
      dailyPlan: {
        ...createDailyPlan(),
        tasks: [
          {
            id: "task_review",
            subject: "Matematicas",
            subjectId: "subject_math",
            type: "review",
            difficulty: 2,
            completed: true,
          },
          {
            id: "task_practice",
            subject: "Matematicas",
            subjectId: "subject_math",
            type: "practice",
            difficulty: 3,
            completed: false,
          },
        ],
        completedTaskIds: ["task_review"],
        completionRate: 0.5,
      },
      motivation: {
        studentId: "student_1",
        streak: 2,
        lastActivityAt: "2026-03-29T09:30:00.000Z",
        effortScore: 0.62,
        confidenceTrend: "up",
        emotionalState: "steady",
        recentRewards: [],
        rewardPoints: 30,
        level: 2,
        achievements: [],
        motivationProfile: "steady",
        updatedAt: "2026-03-29T09:30:00.000Z",
      },
      recentSessions: [
        {
          id: "session_1",
          tenantId: "tenant_1",
          studentProfileId: "student_1",
          subjectId: "subject_math",
          mentorId: "mentor_1",
          clientId: "client_1",
          topic: "Fracciones",
          status: "completed",
          durationMinutes: 25,
          aiTokensUsed: 100,
          emotionalState: "steady",
          tutorSummary: "Buen avance",
          recommendedNextStep: "Haz una practica corta de fracciones equivalentes.",
          transcript: [],
          createdAt: "2026-03-29T09:00:00.000Z",
          completedAt: "2026-03-29T09:25:00.000Z",
          updatedAt: "2026-03-29T09:25:00.000Z",
        },
      ],
      focusSessions: [],
      todayIso: "2026-03-29",
    });

    expect(closure).not.toBeNull();
    expect(closure?.source).toBe("live");
    expect(closure?.status).toBe("in_progress");
    expect(closure?.carryOverPrompt).toBe("Haz una practica corta de fracciones equivalentes.");
    expect(closure?.title).toBe("Hoy has dejado avance real y manana seguiras con ventaja");
    expect(closure?.summary).toContain("ya has ganado traccion");
  });

  it("reuses the last daily closure as tomorrow entry memory when the new day has not started yet", () => {
    const closure = buildDailyClosureSummary({
      student: createStudent(),
      progress: createProgress(createSubjects()),
      dailyPlan: {
        ...createDailyPlan(),
        planDate: "2026-03-30",
        completedTaskIds: [],
        completionRate: 0,
      },
      motivation: {
        studentId: "student_1",
        streak: 3,
        lastActivityAt: "2026-03-29T21:00:00.000Z",
        effortScore: 0.58,
        confidenceTrend: "steady",
        emotionalState: "calm",
        recentRewards: [],
        rewardPoints: 40,
        level: 2,
        achievements: [],
        motivationProfile: "steady",
        updatedAt: "2026-03-29T21:00:00.000Z",
      },
      recentSessions: [],
      focusSessions: [],
      events: [
        {
          id: "evt_closure",
          tenantId: "tenant_1",
          userId: "student_1",
          type: "mentoria_daily_closure",
          payload: {
            name: "Cierre diario",
            metadata: {
              closureDate: "2026-03-29",
              source: "live",
              status: "completed",
              title: "Hoy has cerrado algo importante",
              summary: "Has cerrado el dia y has dejado listo un repaso corto para manana.",
              carryOverPrompt: "Empieza repasando fracciones equivalentes con un ejemplo guiado.",
              carryOverTopic: "Fracciones equivalentes",
              carryOverSubjectId: "subject_math",
              completionRate: 1,
              completedTasks: 2,
              totalTasks: 2,
              lastActivityAt: "2026-03-29T21:00:00.000Z",
            },
          },
          createdAt: "2026-03-29T21:01:00.000Z",
        },
      ],
      todayIso: "2026-03-30",
    });

    expect(closure).not.toBeNull();
    expect(closure?.source).toBe("event");
    expect(closure?.closureDate).toBe("2026-03-29");
    expect(closure?.carryOverPrompt).toBe("Empieza repasando fracciones equivalentes con un ejemplo guiado.");
    expect(closure?.title).toBe("Hoy has cerrado algo importante");
  });

  it("prepares guardian hooks with activity, progress and alerts", () => {
    const student = createStudent();
    const subjects = createSubjects();
    const progress = createProgress(subjects);
    const recentSessions: LearningSession[] = [
      {
        id: "session_1",
        tenantId: "tenant_1",
        studentProfileId: "student_1",
        subjectId: "subject_math",
        mentorId: "mentor_1",
        clientId: "client_1",
        topic: "Fracciones",
        status: "completed",
        durationMinutes: 30,
        aiTokensUsed: 120,
        emotionalState: "steady",
        tutorSummary: "Trabajo guiado",
        recommendedNextStep: "Practicar simplificacion",
        transcript: [],
        createdAt: "2026-03-29T09:00:00.000Z",
        completedAt: "2026-03-29T09:30:00.000Z",
        updatedAt: "2026-03-29T09:30:00.000Z",
      },
    ];
    const focusSessions: FocusSession[] = [
      {
        id: "focus_1",
        tenantId: "tenant_1",
        studentProfileId: "student_1",
        durationMinutes: 25,
        distractionsCount: 1,
        status: "completed",
        startedAt: "2026-03-29T10:00:00.000Z",
        endedAt: "2026-03-29T10:25:00.000Z",
        createdAt: "2026-03-29T10:00:00.000Z",
        updatedAt: "2026-03-29T10:25:00.000Z",
      },
    ];

    const hooks = buildGuardianHookEvents({
      student,
      progress,
      recentSessions,
      focusSessions,
      interventions: [
        {
          id: "int_1",
          severity: "high",
          summary: "Necesita acompanamiento extra en matematicas esta semana.",
          type: "risk_student",
          status: "active",
          createdAt: "2026-03-29T10:40:00.000Z",
        },
      ],
      events: [
        {
          id: "evt_1",
          tenantId: "tenant_1",
          userId: "student_1",
          type: "mentoria_progress_update",
          payload: { name: "Progreso actualizado", metadata: { subject: "Matematicas" } },
          createdAt: "2026-03-29T10:50:00.000Z",
        },
      ],
    });

    expect(hooks.length).toBeGreaterThanOrEqual(4);
    expect(hooks.some((event) => event.category === "activity")).toBe(true);
    expect(hooks.some((event) => event.category === "progress")).toBe(true);
    expect(hooks.some((event) => event.category === "alert")).toBe(true);
    expect(hooks[0]?.createdAt >= hooks[1]?.createdAt).toBe(true);
  });

  it("summarizes image intent without leaking a raw long note", () => {
    const summary = summarizeImagePurpose(
      "Necesito que luego interpreteis una foto del ejercicio de fracciones porque el alumno se pierde en el segundo paso y quiero dejarlo preparado con contexto adicional para el tutor.",
    );

    expect(summary.length).toBeLessThanOrEqual(160);
    expect(summary).toContain("Necesito");
  });
});
