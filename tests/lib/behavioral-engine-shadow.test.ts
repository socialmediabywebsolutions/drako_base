import { describe, expect, it } from "vitest";

import {
  buildMentoriaBehavioralContext,
  mapMentoriaSignalsToBehaviorSignals,
  mapMentoriaStateToUserState,
  runMentoriaBehavioralShadow,
} from "@/lib/behavioral-engine/adapters/mentoria";

function buildSnapshot(overrides?: Record<string, unknown>) {
  return {
    actor: {
      userId: "user_1",
      tenantId: "tenant_1",
    },
    student: {
      id: "student_1",
      tenantId: "tenant_1",
      userId: "user_1",
      learningStage: "eso",
      fullName: "Alex",
      age: 13,
      schoolYear: "2 ESO",
      learningGoals: ["Entender mejor matematicas"],
      baseEmotionalState: "steady",
      emotionalBaseline: { frustration: "medium", motivation: "medium", concentration: "medium" },
      learningPreference: "step_by_step",
      preferredStudyMinutes: 30,
      strengths: ["Curiosidad"],
      onboardingCompleted: true,
      createdAt: "2026-04-01T08:00:00.000Z",
      updatedAt: "2026-04-04T08:00:00.000Z",
    },
    dailyPlan: {
      id: "plan_1",
      tenantId: "tenant_1",
      studentId: "student_1",
      planDate: "2026-04-04",
      recommendedDuration: 30,
      tasks: [
        {
          id: "task_review",
          subject: "Matematicas",
          subjectId: "subject_math",
          type: "review",
          difficulty: 1,
          completed: false,
        },
        {
          id: "task_challenge",
          subject: "Lengua",
          subjectId: "subject_lang",
          type: "challenge",
          difficulty: 4,
          completed: false,
        },
      ],
      priority: "medium",
      adaptationReason: "Balance",
      generatedAt: "2026-04-04T08:00:00.000Z",
      createdAt: "2026-04-04T08:00:00.000Z",
      updatedAt: "2026-04-04T08:00:00.000Z",
      completedTaskIds: [],
      completionRate: 0,
    },
    motivation: {
      studentId: "student_1",
      streak: 2,
      lastActivityAt: "2026-04-04T08:00:00.000Z",
      effortScore: 0.62,
      rewardPoints: 40,
      level: 1,
      achievements: [],
      motivationProfile: "stable",
    },
    recentSessions: [],
    entry: {
      headline: "Empieza por una duda concreta",
      subheadline: "El tutor te guiara sin darte la respuesta final.",
      recommendedSubjectSlug: "matematicas",
      recommendedTopic: "Fracciones",
      recommendedPrompt: "Quiero repasar fracciones paso a paso.",
      quickActions: [],
    },
    dailyClosure: null,
    evolution: {
      studentId: "student_1",
      strengths: ["Matematicas"],
      weaknesses: ["Problemas largos"],
      frustrationLevel: 0.22,
      consistencyScore: 0.66,
      averageResponseTime: 8,
      lastSessions: 4,
      commonMistakes: [],
      progressionVelocity: 0.58,
      updatedAt: "2026-04-04T08:00:00.000Z",
    },
    nowIso: "2026-04-04T12:00:00.000Z",
    ...overrides,
  };
}

describe("behavioral engine shadow for mentoria", () => {
  it("maps mentoria state and signals into a reusable behavioral context", () => {
    const snapshot = buildSnapshot();

    const userState = mapMentoriaStateToUserState(snapshot);
    const signals = mapMentoriaSignalsToBehaviorSignals(snapshot);
    const context = buildMentoriaBehavioralContext(snapshot);

    expect(userState.lifecycleStage).toBe("new");
    expect(signals.pendingTasksCount).toBe(2);
    expect(signals.entryPromptAvailable).toBe(true);
    expect(context.product).toBe("mentoria");
    expect(context.availableActions.canStartPendingTask).toBe(true);
  });

  it("chooses gentle_restart in shadow mode when the student returns after days away", () => {
    const comparison = runMentoriaBehavioralShadow(
      buildSnapshot({
        motivation: {
          studentId: "student_1",
          streak: 1,
          lastActivityAt: "2026-04-01T08:00:00.000Z",
          effortScore: 0.4,
          rewardPoints: 10,
          level: 1,
          achievements: [],
          motivationProfile: "fragile",
        },
      }),
    );

    expect(comparison.shadowStrategy).toBe("gentle_restart");
    expect(comparison.currentStrategy).toBe("gentle_restart");
    expect(comparison.diverged).toBe(false);
  });

  it("chooses resume_session when there is a recent recommended next step and no soft restart is needed", () => {
    const comparison = runMentoriaBehavioralShadow(
      buildSnapshot({
        recentSessions: [
          {
            id: "session_1",
            tenantId: "tenant_1",
            studentProfileId: "student_1",
            subjectId: "subject_math",
            mentorId: "mentor_1",
            clientId: "user_1",
            topic: "Fracciones",
            status: "completed",
            durationMinutes: 20,
            aiTokensUsed: 200,
            emotionalState: "steady",
            tutorSummary: "Buen cierre",
            recommendedNextStep: "Retoma con fracciones equivalentes.",
            transcript: [],
            createdAt: "2026-04-04T10:00:00.000Z",
            updatedAt: "2026-04-04T10:30:00.000Z",
          },
        ],
      }),
    );

    expect(comparison.shadowStrategy).toBe("resume_session");
    expect(comparison.currentStrategy).toBe("resume_session");
  });

  it("chooses momentum_push when the student returns with momentum and a higher streak", () => {
    const comparison = runMentoriaBehavioralShadow(
      buildSnapshot({
        motivation: {
          studentId: "student_1",
          streak: 5,
          lastActivityAt: "2026-04-04T09:00:00.000Z",
          effortScore: 0.84,
          rewardPoints: 120,
          level: 2,
          achievements: [],
          motivationProfile: "high_performer",
        },
      }),
    );

    expect(comparison.shadowStrategy).toBe("momentum_push");
    expect(comparison.currentStrategy).toBe("momentum_push");
    expect(comparison.shadowAction.task?.type).toBe("challenge");
  });

  it("falls back to plan_task when there is no dominant session but there is pending work", () => {
    const comparison = runMentoriaBehavioralShadow(buildSnapshot());

    expect(comparison.shadowStrategy).toBe("plan_task");
    expect(comparison.currentStrategy).toBe("plan_task");
    expect(comparison.diverged).toBe(false);
  });
});
