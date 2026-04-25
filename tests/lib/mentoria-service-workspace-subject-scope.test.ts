import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mentoria/drako-agent-handlers", () => ({
  ensureMentoriaAgentHandlersRegistered: vi.fn(),
}));

vi.mock("@/lib/drako/metrics", () => ({
  createMetricEvent: vi.fn(),
  listEventsForUser: vi.fn().mockResolvedValue([]),
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/behavioral-engine/adapters/mentoria", () => ({
  runMentoriaBehavioralShadow: vi.fn().mockReturnValue({
    currentStrategy: "entry",
    shadowStrategy: "entry",
    diverged: false,
    currentAction: {
      strategy: "entry",
      title: "Empezar ahora",
      description: "Abrir la materia activa.",
      rationale: ["scoped"],
      confidence: 1,
      task: null,
      prompt: null,
    },
    shadowAction: {
      strategy: "entry",
      title: "Empezar ahora",
      description: "Abrir la materia activa.",
      rationale: ["scoped"],
      confidence: 1,
      task: null,
      prompt: null,
    },
    loggedAt: "2026-04-25T10:00:00.000Z",
  }),
}));

vi.mock("@/lib/behavioral-engine/rollout", () => ({
  getMentoriaBehavioralEngineRollout: vi.fn().mockReturnValue("control"),
}));

import { MentoriaService } from "@/lib/mentoria/service";

