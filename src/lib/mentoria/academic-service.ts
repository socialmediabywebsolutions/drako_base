import { env } from "@/lib/cf";
import type {
  CreateMentoriaAcademicDocumentRequestInput,
  CreateMentoriaAcademicManualRecordInput,
  CreateMentoriaAcademicManualRecordRequestInput,
  MentoriaAcademicAnalyzeRequestInput,
  MentoriaAcademicProgressView,
  MentoriaAcademicRecordDetail,
  MentoriaAcademicRecordFilters,
} from "@/lib/mentoria/academic-types";
import { MentoriaAcademicRepository } from "@/lib/mentoria/academic-repository";
import type { MentoriaRequestSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { MentoriaRepository } from "@/lib/mentoria/repository";
import type { MentoriaMaterialIntake } from "@/lib/mentoria/types";

type MentoriaAcademicServiceDependencies = {
  repository?: MentoriaRepository;
  academicRepository?: MentoriaAcademicRepository;
};

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function inferRecordType(text: string): CreateMentoriaAcademicManualRecordInput["recordType"] | "custom" {
  const normalized = normalizeText(text);
  if (normalized.includes("examen")) return "exam";
  if (normalized.includes("tarea") || normalized.includes("deber")) return "homework";
  if (normalized.includes("trabajo") || normalized.includes("proyecto")) return "project";
  if (normalized.includes("cuaderno") || normalized.includes("apunte")) return "notebook";
  if (normalized.includes("actitud") || normalized.includes("comportamiento")) return "behavior";
  if (normalized.includes("higiene") || normalized.includes("presentacion")) return "presentation";
  return "custom";
}

function inferSubjectSlug(text: string): string | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (normalized.includes("mates") || normalized.includes("matemat")) return "matematicas";
  if (normalized.includes("lengua") || normalized.includes("sintaxis") || normalized.includes("gramatica")) return "lengua";
  if (normalized.includes("ciencias") || normalized.includes("biologia") || normalized.includes("fisica") || normalized.includes("quimica")) return "ciencias";
  if (normalized.includes("historia") || normalized.includes("sociales")) return "historia";
  if (normalized.includes("ingles") || normalized.includes("english")) return "ingles";
  return null;
}

function inferScore(text: string): { value: number | null; scale: number | null; label: string | null; confidence: number } {
  const normalized = normalizeText(text);
  const overTen = normalized.match(/(\d{1,2}(?:[\.,]\d)?)\s*\/\s*10/);
  if (overTen) {
    const raw = Number(overTen[1].replace(",", "."));
    return { value: Number.isFinite(raw) ? raw : null, scale: 10, label: overTen[0], confidence: 0.88 };
  }
  const overHundred = normalized.match(/(\d{1,3})\s*%/);
  if (overHundred) {
    const raw = Number(overHundred[1]);
    return { value: Number.isFinite(raw) ? raw : null, scale: 100, label: overHundred[0], confidence: 0.84 };
  }
  const bare = normalized.match(/nota\s*(?:es|:)?\s*(\d{1,2}(?:[\.,]\d)?)/);
  if (bare) {
    const raw = Number(bare[1].replace(",", "."));
    return { value: Number.isFinite(raw) ? raw : null, scale: 10, label: bare[0], confidence: 0.72 };
  }
  return { value: null, scale: null, label: null, confidence: 0.35 };
}

function inferTeacherComment(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;
  const parts = normalized.split(/[\n\.]/).map((item) => item.trim()).filter(Boolean);
  const hint = parts.find((item) => /profe|profesor|profesora|observacion|comentario/.test(normalizeText(item))) ?? null;
  return hint;
}

