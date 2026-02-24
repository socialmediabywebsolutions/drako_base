export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasSocialAccounts, resolveSocialContext, SocialContextError, upsertSaasSocialAccount } from "@/lib/social/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const items = await listSaasSocialAccounts(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron cargar las cuentas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      provider?: string;
      handle?: string | null;
      displayName?: string | null;
      status?: string;
      authMeta?: Record<string, unknown> | null;
      isPrimary?: boolean;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const saasId = body.saasId ?? null;
    if (!saasId || !body.provider || !body.status) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId, provider and status are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const provider = body.provider as "INSTAGRAM" | "FACEBOOK_PAGE" | "TIKTOK" | "WHATSAPP" | "OTHER";
    // CONNECTED_REAL status is required for production autopublish
    const status = body.status as "DISCONNECTED" | "CONNECTED_DEMO" | "CONNECTED_REAL";
    const account = await upsertSaasSocialAccount(ctx, {
      id: body.id,
      saasId,
      provider,
      handle: body.handle ?? null,
      displayName: body.displayName ?? null,
      status,
      authMeta: body.authMeta ?? null,
      isPrimary: body.isPrimary ?? false,
    });
    return NextResponse.json({ account });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_ACCOUNTS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo guardar la cuenta" }, { status: 500 });
  }
}
