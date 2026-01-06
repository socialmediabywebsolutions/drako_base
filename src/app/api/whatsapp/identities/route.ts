import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { handleWhatsappApiError } from "@/lib/whatsapp/api-helpers";
import { resolveWhatsappContext, listWhatsappIdentities, upsertWhatsappIdentity } from "@/lib/whatsapp/repository";
import type { WhatsappActorType } from "@/lib/whatsapp/types";
export const runtime = "edge";


const ACTOR_TYPES: WhatsappActorType[] = ["PLATFORM_OWNER", "SAAS_OWNER", "EMPLOYEE", "CUSTOMER"];

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() ?? "";
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "saasId es obligatorio" }, { status: 400 });
    }
    const ctx = await resolveWhatsappContext({ tenantId, saasId });
    const items = await listWhatsappIdentities(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleWhatsappApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const body = (await request.json().catch(() => null)) as
      | {
          saasId?: string;
          actorType?: WhatsappActorType;
          actorId?: string;
          phoneNumber?: string;
          preferredLanguage?: string | null;
          allowedChannels?: string[] | null;
          consentFlags?: string[] | null;
          metadata?: Record<string, unknown> | null;
        }
      | null;
    const saasId = body?.saasId?.trim();
    const actorType = body?.actorType;
    const actorId = body?.actorId?.trim();
    const phoneNumber = body?.phoneNumber?.trim();
    if (!saasId || !actorType || !actorId || !phoneNumber) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "saasId, actorType, actorId y phoneNumber son obligatorios" }, { status: 400 });
    }
    if (!ACTOR_TYPES.includes(actorType)) {
      return NextResponse.json({ code: "INVALID_INPUT", message: "actorType no válido" }, { status: 400 });
    }
    const ctx = await resolveWhatsappContext({ tenantId, saasId });
    const item = await upsertWhatsappIdentity(ctx, {
      saasId,
      actorType,
      actorId,
      phoneNumber,
      preferredLanguage: body?.preferredLanguage ?? null,
      allowedChannels: body?.allowedChannels ?? null,
      consentFlags: body?.consentFlags ?? null,
      metadata: body?.metadata ?? null,
    });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleWhatsappApiError(error);
  }
}
