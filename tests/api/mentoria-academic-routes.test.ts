import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  createMentoriaAcademicServiceInstance: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/academic-service", () => ({
  MentoriaAcademicService: class MentoriaAcademicService {
    constructor() {
      return mocks.createMentoriaAcademicServiceInstance();
    }
  },
}));

import { GET as getRecordsRoute, POST as postRecordsRoute } from "@/app/api/mentoria/academic/records/route";
import { GET as getRecordDetailRoute } from "@/app/api/mentoria/academic/records/[id]/route";
import { POST as uploadRoute } from "@/app/api/mentoria/academic/upload/route";
import { POST as analyzeRoute } from "@/app/api/mentoria/academic/analyze/route";
import { GET as getProgressRoute } from "@/app/api/mentoria/academic/progress/route";

function buildSession() {
  return {
    userId: "user_1",
    email: "family@example.com",
    tenantId: "tenant_1",
    role: "user",
    actorType: "guardian",
    familyId: "tenant_1",
    guardianId: "guardian_1",
    studentProfileId: "student_1",
    systemRole: "primary_guardian",
  } as const;
}

describe("mentoria academic routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue(buildSession());
  });

  it("lists academic records and documents with student and subject scoping", async () => {
    const listRecords = vi.fn().mockResolvedValue({
      student: { id: "student_1", fullName: "Alex" },
      records: [{ id: "record_1" }],
      documents: [{ id: "document_1" }],
    });
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ listRecords });

    const response = await getRecordsRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/records?studentId=student_1&subjectSlug=matematicas&recordType=exam"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      student: { id: "student_1", fullName: "Alex" },
      records: [{ id: "record_1" }],
      documents: [{ id: "document_1" }],
    });
    expect(listRecords).toHaveBeenCalledWith(buildSession(), {
      studentId: "student_1",
      subjectSlug: "matematicas",
      recordType: "exam",
      status: undefined,
    });
  });

  it("creates a manual academic record", async () => {
    const createManualRecord = vi.fn().mockResolvedValue({
      student: { id: "student_1", fullName: "Alex" },
      record: { id: "record_manual_1", recordType: "exam" },
    });
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ createManualRecord });

    const response = await postRecordsRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "matematicas",
          recordType: "exam",
          title: "Examen de mates",
          scoreValue: 8,
          scoreScale: 10,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      record: { id: "record_manual_1", recordType: "exam" },
    });
    expect(createManualRecord).toHaveBeenCalledWith(
      buildSession(),
      expect.objectContaining({
        studentId: "student_1",
        subjectSlug: "matematicas",
        recordType: "exam",
        title: "Examen de mates",
      }),
    );
  });

  it("returns 404 when the requested academic record detail does not exist", async () => {
    const getRecordDetail = vi.fn().mockResolvedValue({ studentId: "", detail: null });
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ getRecordDetail });

    const response = await getRecordDetailRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/records/record_missing"),
      { params: Promise.resolve({ id: "record_missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "MENTORIA_ACADEMIC_RECORD_NOT_FOUND",
    });
  });

  it("creates an academic document from upload", async () => {
    const createDocument = vi.fn().mockResolvedValue({
      student: { id: "student_1", fullName: "Alex" },
      document: { id: "document_1", analysisStatus: "pending" },
      replayed: false,
    });
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ createDocument });

    const formData = new FormData();
    formData.set("studentId", "student_1");
    formData.set("subjectSlug", "matematicas");
    formData.set("recordType", "exam");
    formData.set("file", new File(["fake-pdf"], "examen.pdf", { type: "application/pdf" }));

    const response = await uploadRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/upload", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      document: { id: "document_1", analysisStatus: "pending" },
      replayed: false,
    });
    expect(createDocument).toHaveBeenCalledWith(
      buildSession(),
      expect.objectContaining({
        studentId: "student_1",
        subjectSlug: "matematicas",
        classification: "exam",
        documentKind: "pdf",
        sourceChannel: "web_upload",
      }),
    );
  });

  it("maps low-information analyze requests to a 400 source-required error", async () => {
    const analyze = vi.fn().mockRejectedValue(new Error("MENTORIA_ACADEMIC_SOURCE_REQUIRED"));
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ analyze });

    const response = await analyzeRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: "student_1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "MENTORIA_ACADEMIC_SOURCE_REQUIRED",
    });
  });

  it("returns the separated academic progress view", async () => {
    const getProgress = vi.fn().mockResolvedValue({
      studentId: "student_1",
      subjects: [
        {
          subjectSlug: "matematicas",
          subjectName: "Matematicas",
          schoolAverageScore: 72,
          mentoriaMasteryScore: 64,
          mentoriaConfidenceScore: 60,
          trendDirection: "up",
          weakPoints: ["fracciones"],
          strongPoints: ["constancia"],
          notesCount: 3,
        },
      ],
      summary: {
        schoolAverageScore: 72,
        mentoriaMasteryAverage: 64,
        mentoriaConfidenceAverage: 60,
        strongestSubjects: ["Matematicas"],
        weakestSubjects: [],
      },
    });
    mocks.createMentoriaAcademicServiceInstance.mockReturnValue({ getProgress });

    const response = await getProgressRoute(
      new Request("https://mentoria.drako.systems/api/mentoria/academic/progress?studentId=student_1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      progress: {
        studentId: "student_1",
        subjects: [{ subjectSlug: "matematicas", trendDirection: "up" }],
      },
    });
    expect(getProgress).toHaveBeenCalledWith(buildSession(), "student_1");
  });
});
