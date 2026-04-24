import type { MentoriaProgress } from "@/lib/mentoria/types";
import type {
  CreateMentoriaAcademicDocumentInput,
  CreateMentoriaAcademicManualRecordInput,
  MentoriaAcademicAnalysis,
  MentoriaAcademicDocument,
  MentoriaAcademicExtraction,
  MentoriaAcademicProgressView,
  MentoriaAcademicRecord,
  MentoriaAcademicRecordDetail,
  MentoriaAcademicRecordFilters,
  MentoriaSubjectPerformanceSnapshot,
} from "@/lib/mentoria/academic-types";

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown> | null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.toLowerCase().includes("unique constraint");
}

type AcademicRecordRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_slug: string | null;
  record_type: string;
  source_channel: string;
  source_ref_id: string;
  title: string;
  score_value: number | null;
  score_scale: number | null;
  score_label: string | null;
  recorded_at: string;
  teacher_comment: string | null;
  status: string;
  created_by_actor_type: string;
  created_by_actor_id: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

type AcademicDocumentRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  academic_record_id: string | null;
  material_intake_id: string | null;
  subject_slug: string | null;
  document_kind: string;
  classification: string;
  source_channel: string;
  source_message_id: string | null;
  storage_key: string;
  mime_type: string;
  file_name: string | null;
  sha256: string | null;
  captured_at: string;
  notes_text: string | null;
  analysis_status: string;
  created_at: string;
  updated_at: string;
};

type AcademicExtractionRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  document_id: string;
  academic_record_id: string | null;
  subject_slug: string | null;
  extracted_record_type: string | null;
  extracted_score_value: number | null;
  extracted_score_scale: number | null;
  extracted_score_label: string | null;
  extracted_teacher_comment: string | null;
  extracted_exam_date: string | null;
  confidence_score: number;
  status: string;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
};

type AcademicAnalysisRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  academic_record_id: string;
  document_id: string | null;
  subject_slug: string | null;
  analysis_type: string;
  mistakes_json: string | null;
  weak_points_json: string | null;
  strong_points_json: string | null;
  recommendations_json: string | null;
  board_signal_json: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type AcademicSnapshotRow = {
  id: string;
  tenant_id: string;
  student_profile_id: string;
  subject_slug: string;
  snapshot_date: string;
  school_average_score: number | null;
  mentoria_mastery_score: number | null;
  mentoria_confidence_score: number | null;
  trend_direction: string;
  weak_points_json: string | null;
  strong_points_json: string | null;
  notes_count: number;
  created_at: string;
  updated_at: string;
};

