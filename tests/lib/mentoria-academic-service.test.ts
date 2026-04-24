import { beforeEach, describe, expect, it, vi } from "vitest";

import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";
import type {
  MentoriaAcademicDocument,
  MentoriaAcademicProgressView,
  MentoriaAcademicRecord,
  MentoriaAcademicRecordDetail,
} from "@/lib/mentoria/academic-types";
import type { MentoriaRequestSession } from "@/lib/mentoria/auth/request";
import type {
  MentoriaGuardianAccessibleStudent,
  MentoriaMaterialIntake,
  MentoriaProgress,
  StudentProfile,
} from "@/lib/mentoria/types";

function buildStudent(overrides?: Partial<StudentProfile>): StudentProfile {
  return {
    id: "student_1",
    tenantId: "tenant_mentoria",
    userId: "student_user_1",
    learningStage: "eso",
    fullName: "Alex",
    age: 13,
    schoolYear: "2 ESO",
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
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildAccess(overrides?: Partial<MentoriaGuardianAccessibleStudent>): MentoriaGuardianAccessibleStudent {
  return {
    id: "access_1",
    familyId: "tenant_mentoria",
    guardianId: "guardian_1",
    studentId: "student_1",
    studentProfileId: "student_1",
    canViewFullProgress: true,
    canManageSchedule: true,
    dailyStudyMinutes: 30,
    supervisionLevel: "balanced",
    notificationPreferences: ["progress"],
    isPrimaryContact: true,
    studentName: "Alex",
    source: "canonical",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildProgress(overrides?: Partial<MentoriaProgress>): MentoriaProgress {
  return {
    id: "progress_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: "subject_matematicas",
    subject: {
      id: "subject_matematicas",
      tenantId: "tenant_mentoria",
      slug: "matematicas",
      name: "Matematicas",
      description: "Refuerzo",
      difficultyBand: "core",
      createdAt: "2026-04-24T10:00:00.000Z",
      updatedAt: "2026-04-24T10:00:00.000Z",
    },
    masteryScore: 62,
    confidenceScore: 58,
    streakDays: 2,
    sessionsCompleted: 4,
    exercisesCompleted: 8,
    strongTopics: [],
    weakTopics: ["fracciones"],
    lastActivityAt: "2026-04-24T10:00:00.000Z",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildRecord(overrides?: Partial<MentoriaAcademicRecord>): MentoriaAcademicRecord {
  return {
    id: "record_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectSlug: "matematicas",
    recordType: "exam",
    sourceChannel: "manual_web",
    sourceRefId: "manual:record_1",
    title: "Examen de fracciones",
    scoreValue: 7,
    scoreScale: 10,
    scoreLabel: "7/10",
    recordedAt: "2026-04-24T10:00:00.000Z",
    teacherComment: "Buen esfuerzo",
    status: "confirmed",
    createdByActorType: "student",
    createdByActorId: "student_user_1",
    metadata: {},
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildDocument(overrides?: Partial<MentoriaAcademicDocument>): MentoriaAcademicDocument {
  return {
    id: "document_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    academicRecordId: null,
    materialIntakeId: null,
    subjectSlug: "matematicas",
    documentKind: "image",
    classification: "homework",
    sourceChannel: "whatsapp",
    sourceMessageId: "wamid_1",
    storageKey: "media_1",
    mimeType: "image/jpeg",
    fileName: "tarea.jpg",
    sha256: null,
    capturedAt: "2026-04-24T10:00:00.000Z",
    notesText: "foto de tarea",
    analysisStatus: "pending",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildProgressView(overrides?: Partial<MentoriaAcademicProgressView>): MentoriaAcademicProgressView {
  return {
    studentId: "student_1",
    subjects: [
      {
        subjectSlug: "matematicas",
        subjectName: "Matematicas",
        schoolAverageScore: 70,
        mentoriaMasteryScore: 62,
        mentoriaConfidenceScore: 58,
        trendDirection: "steady",
        weakPoints: ["fracciones"],
        strongPoints: ["constancia"],
        notesCount: 2,
      },
    ],
    summary: {
      schoolAverageScore: 70,
      mentoriaMasteryAverage: 62,
      mentoriaConfidenceAverage: 58,
      strongestSubjects: ["Matematicas"],
      weakestSubjects: [],
    },
    ...overrides,
  };
}

function buildMaterialIntake(overrides?: Partial<MentoriaMaterialIntake>): MentoriaMaterialIntake {
  return {
    id: "intake_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    channel: "whatsapp",
    sourceMessageId: "wamid_1",
    phoneNumber: "+34600000000",
    mediaType: "image",
    intakeKind: "homework_photo",
    providerMediaId: "media_1",
    mimeType: "image/jpeg",
    fileName: "tarea.jpg",
    caption: "foto de tarea",
    originalText: "foto de tarea",
    status: "received",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
    ...overrides,
  };
}

function buildGuardianActor(): MentoriaRequestSession {
  return {
    userId: "guardian_user_1",
    email: "family@example.com",
    tenantId: "tenant_mentoria",
    role: "user",
    actorType: "guardian",
    familyId: "tenant_mentoria",
    guardianId: "guardian_1",
    studentProfileId: "student_1",
    systemRole: "primary_guardian",
  };
}

function buildStudentActor(): MentoriaRequestSession {
  return {
    userId: "student_user_1",
    email: "alex@example.com",
    tenantId: "tenant_mentoria",
    role: "user",
    actorType: "student",
    familyId: "tenant_mentoria",
    guardianId: null,
    studentProfileId: "student_1",
    systemRole: "student",
  };
}

describe("MentoriaAcademicService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a canonical manual academic record", async () => {
    const student = buildStudent();
    const progress = [buildProgress()];
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(student),
      listProgress: vi.fn().mockResolvedValue(progress),
    };
    const academicRepository = {
      createManualRecord: vi.fn().mockResolvedValue(buildRecord()),
      rebuildSnapshotsFromRecords: vi.fn().mockResolvedValue(buildProgressView()),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    const result = await service.createManualRecord(buildStudentActor(), {
      studentId: "student_1",
      subjectSlug: "matematicas",
      recordType: "exam",
      title: "Examen parcial",
      scoreValue: 8,
      scoreScale: 10,
      teacherComment: "Buena base",
    });

    expect(academicRepository.createManualRecord).toHaveBeenCalledWith(
      "tenant_mentoria",
      expect.objectContaining({
        studentProfileId: "student_1",
        createdByActorType: "student",
        createdByActorId: "student_user_1",
        title: "Examen parcial",
      }),
    );
    expect(academicRepository.rebuildSnapshotsFromRecords).toHaveBeenCalledWith({
      tenantId: "tenant_mentoria",
      studentProfileId: "student_1",
      progress,
    });
    expect(result.record.id).toBe("record_1");
  });

  it("creates an academic document scoped to the requested guardian student", async () => {
    const student = buildStudent();
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(null),
      listGuardianAccessibleStudents: vi.fn().mockResolvedValue([buildAccess()]),
      getStudentProfileById: vi.fn().mockResolvedValue(student),
    };
    const academicRepository = {
      createDocument: vi.fn().mockResolvedValue({ document: buildDocument(), replayed: false }),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    const result = await service.createDocument(buildGuardianActor(), {
      studentId: "student_1",
      subjectSlug: "matematicas",
      documentKind: "pdf",
      classification: "project",
      sourceChannel: "web_upload",
      storageKey: "project.pdf:sha",
      mimeType: "application/pdf",
      fileName: "project.pdf",
    });

    expect(academicRepository.createDocument).toHaveBeenCalledWith(
      "tenant_mentoria",
      expect.objectContaining({
        studentProfileId: "student_1",
        sourceChannel: "web_upload",
        fileName: "project.pdf",
      }),
    );
    expect(result.document.id).toBe("document_1");
  });

  it("creates an academic document and provisional record from WhatsApp material intake", async () => {
    const student = buildStudent();
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(student),
    };
    const academicRepository = {
      createDocument: vi.fn().mockResolvedValue({
        document: buildDocument({ id: "document_whatsapp_1", classification: "homework" }),
        replayed: false,
      }),
      createProvisionalRecordFromDocument: vi.fn().mockResolvedValue({
        record: buildRecord({
          id: "record_whatsapp_1",
          recordType: "homework",
          sourceChannel: "whatsapp",
          sourceRefId: "material_intake:intake_1",
          status: "provisional",
          createdByActorType: "system",
          createdByActorId: null,
        }),
        replayed: false,
      }),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    const result = await service.ingestWhatsappMaterial({
      actor: buildStudentActor(),
      intake: buildMaterialIntake(),
      sourceMessageId: "wamid_1",
      notesText: "foto de tarea de mates",
    });

    expect(academicRepository.createDocument).toHaveBeenCalledWith(
      "tenant_mentoria",
      expect.objectContaining({
        materialIntakeId: "intake_1",
        sourceMessageId: "wamid_1",
        sourceChannel: "whatsapp",
      }),
    );
    expect(academicRepository.createProvisionalRecordFromDocument).toHaveBeenCalledWith(
      "tenant_mentoria",
      expect.objectContaining({
        documentId: "document_whatsapp_1",
        sourceRefId: "material_intake:intake_1",
        recordType: "homework",
      }),
    );
    expect(result.record?.recordType).toBe("homework");
  });

  it("blocks sibling crossing when a guardian requests a student outside canonical access", async () => {
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(null),
      listGuardianAccessibleStudents: vi.fn().mockResolvedValue([buildAccess()]),
    };
    const academicRepository = {
      listRecords: vi.fn(),
      listDocuments: vi.fn(),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    await expect(
      service.listRecords(buildGuardianActor(), { studentId: "student_2" }),
    ).rejects.toThrow("STUDENT_ACCESS_DENIED");

    expect(academicRepository.listRecords).not.toHaveBeenCalled();
    expect(academicRepository.listDocuments).not.toHaveBeenCalled();
  });

  it("keeps record detail isolated by tenant and by direct student identity", async () => {
    const student = buildStudent();
    const otherStudentDetail: MentoriaAcademicRecordDetail = {
      record: buildRecord({ studentProfileId: "student_2" }),
      document: null,
      extraction: null,
      analysis: null,
    };
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(student),
    };
    const academicRepository = {
      getRecordDetail: vi.fn().mockResolvedValue(otherStudentDetail),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    await expect(service.getRecordDetail(buildStudentActor(), "record_foreign")).rejects.toThrow("STUDENT_ACCESS_DENIED");
    expect(academicRepository.getRecordDetail).toHaveBeenCalledWith("tenant_mentoria", "record_foreign");
  });

  it("keeps subject filters isolated when listing records and documents", async () => {
    const student = buildStudent();
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(student),
    };
    const academicRepository = {
      listRecords: vi.fn().mockResolvedValue([buildRecord({ subjectSlug: "matematicas" })]),
      listDocuments: vi.fn().mockResolvedValue([buildDocument({ subjectSlug: "matematicas" })]),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    await service.listRecords(buildStudentActor(), {
      studentId: "student_1",
      subjectSlug: "matematicas",
      recordType: "exam",
    });

    expect(academicRepository.listRecords).toHaveBeenCalledWith("tenant_mentoria", "student_1", {
      subjectSlug: "matematicas",
      recordType: "exam",
      status: null,
    });
    expect(academicRepository.listDocuments).toHaveBeenCalledWith("tenant_mentoria", "student_1", {
      subjectSlug: "matematicas",
      recordType: "exam",
    });
  });

  it("builds progress from academic snapshots without pulling raw classroom payloads", async () => {
    const student = buildStudent();
    const progress = [buildProgress()];
    const progressView = buildProgressView();
    const repository = {
      getStudentProfileByUser: vi.fn().mockResolvedValue(student),
      listProgress: vi.fn().mockResolvedValue(progress),
    };
    const academicRepository = {
      rebuildSnapshotsFromRecords: vi.fn().mockResolvedValue(progressView),
    };
    const service = new MentoriaAcademicService({ repository: repository as any, academicRepository: academicRepository as any });

    const result = await service.getProgress(buildStudentActor(), "student_1");

    expect(repository.listProgress).toHaveBeenCalledWith("tenant_mentoria", "student_1");
    expect(academicRepository.rebuildSnapshotsFromRecords).toHaveBeenCalledWith({
      tenantId: "tenant_mentoria",
      studentProfileId: "student_1",
      progress,
    });
    expect(result.summary.schoolAverageScore).toBe(70);
  });
});
