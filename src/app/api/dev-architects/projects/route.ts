export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env, type DracoEnv } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listDevArchitectProjects, upsertDevArchitectProject } from "@/lib/dev-architects/store";
import type { DevArchitectProject } from "@/lib/dev-architects/types";

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const bindings = env();
    const items = await listDevArchitectProjects(tenantId, bindings);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_PROJECTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<DevArchitectProject> | null;
    if (!body || !body.name || !body.type || !body.status) {
      return NextResponse.json({ ok: false, error: "name, type y status son obligatorios" }, { status: 400 });
    }
    const bindings: DracoEnv | null = env();
    const project = await upsertDevArchitectProject(tenantId, bindings, {
      id: body.id,
      name: body.name,
      type: body.type,
      origin: body.origin,
      origin_url: body.origin_url,
      branch_name: body.branch_name,
      status: body.status,
      last_build_status: body.last_build_status,
      last_action_summary: body.last_action_summary,
    });
    return NextResponse.json({ ok: true, item: project });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_PROJECTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}