function mapRecord(row: AcademicRecordRow): MentoriaAcademicRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectSlug: row.subject_slug,
    recordType: row.record_type as MentoriaAcademicRecord["recordType"],
    sourceChannel: row.source_channel as MentoriaAcademicRecord["sourceChannel"],
    sourceRefId: row.source_ref_id,
    title: row.title,
    scoreValue: row.score_value,
    scoreScale: row.score_scale,
    scoreLabel: row.score_label,
    recordedAt: row.recorded_at,
    teacherComment: row.teacher_comment,
    status: row.status as MentoriaAcademicRecord["status"],
    createdByActorType: row.created_by_actor_type as MentoriaAcademicRecord["createdByActorType"],
    createdByActorId: row.created_by_actor_id,
    metadata: parseJsonObject<Record<string, unknown>>(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: AcademicDocumentRow): MentoriaAcademicDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    academicRecordId: row.academic_record_id,
    materialIntakeId: row.material_intake_id,
    subjectSlug: row.subject_slug,
    documentKind: row.document_kind as MentoriaAcademicDocument["documentKind"],
    classification: row.classification as MentoriaAcademicDocument["classification"],
    sourceChannel: row.source_channel as MentoriaAcademicDocument["sourceChannel"],
    sourceMessageId: row.source_message_id,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileName: row.file_name,
    sha256: row.sha256,
    capturedAt: row.captured_at,
    notesText: row.notes_text,
    analysisStatus: row.analysis_status as MentoriaAcademicDocument["analysisStatus"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExtraction(row: AcademicExtractionRow): MentoriaAcademicExtraction {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    documentId: row.document_id,
    academicRecordId: row.academic_record_id,
    subjectSlug: row.subject_slug,
    extractedRecordType: row.extracted_record_type as MentoriaAcademicExtraction["extractedRecordType"],
    extractedScoreValue: row.extracted_score_value,
    extractedScoreScale: row.extracted_score_scale,
    extractedScoreLabel: row.extracted_score_label,
    extractedTeacherComment: row.extracted_teacher_comment,
    extractedExamDate: row.extracted_exam_date,
    confidenceScore: Number(row.confidence_score ?? 0),
    status: row.status as MentoriaAcademicExtraction["status"],
    raw: parseJsonObject<Record<string, unknown>>(row.raw_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnalysis(row: AcademicAnalysisRow): MentoriaAcademicAnalysis {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    academicRecordId: row.academic_record_id,
    documentId: row.document_id,
    subjectSlug: row.subject_slug,
    analysisType: row.analysis_type as MentoriaAcademicAnalysis["analysisType"],
    mistakes: parseJsonArray<string>(row.mistakes_json),
    weakPoints: parseJsonArray<string>(row.weak_points_json),
    strongPoints: parseJsonArray<string>(row.strong_points_json),
    recommendations: parseJsonArray<string>(row.recommendations_json),
    boardSignal: parseJsonValue<MentoriaAcademicAnalysis["boardSignal"]>(row.board_signal_json, null),
    confidenceScore: Number(row.confidence_score ?? 0),
    status: row.status as MentoriaAcademicAnalysis["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshot(row: AcademicSnapshotRow): MentoriaSubjectPerformanceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentProfileId: row.student_profile_id,
    subjectSlug: row.subject_slug,
    snapshotDate: row.snapshot_date,
    schoolAverageScore: row.school_average_score,
    mentoriaMasteryScore: row.mentoria_mastery_score,
    mentoriaConfidenceScore: row.mentoria_confidence_score,
    trendDirection: row.trend_direction as MentoriaSubjectPerformanceSnapshot["trendDirection"],
    weakPoints: parseJsonArray<string>(row.weak_points_json),
    strongPoints: parseJsonArray<string>(row.strong_points_json),
    notesCount: Number(row.notes_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MentoriaAcademicRepository {
  constructor(private db: D1Database) {}

  async listRecords(tenantId: string, studentProfileId: string, filters?: MentoriaAcademicRecordFilters): Promise<MentoriaAcademicRecord[]> {
    const conditions = ["tenant_id = ?", "student_profile_id = ?"];
    const params: unknown[] = [tenantId, studentProfileId];

    if (filters?.subjectSlug) {
      conditions.push("subject_slug = ?");
      params.push(filters.subjectSlug);
    }
    if (filters?.recordType) {
      conditions.push("record_type = ?");
      params.push(filters.recordType);
    }
    if (filters?.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }

    const result = await this.db
      .prepare(`SELECT * FROM mentoria_academic_records WHERE ${conditions.join(" AND ")} ORDER BY recorded_at DESC, created_at DESC LIMIT 200`)
      .bind(...params)
      .all<AcademicRecordRow>();

    return (result.results ?? []).map(mapRecord);
  }

  async getRecordById(tenantId: string, id: string): Promise<MentoriaAcademicRecord | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_records WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(tenantId, id)
      .first<AcademicRecordRow>();
    return row ? mapRecord(row) : null;
  }

  async createManualRecord(tenantId: string, input: CreateMentoriaAcademicManualRecordInput): Promise<MentoriaAcademicRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO mentoria_academic_records (
          id, tenant_id, student_profile_id, subject_slug, record_type, source_channel, source_ref_id, title,
          score_value, score_scale, score_label, recorded_at, teacher_comment, status,
          created_by_actor_type, created_by_actor_id, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'manual_web', ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.studentProfileId,
        input.subjectSlug ?? null,
        input.recordType,
        `manual:${id}`,
        input.title,
        input.scoreValue ?? null,
        input.scoreScale ?? null,
        input.scoreLabel ?? null,
        input.recordedAt ?? now,
        input.teacherComment ?? null,
        input.createdByActorType,
        input.createdByActorId ?? null,
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
      )
      .run();

    const saved = await this.getRecordById(tenantId, id);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_RECORD_PERSIST_FAILED");
    return saved;
  }

  async createDocument(tenantId: string, input: CreateMentoriaAcademicDocumentInput): Promise<{ document: MentoriaAcademicDocument; replayed: boolean }> {
    const now = new Date().toISOString();
    if (input.sourceMessageId) {
      const existing = await this.getDocumentBySourceMessage(tenantId, input.sourceMessageId);
      if (existing) return { document: existing, replayed: true };
    }
    const id = crypto.randomUUID();
    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_academic_documents (
            id, tenant_id, student_profile_id, academic_record_id, material_intake_id, subject_slug, document_kind,
            classification, source_channel, source_message_id, storage_key, mime_type, file_name, sha256,
            captured_at, notes_text, analysis_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          tenantId,
          input.studentProfileId,
          input.academicRecordId ?? null,
          input.materialIntakeId ?? null,
          input.subjectSlug ?? null,
          input.documentKind,
          input.classification,
          input.sourceChannel,
          input.sourceMessageId ?? null,
          input.storageKey,
          input.mimeType,
          input.fileName ?? null,
          input.sha256 ?? null,
          input.capturedAt ?? now,
          input.notesText ?? null,
          input.analysisStatus ?? "pending",
          now,
          now,
        )
        .run();
    } catch (error) {
      if (input.sourceMessageId && isUniqueConstraintError(error)) {
        const existing = await this.getDocumentBySourceMessage(tenantId, input.sourceMessageId);
        if (existing) return { document: existing, replayed: true };
      }
      throw error;
    }

    const saved = await this.getDocumentById(tenantId, id);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_DOCUMENT_PERSIST_FAILED");
    return { document: saved, replayed: false };
  }

  async getDocumentById(tenantId: string, id: string): Promise<MentoriaAcademicDocument | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_documents WHERE tenant_id = ? AND id = ? LIMIT 1`)
      .bind(tenantId, id)
      .first<AcademicDocumentRow>();
    return row ? mapDocument(row) : null;
  }

  async getDocumentBySourceMessage(tenantId: string, sourceMessageId: string): Promise<MentoriaAcademicDocument | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_documents WHERE tenant_id = ? AND source_message_id = ? LIMIT 1`)
      .bind(tenantId, sourceMessageId)
      .first<AcademicDocumentRow>();
    return row ? mapDocument(row) : null;
  }

  async updateDocumentAnalysisStatus(
    tenantId: string,
    id: string,
    analysisStatus: MentoriaAcademicDocument["analysisStatus"],
  ): Promise<MentoriaAcademicDocument | null> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`UPDATE mentoria_academic_documents SET analysis_status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
      .bind(analysisStatus, now, tenantId, id)
      .run();
    return this.getDocumentById(tenantId, id);
  }

  async listDocuments(tenantId: string, studentProfileId: string, filters?: { subjectSlug?: string | null; recordType?: string | null }): Promise<MentoriaAcademicDocument[]> {
    const conditions = ["tenant_id = ?", "student_profile_id = ?"];
    const params: unknown[] = [tenantId, studentProfileId];
    if (filters?.subjectSlug) {
      conditions.push("subject_slug = ?");
      params.push(filters.subjectSlug);
    }
    if (filters?.recordType) {
      conditions.push("classification = ?");
      params.push(filters.recordType);
    }
    const result = await this.db
      .prepare(`SELECT * FROM mentoria_academic_documents WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 200`)
      .bind(...params)
      .all<AcademicDocumentRow>();
    return (result.results ?? []).map(mapDocument);
  }

  async createProvisionalRecordFromDocument(tenantId: string, input: {
    studentProfileId: string;
    documentId: string;
    subjectSlug?: string | null;
    recordType: MentoriaAcademicRecord["recordType"];
    title: string;
    sourceChannel: MentoriaAcademicRecord["sourceChannel"];
    sourceRefId: string;
    scoreValue?: number | null;
    scoreScale?: number | null;
    scoreLabel?: string | null;
    teacherComment?: string | null;
    recordedAt?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<{ record: MentoriaAcademicRecord; replayed: boolean }> {
    const existing = await this.db
      .prepare(`SELECT * FROM mentoria_academic_records WHERE tenant_id = ? AND source_ref_id = ? LIMIT 1`)
      .bind(tenantId, input.sourceRefId)
      .first<AcademicRecordRow>();
    if (existing) {
      return { record: mapRecord(existing), replayed: true };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO mentoria_academic_records (
          id, tenant_id, student_profile_id, subject_slug, record_type, source_channel, source_ref_id, title,
          score_value, score_scale, score_label, recorded_at, teacher_comment, status,
          created_by_actor_type, created_by_actor_id, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'provisional', 'system', NULL, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.studentProfileId,
        input.subjectSlug ?? null,
        input.recordType,
        input.sourceChannel,
        input.sourceRefId,
        input.title,
        input.scoreValue ?? null,
        input.scoreScale ?? null,
        input.scoreLabel ?? null,
        input.recordedAt ?? now,
        input.teacherComment ?? null,
        JSON.stringify({ documentId: input.documentId, ...(input.metadata ?? {}) }),
        now,
        now,
      )
      .run();

    const saved = await this.getRecordById(tenantId, id);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_RECORD_PERSIST_FAILED");

    await this.db
      .prepare(`UPDATE mentoria_academic_documents SET academic_record_id = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
      .bind(id, now, tenantId, input.documentId)
      .run();

    return { record: saved, replayed: false };
  }

  async createOrUpdateExtraction(tenantId: string, input: Omit<MentoriaAcademicExtraction, "id" | "tenantId" | "createdAt" | "updatedAt">): Promise<MentoriaAcademicExtraction> {
    const existing = await this.db
      .prepare(`SELECT * FROM mentoria_academic_extractions WHERE tenant_id = ? AND document_id = ? LIMIT 1`)
      .bind(tenantId, input.documentId)
      .first<AcademicExtractionRow>();
    const now = new Date().toISOString();
    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_academic_extractions
           SET academic_record_id = ?, subject_slug = ?, extracted_record_type = ?, extracted_score_value = ?, extracted_score_scale = ?,
               extracted_score_label = ?, extracted_teacher_comment = ?, extracted_exam_date = ?, confidence_score = ?, status = ?, raw_json = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          input.academicRecordId ?? null,
          input.subjectSlug ?? null,
          input.extractedRecordType ?? null,
          input.extractedScoreValue ?? null,
          input.extractedScoreScale ?? null,
          input.extractedScoreLabel ?? null,
          input.extractedTeacherComment ?? null,
          input.extractedExamDate ?? null,
          input.confidenceScore,
          input.status,
          JSON.stringify(input.raw ?? {}),
          now,
          tenantId,
          existing.id,
        )
        .run();
      const refreshed = await this.getExtractionByDocumentId(tenantId, input.documentId);
      if (!refreshed) throw new Error("MENTORIA_ACADEMIC_EXTRACTION_PERSIST_FAILED");
      return refreshed;
    }

    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO mentoria_academic_extractions (
          id, tenant_id, student_profile_id, document_id, academic_record_id, subject_slug, extracted_record_type,
          extracted_score_value, extracted_score_scale, extracted_score_label, extracted_teacher_comment, extracted_exam_date,
          confidence_score, status, raw_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.studentProfileId,
        input.documentId,
        input.academicRecordId ?? null,
        input.subjectSlug ?? null,
        input.extractedRecordType ?? null,
        input.extractedScoreValue ?? null,
        input.extractedScoreScale ?? null,
        input.extractedScoreLabel ?? null,
        input.extractedTeacherComment ?? null,
        input.extractedExamDate ?? null,
        input.confidenceScore,
        input.status,
        JSON.stringify(input.raw ?? {}),
        now,
        now,
      )
      .run();
    const saved = await this.getExtractionByDocumentId(tenantId, input.documentId);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_EXTRACTION_PERSIST_FAILED");
    return saved;
  }

  async getExtractionByDocumentId(tenantId: string, documentId: string): Promise<MentoriaAcademicExtraction | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_extractions WHERE tenant_id = ? AND document_id = ? LIMIT 1`)
      .bind(tenantId, documentId)
      .first<AcademicExtractionRow>();
    return row ? mapExtraction(row) : null;
  }

  async createOrUpdateAnalysis(tenantId: string, input: Omit<MentoriaAcademicAnalysis, "id" | "tenantId" | "createdAt" | "updatedAt">): Promise<MentoriaAcademicAnalysis> {
    const existing = await this.db
      .prepare(`SELECT * FROM mentoria_academic_analyses WHERE tenant_id = ? AND academic_record_id = ? LIMIT 1`)
      .bind(tenantId, input.academicRecordId)
      .first<AcademicAnalysisRow>();
    const now = new Date().toISOString();
    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_academic_analyses
           SET document_id = ?, subject_slug = ?, analysis_type = ?, mistakes_json = ?, weak_points_json = ?, strong_points_json = ?,
               recommendations_json = ?, board_signal_json = ?, confidence_score = ?, status = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          input.documentId ?? null,
          input.subjectSlug ?? null,
          input.analysisType,
          JSON.stringify(input.mistakes ?? []),
          JSON.stringify(input.weakPoints ?? []),
          JSON.stringify(input.strongPoints ?? []),
          JSON.stringify(input.recommendations ?? []),
          JSON.stringify(input.boardSignal ?? null),
          input.confidenceScore,
          input.status,
          now,
          tenantId,
          existing.id,
        )
        .run();
      const refreshed = await this.getAnalysisByRecordId(tenantId, input.academicRecordId);
      if (!refreshed) throw new Error("MENTORIA_ACADEMIC_ANALYSIS_PERSIST_FAILED");
      return refreshed;
    }

    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO mentoria_academic_analyses (
          id, tenant_id, student_profile_id, academic_record_id, document_id, subject_slug, analysis_type,
          mistakes_json, weak_points_json, strong_points_json, recommendations_json, board_signal_json,
          confidence_score, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.studentProfileId,
        input.academicRecordId,
        input.documentId ?? null,
        input.subjectSlug ?? null,
        input.analysisType,
        JSON.stringify(input.mistakes ?? []),
        JSON.stringify(input.weakPoints ?? []),
        JSON.stringify(input.strongPoints ?? []),
        JSON.stringify(input.recommendations ?? []),
        JSON.stringify(input.boardSignal ?? null),
        input.confidenceScore,
        input.status,
        now,
        now,
      )
      .run();
    const saved = await this.getAnalysisByRecordId(tenantId, input.academicRecordId);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_ANALYSIS_PERSIST_FAILED");
    return saved;
  }

  async getAnalysisByRecordId(tenantId: string, recordId: string): Promise<MentoriaAcademicAnalysis | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_analyses WHERE tenant_id = ? AND academic_record_id = ? LIMIT 1`)
      .bind(tenantId, recordId)
      .first<AcademicAnalysisRow>();
    return row ? mapAnalysis(row) : null;
  }

  async getRecordDetail(tenantId: string, recordId: string): Promise<MentoriaAcademicRecordDetail | null> {
    const record = await this.getRecordById(tenantId, recordId);
    if (!record) return null;
    const [document, extraction, analysis] = await Promise.all([
      this.getPrimaryDocumentForRecord(tenantId, recordId),
      this.getPrimaryDocumentForRecord(tenantId, recordId).then((doc) => doc ? this.getExtractionByDocumentId(tenantId, doc.id) : null),
      this.getAnalysisByRecordId(tenantId, recordId),
    ]);
    return { record, document, extraction, analysis };
  }

  async getPrimaryDocumentForRecord(tenantId: string, recordId: string): Promise<MentoriaAcademicDocument | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_academic_documents WHERE tenant_id = ? AND academic_record_id = ? ORDER BY created_at DESC LIMIT 1`)
      .bind(tenantId, recordId)
      .first<AcademicDocumentRow>();
    return row ? mapDocument(row) : null;
  }

  async upsertSubjectPerformanceSnapshot(tenantId: string, input: Omit<MentoriaSubjectPerformanceSnapshot, "id" | "tenantId" | "createdAt" | "updatedAt">): Promise<MentoriaSubjectPerformanceSnapshot> {
    const existing = await this.db
      .prepare(`SELECT * FROM mentoria_subject_performance_snapshots WHERE tenant_id = ? AND student_profile_id = ? AND subject_slug = ? LIMIT 1`)
      .bind(tenantId, input.studentProfileId, input.subjectSlug)
      .first<AcademicSnapshotRow>();
    const now = new Date().toISOString();
    if (existing) {
      await this.db
        .prepare(
          `UPDATE mentoria_subject_performance_snapshots
           SET snapshot_date = ?, school_average_score = ?, mentoria_mastery_score = ?, mentoria_confidence_score = ?, trend_direction = ?, weak_points_json = ?, strong_points_json = ?, notes_count = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        )
        .bind(
          input.snapshotDate,
          input.schoolAverageScore ?? null,
          input.mentoriaMasteryScore ?? null,
          input.mentoriaConfidenceScore ?? null,
          input.trendDirection,
          JSON.stringify(input.weakPoints ?? []),
          JSON.stringify(input.strongPoints ?? []),
          input.notesCount,
          now,
          tenantId,
          existing.id,
        )
        .run();
      const refreshed = await this.getSnapshotBySubject(tenantId, input.studentProfileId, input.subjectSlug);
      if (!refreshed) throw new Error("MENTORIA_ACADEMIC_SNAPSHOT_PERSIST_FAILED");
      return refreshed;
    }

    const id = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO mentoria_subject_performance_snapshots (
          id, tenant_id, student_profile_id, subject_slug, snapshot_date, school_average_score, mentoria_mastery_score,
          mentoria_confidence_score, trend_direction, weak_points_json, strong_points_json, notes_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        tenantId,
        input.studentProfileId,
        input.subjectSlug,
        input.snapshotDate,
        input.schoolAverageScore ?? null,
        input.mentoriaMasteryScore ?? null,
        input.mentoriaConfidenceScore ?? null,
        input.trendDirection,
        JSON.stringify(input.weakPoints ?? []),
        JSON.stringify(input.strongPoints ?? []),
        input.notesCount,
        now,
        now,
      )
      .run();
    const saved = await this.getSnapshotBySubject(tenantId, input.studentProfileId, input.subjectSlug);
    if (!saved) throw new Error("MENTORIA_ACADEMIC_SNAPSHOT_PERSIST_FAILED");
    return saved;
  }

  async getSnapshotBySubject(tenantId: string, studentProfileId: string, subjectSlug: string): Promise<MentoriaSubjectPerformanceSnapshot | null> {
    const row = await this.db
      .prepare(`SELECT * FROM mentoria_subject_performance_snapshots WHERE tenant_id = ? AND student_profile_id = ? AND subject_slug = ? LIMIT 1`)
      .bind(tenantId, studentProfileId, subjectSlug)
      .first<AcademicSnapshotRow>();
    return row ? mapSnapshot(row) : null;
  }

  async listSnapshots(tenantId: string, studentProfileId: string): Promise<MentoriaSubjectPerformanceSnapshot[]> {
    const result = await this.db
      .prepare(`SELECT * FROM mentoria_subject_performance_snapshots WHERE tenant_id = ? AND student_profile_id = ? ORDER BY subject_slug ASC`)
      .bind(tenantId, studentProfileId)
      .all<AcademicSnapshotRow>();
    return (result.results ?? []).map(mapSnapshot);
  }

  async rebuildSnapshotsFromRecords(params: {
    tenantId: string;
    studentProfileId: string;
    progress: MentoriaProgress[];
  }): Promise<MentoriaAcademicProgressView> {
    const records = await this.listRecords(params.tenantId, params.studentProfileId);
    const bySubject = new Map<string, MentoriaAcademicRecord[]>();
    for (const record of records) {
      if (!record.subjectSlug) continue;
      const current = bySubject.get(record.subjectSlug) ?? [];
      current.push(record);
      bySubject.set(record.subjectSlug, current);
    }

    const progressBySubject = new Map(params.progress.map((item) => [item.subject?.slug ?? "", item]));
    const allSubjectSlugs = new Set<string>([
      ...Array.from(bySubject.keys()),
      ...params.progress.map((item) => item.subject?.slug).filter((item): item is string => Boolean(item)),
    ]);

    for (const subjectSlug of allSubjectSlugs) {
      const subjectRecords = bySubject.get(subjectSlug) ?? [];
      const numericScores = subjectRecords
        .map((item) => {
          if (item.scoreValue === null || item.scoreScale === null || item.scoreScale <= 0) return null;
          return (item.scoreValue / item.scoreScale) * 100;
        })
        .filter((item): item is number => typeof item === "number" && Number.isFinite(item));
      const schoolAverageScore = numericScores.length > 0
        ? Math.round((numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length) * 100) / 100
        : null;
      const relatedProgress = progressBySubject.get(subjectSlug) ?? null;
      const trendDirection = schoolAverageScore === null || !relatedProgress
        ? "unknown"
        : schoolAverageScore > relatedProgress.masteryScore + 5
          ? "up"
          : schoolAverageScore < relatedProgress.masteryScore - 5
            ? "down"
            : "steady";
      const detailPairs = await Promise.all(subjectRecords.map((record) => this.getAnalysisByRecordId(params.tenantId, record.id)));
      const weakPoints = Array.from(new Set(detailPairs.flatMap((item) => item?.weakPoints ?? []))).slice(0, 6);
      const strongPoints = Array.from(new Set(detailPairs.flatMap((item) => item?.strongPoints ?? []))).slice(0, 6);
      await this.upsertSubjectPerformanceSnapshot(params.tenantId, {
        studentProfileId: params.studentProfileId,
        subjectSlug,
        snapshotDate: new Date().toISOString().slice(0, 10),
        schoolAverageScore,
        mentoriaMasteryScore: relatedProgress?.masteryScore ?? null,
        mentoriaConfidenceScore: relatedProgress?.confidenceScore ?? null,
        trendDirection,
        weakPoints,
        strongPoints,
        notesCount: subjectRecords.length,
      });
    }

    const snapshots = await this.listSnapshots(params.tenantId, params.studentProfileId);
    const subjects = snapshots.map((snapshot) => ({
      subjectSlug: snapshot.subjectSlug,
      subjectName: progressBySubject.get(snapshot.subjectSlug)?.subject?.name ?? snapshot.subjectSlug,
      schoolAverageScore: snapshot.schoolAverageScore,
      mentoriaMasteryScore: snapshot.mentoriaMasteryScore,
      mentoriaConfidenceScore: snapshot.mentoriaConfidenceScore,
      trendDirection: snapshot.trendDirection,
      weakPoints: snapshot.weakPoints,
      strongPoints: snapshot.strongPoints,
      notesCount: snapshot.notesCount,
    }));

    const schoolAverageValues = subjects.map((item) => item.schoolAverageScore).filter((item): item is number => typeof item === "number");
    const masteryValues = subjects.map((item) => item.mentoriaMasteryScore).filter((item): item is number => typeof item === "number");
    const confidenceValues = subjects.map((item) => item.mentoriaConfidenceScore).filter((item): item is number => typeof item === "number");

    return {
      studentId: params.studentProfileId,
      subjects,
      summary: {
        schoolAverageScore: schoolAverageValues.length ? Math.round((schoolAverageValues.reduce((sum, value) => sum + value, 0) / schoolAverageValues.length) * 100) / 100 : null,
        mentoriaMasteryAverage: masteryValues.length ? Math.round((masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) * 100) / 100 : null,
        mentoriaConfidenceAverage: confidenceValues.length ? Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 100) / 100 : null,
        strongestSubjects: subjects
          .filter((item) => (item.schoolAverageScore ?? 0) >= 70 || (item.mentoriaMasteryScore ?? 0) >= 70)
          .map((item) => item.subjectName)
          .slice(0, 4),
        weakestSubjects: subjects
          .filter((item) => (item.schoolAverageScore ?? 100) < 60 || (item.mentoriaMasteryScore ?? 100) < 60)
          .map((item) => item.subjectName)
          .slice(0, 4),
      },
    };
  }
}