function buildAcademicInsights(input: { recordType: string; subjectSlug: string | null; rawText: string; scoreValue: number | null; confidence: number }) {
  const normalized = normalizeText(input.rawText);
  const weakPoints: string[] = [];
  const strongPoints: string[] = [];
  const mistakes: string[] = [];
  const recommendations: string[] = [];

  if (normalized.includes("error") || normalized.includes("fallo")) mistakes.push("Se detectan referencias explícitas a errores en el material.");
  if (normalized.includes("calculo") || normalized.includes("cuenta")) weakPoints.push("Posible fricción en cálculo o procedimiento.");
  if (normalized.includes("comprension") || normalized.includes("enunciado")) weakPoints.push("Posible dificultad de comprensión del enunciado.");
  if (normalized.includes("bien") || normalized.includes("correcto")) strongPoints.push("Hay evidencia de ejecución correcta en parte del material.");
  if (input.scoreValue !== null && input.scoreValue >= 7) strongPoints.push("Rendimiento escolar sólido en este registro.");
  if (input.scoreValue !== null && input.scoreValue < 6) weakPoints.push("Resultado escolar por debajo del umbral objetivo.");
  if (input.recordType === "exam") recommendations.push("Conviene convertir este examen en una sesión futura de refuerzo guiado.");
  if (input.recordType === "homework") recommendations.push("Conviene practicar un ejercicio similar antes de la próxima tarea.");
  if (input.confidence < 0.6) recommendations.push("Revisar manualmente el análisis antes de consolidarlo.");
  if (weakPoints.length === 0) weakPoints.push("Sin puntos débiles claros todavía. Hace falta más evidencia.");
  if (strongPoints.length === 0) strongPoints.push("Sin fortalezas claras todavía. Hace falta más evidencia.");
  if (mistakes.length === 0) mistakes.push("No hay detalle suficiente para clasificar errores concretos con alta confianza.");
  if (recommendations.length === 0) recommendations.push("Mantener seguimiento y añadir una nueva evidencia académica en esta materia.");

  return {
    weakPoints,
    strongPoints,
    mistakes,
    recommendations,
    boardSignal: {
      subjectSlug: input.subjectSlug,
      topic: input.recordType === "exam" ? "Refuerzo post examen" : input.recordType === "homework" ? "Corrección de tarea" : "Seguimiento académico",
      summary: recommendations[0] ?? "Revisar evidencia académica reciente.",
    },
  };
}

function resolveDocumentAnalysisStatus(confidence: number) {
  return confidence >= 0.6 ? "analyzed" : "needs_review";
}

export class MentoriaAcademicService {
  private repository: MentoriaRepository;
  private academicRepository: MentoriaAcademicRepository;

  constructor(dependencies: MentoriaAcademicServiceDependencies = {}) {
    if (dependencies.repository && dependencies.academicRepository) {
      this.repository = dependencies.repository;
      this.academicRepository = dependencies.academicRepository;
      return;
    }
    const db = getMentoriaDb(env?.());
    this.repository = dependencies.repository ?? new MentoriaRepository(db);
    this.academicRepository = dependencies.academicRepository ?? new MentoriaAcademicRepository(db);
  }

  private async resolveStudentForActor(actor: MentoriaRequestSession, requestedStudentProfileId?: string | null) {
    const requested = requestedStudentProfileId?.trim() || "";
    const directStudent = await this.repository.getStudentProfileByUser(actor.tenantId, actor.userId).catch(() => null);
    if (directStudent) {
      if (requested && directStudent.id !== requested) throw new Error("STUDENT_ACCESS_DENIED");
      return directStudent;
    }

    const accessibleStudents = await this.repository.listGuardianAccessibleStudents(actor.tenantId, actor.userId).catch(() => []);
    if (accessibleStudents.length === 0) throw new Error("ONBOARDING_REQUIRED");

    if (requested) {
      const explicit = accessibleStudents.find((item) => item.studentProfileId === requested || item.studentId === requested) ?? null;
      if (!explicit) throw new Error("STUDENT_ACCESS_DENIED");
      const student = await this.repository.getStudentProfileById(actor.tenantId, explicit.studentProfileId);
      if (!student) throw new Error("STUDENT_ACCESS_DENIED");
      return student;
    }

    const first = accessibleStudents[0];
    const student = await this.repository.getStudentProfileById(actor.tenantId, first.studentProfileId);
    if (!student) throw new Error("STUDENT_ACCESS_DENIED");
    return student;
  }

  async listRecords(actor: MentoriaRequestSession, input?: { studentId?: string | null; subjectSlug?: string | null; recordType?: string | null; status?: string | null }) {
    const student = await this.resolveStudentForActor(actor, input?.studentId);
    const records = await this.academicRepository.listRecords(actor.tenantId, student.id, {
      subjectSlug: input?.subjectSlug ?? null,
      recordType: (input?.recordType as MentoriaAcademicRecordFilters["recordType"]) ?? null,
      status: (input?.status as MentoriaAcademicRecordFilters["status"]) ?? null,
    });
    const documents = await this.academicRepository.listDocuments(actor.tenantId, student.id, {
      subjectSlug: input?.subjectSlug ?? null,
      recordType: input?.recordType ?? null,
    });
    return { student, records, documents };
  }

