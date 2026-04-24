import { env } from "@/lib/cf";
import { queryOne } from "@/lib/db";
import { MentoriaAcademicService } from "@/lib/mentoria/academic-service";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { MentoriaRepository } from "@/lib/mentoria/repository";
import { recordObservabilityActivity } from "@/lib/observability-core";
import type { MentoriaGuardianAccessibleStudent, MentoriaMaterialIntake, MentoriaMaterialIntakeKind } from "@/lib/mentoria/types";
import type { WhatsappActorType } from "@/lib/whatsapp/types";

export type MentoriaWhatsappEntryParams = {
  tenantId: string;
  saasId: string;
  phoneNumber: string;
  body: string;
  actorType?: WhatsappActorType | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MentoriaWhatsappEntryResult = {
  handled: boolean;
  messagesToSend: Array<{ body: string }>;
  intent?: string;
  error?: string;
};

type SaasInstancePlatformRow = {
  id: string;
  tenant_id: string;
  platform_type: string;
};

type MentoriaWhatsappMediaMetadata = {
  kind?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  sha256?: string;
};

type SupportedStudentMediaKind = "image" | "document";

const SUPPORTED_GUARDIAN_INTENTS = new Set(["resumen", "estado", "como va", "proxima tarea", "ultima sesion", "plan", "alertas"]);
const MANUAL_MATERIAL_LABELS = new Set(["examen", "tarea", "apuntes", "nota"]);
const MAX_CONTEXT_TEXT_LENGTH = 160;
const MATERIAL_CONTEXT_WINDOW_MS = 15 * 60 * 1000;
const MENTORIA_WHATSAPP_SOURCE_KEY = "mentoria.whatsapp";

function normalizeIntent(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatIsoDate(date?: string | null): string {
  if (!date) return "sin actividad registrada";
  return date.slice(0, 10);
}

function formatGuardianCommandResponse(lines: string[]): string {
  return lines.join("\n");
}

function buildGuardianSummaryResponse(params: {
  studentName: string;
  sessionsCount: number;
  lastActivity: string | null;
  topProgressLabel: string;
  planSummary: string;
}): string {
  return formatGuardianCommandResponse([
    `Resumen de ${params.studentName}:`,
    `- Sesiones recientes: ${params.sessionsCount}`,
    `- Ultima actividad: ${formatIsoDate(params.lastActivity)}`,
    `- Progreso principal: ${params.topProgressLabel}`,
    `- Plan actual: ${params.planSummary}`,
  ]);
}

function buildGuardianNextTaskResponse(studentName: string, dailyPlan: Awaited<ReturnType<MentoriaRepository["getDailyPlan"]>>): string {
  const nextTask = dailyPlan?.tasks.find((task) => !task.completed) ?? null;
  if (!dailyPlan || !nextTask) {
    return `Proxima tarea de ${studentName}: no hay tareas pendientes ahora mismo.`;
  }

  return formatGuardianCommandResponse([
    `Proxima tarea de ${studentName}:`,
    `- Materia: ${nextTask.subject}`,
    `- Tipo: ${nextTask.type}`,
    `- Dificultad: ${nextTask.difficulty}/5`,
    `- Fecha del plan: ${dailyPlan.planDate}`,
  ]);
}

function buildGuardianLastSessionResponse(studentName: string, session: Awaited<ReturnType<MentoriaRepository["listLearningSessions"]>>[number] | null): string {
  if (!session) {
    return `Ultima sesion de ${studentName}: no hay sesiones registradas.`;
  }

  return formatGuardianCommandResponse([
    `Ultima sesion de ${studentName}:`,
    `- Tema: ${session.topic}`,
    `- Estado: ${session.status}`,
    `- Fecha: ${formatIsoDate(session.updatedAt)}`,
    `- Siguiente paso: ${session.recommendedNextStep || "sin siguiente paso registrado"}`,
  ]);
}

function buildGuardianPlanResponse(studentName: string, plan: Awaited<ReturnType<MentoriaRepository["getCurrentStudyPlan"]>>): string {
  if (!plan) {
    return `Plan actual de ${studentName}: no hay un plan activo ahora mismo.`;
  }

  return formatGuardianCommandResponse([
    `Plan actual de ${studentName}:`,
    `- Semana: ${plan.weekStart} a ${plan.weekEnd}`,
    `- Objetivo: ${plan.goalsSummary || "sin objetivo resumido"}`,
    `- Bloques: ${plan.blocks.length}`,
  ]);
}

function buildGuardianAlertsResponse(studentName: string, interventions: Awaited<ReturnType<MentoriaRepository["listInterventions"]>>): string {
  const activeInterventions = interventions.filter((item) => item.status === "active");
  const topAlert = activeInterventions[0] ?? null;
  if (!topAlert) {
    return `Alertas de ${studentName}: no hay alertas activas ahora mismo.`;
  }

  return formatGuardianCommandResponse([
    `Alertas de ${studentName}:`,
    `- Nivel: ${topAlert.severity}`,
    `- Resumen: ${topAlert.summary}`,
    `- Recomendacion: ${topAlert.recommendations[0] ?? "sin recomendacion registrada"}`,
  ]);
}

function buildGuardianContextRequiredReply(accessList: MentoriaGuardianAccessibleStudent[]): string {
  const names = accessList.map((item) => item.studentName).filter(Boolean);
  return `Necesito que indiques de que alumno hablas antes de continuar. Alumnos disponibles: ${names.join(", ")}.`;
}

async function resolveGuardianStudentTarget(params: {
  repository: MentoriaRepository;
  tenantId: string;
  actorId: string;
  phoneNumber: string;
  metadata?: Record<string, unknown> | null;
}) {
  const accessList = await params.repository.listGuardianAccessibleStudents(params.tenantId, params.actorId).catch(() => []);
  if (accessList.length === 0) {
    return {
      kind: "missing" as const,
    };
  }

  const requestedActiveStudentId = typeof params.metadata?.activeStudentId === "string" ? params.metadata.activeStudentId.trim() : "";
  if (requestedActiveStudentId) {
    const explicitTarget =
      accessList.find((item) => item.studentId === requestedActiveStudentId || item.studentProfileId === requestedActiveStudentId) ?? null;
    if (!explicitTarget) {
      return {
        kind: "forbidden" as const,
        accessList,
      };
    }

    await params.repository.upsertConversationContext({
      familyId: params.tenantId,
      channel: "whatsapp",
      threadKey: params.phoneNumber,
      actorType: "guardian_actor",
      actorId: params.actorId,
      scopeType: "student",
      activeStudentId: explicitTarget.studentId,
      resolvedBy: "explicit_switch",
      markExplicitSwitch: true,
    });

    return {
      kind: "resolved" as const,
      target: explicitTarget,
      accessList,
      resolution: "explicit_switch" as const,
    };
  }

  if (accessList.length === 1) {
    const singleTarget = accessList[0] as MentoriaGuardianAccessibleStudent;
    await params.repository.upsertConversationContext({
      familyId: params.tenantId,
      channel: "whatsapp",
      threadKey: params.phoneNumber,
      actorType: "guardian_actor",
      actorId: params.actorId,
      scopeType: "student",
      activeStudentId: singleTarget.studentId,
      resolvedBy: singleTarget.source === "canonical" ? "single_access" : "legacy_fallback",
    });

    return {
      kind: "resolved" as const,
      target: singleTarget,
      accessList,
      resolution: singleTarget.source === "canonical" ? "single_access" : "legacy_fallback",
    };
  }

  const context = await params.repository.getConversationContext({
    familyId: params.tenantId,
    channel: "whatsapp",
    threadKey: params.phoneNumber,
    actorType: "guardian_actor",
    actorId: params.actorId,
  });

  if (context?.activeStudentId) {
    const contextualTarget =
      accessList.find((item) => item.studentId === context.activeStudentId || item.studentProfileId === context.activeStudentId) ?? null;
    if (contextualTarget) {
      return {
        kind: "resolved" as const,
        target: contextualTarget,
        accessList,
        resolution: "context" as const,
      };
    }
  }

  return {
    kind: "ambiguous" as const,
    accessList,
  };
}

async function buildGuardianIntentResult(params: {
  repository: MentoriaRepository;
  tenantId: string;
  studentId: string;
  studentName: string;
  normalizedIntent: string;
}) {
  const { repository, tenantId, studentId, studentName, normalizedIntent } = params;

  if (normalizedIntent === "proxima tarea") {
    const dailyPlan = await repository.getDailyPlan(tenantId, studentId).catch(() => null);
    return {
      handled: true,
      messagesToSend: [{ body: buildGuardianNextTaskResponse(studentName, dailyPlan) }],
      intent: "MENTORIA_GUARDIAN_NEXT_TASK",
    };
  }

  if (normalizedIntent === "ultima sesion") {
    const sessions = await repository.listLearningSessions(tenantId, studentId).catch(() => []);
    return {
      handled: true,
      messagesToSend: [{ body: buildGuardianLastSessionResponse(studentName, sessions[0] ?? null) }],
      intent: "MENTORIA_GUARDIAN_LAST_SESSION",
    };
  }

  if (normalizedIntent === "plan") {
    const currentPlan = await repository.getCurrentStudyPlan(tenantId, studentId).catch(() => null);
    return {
      handled: true,
      messagesToSend: [{ body: buildGuardianPlanResponse(studentName, currentPlan) }],
      intent: "MENTORIA_GUARDIAN_PLAN",
    };
  }

  if (normalizedIntent === "alertas") {
    const interventions = await repository.listInterventions(tenantId, studentId).catch(() => []);
    return {
      handled: true,
      messagesToSend: [{ body: buildGuardianAlertsResponse(studentName, interventions) }],
      intent: "MENTORIA_GUARDIAN_ALERTS",
    };
  }

  const [progress, sessions, currentPlan] = await Promise.all([
    repository.listProgress(tenantId, studentId).catch(() => []),
    repository.listLearningSessions(tenantId, studentId).catch(() => []),
    repository.getCurrentStudyPlan(tenantId, studentId).catch(() => null),
  ]);

  const topProgress = progress[0];
  const topProgressLabel = topProgress
    ? `${topProgress.subject?.name ?? "materia"}: ${Math.round(topProgress.masteryScore)}%`
    : "sin progreso registrado";

  const lastActivity = topProgress?.lastActivityAt ?? sessions[0]?.updatedAt ?? null;
  const planSummary = currentPlan?.goalsSummary?.trim() || "sin plan activo";

  return {
    handled: true,
    messagesToSend: [
      {
        body: buildGuardianSummaryResponse({
          studentName,
          sessionsCount: sessions.length,
          lastActivity,
          topProgressLabel,
          planSummary,
        }),
      },
    ],
    intent: "MENTORIA_GUARDIAN_SUMMARY",
  };
}

function isShortContextualStudentText(text: string): boolean {
  return text.length > 0 && text.length <= MAX_CONTEXT_TEXT_LENGTH;
}

function isRecentIsoDate(date: string, windowMs: number): boolean {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= windowMs;
}

function resolveAcademicImageKind(text: string): "exam_photo" | "homework_photo" | "notes_photo" | "exercise_photo" | "academic_image" {
  if (text.includes("examen")) return "exam_photo";
  if (text.includes("tarea")) return "homework_photo";
  if (text.includes("apunte") || text.includes("apuntes")) return "notes_photo";
  if (text.includes("ejercicio") || text.includes("ejercicios")) return "exercise_photo";
  return "academic_image";
}

function resolveAcademicDocumentKind(text: string): "exam_document" | "homework_document" | "notes_document" | "study_document" | "academic_document" {
  if (text.includes("examen")) return "exam_document";
  if (text.includes("tarea")) return "homework_document";
  if (text.includes("apunte") || text.includes("apuntes")) return "notes_document";
  if (text.includes("estudio") || text.includes("material")) return "study_document";
  return "academic_document";
}

function isManualMaterialClassification(text: string): boolean {
  return MANUAL_MATERIAL_LABELS.has(text);
}

function resolveManualMaterialClassificationKind(intake: MentoriaMaterialIntake, label: string): MentoriaMaterialIntakeKind {
  if (intake.mediaType === "document") {
    if (label === "examen") return "exam_document";
    if (label === "tarea") return "homework_document";
    return "notes_document";
  }

  if (label === "examen") return "exam_photo";
  if (label === "tarea") return "homework_photo";
  if (label === "apuntes" || label === "nota") return "notes_photo";
  return "academic_image";
}

function buildManualClassificationReply(studentName: string, label: string): string {
  return `He clasificado tu material reciente como ${label}, ${studentName}.`;
}

function isSupportedStudentMediaMime(kind: SupportedStudentMediaKind, mimeType: string): boolean {
  if (kind === "image") return mimeType.startsWith("image/");
  return mimeType === "application/pdf";
}

function buildStudentMediaReply(kind: SupportedStudentMediaKind, studentFullName: string): string {
  if (kind === "document") {
    return `He recibido tu PDF, ${studentFullName}. Lo he guardado como material pendiente de revision manual.`;
  }
  return `He recibido tu imagen, ${studentFullName}. La he guardado como material pendiente de revision manual.`;
}

async function recordMentoriaWhatsappActivity(params: {
  tenantId: string;
  saasId: string;
  activityType: string;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await recordObservabilityActivity({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "integration",
      sourceKey: MENTORIA_WHATSAPP_SOURCE_KEY,
      activityType: params.activityType,
      status: params.status,
      summary: params.summary,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.error("MENTORIA_WHATSAPP_OBSERVABILITY_ACTIVITY_ERROR", error);
  }
}

async function recordMentoriaWhatsappOutcome(params: {
  tenantId: string;
  saasId: string;
  handled: boolean;
  intent?: string;
  error?: string;
  metadata?: Record<string, unknown> | null;
}) {
  await recordMentoriaWhatsappActivity({
    tenantId: params.tenantId,
    saasId: params.saasId,
    activityType: "mentoria_whatsapp_result",
    status: params.error ? "error" : params.handled ? "success" : "warning",
    summary: params.error
      ? `Mentoria WhatsApp returned ${params.error}.`
      : params.handled
        ? `Mentoria WhatsApp handled ${params.intent ?? "unknown_intent"}.`
        : "Mentoria WhatsApp did not handle the inbound message.",
    metadata: {
      handled: params.handled,
      intent: params.intent ?? null,
      error: params.error ?? null,
      ...(params.metadata ?? {}),
    },
  });
}

function classifyGuardianIntent(normalizedIntent: string): "guardian_summary_command" | "guardian_operational_command" {
  return normalizedIntent === "resumen" || normalizedIntent === "estado" || normalizedIntent === "como va"
    ? "guardian_summary_command"
    : "guardian_operational_command";
}

async function handleStudentMediaIntake(params: {
  repository: MentoriaRepository;
  tenantId: string;
  saasId: string;
  actorId: string;
  actorType: WhatsappActorType;
  phoneNumber: string;
  body?: string;
  metadata?: Record<string, unknown> | null;
  media: MentoriaWhatsappMediaMetadata | null;
  kind: SupportedStudentMediaKind;
}): Promise<MentoriaWhatsappEntryResult | null> {
  const { repository, tenantId, saasId, actorId, actorType, phoneNumber, body, metadata, media, kind } = params;

  if (actorType !== "CUSTOMER") {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_STUDENT_ONLY",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_actor_mismatch",
      },
    });

    return result;
  }

  const student = await repository.getStudentProfileByUser(tenantId, actorId).catch(() => null);
  if (!student) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_STUDENT_CONTEXT_MISMATCH",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_actor_mismatch",
      },
    });

    return result;
  }

  if (!media?.mediaId) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_MISSING",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_invalid_media",
      },
    });

    return result;
  }

  if (media.kind !== kind) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_invalid_media",
      },
    });

    return result;
  }

  const mimeType = media.mimeType?.trim().toLowerCase() ?? "";
  if (!isSupportedStudentMediaMime(kind, mimeType)) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_invalid_media",
      },
    });

    return result;
  }

  const sourceMessageId = typeof metadata?.messageId === "string" ? metadata.messageId.trim() : "";
  if (!sourceMessageId) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: "rejected_by_invalid_media",
      },
    });

    return result;
  }

  const normalizedText = normalizeIntent(body ?? media.caption ?? media.fileName ?? "");

  try {
    const persisted = await repository.createMaterialIntake({
      tenantId,
      studentProfileId: student.id,
      sourceMessageId,
      phoneNumber,
      mediaType: kind,
      intakeKind: kind === "image" ? resolveAcademicImageKind(normalizedText) : resolveAcademicDocumentKind(normalizedText),
      providerMediaId: media.mediaId,
      mimeType,
      fileName: media.fileName ?? null,
      caption: media.caption ?? null,
      originalText: body ?? null,
    });

    const academicService = new MentoriaAcademicService();
    const academicResult = await academicService.ingestWhatsappMaterial({
      actor: {
        userId: actorId,
        email: "",
        tenantId,
        role: "user",
        actorType: "student",
        familyId: tenantId,
        guardianId: null,
        studentProfileId: student.id,
        systemRole: "student",
      },
      intake: persisted.intake,
      sourceMessageId,
      notesText: body ?? media.caption ?? media.fileName ?? null,
    });

    await recordMentoriaWhatsappActivity({
      tenantId,
      saasId,
      activityType: kind === "document" ? "student_pdf_intake" : "student_image_intake",
      status: "success",
      summary: persisted.replayed
        ? `Mentoria WhatsApp replayed ${kind} intake safely.`
        : `Mentoria WhatsApp persisted ${kind} intake successfully.`,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: kind === "document" ? "student_pdf_intake" : "student_image_intake",
        studentProfileId: student.id,
        sourceMessageId,
        intakeId: persisted.intake.id,
        academicDocumentId: academicResult.document.id,
        academicRecordId: academicResult.record?.id ?? null,
        replayed: persisted.replayed,
      },
    });
  } catch {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_MATERIAL_INTAKE_PERSIST_FAILED",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType,
        actorId,
        messageType: kind,
        useCase: kind === "document" ? "student_pdf_intake" : "student_image_intake",
      },
    });

    return result;
  }

  return {
    handled: true,
    messagesToSend: [{ body: buildStudentMediaReply(kind, student.fullName) }],
    intent: "MENTORIA_STUDENT_MATERIAL_RECEIVED",
  };
}

