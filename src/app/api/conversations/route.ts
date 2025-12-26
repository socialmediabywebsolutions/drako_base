import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleConversationsApiError } from "@/lib/conversations/api-helpers";
import {
  appendMessageForActor,
  createConversation,
  listConversationsForActor,
  resolveConversationsContext,
} from "@/lib/conversations/repository";
import type {
  ConversationActorType,
  ConversationChannel,
  ConversationMetadata,
  ConversationParticipants,
  ConversationSource,
  ConversationType,
  ConversationStatus,
} from "@/lib/conversations/types";

export const runtime = "edge";

const VALID_ACTOR_TYPES: ConversationActorType[] = ["OWNER", "EMPLOYEE"];
const VALID_CHANNELS: ConversationChannel[] = [
  "WHATSAPP",
  "INSTAGRAM_DM",
  "MESSENGER",
  "EMAIL",
  "PHONE_CALL",
  "IN_PERSON",
  "OTHER",
];
const VALID_TYPES: ConversationType[] = ["LEAD", "SUPPLIER", "CLIENT", "INTERNAL", "TASK", "OTHER"];
const VALID_SOURCES: ConversationSource[] = [
  "EMAIL",
  "WHATSAPP",
  "INSTAGRAM_DM",
  "SOCIAL",
  "TASK",
  "PORTAL",
  "MANUAL",
  "SYSTEM",
  "OTHER",
];
const VALID_STATUSES: ConversationStatus[] = ["OPEN", "PENDING", "RESOLVED", "ARCHIVED"];

function parseActorType(value: string | null): ConversationActorType {
  const normalized = value?.toUpperCase() ?? "OWNER";
  return VALID_ACTOR_TYPES.includes(normalized as ConversationActorType) ? (normalized as ConversationActorType) : "OWNER";
}

function parseChannel(value: unknown): ConversationChannel {
  if (typeof value === "string") {
    const normalized = value.toUpperCase() as ConversationChannel;
    if (VALID_CHANNELS.includes(normalized)) {
      return normalized;
    }
  }
  return "OTHER";
}

function parseConversationTypes(value: string | null): ConversationType[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((item) => item.trim().toUpperCase());
  const filtered = parts.filter((item): item is ConversationType => VALID_TYPES.includes(item as ConversationType));
  return filtered.length ? filtered : undefined;
}

function parseConversationStatuses(value: string | null): ConversationStatus[] | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.includes(",")) {
    const parts = normalized.split(",").map((item) => item.trim()).filter(Boolean) as ConversationStatus[];
    const filtered = parts.filter((item): item is ConversationStatus => VALID_STATUSES.includes(item));
    return filtered.length ? filtered : undefined;
  }
  if (VALID_STATUSES.includes(normalized as ConversationStatus)) {
    return [normalized as ConversationStatus];
  }
  return undefined;
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function sanitizeParticipants(input: unknown): ConversationParticipants | undefined {
  if (!input || typeof input !== "object") return undefined;
  const participants = input as ConversationParticipants;
  const owners = typeof participants.owners === "boolean" ? participants.owners : undefined;
  const employeeIds = Array.isArray(participants.employeeIds)
    ? participants.employeeIds.map((id) => String(id).trim()).filter(Boolean)
    : undefined;
  return {
    owners,
    employeeIds,
  };
}

function parseConversationType(value: string | null | undefined): ConversationType | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase() as ConversationType;
  return VALID_TYPES.includes(upper) ? upper : undefined;
}

function parseConversationSource(value: string | null | undefined): ConversationSource | null {
  if (!value) return null;
  const upper = value.toUpperCase() as ConversationSource;
  return VALID_SOURCES.includes(upper) ? upper : "OTHER";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const actorType = parseActorType(url.searchParams.get("actorType"));
    const actorId = url.searchParams.get("actorId")?.trim() || undefined;
    if (actorType === "EMPLOYEE" && !actorId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "actorId is required for employees" }, { status: 400 });
    }
    const unreadOnly = parseBoolean(url.searchParams.get("unreadOnly"));
    const types = parseConversationTypes(url.searchParams.get("types"));
    const statuses = parseConversationStatuses(url.searchParams.get("status"));

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId });
    const conversations = await listConversationsForActor(ctx, {
      actorType,
      actorId,
      unreadOnly,
      types,
      statuses,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      subject?: string | null;
      actorType?: string | null;
      actorId?: string | null;
      participants?: ConversationParticipants;
      initialMessage?: string | null;
      channel?: string | null;
      type?: string | null;
      source?: string | null;
      tags?: string[] | null;
      linkedEntities?: ConversationMetadata["linkedEntities"];
      linkedEntity?: { type: string; id: string; label?: string } | null;
      metadata?: ConversationMetadata | null;
      customerId?: string | null;
    } | null;

    if (!body?.saasId || !body.subject || !body.actorType || !body.initialMessage || !body.source) {
      return NextResponse.json(
        {
          code: "INVALID_BODY",
          message: "saasId, subject, actorType, initialMessage and source are required",
        },
        { status: 400 },
      );
    }

    const actorType = parseActorType(body.actorType);
    const actorId = body.actorId?.trim() || undefined;
    if (actorType === "EMPLOYEE" && !actorId) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "actorId is required when actorType is EMPLOYEE" },
        { status: 400 },
      );
    }
    const participants = sanitizeParticipants(body.participants);
    const channel = parseChannel(body.channel ?? body.source);
    const type = body.type?.toUpperCase() ?? undefined;
    const normalizedType = parseConversationType(type ?? undefined) ?? body.metadata?.type ?? null;
    const normalizedSource = parseConversationSource(body.source ?? (body.metadata?.source as string | null | undefined));
    const mergedParticipants = participants ?? sanitizeParticipants(body.metadata?.participants);
    const tagsInput = body.tags ?? body.metadata?.tags;
    const tags = Array.isArray(tagsInput) ? tagsInput.map((tag) => String(tag)) : null;
    const linkedEntities = body.linkedEntities ?? (body.linkedEntity ? [body.linkedEntity] : body.metadata?.linkedEntities ?? undefined);

    const metadata: ConversationMetadata = {
      ...(body.metadata ?? {}),
      type: normalizedType ?? null,
      source: normalizedSource,
    };
    if (tags) {
      metadata.tags = tags;
    }
    if (mergedParticipants) {
      metadata.participants = mergedParticipants;
    }
    if (linkedEntities) {
      metadata.linkedEntities = linkedEntities;
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId: body.saasId });
    const conversation = await createConversation(ctx, {
      saasId: body.saasId,
      customerId: body.customerId ?? null,
      channel,
      subject: body.subject,
      metadata,
    });

    const result = await appendMessageForActor(ctx, {
      conversationId: conversation.id,
      actorType,
      actorId,
      body: body.initialMessage,
    });

    return NextResponse.json({ conversation: result.conversation, firstMessage: result.message });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}
