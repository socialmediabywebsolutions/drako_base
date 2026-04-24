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

import { POST } from "@/app/api/mentoria/chat/route";

describe("mentoria chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
  });

  it("requires student, subject and message for the real chat endpoint", async () => {
    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No entiendo fracciones", studentId: "student_1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_REQUIRED",
    });
  });

  it("starts a guided chat session with explicit student and subject isolation", async () => {
    const startGuidedSession = vi.fn().mockResolvedValue({
      session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Haz una suma corta." },
      subject: { id: "subject_1", slug: "matematicas", name: "Matematicas" },
      adaptation: { emotionalState: "steady" },
      reply: "Vale, vamos paso a paso.",
      explanation: "Primero compara denominadores.",
      suggestedSteps: ["Mira los denominadores", "Busca un comun denominador"],
      reinforcementQuestion: "¿Que ves primero en cada fraccion?",
      sessionMode: "subject_reinforcement",
      sessionInputKind: "selected_subject",
      insights: [],
    });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "matematicas",
          message: "No entiendo fracciones",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      reply: "Vale, vamos paso a paso.",
      subject: { slug: "matematicas", name: "Matematicas" },
    });
    expect(startGuidedSession).toHaveBeenCalledWith(
      {
        userId: "user_1",
        email: "family@example.com",
        tenantId: "tenant_1",
        role: "user",
      },
      {
        studentProfileId: "student_1",
        subjectSlug: "matematicas",
        topic: undefined,
        message: "No entiendo fracciones",
      },
    );
  });
});
