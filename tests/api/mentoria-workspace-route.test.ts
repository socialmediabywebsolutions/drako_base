import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  createMentoriaServiceInstance: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/service", () => ({
  MentoriaService: class MentoriaService {
    constructor() {
      return mocks.createMentoriaServiceInstance();
    }
  },
}));

import { GET } from "@/app/api/mentoria/workspace/route";

describe("mentoria workspace route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the full workspace experience for an authenticated student", async () => {
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
    const getWorkspaceExperience = vi.fn().mockResolvedValue({
        student: { id: "student_1", fullName: "Alex" },
        studentSubjects: [],
        progress: [],
        currentPlan: null,
        dailyPlan: null,
        billing: null,
        focusSessions: [],
        recentSessions: [],
        analysis: { weakSubjects: [], strongSubjects: [], nextActions: [] },
        entry: {
          headline: "Empieza por una duda concreta",
          subheadline: "El tutor te guiara sin darte la respuesta final.",
          recommendedSubjectSlug: "matematicas",
          recommendedTopic: "Fracciones",
          recommendedPrompt: "Quiero repasar fracciones paso a paso.",
          quickActions: [],
        },
        memory: {
          commonMistakes: [],
          watchouts: [],
          strengths: [],
          suggestedDifficulty: "guided",
        },
        guardianHooks: [],
        exercises: [],
        motivation: null,
      });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      getWorkspaceExperience,
    });

    const response = await GET(new Request("https://mentoria.drako.systems/api/mentoria/workspace"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      student: { id: "student_1", fullName: "Alex" },
      entry: { recommendedSubjectSlug: "matematicas" },
      memory: { suggestedDifficulty: "guided" },
    });
    expect(getWorkspaceExperience).toHaveBeenCalledWith({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    }, undefined);
  });

  it("forwards the selected student id when the family opens a linked student workspace", async () => {
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
    const getWorkspaceExperience = vi.fn().mockResolvedValue({
      student: { id: "student_2", fullName: "Vera" },
      studentSubjects: [],
      progress: [],
      currentPlan: null,
      dailyPlan: null,
      billing: null,
      focusSessions: [],
      recentSessions: [],
      analysis: { weakSubjects: [], strongSubjects: [], nextActions: [] },
      entry: {
        headline: "Empieza por una duda concreta",
        subheadline: "El tutor te guiara sin darte la respuesta final.",
        recommendedSubjectSlug: "matematicas",
        recommendedTopic: "Fracciones",
        recommendedPrompt: "Quiero repasar fracciones paso a paso.",
        quickActions: [],
      },
      memory: {
        commonMistakes: [],
        watchouts: [],
        strengths: [],
        suggestedDifficulty: "guided",
      },
      guardianHooks: [],
      exercises: [],
      motivation: null,
    });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      getWorkspaceExperience,
    });

    const response = await GET(new Request("https://mentoria.drako.systems/api/mentoria/workspace?studentId=student_2"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      student: { id: "student_2", fullName: "Vera" },
    });
    expect(getWorkspaceExperience).toHaveBeenCalledWith({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    }, "student_2");
  });

  it("fails closed when there is no authenticated session", async () => {
    mocks.requireCurrentMentoriaSession.mockRejectedValue(new Error("SESSION_REQUIRED"));

    const response = await GET(new Request("https://mentoria.drako.systems/api/mentoria/workspace"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SESSION_REQUIRED",
    });
  });
});
