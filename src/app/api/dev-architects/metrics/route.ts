import { NextResponse } from "next/server";
import { env, type DracoEnv } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildDevArchitectProjectMetrics, listDevArchitectChecklists, listDevArchitectProjects, listDevArchitectSessions } from "@/lib/dev-architects/store";
export const runtime = "edge";


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
    const bindings: DracoEnv | null = env();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const projects = await listDevArchitectProjects(tenantId, bindings);
    const sessions = await listDevArchitectSessions(tenantId, bindings);
    const checklistResults = await Promise.all(
      projects.map((project) => listDevArchitectChecklists(tenantId, bindings, project.id)),
    );
    const checklists = checklistResults.flat();
    const items = await buildDevArchitectProjectMetrics({
      tenantId,
      bindings,
      projects,
      sessions,
      checklists,
      targetProjectId: projectId,
    });
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_METRICS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}
