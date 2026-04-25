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

import { POST } from "@/app/api/mentoria/session/route";

describe("mentoria session route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
  });

  it("requires subjectSlug for every guided session request", async () => {
    const startGuidedSession = vi.fn();
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          message: "Quiero avanzar",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_REQUIRED",
    });
    expect(startGuidedSession).not.toHaveBeenCalled();
  });

  it("fails when the requested subject does not belong to the student", async () => {
    const startGuidedSession = vi.fn().mockRejectedValue(new Error("SUBJECT_ACCESS_DENIED"));
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "ingles",
          topic: "Present simple",
          message: "Quiero avanzar en ingles",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_ACCESS_DENIED",
    });
  });

  it("returns a context mismatch when the requested session belongs to another subject", async () => {
    const startGuidedSession = vi.fn().mockRejectedValue(new Error("SUBJECT_CONTEXT_MISMATCH"));
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "historia",
          sessionId: "session_ingles",
          topic: "Revolucion francesa",
          message: "Retoma la sesion",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_CONTEXT_MISMATCH",
    });
  });
});
