import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeAgentMock, resolveLearningLoopDecisionMock } = vi.hoisted(() => ({
  executeAgentMock: vi.fn(),
  resolveLearningLoopDecisionMock: vi.fn(),
}));

vi.mock("@/lib/mentoria/drako-agent-handlers", () => ({
  ensureMentoriaAgentHandlersRegistered: vi.fn(),
}));

vi.mock("@/lib/drako/agent-core", () => ({
  executeAgent: executeAgentMock,
  createAgentResponse: vi.fn(),
  createAgentTask: vi.fn((input) => input),
}));

vi.mock("@/lib/drako/metrics", () => ({
  createMetricEvent: vi.fn((input) => input),
  listEventsForUser: vi.fn().mockResolvedValue([]),
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mentoria/resilience/orchestrator", () => ({
  getMentoriaOrchestrator: vi.fn(() => ({
    collectFeedbackGuaranteed: vi.fn().mockResolvedValue({
      sessionFeedback: {
        liked: [],
        improved: [],
        summary: "Feedback listo.",
      },
      dailyClosure: null,
    }),
  })),
}));

vi.mock("@/lib/mentoria/learning-loop", () => ({
  resolveLearningLoopDecision: resolveLearningLoopDecisionMock,
}));

import { MentoriaService } from "@/lib/mentoria/service";

