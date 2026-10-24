import { describe, expect, it } from "vitest";

import {
  assertSubjectMessageConsistency,
  resolveMentoriaIntentEngine,
} from "@/lib/mentoria/intent-engine";

describe("mentoria intent engine", () => {
  it("classifies exam messages as an exam classroom flow", () => {
    const result = resolveMentoriaIntentEngine({
      message: "Hazme un examen de historia",
      subject: { slug: "historia", name: "Historia" },
    });

    expect(result).toMatchObject({
      intent: "exam",
      classroomMode: "exam",
      boardMode: "exam",
      requiresStudentAnswer: true,
    });
  });

  it("classifies explanation messages as a guided explanation flow", () => {
    const result = resolveMentoriaIntentEngine({
      message: "No entiendo fracciones",
      subject: { slug: "matematicas", name: "Matematicas" },
    });

    expect(result).toMatchObject({
      intent: "explanation",
      classroomMode: "explain",
      boardMode: "explanation",
    });
  });

  it("fails closed when the message mentions another subject than the active classroom", () => {
    expect(() =>
      assertSubjectMessageConsistency({
        message: "Hazme un examen de historia",
        activeSubject: { slug: "matematicas", name: "Matematicas" },
        availableSubjects: [
          { slug: "matematicas", name: "Matematicas" },
          { slug: "historia", name: "Historia" },
        ],
      }),
    ).toThrowError("SUBJECT_CONTEXT_MISMATCH");
  });
});