export async function runMentoriaWhatsappEntry(
  params: MentoriaWhatsappEntryParams,
): Promise<MentoriaWhatsappEntryResult> {
  const tenantId = params.tenantId?.trim();
  const saasId = params.saasId?.trim();
  const phoneNumber = params.phoneNumber?.trim();
  const body = params.body?.trim();
  const actorId = params.actorId?.trim() ?? "";
  const messageType = typeof params.metadata?.messageType === "string" ? params.metadata.messageType : "text";

  if (tenantId && saasId) {
    await recordMentoriaWhatsappActivity({
      tenantId,
      saasId,
      activityType: "mentoria_whatsapp_inbound",
      status: "info",
      summary: `Mentoria WhatsApp received ${messageType} message.`,
      metadata: {
        actorType: params.actorType ?? null,
        actorId: actorId || null,
        messageType,
        sourceMessageId: typeof params.metadata?.messageId === "string" ? params.metadata.messageId.trim() : null,
      },
    });
  }

  if (!tenantId || !saasId || !phoneNumber) {
    return {
      handled: false,
      messagesToSend: [],
      error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
    };
  }

  if (!params.actorType || !actorId) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_ACTOR_NOT_RESOLVED",
    };
  }

  let db: D1Database;
  try {
    db = getMentoriaDb(env?.());
  } catch {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_DB_UNAVAILABLE",
    };
  }

  const saasInstance = await queryOne<SaasInstancePlatformRow>(
    `SELECT id, tenant_id, platform_type
     FROM saas_instances
     WHERE id = ? AND tenant_id = ?
     LIMIT 1`,
    saasId,
    tenantId,
  ).catch(() => null);

  if (!saasInstance || saasInstance.platform_type !== "mentoria") {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_SAAS_CONTEXT_MISMATCH",
    };
  }

  const repository = new MentoriaRepository(db);
  const media =
    params.metadata?.media && typeof params.metadata.media === "object"
      ? (params.metadata.media as MentoriaWhatsappMediaMetadata)
      : null;

  if (messageType === "image" || messageType === "document") {
    const mediaResult = await handleStudentMediaIntake({
      repository,
      tenantId,
      saasId,
      actorId,
      actorType: params.actorType,
      phoneNumber,
      body,
      metadata: params.metadata,
      media,
      kind: messageType,
    });
    if (mediaResult) {
      await recordMentoriaWhatsappOutcome({
        tenantId,
        saasId,
        handled: mediaResult.handled,
        intent: mediaResult.intent,
        error: mediaResult.error,
        metadata: {
          actorType: params.actorType,
          actorId,
          messageType,
          useCase: messageType === "document" ? "student_pdf_intake" : "student_image_intake",
        },
      });
      return mediaResult;
    }
  }

  if (!body) {
    return {
      handled: false,
      messagesToSend: [],
      error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
    };
  }

  if (params.actorType === "CUSTOMER") {
    const student = await repository.getStudentProfileByUser(tenantId, actorId).catch(() => null);
    if (student) {
      if (body.length > 0 && body.length <= MAX_CONTEXT_TEXT_LENGTH) {
        const sourceMessageId = typeof params.metadata?.messageId === "string" ? params.metadata.messageId.trim() : "";
        if (!sourceMessageId) {
          return {
            handled: false,
            messagesToSend: [],
            error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
          };
        }

        const latestMaterial = await repository.getLatestMaterialIntake(tenantId, student.id).catch(() => null);
        if (!latestMaterial || !isRecentIsoDate(latestMaterial.createdAt, MATERIAL_CONTEXT_WINDOW_MS)) {
          return {
            handled: false,
            messagesToSend: [],
            error: "MENTORIA_WHATSAPP_RECENT_MATERIAL_NOT_FOUND",
          };
        }

        const normalizedBody = normalizeIntent(body);
        if (isManualMaterialClassification(normalizedBody)) {
          try {
            const classified = await repository.updateMaterialIntakeKind({
              tenantId,
              intakeId: latestMaterial.id,
              intakeKind: resolveManualMaterialClassificationKind(latestMaterial, normalizedBody),
            });

            await recordMentoriaWhatsappActivity({
              tenantId,
              saasId,
              activityType: "student_material_manual_classification",
              status: "success",
              summary: classified.replayed
                ? `Mentoria WhatsApp replayed manual classification ${normalizedBody} safely.`
                : `Mentoria WhatsApp classified recent material as ${normalizedBody}.`,
              metadata: {
                actorType: params.actorType,
                actorId,
                messageType,
                useCase: "student_material_manual_classification",
                sourceMessageId,
                studentProfileId: student.id,
                materialIntakeId: latestMaterial.id,
                intakeKind: classified.intake.intakeKind,
                manualLabel: normalizedBody,
                replayed: classified.replayed,
              },
            });
          } catch {
            return {
              handled: false,
              messagesToSend: [],
              error: "MENTORIA_MATERIAL_INTAKE_PERSIST_FAILED",
            };
          }

          const result = {
            handled: true,
            messagesToSend: [{ body: buildManualClassificationReply(student.fullName, normalizedBody) }],
            intent: "MENTORIA_STUDENT_MATERIAL_CLASSIFIED",
          };

          await recordMentoriaWhatsappOutcome({
            tenantId,
            saasId,
            handled: result.handled,
            intent: result.intent,
            metadata: {
              actorType: params.actorType,
              actorId,
              messageType,
              useCase: "student_material_manual_classification",
              manualLabel: normalizedBody,
            },
          });

          return result;
        }

        try {
          const persisted = await repository.createMaterialContextNote({
            tenantId,
            studentProfileId: student.id,
            materialIntakeId: latestMaterial.id,
            sourceMessageId,
            body,
          });

          await recordMentoriaWhatsappActivity({
            tenantId,
            saasId,
            activityType: "student_context_note",
            status: "success",
            summary: persisted.replayed
              ? "Mentoria WhatsApp replayed contextual note safely."
              : "Mentoria WhatsApp persisted contextual note successfully.",
            metadata: {
              actorType: params.actorType,
              actorId,
              messageType,
              useCase: "student_context_note",
              studentProfileId: student.id,
              sourceMessageId,
              materialIntakeId: latestMaterial.id,
              contextNoteId: persisted.note.id,
              replayed: persisted.replayed,
            },
          });
        } catch {
          return {
            handled: false,
            messagesToSend: [],
            error: "MENTORIA_MATERIAL_CONTEXT_NOTE_PERSIST_FAILED",
          };
        }

        const result = {
          handled: true,
          messagesToSend: [{ body: `He añadido tu texto al material que enviaste hace un momento, ${student.fullName}. Queda guardado como contexto.` }],
          intent: "MENTORIA_STUDENT_MATERIAL_CONTEXT_RECORDED",
        };

        await recordMentoriaWhatsappOutcome({
          tenantId,
          saasId,
          handled: result.handled,
          intent: result.intent,
          metadata: {
            actorType: params.actorType,
            actorId,
            messageType,
            useCase: "student_context_note",
          },
        });

        return result;
      }

      return {
        handled: false,
        messagesToSend: [],
        error: "MENTORIA_WHATSAPP_CONTEXT_TEXT_NOT_SUPPORTED",
      };
    }
  }

  if (params.actorType !== "CUSTOMER") {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_GUARDIAN_ONLY",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType: params.actorType,
        actorId,
        messageType,
        useCase: "rejected_by_actor_mismatch",
      },
    });

    return result;
  }

  const normalizedIntent = normalizeIntent(body);
  if (!SUPPORTED_GUARDIAN_INTENTS.has(normalizedIntent)) {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_INTENT_NOT_SUPPORTED",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType: params.actorType,
        actorId,
        messageType,
        useCase: "guardian_unsupported_intent",
      },
    });

    return result;
  }

  const guardianTarget = await resolveGuardianStudentTarget({
    repository,
    tenantId,
    actorId,
    phoneNumber,
    metadata: params.metadata,
  });

  if (guardianTarget.kind === "missing") {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_GUARDIAN_CONTEXT_MISMATCH",
    };
  }

  if (guardianTarget.kind === "forbidden") {
    const result = {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_STUDENT_CONTEXT_FORBIDDEN",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType: params.actorType,
        actorId,
        messageType,
        useCase: "guardian_invalid_student_context",
      },
    });

    return result;
  }

  if (guardianTarget.kind === "ambiguous") {
    const result = {
      handled: false,
      messagesToSend: [{ body: buildGuardianContextRequiredReply(guardianTarget.accessList) }],
      error: "MENTORIA_WHATSAPP_STUDENT_CONTEXT_REQUIRED",
    };

    await recordMentoriaWhatsappOutcome({
      tenantId,
      saasId,
      handled: result.handled,
      error: result.error,
      metadata: {
        actorType: params.actorType,
        actorId,
        messageType,
        useCase: "guardian_student_context_required",
        availableStudents: guardianTarget.accessList.map((item) => item.studentId),
      },
    });

    return result;
  }

  const student = await repository.getStudentProfileById(tenantId, guardianTarget.target.studentProfileId).catch(() => null);
  if (!student) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_STUDENT_DATA_UNAVAILABLE",
    };
  }

  const result = await buildGuardianIntentResult({
    repository,
    tenantId,
    studentId: student.id,
    studentName: student.fullName,
    normalizedIntent,
  });

  await recordMentoriaWhatsappActivity({
    tenantId,
    saasId,
    activityType: classifyGuardianIntent(normalizedIntent),
    status: "success",
    summary:
      classifyGuardianIntent(normalizedIntent) === "guardian_summary_command"
        ? `Mentoria WhatsApp resolved guardian summary command ${normalizedIntent}.`
        : `Mentoria WhatsApp resolved guardian operational command ${normalizedIntent}.`,
    metadata: {
      actorType: params.actorType,
      actorId,
      messageType,
      useCase: classifyGuardianIntent(normalizedIntent),
      normalizedIntent,
      studentProfileId: student.id,
      studentResolution: guardianTarget.resolution,
      accessSource: guardianTarget.target.source,
    },
  });

  await recordMentoriaWhatsappOutcome({
    tenantId,
    saasId,
    handled: result.handled,
    intent: result.intent,
    metadata: {
      actorType: params.actorType,
      actorId,
      messageType,
      useCase: classifyGuardianIntent(normalizedIntent),
      normalizedIntent,
      studentResolution: guardianTarget.resolution,
      accessSource: guardianTarget.target.source,
    },
  });

  return result;
}