describe("MentoriaService evolution scope", () => {
  beforeEach(() => {
    executeAgentMock.mockReset();
    resolveLearningLoopDecisionMock.mockReset();
  });

  it("passes subject-scoped evolution into the learning loop and persists the same subject scope", async () => {
    const subject = {
      id: "subject_matematicas",
      tenantId: "tenant_1",
      slug: "matematicas",
      name: "Matematicas",
      description: "Refuerzo guiado",
      difficultyBand: "core",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    };
    const student = {
      id: "student_1",
      tenantId: "tenant_1",
      userId: "user_1",
      fullName: "Alex",
      age: 13,
      schoolYear: "2 ESO",
      learningGoals: [],
      strengths: [],
      learningPreference: "step_by_step",
      preferredStudyMinutes: 20,
      baseEmotionalState: "steady",
      emotionalBaseline: {
        frustration: "medium",
        motivation: "medium",
        concentration: "medium",
      },
      onboardingCompleted: true,
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    };
    const evolution = {
      studentId: "student_1",
      subjectSlug: "matematicas",
      strengths: [],
      weaknesses: ["Fracciones"],
      frustrationLevel: 0.74,
      consistencyScore: 0.42,
      averageResponseTime: 19,
      lastSessions: 5,
      commonMistakes: ["Error recurrente en Fracciones"],
      progressionVelocity: 0.36,
      updatedAt: "2026-04-25T10:00:00.000Z",
    };
    const saveStudentEvolutionProfile = vi.fn(async (_tenantId, profile) => profile);

    const repository = {
      getSubjectBySlug: vi.fn().mockResolvedValue(subject),
      getStudentEvolutionProfile: vi.fn().mockImplementation(async (_tenantId, _studentId, subjectSlug) => ({
        ...evolution,
        subjectSlug,
      })),
      listProgress: vi.fn().mockResolvedValue([
        {
          id: "progress_1",
          tenantId: "tenant_1",
          studentProfileId: "student_1",
          subjectId: subject.id,
          masteryScore: 52,
          confidenceScore: 48,
          streakDays: 0,
          sessionsCompleted: 0,
          exercisesCompleted: 0,
          weakTopics: ["fracciones"],
          strongTopics: [],
          lastActivityAt: null,
          createdAt: "2026-04-25T10:00:00.000Z",
          updatedAt: "2026-04-25T10:00:00.000Z",
        },
      ]),
      listLearningSessions: vi.fn().mockResolvedValue([]),
      listStudentSubjects: vi.fn().mockResolvedValue([{ subjectId: subject.id, subject }]),
      listStudentSubjectMemories: vi.fn().mockResolvedValue([]),
      listSubjects: vi.fn().mockResolvedValue([subject]),
      createLearningSession: vi.fn().mockResolvedValue({
        id: "session_1",
        tenantId: "tenant_1",
        mentorId: "mentor_1",
        clientId: "student_1",
        studentProfileId: "student_1",
        subjectId: subject.id,
        topic: "Fracciones",
        status: "active",
        durationMinutes: 12,
        aiTokensUsed: 120,
        transcript: [],
        emotionalState: "steady",
        tutorSummary: "Resumen",
        recommendedNextStep: "Responde la pregunta guiada.",
        boardUpdate: null,
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
      }),
      upsertProgress: vi.fn().mockResolvedValue(undefined),
      saveStudentEvolutionProfile,
      getStudentLearningMemory: vi.fn().mockResolvedValue(null),
      saveStudentLearningMemory: vi.fn().mockResolvedValue({
        studentId: "student_1",
        preferredExplanationStyle: "short_guided",
        averageResponseSpeed: "medium",
        confidenceTrend: "steady",
        frustrationTrend: "rising",
        consistencyTrend: "steady",
        repetitionRiskSignals: [],
        motivationPattern: "steady",
        bestSessionLength: 12,
        bestSessionTimeWindow: "afternoon",
        strongestSubjects: [],
        weakestSubjects: ["Matematicas"],
        lastAdaptationSummary: { nextStart: "Empieza por la base." },
        adaptationCount: 1,
        updatedAt: "2026-04-25T10:00:00.000Z",
      }),
      getStudentSubjectMemory: vi.fn().mockResolvedValue(null),
      saveStudentSubjectMemory: vi.fn().mockResolvedValue({
        studentId: "student_1",
        tenantId: "tenant_1",
        subjectSlug: "matematicas",
        conceptKey: "fractions_comparison",
        confidenceLevel: "medium",
        masteryLevel: "developing",
        recurrenceCount: 1,
        lastErrorType: "conceptual_confusion",
        preferredSupportStyle: "visual_step_by_step",
        lastWorkedAt: "2026-04-25T10:00:00.000Z",
        needsReinforcement: true,
        evidenceSummary: "Fracciones: persiste error conceptual; conviene visual step by step.",
        internalSummary: {
          conceptWorked: "Comparacion de fracciones",
          errorDetected: "conceptual_confusion",
          interventionThatWorked: "visual step by step",
          revisitSoon: true,
        },
        updatedAt: "2026-04-25T10:00:00.000Z",
      }),
      listInterventions: vi.fn().mockResolvedValue([]),
      saveInterventions: vi.fn().mockResolvedValue([]),
      saveMotivationState: vi.fn().mockResolvedValue({
        studentId: "student_1",
        streak: 1,
        lastActivityAt: "2026-04-25T10:00:00.000Z",
        effortScore: 0.5,
        rewardPoints: 0,
        level: 1,
        achievements: [],
        motivationProfile: "steady",
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
      }),
    };

    const persistence = {
      getSessionSnapshot: vi.fn().mockResolvedValue(null),
      getActiveSession: vi.fn().mockResolvedValue(null),
      saveSessionSnapshot: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
    };

    const trialManager = {
      getTrial: vi.fn().mockResolvedValue({ id: "trial_1" }),
      isTrialActive: vi.fn().mockResolvedValue(true),
      getTrialDaysRemaining: vi.fn().mockResolvedValue(7),
      startTrial: vi.fn().mockResolvedValue(undefined),
    };

    executeAgentMock.mockResolvedValue({
      reply: "Vamos con una explicacion suave.",
      output: {
        tutorSummary: "Resumen",
        recommendedNextStep: "Responde la pregunta guiada.",
        explanation: "Primero compara el denominador.",
        suggestedSteps: ["Mira el denominador"],
        reinforcementQuestion: "Que miras primero en cada fraccion?",
      },
      usage: { tokens: 120 },
      metadata: { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast" },
    });

    resolveLearningLoopDecisionMock.mockReturnValue({
      learningStateUpdated: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        stepIndex: 0,
        difficultyLevel: 1,
        masteryScore: 24,
        frustrationLevel: "high",
        detectedGaps: ["Error recurrente en Fracciones"],
        lastUserAnswer: null,
        lastTutorAction: "introduce_concept",
        mode: "explain",
        strategy: "visual",
        awaitingStudentAnswer: true,
        repeatedBlockCount: 0,
        feedback: "Detecto una dificultad repetida en este tema, asi que empiezo mas guiado de lo normal.",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      nextAction: "Responde a la pregunta guiada para adaptar el siguiente paso.",
      feedback: "Detecto una dificultad repetida en este tema, asi que empiezo mas guiado de lo normal.",
      tutorInstruction: "Explica desde la base.",
      evolutionSignals: ["common_mistake", "high_frustration_history"],
    });

    const service = new MentoriaService(repository as any, {} as any, persistence as any, trialManager as any);
    (service as any).requireOnboardedStudent = vi.fn().mockResolvedValue(student);
    (service as any).getBillingSummary = vi.fn().mockResolvedValue({
      planCode: "pro",
      limits: { guidedSessionsPerDay: 5 },
      usage: { guidedSessionsToday: 0 },
      features: {
        adaptiveInterventions: true,
        adaptiveMotivation: true,
        weeklyReports: true,
        downloadableReports: true,
        whatsappIngestion: true,
        aiPlanner: true,
      },
    });
    (service as any).getCanonicalFamilyContract = vi.fn().mockResolvedValue(null);
    (service as any).ensureMotivationState = vi.fn().mockResolvedValue({
      studentId: "student_1",
      streak: 1,
      lastActivityAt: "2026-04-25T10:00:00.000Z",
      effortScore: 0.5,
      rewardPoints: 0,
      level: 1,
      achievements: [],
      motivationProfile: "steady",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    });
    (service as any).ensureLearningMemoryProfile = vi.fn().mockResolvedValue({
      studentId: "student_1",
      tenantId: "tenant_1",
      preferredExplanationStyle: "short_guided",
      averageResponseSpeed: "medium",
      confidenceTrend: "steady",
      frustrationTrend: "rising",
      consistencyTrend: "steady",
      repetitionRiskSignals: [],
      motivationPattern: "steady",
      bestSessionLength: 12,
      bestSessionTimeWindow: "afternoon",
      strongestSubjects: [],
      weakestSubjects: ["Matematicas"],
      lastAdaptationSummary: { nextStart: "Empieza por la base." },
      styleEvidence: { short_guided: 1 },
      timeWindowEvidence: { afternoon: 1 },
      adaptationCount: 1,
      updatedAt: "2026-04-25T10:00:00.000Z",
    });
    (service as any).ensureDailyPlan = vi.fn().mockResolvedValue({
      id: "plan_1",
      tenantId: "tenant_1",
      studentId: "student_1",
      planDate: "2026-04-25",
      recommendedDuration: 20,
      tasks: [],
      priority: "medium",
      adaptationReason: "Plan",
      generatedAt: "2026-04-25T10:00:00.000Z",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
      completedTaskIds: [],
      completionRate: 0,
    });
    (service as any).syncUserContext = vi.fn().mockResolvedValue({ userId: "user_1" });
    (service as any).buildUserInsights = vi.fn().mockResolvedValue([]);
    (service as any).trackDailyClosureSnapshot = vi.fn().mockResolvedValue(null);
    (service as any).completeDailyPlan = vi.fn().mockResolvedValue(undefined);

    await service.startGuidedSession(
      { userId: "user_1", email: "family@example.com", tenantId: "tenant_1", role: "user" } as any,
      {
        studentProfileId: "student_1",
        subjectSlug: "matematicas",
        message: "No entiendo fracciones",
      },
    );

    expect(resolveLearningLoopDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectSlug: "matematicas",
        studentEvolution: expect.objectContaining({
          subjectSlug: "matematicas",
          commonMistakes: ["Error recurrente en Fracciones"],
        }),
      }),
    );
    expect(saveStudentEvolutionProfile).toHaveBeenCalledWith(
      "tenant_1",
      expect.objectContaining({
        subjectSlug: "matematicas",
      }),
    );
  });
});
