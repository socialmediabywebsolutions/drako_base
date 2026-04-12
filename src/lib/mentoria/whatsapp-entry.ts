import { env } from "@/lib/cf";
import { queryOne } from "@/lib/db";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
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

export async function runMentoriaWhatsappEntry(
  params: MentoriaWhatsappEntryParams,
): Promise<MentoriaWhatsappEntryResult> {
  const tenantId = params.tenantId?.trim();
  const saasId = params.saasId?.trim();
  const phoneNumber = params.phoneNumber?.trim();
  const body = params.body?.trim();
  const actorId = params.actorId?.trim() ?? "";

  if (!tenantId || !saasId || !phoneNumber || !body) {
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
  const familyRepository = new MentoriaFamilyRepository(db);

  let actorExists = false;

  if (params.actorType === "CUSTOMER") {
    const student = await repository.getStudentProfileById(tenantId, actorId).catch(() => null);
    if (student) {
      actorExists = true;
    } else {
      const familyStudent = await familyRepository.getStudentById(actorId).catch(() => null);
      actorExists = Boolean(familyStudent && familyStudent.familyId === tenantId);
    }
  }

  if (!actorExists) {
    return {
      handled: false,
      messagesToSend: [],
      error: "MENTORIA_ACTOR_CONTEXT_MISMATCH",
    };
  }

  return {
    handled: false,
    messagesToSend: [],
    error: "MENTORIA_WHATSAPP_NOT_READY",
  };
}
