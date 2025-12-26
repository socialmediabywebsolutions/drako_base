import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSaasSocialPostById,
  resolveSocialContext,
  SocialContextError,
  updateSaasSocialPostStatus,
} from "@/lib/social/repository";

export const runtime = "edge";

const ALLOWED_STATUSES = ["DRAFT", "SCHEDULED", "POSTED", "FAILED"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id: postId } = await params;
    if (!postId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId });
    const post = await getSaasSocialPostById(ctx, postId);
    if (!post) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POST_GET_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo cargar el post" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id: postId } = await params;
    if (!postId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as { status?: string; postedAt?: string | null } | null;
    if (!body?.status || !ALLOWED_STATUSES.includes(body.status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status is invalid" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId });
    const post = await updateSaasSocialPostStatus(ctx, {
      id: postId,
      status: body.status as (typeof ALLOWED_STATUSES)[number],
      postedAt: body.postedAt ?? null,
    });
    if (!post) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_POST_PATCH_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo actualizar el post" }, { status: 500 });
  }
}
