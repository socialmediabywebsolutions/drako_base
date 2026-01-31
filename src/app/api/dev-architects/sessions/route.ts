import { NextResponse } from "next/server";
import { env, type DracoEnv } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { createDevArchitectSession, listDevArchitectSessions } from "@/lib/dev-architects/store";
import type { DevArchitectMode } from "@/lib/dev-architects/types";
// export const runtime = "edge"; // OpenNext Migration


async function resolveTenantId(req: Request): Promise<string> {
  const url = new URL(req.url);
  const explicit = url.searchParams.get("tenantId") ?? req.headers.get("x-tenant-id") ?? undefined;
  if (explicit) return explicit;
  try {
    const { tenantId } = await requireTenantAccess(req);
    return tenantId;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return "demo-tenant";
    }
    throw error;
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const tenantId = await resolveTenantId(req);
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const sessionMode = url.searchParams.get("mode") as DevArchitectMode | null;
    const bindings = env();
    let items = await listDevArchitectSessions(tenantId, bindings, projectId ?? undefined);
    if (sessionMode) {
      items = items.filter((session) => session.mode === sessionMode);
    }
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_SESSIONS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await resolveTenantId(req);
    const body = (await req.json().catch(() => null)) as { projectId?: string; mode?: DevArchitectMode; title?: string; summary?: string | null } | null;
    if (!body?.projectId || !body?.mode || !body?.title) {
      return NextResponse.json({ ok: false, error: "projectId, mode y title son obligatorios" }, { status: 400 });
    }
    const bindings: DracoEnv | null = env();
    const session = await createDevArchitectSession(tenantId, bindings, {
      project_id: body.projectId,
      mode: body.mode,
      title: body.title,
      summary: body.summary ?? null,
    });
    return NextResponse.json({ ok: true, item: session });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_SESSIONS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}