  async getRecordDetail(actor: MentoriaRequestSession, recordId: string): Promise<{ studentId: string; detail: MentoriaAcademicRecordDetail | null }> {
    const detail = await this.academicRepository.getRecordDetail(actor.tenantId, recordId);
    if (!detail) return { studentId: "", detail: null };
    const student = await this.resolveStudentForActor(actor, detail.record.studentProfileId);
    if (student.id !== detail.record.studentProfileId) throw new Error("STUDENT_ACCESS_DENIED");
    return { studentId: student.id, detail };
  }

  async createManualRecord(actor: MentoriaRequestSession, input: CreateMentoriaAcademicManualRecordRequestInput) {
    const student = await this.resolveStudentForActor(actor, input.studentId ?? input.studentProfileId);
    const record = await this.academicRepository.createManualRecord(actor.tenantId, {
      ...input,
      studentProfileId: student.id,
      createdByActorType: actor.actorType === "guardian" ? "guardian" : actor.actorType === "student" ? "student" : "system",
      createdByActorId: actor.userId,
    });
    const progress = await this.repository.listProgress(actor.tenantId, student.id);
    await this.academicRepository.rebuildSnapshotsFromRecords({ tenantId: actor.tenantId, studentProfileId: student.id, progress });
    return { student, record };
  }

  async createDocument(actor: MentoriaRequestSession, input: CreateMentoriaAcademicDocumentRequestInput) {
    const student = await this.resolveStudentForActor(actor, input.studentId ?? input.studentProfileId);
    const created = await this.academicRepository.createDocument(actor.tenantId, {
      ...input,
      studentProfileId: student.id,
    });
    return { student, ...created };
  }

  async analyze(actor: MentoriaRequestSession, input: MentoriaAcademicAnalyzeRequestInput) {
    const student = await this.resolveStudentForActor(actor, input.studentId ?? input.studentProfileId);
    let document = input.documentId ? await this.academicRepository.getDocumentById(actor.tenantId, input.documentId) : null;
    if (document && document.studentProfileId !== student.id) throw new Error("STUDENT_ACCESS_DENIED");
    const detail = input.recordId ? await this.academicRepository.getRecordDetail(actor.tenantId, input.recordId) : null;
    if (detail?.record.studentProfileId && detail.record.studentProfileId !== student.id) throw new Error("STUDENT_ACCESS_DENIED");
    if (!document && detail?.document) document = detail.document;
    if (!document && !detail?.record) throw new Error("MENTORIA_ACADEMIC_SOURCE_REQUIRED");

    const rawText = input.rawText ?? document?.notesText ?? detail?.record.teacherComment ?? detail?.record.title ?? "";
    const subjectSlug = document?.subjectSlug ?? detail?.record.subjectSlug ?? inferSubjectSlug(rawText);
    const recordType = detail?.record.recordType ?? inferRecordType(`${document?.classification ?? ""} ${rawText}`);
    const score = inferScore(rawText);
    const teacherComment = inferTeacherComment(rawText) ?? detail?.record.teacherComment ?? null;
    const confidence = Math.max(0.32, Math.min(0.94, score.confidence + (subjectSlug ? 0.08 : 0) + (recordType !== "custom" ? 0.06 : 0)));
    let extraction = null;
    if (document?.id) {
      extraction = await this.academicRepository.createOrUpdateExtraction(actor.tenantId, {
        studentProfileId: student.id,
        documentId: document.id,
        academicRecordId: detail?.record.id ?? document.academicRecordId ?? null,
        subjectSlug,
        extractedRecordType: recordType,
        extractedScoreValue: score.value,
        extractedScoreScale: score.scale,
        extractedScoreLabel: score.label,
        extractedTeacherComment: teacherComment,
        extractedExamDate: null,
        confidenceScore: confidence,
        status: confidence >= 0.6 ? "extracted" : "needs_review",
        raw: {
          rawText,
          inferredSubjectSlug: subjectSlug,
          inferredRecordType: recordType,
          score,
        },
      });
    }

    let record = detail?.record ?? null;
    if (!record && document) {
      const provisional = await this.academicRepository.createProvisionalRecordFromDocument(actor.tenantId, {
        studentProfileId: student.id,
        documentId: document.id,
        subjectSlug,
        recordType,
        title: document.fileName ?? document.notesText ?? `Registro académico ${recordType}`,
        sourceChannel: document.sourceChannel,
        sourceRefId: `document:${document.id}`,
        scoreValue: score.value,
        scoreScale: score.scale,
        scoreLabel: score.label,
        teacherComment,
        metadata: { documentId: document.id, extractionId: extraction?.id ?? null },
      });
      record = provisional.record;
    }

    if (!record) throw new Error("MENTORIA_ACADEMIC_RECORD_PERSIST_FAILED");

    const insights = buildAcademicInsights({ recordType, subjectSlug, rawText, scoreValue: score.value, confidence });
    const analysis = await this.academicRepository.createOrUpdateAnalysis(actor.tenantId, {
      studentProfileId: student.id,
      academicRecordId: record.id,
      documentId: document?.id ?? null,
      subjectSlug,
      analysisType: recordType === "exam" ? "exam_correction" : recordType === "homework" ? "task_review" : "document_review",
      mistakes: insights.mistakes,
      weakPoints: insights.weakPoints,
      strongPoints: insights.strongPoints,
      recommendations: insights.recommendations,
      boardSignal: insights.boardSignal,
      confidenceScore: confidence,
      status: confidence >= 0.6 ? "completed" : "needs_review",
    });

    if (document) {
      document = await this.academicRepository.updateDocumentAnalysisStatus(
        actor.tenantId,
        document.id,
        resolveDocumentAnalysisStatus(confidence),
      );
    }

    const progress = await this.repository.listProgress(actor.tenantId, student.id);
    const progressView = await this.academicRepository.rebuildSnapshotsFromRecords({ tenantId: actor.tenantId, studentProfileId: student.id, progress });

    return { student, record, document, extraction, analysis, progress: progressView };
  }

