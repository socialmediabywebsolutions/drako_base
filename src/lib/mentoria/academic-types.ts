export type MentoriaAcademicRecordType =
  | "exam"
  | "homework"
  | "project"
  | "notebook"
  | "behavior"
  | "presentation"
  | "custom";

export type MentoriaAcademicSourceChannel = "manual_web" | "whatsapp" | "web_upload" | "ai_extraction";

export type MentoriaAcademicActorType = "student" | "guardian" | "system" | "admin";

export type MentoriaAcademicRecordStatus = "provisional" | "confirmed" | "needs_review";

export type MentoriaAcademicDocumentKind = "image" | "pdf";

export type MentoriaAcademicDocumentStatus = "pending" | "analyzed" | "needs_review";

export type MentoriaAcademicExtractionStatus = "extracted" | "needs_review";

export type MentoriaAcademicAnalysisStatus = "completed" | "needs_review";

export type MentoriaAcademicTrendDirection = "up" | "down" | "steady" | "unknown";

export type MentoriaAcademicRecord = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectSlug: string | null;
  recordType: MentoriaAcademicRecordType;
  sourceChannel: MentoriaAcademicSourceChannel;
  sourceRefId: string;
  title: string;
  scoreValue: number | null;
  scoreScale: number | null;
  scoreLabel: string | null;
  recordedAt: string;
  teacherComment: string | null;
  status: MentoriaAcademicRecordStatus;
  createdByActorType: MentoriaAcademicActorType;
  createdByActorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaAcademicDocument = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicRecordId: string | null;
  materialIntakeId: string | null;
  subjectSlug: string | null;
  documentKind: MentoriaAcademicDocumentKind;
  classification: MentoriaAcademicRecordType | "unknown";
  sourceChannel: MentoriaAcademicSourceChannel;
  sourceMessageId: string | null;
  storageKey: string;
  mimeType: string;
  fileName: string | null;
  sha256: string | null;
  capturedAt: string;
  notesText: string | null;
  analysisStatus: MentoriaAcademicDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaAcademicExtraction = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  documentId: string;
  academicRecordId: string | null;
  subjectSlug: string | null;
  extractedRecordType: MentoriaAcademicRecordType | null;
  extractedScoreValue: number | null;
  extractedScoreScale: number | null;
  extractedScoreLabel: string | null;
  extractedTeacherComment: string | null;
  extractedExamDate: string | null;
  confidenceScore: number;
  status: MentoriaAcademicExtractionStatus;
  raw: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaAcademicAnalysis = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicRecordId: string;
  documentId: string | null;
  subjectSlug: string | null;
  analysisType: "document_review" | "exam_correction" | "task_review";
  mistakes: string[];
  weakPoints: string[];
  strongPoints: string[];
  recommendations: string[];
  boardSignal: {
    subjectSlug: string | null;
    topic: string | null;
    summary: string;
  } | null;
  confidenceScore: number;
  status: MentoriaAcademicAnalysisStatus;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaSubjectPerformanceSnapshot = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  subjectSlug: string;
  snapshotDate: string;
  schoolAverageScore: number | null;
  mentoriaMasteryScore: number | null;
  mentoriaConfidenceScore: number | null;
  trendDirection: MentoriaAcademicTrendDirection;
  weakPoints: string[];
  strongPoints: string[];
  notesCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MentoriaAcademicRecordDetail = {
  record: MentoriaAcademicRecord;
  document: MentoriaAcademicDocument | null;
  extraction: MentoriaAcademicExtraction | null;
  analysis: MentoriaAcademicAnalysis | null;
};

export type MentoriaAcademicRecordFilters = {
  subjectSlug?: string | null;
  recordType?: MentoriaAcademicRecordType | null;
  status?: MentoriaAcademicRecordStatus | null;
};

export type CreateMentoriaAcademicManualRecordInput = {
  studentProfileId: string;
  subjectSlug?: string | null;
  recordType: MentoriaAcademicRecordType;
  title: string;
  scoreValue?: number | null;
  scoreScale?: number | null;
  scoreLabel?: string | null;
  recordedAt?: string | null;
  teacherComment?: string | null;
  metadata?: Record<string, unknown>;
  createdByActorType: MentoriaAcademicActorType;
  createdByActorId?: string | null;
};

export type CreateMentoriaAcademicManualRecordRequestInput = Omit<
  CreateMentoriaAcademicManualRecordInput,
  "studentProfileId" | "createdByActorType"
> & {
  studentId?: string | null;
  studentProfileId?: string | null;
  createdByActorType?: MentoriaAcademicActorType;
};

export type CreateMentoriaAcademicDocumentInput = {
  studentProfileId: string;
  academicRecordId?: string | null;
  materialIntakeId?: string | null;
  subjectSlug?: string | null;
  documentKind: MentoriaAcademicDocumentKind;
  classification: MentoriaAcademicRecordType | "unknown";
  sourceChannel: MentoriaAcademicSourceChannel;
  sourceMessageId?: string | null;
  storageKey: string;
  mimeType: string;
  fileName?: string | null;
  sha256?: string | null;
  capturedAt?: string | null;
  notesText?: string | null;
  analysisStatus?: MentoriaAcademicDocumentStatus;
};

export type CreateMentoriaAcademicDocumentRequestInput = Omit<CreateMentoriaAcademicDocumentInput, "studentProfileId"> & {
  studentId?: string | null;
  studentProfileId?: string | null;
};

export type MentoriaAcademicAnalyzeInput = {
  studentProfileId: string;
  documentId?: string | null;
  recordId?: string | null;
  rawText?: string | null;
};

export type MentoriaAcademicAnalyzeRequestInput = Omit<MentoriaAcademicAnalyzeInput, "studentProfileId"> & {
  studentId?: string | null;
  studentProfileId?: string | null;
};

export type MentoriaAcademicProgressSubject = {
  subjectSlug: string;
  subjectName: string;
  schoolAverageScore: number | null;
  mentoriaMasteryScore: number | null;
  mentoriaConfidenceScore: number | null;
  trendDirection: MentoriaAcademicTrendDirection;
  weakPoints: string[];
  strongPoints: string[];
  notesCount: number;
};

export type MentoriaAcademicProgressView = {
  studentId: string;
  subjects: MentoriaAcademicProgressSubject[];
  summary: {
    schoolAverageScore: number | null;
    mentoriaMasteryAverage: number | null;
    mentoriaConfidenceAverage: number | null;
    strongestSubjects: string[];
    weakestSubjects: string[];
  };
};
