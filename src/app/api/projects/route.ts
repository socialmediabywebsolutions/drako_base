import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { createProject, listProjects } from "@/lib/projects/repository";

export const runtime = "edge";

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id") ?? undefined;
    const items = await listProjects({ tenantId, companyId });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `projects_list_err_${Date.now()}`;
    console.error("PROJECTS_LIST_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const rawCompanyId = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
    const slugInput = typeof payload.slug === "string" ? payload.slug.trim() : null;
    const domain = typeof payload.domain === "string" ? payload.domain.trim() : null;

    if (!name) {
      return NextResponse.json({ ok: false, error: "name es obligatorio" }, { status: 400 });
    }

    const created = await createProject({
      tenantId,
      companyId: rawCompanyId || null,
      name,
      slug: slugInput,
      domain,
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `projects_create_err_${Date.now()}`;
    console.error("PROJECTS_CREATE_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "create_failed", correlationId },
      { status: 500 },
    );
  }
}