describe("MentoriaService workspace subject isolation", () => {
  it("filters the workspace payload to the requested subject instead of returning tasks from another classroom", async () => {
    const student = {
      id: "student_1",
      tenantId: "tenant_mentoria",
      fullName: "Alex",
      age: 13,
      schoolYear: "2 ESO",
      learningStage: "eso",
      learningGoals: [],
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
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    } as const;

    const historia = {
      id: "subject_historia",
      tenantId: "tenant_mentoria",
      slug: "historia",
      name: "Historia",
      description: "Historia universal",
      difficultyBand: "core",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    } as const;

    const matematicas = {
      id: "subject_matematicas",
      tenantId: "tenant_mentoria",
      slug: "matematicas",
      name: "Matematicas",
      description: "Matematicas",
      difficultyBand: "core",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    } as const;

    const repository = {
      listStudentSubjectMemories: vi.fn().mockResolvedValue([
        {
          id: "memory_historia",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: "subject_historia",
          subjectSlug: "historia",
          conceptKey: "edad_moderna",
          conceptLabel: "Edad Moderna",
          masteryLevel: "developing",
          confidenceLevel: "medium",
          retentionRisk: "medium",
          lastSeenAt: "2026-04-25T10:00:00.000Z",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ]),
      listExercises: vi.fn().mockResolvedValue([
        {
          id: "exercise_historia",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: "subject_historia",
          prompt: "Explica dos causas de la Revolucion francesa.",
          expectedCompetency: "Relacionar causas historicas",
          hints: [],
          answerFormat: "Texto corto",
          difficultyLevel: "medium",
          status: "pending",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ]),
    };

    const service = new MentoriaService(repository as any, {} as any, {} as any, {} as any);
    (service as any).getDashboard = vi.fn().mockResolvedValue({
      student,
      family: null,
      primaryGuardian: null,
      secondaryGuardians: [],
      guardianStudentAccess: [],
      subjects: [historia, matematicas],
      studentSubjects: [
        { subjectId: historia.id, subject: historia },
        { subjectId: matematicas.id, subject: matematicas },
      ],
      progress: [
        {
          id: "progress_historia",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: historia.id,
          currentLevel: 62,
          masteryScore: 62,
          confidenceScore: 58,
          masteryLevel: "developing",
          lastActivityAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
        {
          id: "progress_matematicas",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: matematicas.id,
          currentLevel: 84,
          masteryScore: 84,
          confidenceScore: 80,
          masteryLevel: "solid",
          lastActivityAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ],
      analysis: null,
      motivation: {
        motivationProfile: "steady",
        streak: 3,
      },
      dailyPlan: {
        id: "plan_1",
        studentProfileId: "student_1",
        planDate: "2026-04-25",
        tasks: [
          {
            id: "task_historia",
            subjectId: historia.id,
            subject: historia.name,
            type: "review",
            label: "Repasar Revolucion francesa",
            completed: false,
          },
          {
            id: "task_matematicas",
            subjectId: matematicas.id,
            subject: matematicas.name,
            type: "challenge",
            label: "Resolver fracciones",
            completed: false,
          },
        ],
        completedTaskIds: [],
        completionRate: 0,
        priority: "medium",
        recommendedDuration: 30,
        adaptationReason: "Plan equilibrado",
      },
      recentSessions: [
        {
          id: "session_historia",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: historia.id,
          mentorId: "mentor_1",
          clientId: "student_1",
          topic: "Revolucion francesa",
          status: "completed",
          durationMinutes: 15,
          aiTokensUsed: 120,
          transcript: [],
          recommendedNextStep: "Relaciona causas y consecuencias.",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
        {
          id: "session_matematicas",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: matematicas.id,
          mentorId: "mentor_1",
          clientId: "student_1",
          topic: "Fracciones",
          status: "completed",
          durationMinutes: 20,
          aiTokensUsed: 150,
          transcript: [],
          recommendedNextStep: "Haz una comparacion de fracciones.",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ],
      focusSessions: [
        {
          id: "focus_historia",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: historia.id,
          mode: "focus",
          startedAt: "2026-04-25T10:00:00.000Z",
          completedAt: "2026-04-25T10:20:00.000Z",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:20:00.000Z",
        },
        {
          id: "focus_matematicas",
          tenantId: "tenant_mentoria",
          studentProfileId: "student_1",
          subjectId: matematicas.id,
          mode: "focus",
          startedAt: "2026-04-25T10:00:00.000Z",
          completedAt: "2026-04-25T10:25:00.000Z",
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:25:00.000Z",
        },
      ],
      evolution: {
        identityState: "steady",
        weaknesses: [],
        commonMistakes: [],
        strengths: [],
        frustrationLevel: 0.4,
        progressionVelocity: 0.5,
        consistencyScore: 0.6,
      },
      interventions: [],
      billing: {
        planCode: "family",
        limits: {
          guidedSessionsPerDay: 3,
        },
        usage: {
          guidedSessionsToday: 0,
        },
      },
      growth: {
        referralCode: null,
      },
      insights: [],
    });
    (service as any).buildProgressAnalysis = vi.fn().mockResolvedValue({
      weakSubjects: ["Historia"],
      strongSubjects: [],
      nextActions: ["Repasar la Revolucion francesa."],
    });
    (service as any).ensureLearningMemoryProfile = vi.fn().mockResolvedValue({
      studentProfileId: "student_1",
      profileSummary: "Memoria activa",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    });

    const workspace = await service.getWorkspaceExperience(
      {
        userId: "user_1",
        tenantId: "tenant_mentoria",
        email: "alex@example.com",
        role: "student",
      },
      { studentProfileId: "student_1", subjectSlug: "historia" },
    );

    expect(workspace.dailyPlan.tasks.map((task) => task.subjectId)).toEqual(["subject_historia"]);
    expect(workspace.recentSessions.map((session) => session.subjectId)).toEqual(["subject_historia"]);
    expect(workspace.focusSessions.map((session) => session.subjectId)).toEqual(["subject_historia"]);
    expect(workspace.progress.map((item) => item.subjectId)).toEqual(["subject_historia"]);
    expect(workspace.entry.recommendedSubjectSlug).toBe("historia");
    expect(repository.listStudentSubjectMemories).toHaveBeenCalledWith("tenant_mentoria", "student_1", { subjectSlug: "historia" });
    expect(repository.listExercises).toHaveBeenCalledWith("tenant_mentoria", "student_1", "subject_historia");
  });
});
