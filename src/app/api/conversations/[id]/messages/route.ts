export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleConversationsApiError } from "@/lib/conversations/api-helpers";
import {
  appendMessageForActor,
  createNotificationsForConversationMessage,
  getConversationForActor,
  listMessagesForConversation,
  markConversationAsReadForActor,
  resolveConversationsContext,
} from "@/lib/conversations/repository";
import type { ConversationActorType } from "@/lib/conversations/types";



const VALID_ACTOR_TYPES: ConversationActorType[] = ["OWNER", "EMPLOYEE"];

function parseActorType(value: string | null): ConversationActorType {
  const normalized = value?.toUpperCase() ?? "OWNER";
  return VALID_ACTOR_TYPES.includes(normalized as ConversationActorType) ? (normalized as ConversationActorType) : "OWNER";
}

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id } = await params;
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const actorType = parseActorType(url.searchParams.get("actorType"));
    const actorId = url.searchParams.get("actorId")?.trim() || undefined;
    if (actorType === "EMPLOYEE" && !actorId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "actorId is required for employees" }, { status: 400 });
    }
    const markAsRead = parseBoolean(url.searchParams.get("markAsRead"));

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId });
    const conversation = await getConversationForActor(ctx, {
      conversationId: id,
      actorType,
      actorId,
    });
    const messages = await listMessagesForConversation(ctx, id);
    if (markAsRead) {
      await markConversationAsReadForActor(ctx, {
        conversationId: id,
        actorType,
        actorId,
      });
    }

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      actorType?: string | null;
      actorId?: string | null;
      content?: string | null;
    } | null;
    if (!body?.saasId || !body.actorType || !body.content) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, actorType and content are required" },
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

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId: body.saasId });
    const { id } = await params;

    const result = await appendMessageForActor(ctx, {
      conversationId: id,
      actorType,
      actorId,
      body: body.content,
    });

    await createNotificationsForConversationMessage(ctx, {
      conversation: result.conversation,
      preview: body.content,
      senderActorType: actorType,
      senderActorId: actorId,
    });

    await markConversationAsReadForActor(ctx, {
      conversationId: id,
      actorType,
      actorId,
    });

    return NextResponse.json({ conversation: result.conversation, message: result.message });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}
