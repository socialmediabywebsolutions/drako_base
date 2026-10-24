export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasSocialChannels, resolveSocialContext, SocialContextError, upsertSaasSocialChannel } from "@/lib/social/repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const items = await listSaasSocialChannels(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNELS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to list channels" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      name?: string;
      description?: string | null;
      niche?: string | null;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const saasId = body.saasId ?? null;
    if (!saasId || !body.name?.trim()) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and name are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const channel = await upsertSaasSocialChannel(ctx, {
      id: body.id,
      saasId,
      name: body.name.trim(),
      description: body.description ?? null,
      niche: body.niche ?? null,
    });
    return NextResponse.json({ channel });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CHANNELS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "Unable to save channel" }, { status: 500 });
  }
}
