import { NextResponse } from "next/server";

import { env } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { resolveCompanyFeaturePackContext } from "@/lib/orchestrator/company-context";
import { getProjectById } from "@/lib/projects/repository";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EntitlementSource = "company" | "saas" | "none";

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

function invalidRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

async function loadProjectDetail(tenantId: string, projectId: string) {
  const detail = await getProjectById({ tenantId, projectId });
  if (!detail) {
    return null;
  }
  return detail;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return invalidRequest("project_id es obligatorio");
    }

    const { tenantId } = await requireTenantAccess(request);

    const detail = await loadProjectDetail(tenantId, projectId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
    }

    const companyId = detail.project.company_id?.trim() || null;
    const fallbackSaasId = detail.project.id;

    const contextResult = await resolveCompanyFeaturePackContext({
      tenantId,
      companyId,
      fallbackSaasId,
      env: env(),
    });

    const resolvedSaasId = contextResult.resolvedSaasId;
    const resolvedSource: EntitlementSource =
      resolvedSaasId && companyId && resolvedSaasId === companyId ? "company" : resolvedSaasId ? "saas" : "none";

    const inheritedFeatures = (contextResult.features ?? []).map((feature) => ({
      ...feature,
      source: resolvedSource,
    }));

    const inheritedPacks = (contextResult.packs ?? []).map((pack) => ({
      ...pack,
      source: resolvedSource,
    }));

    return NextResponse.json({
      ok: true,
      tenantId,
      projectId,
      companyId,
      resolvedSaasId,
      projectEntitlements: detail.entitlements,
      inheritedContext: {
        source: resolvedSource,
        resolvedSaasId,
        features: inheritedFeatures,
        packs: inheritedPacks,
        errors: contextResult.errors,
      },
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof Response) return error;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_entitlements_context_${Date.now()}`;
    console.error("PROJECT_ENTITLEMENTS_CONTEXT_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "context_failed", correlationId },
      { status: 500 },
    );
  }
}
