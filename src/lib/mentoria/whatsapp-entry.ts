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

const SUPPORTED_GUARDIAN_INTENTS = new Set(["resumen", "estado", "como va"]);

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

function resolveAcademicImageKind(text: string): "exam_photo" | "homework_photo" | "notes_photo" | "exercise_photo" | "academic_image" {
  if (text.includes("examen")) return "exam_photo";
  if (text.includes("tarea")) return "homework_photo";
  if (text.includes("apunte") || text.includes("apuntes")) return "notes_photo";
  if (text.includes("ejercicio") || text.includes("ejercicios")) return "exercise_photo";
  return "academic_image";
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

  if (messageType === "image") {
    if (params.actorType !== "CUSTOMER") {
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

    if (media.kind !== "image") {
      return {
        handled: false,
        messagesToSend: [],
        error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
      };
    }

    const mimeType = media.mimeType?.trim().toLowerCase() ?? "";
    if (!mimeType.startsWith("image/")) {
      return {
        handled: false,
        messagesToSend: [],
        error: "MENTORIA_WHATSAPP_MEDIA_TYPE_NOT_SUPPORTED",
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

    try {
      await repository.createMaterialIntake({
        tenantId,
        studentProfileId: student.id,
        sourceMessageId,
        phoneNumber,
        mediaType: "image",
        intakeKind: resolveAcademicImageKind(normalizeIntent(body ?? media.caption ?? "")),
        providerMediaId: media.mediaId,
        mimeType,
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
      messagesToSend: [{ body: `He recibido tu imagen, ${student.fullName}. La he guardado como material pendiente de revision manual.` }],
      intent: "MENTORIA_STUDENT_MATERIAL_RECEIVED",
    };
  }

  if (!body) {
    return {
      handled: false,
      messagesToSend: [],
      error: "INVALID_MENTORIA_WHATSAPP_CONTEXT",
    };
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

  const [progress, sessions, currentPlan] = await Promise.all([
    repository.listProgress(tenantId, student.id).catch(() => []),
    repository.listLearningSessions(tenantId, student.id).catch(() => []),
    repository.getCurrentStudyPlan(tenantId, student.id).catch(() => null),
  ]);

  const topProgress = progress[0];
  const topProgressLabel = topProgress
    ? `${topProgress.subject?.name ?? "materia"}: ${Math.round(topProgress.masteryScore)}%`
    : "sin progreso registrado";

  const lastActivity = topProgress?.lastActivityAt ?? sessions[0]?.updatedAt ?? null;
  const planSummary = currentPlan?.goalsSummary?.trim() || "sin plan activo";

  const summary = [
    `Resumen de ${student.fullName}:`,
    `- Sesiones recientes: ${sessions.length}`,
    `- Ultima actividad: ${formatIsoDate(lastActivity)}`,
    `- Progreso principal: ${topProgressLabel}`,
    `- Plan actual: ${planSummary}`,
  ].join("\n");

  return {
    handled: true,
    messagesToSend: [{ body: summary }],
    intent: "MENTORIA_GUARDIAN_SUMMARY",
  };
}
