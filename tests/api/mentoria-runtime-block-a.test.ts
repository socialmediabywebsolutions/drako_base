import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  createMentoriaServiceInstance: vi.fn(),
  createSessionPersistenceInstance: vi.fn(),
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

vi.mock("@/lib/mentoria/session-persistence", () => ({
  SessionPersistenceManager: class SessionPersistenceManager {
    constructor() {
      return mocks.createSessionPersistenceInstance();
    }
  },
}));

import {
  GET as onboardingGet,
} from "@/app/api/mentoria/onboarding/route";
import {
  GET as sessionRecoverGet,
  POST as sessionRecoverPost,
} from "@/app/api/mentoria/session/recover/route";

describe("mentoria block A runtime fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_mentoria_1",
      email: "family@example.com",
      tenantId: "tenant_mentoria_1",
      role: "user",
    });
  });

  it("fails explicitly on onboarding GET when db/runtime drift happens", async () => {
    mocks.createMentoriaServiceInstance.mockReturnValue({
      getOnboardingState: vi.fn().mockRejectedValue(new Error("no such table: mentoria_session_state")),
    });

    const response = await onboardingGet(
      new Request("https://mentoria.drako.systems/api/mentoria/onboarding"),
    );
    const body = (await response.json()) as { ok?: boolean; error?: string };

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("no such table");
  });

  it("uses student profile id as the single source of truth for active session recovery", async () => {
    const getActiveSession = vi.fn().mockResolvedValue({
      sessionId: "session_1",
      tenantId: "tenant_mentoria_1",
      studentProfileId: "student_mentoria_1",
      subjectId: "subject_1",
      topic: "Fracciones",
      status: "active",
      transcript: [],
      emotionalState: "steady",
      lastActivityAt: new Date().toISOString(),
      aiTokensUsed: 12,
      durationMinutes: 8,
    });

    mocks.createMentoriaServiceInstance.mockReturnValue({
      getProfile: vi.fn().mockResolvedValue({
        id: "student_mentoria_1",
        onboardingCompleted: true,
      }),
    });
    mocks.createSessionPersistenceInstance.mockReturnValue({
      getActiveSession,
    });

    const response = await sessionRecoverGet(
      new Request("https://mentoria.drako.systems/api/mentoria/session/recover"),
    );

    expect(response.status).toBe(200);
    expect(getActiveSession).toHaveBeenCalledWith("tenant_mentoria_1", "student_mentoria_1");
    expect(getActiveSession).not.toHaveBeenCalledWith("tenant_mentoria_1", "user_mentoria_1");
  });

  it("rejects resume when session belongs to a different student profile", async () => {
    const resumeSession = vi.fn();

    mocks.createMentoriaServiceInstance.mockReturnValue({
      getProfile: vi.fn().mockResolvedValue({
        id: "student_mentoria_1",
        onboardingCompleted: true,
      }),
    });
    mocks.createSessionPersistenceInstance.mockReturnValue({
      getSessionSnapshot: vi.fn().mockResolvedValue({
        sessionId: "session_1",
        tenantId: "tenant_mentoria_1",
        studentProfileId: "student_other",
        subjectId: "subject_1",
        topic: "Fracciones",
        status: "active",
        transcript: [],
        emotionalState: "steady",
        lastActivityAt: new Date().toISOString(),
        aiTokensUsed: 12,
        durationMinutes: 8,
      }),
      resumeSession,
    });

    const response = await sessionRecoverPost(
      new Request("https://mentoria.drako.systems/api/mentoria/session/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "session_1" }),
      }),
    );

    expect(response.status).toBe(404);
    expect(resumeSession).not.toHaveBeenCalled();
  });
});