  async getProgress(actor: MentoriaRequestSession, studentId?: string | null): Promise<MentoriaAcademicProgressView> {
    const student = await this.resolveStudentForActor(actor, studentId);
    const progress = await this.repository.listProgress(actor.tenantId, student.id);
    return this.academicRepository.rebuildSnapshotsFromRecords({ tenantId: actor.tenantId, studentProfileId: student.id, progress });
  }

  async ingestWhatsappMaterial(params: {
    actor: MentoriaRequestSession;
    intake: MentoriaMaterialIntake;
    sourceMessageId: string;
    notesText?: string | null;
  }) {
    const student = await this.resolveStudentForActor(params.actor, params.intake.studentProfileId);
    if (student.id !== params.intake.studentProfileId) throw new Error("STUDENT_ACCESS_DENIED");

    const classification = params.intake.intakeKind.includes("exam")
      ? "exam"
      : params.intake.intakeKind.includes("homework")
        ? "homework"
        : params.intake.intakeKind.includes("notes")
          ? "notebook"
          : params.intake.intakeKind.includes("study")
            ? "project"
            : "custom";
    const subjectSlug = inferSubjectSlug(`${params.intake.caption ?? ""} ${params.intake.originalText ?? ""} ${params.notesText ?? ""}`);
    const created = await this.academicRepository.createDocument(params.actor.tenantId, {
      studentProfileId: student.id,
      materialIntakeId: params.intake.id,
      subjectSlug,
      documentKind: params.intake.mediaType === "document" ? "pdf" : "image",
      classification,
      sourceChannel: "whatsapp",
      sourceMessageId: params.sourceMessageId,
      storageKey: params.intake.providerMediaId,
      mimeType: params.intake.mimeType,
      fileName: params.intake.fileName ?? null,
      sha256: null,
      capturedAt: params.intake.createdAt,
      notesText: params.notesText ?? params.intake.caption ?? params.intake.originalText ?? null,
      analysisStatus: "pending",
    });

    let record = null;
    if (classification === "exam" || classification === "homework" || classification === "project") {
      const provisional = await this.academicRepository.createProvisionalRecordFromDocument(params.actor.tenantId, {
        studentProfileId: student.id,
        documentId: created.document.id,
        subjectSlug,
        recordType: classification,
        title: params.intake.fileName ?? params.intake.caption ?? `Documento ${classification}`,
        sourceChannel: "whatsapp",
        sourceRefId: `material_intake:${params.intake.id}`,
        metadata: { materialIntakeId: params.intake.id },
      });
      record = provisional.record;
    }

    return {
      student,
      document: created.document,
      documentReplayed: created.replayed,
      record,
    };
  }
}
