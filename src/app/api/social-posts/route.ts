export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  SOCIAL_POST_STATUSES,
  insertSocialPosts,
  listSocialPosts,
  parseSocialPostInput,
  updateSocialPostStatus,
  type SocialPostStatus,
} from "@/lib/drako/social-posts-repository";

// /api/social-posts — posts del AutoPublishAgent de @drako.systems (DRACO_DB).
// GET y PATCH: sesión de operator. POST: Bearer <CRON_SECRET | INTERNAL_API_SECRET>.

function ownerAuthError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

// GET ?page=1&limit=10 — más recientes primero.
export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);
    const params = new URL(request.url).searchParams;
    const result = await listSocialPosts(Number(params.get("page") ?? "1"), Number(params.get("limit") ?? "10"));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const authResponse = ownerAuthError(error);
    if (authResponse) return authResponse;
    console.error("SOCIAL_POSTS_LIST_ERROR", error);
    return NextResponse.json({ ok: false, error: "SOCIAL_POSTS_UNAVAILABLE" }, { status: 500 });
  }
}

// POST — body: un post o un array { platform, content, hashtags?, source_article_id?, scheduled_at? }.
export async function POST(request: Request) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    const status = error instanceof CronAuthError ? error.status : 401;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const items = parseSocialPostInput(await request.json().catch(() => null));
  if (!items) {
    return NextResponse.json({ ok: false, error: "Body must be { platform, content } or an array of them" }, { status: 400 });
  }
  try {
    const saved = await insertSocialPosts(items);
    return NextResponse.json({ ok: true, saved }, { status: 201 });
  } catch (error) {
    console.error("SOCIAL_POSTS_INSERT_ERROR", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "SOCIAL_POSTS_INSERT_FAILED" }, { status: 500 });
  }
}

// PATCH ?id=123 — body { status: 'publicado' | 'descartado' | 'pendiente' }.
export async function PATCH(request: Request) {
  try {
    await requireOwnerAccess(request);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
    const status = typeof body?.status === "string" ? body.status : "";
    if (!(SOCIAL_POST_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ ok: false, error: `status must be one of ${SOCIAL_POST_STATUSES.join(", ")}` }, { status: 400 });
    }
    const updated = await updateSocialPostStatus(id, status as SocialPostStatus);
    if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, id, status });
  } catch (error) {
    const authResponse = ownerAuthError(error);
    if (authResponse) return authResponse;
    console.error("SOCIAL_POST_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "SOCIAL_POST_UPDATE_FAILED" }, { status: 500 });
  }
}
