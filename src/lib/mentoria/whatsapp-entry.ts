import { env } from "@/lib/cf";
import { queryOne } from "@/lib/db";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { MentoriaRepository } from "@/lib/mentoria/repository";
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
const MAX_CONTEXT_TEXT_LENGTH = 160;
const MATERIAL_CONTEXT_WINDOW_MS = 15 * 60 * 1000;

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

async function handleStudentMediaIntake(params: {
  repository: MentoriaRepository;
  tenantId: string;
  actorId: string;
  actorType: WhatsappActorType;
  phoneNumber: string;
  body?: string;
  metadata?: Record<string, unknown> | null;
  media: MentoriaWhatsappMediaMetadata | null;
  kind: SupportedStudentMediaKind;
}): Promise<MentoriaWhatsappEntryResult | null> {
  const { repository, tenantId, actorId, actorType, phoneNumber, body, metadata, media, kind } = params;

  if (actorType !== "CUSTOMER") {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_STUDENT_ONLY",
    };
  }

  const student = await repository.getStudentProfileByUser(tenantId, actorId).catch(() => null);
  if (!student) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_STUDENT_CONTEXT_MISMATCH",
    };
  }

  if (!media?.mediaId) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_MISSING",
    };
  }

  if (media.kind !== kind) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
    };
  }

  const mimeType = media.mimeType?.trim().toLowerCase() ?? "";
  if (!isSupportedStudentMediaMime(kind, mimeType)) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
    };
  }

  const sourceMessageId = typeof metadata?.messageId === "string" ? metadata.messageId.trim() : "";
  if (!sourceMessageId) {
    return {
      handled: false,
      messagesToSend: [],
      error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
    };
  }

  const normalizedText = normalizeIntent(body ?? media.caption ?? media.fileName ?? "");

  try {
    await repository.createMaterialIntake({
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
  } catch {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_MATERIAL_INTAKE_PERSIST_FAILED",
    };
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
  const messageType = typeof params.metadata?.messageType === "string" ? params.metadata.messageType : "text";
  const media =
    params.metadata?.media && typeof params.metadata.media === "object"
      ? (params.metadata.media as MentoriaWhatsappMediaMetadata)
      : null;

  if (messageType === "image" || messageType === "document") {
    const mediaResult = await handleStudentMediaIntake({
      repository,
      tenantId,
      actorId,
      actorType: params.actorType,
      phoneNumber,
      body,
      metadata: params.metadata,
      media,
      kind: messageType,
    });
    if (mediaResult) {
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
      if (!isShortContextualStudentText(body)) {
        return {
          handled: false,
          messagesToSend: [],
          error: "MENTORIA_WHATSAPP_CONTEXT_TEXT_NOT_SUPPORTED",
        };
      }

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

      try {
        await repository.createMaterialContextNote({
          tenantId,
          studentProfileId: student.id,
          materialIntakeId: latestMaterial.id,
          sourceMessageId,
          body,
        });
      } catch {
        return {
          handled: false,
          messagesToSend: [],
          error: "MENTORIA_MATERIAL_CONTEXT_NOTE_PERSIST_FAILED",
        };
      }

      return {
        handled: true,
        messagesToSend: [{ body: `He añadido tu texto al material que enviaste hace un momento, ${student.fullName}. Queda guardado como contexto.` }],
        intent: "MENTORIA_STUDENT_MATERIAL_CONTEXT_RECORDED",
      };
    }
  }

  if (params.actorType !== "CUSTOMER") {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_GUARDIAN_ONLY",
    };
  }

  const normalizedIntent = normalizeIntent(body);
  if (!SUPPORTED_GUARDIAN_INTENTS.has(normalizedIntent)) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_WHATSAPP_INTENT_NOT_SUPPORTED",
    };
  }

  const parentAccount = await repository.getParentAccountByUser(tenantId, actorId).catch(() => null);
  if (!parentAccount) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_GUARDIAN_CONTEXT_MISMATCH",
    };
  }

  const student = await repository.getStudentProfileById(tenantId, parentAccount.studentProfileId).catch(() => null);
  if (!student) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_STUDENT_DATA_UNAVAILABLE",
    };
  }

  return buildGuardianIntentResult({
    repository,
    tenantId,
    studentId: student.id,
    studentName: student.fullName,
    normalizedIntent,
  });
}
