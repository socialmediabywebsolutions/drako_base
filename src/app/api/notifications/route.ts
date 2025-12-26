import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleConversationsApiError } from "@/lib/conversations/api-helpers";
import {
  listNotificationsForActor,
  markNotificationsRead,
  resolveConversationsContext,
} from "@/lib/conversations/repository";
import type { ConversationActorType } from "@/lib/conversations/types";

export const runtime = "edge";

const VALID_ACTOR_TYPES: ConversationActorType[] = ["OWNER", "EMPLOYEE"];

type MarkAction = "MARK_READ" | "MARK_ALL_READ";

function parseActorType(value: string | null): ConversationActorType {
  const normalized = value?.toUpperCase() ?? "OWNER";
  return VALID_ACTOR_TYPES.includes(normalized as ConversationActorType) ? (normalized as ConversationActorType) : "OWNER";
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
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

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId });
    const notifications = await listNotificationsForActor(ctx, {
      actorType,
      actorId,
      saasId,
      unreadOnly,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      actorType?: string | null;
      actorId?: string | null;
      ids?: string[] | null;
      action?: MarkAction | null;
      conversationId?: string | null;
    } | null;
    if (!body?.saasId || !body.actorType || !body.action) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, actorType and action are required" },
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

    const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : undefined;

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveConversationsContext({ tenantId, saasId: body.saasId });

    await markNotificationsRead(ctx, {
      actorType,
      actorId,
      saasId: body.saasId,
      ids,
      action: body.action,
      conversationId: body.conversationId ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleConversationsApiError(error);
  }
}
