import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { verifyProjectDomain } from "@/lib/empire/domain-verifier";
import { respondDatabaseError } from "@/lib/http/errors";
import {
  listProjectDomains,
  updateProjectDomainStatus,
} from "@/lib/projects/repository";

// export const runtime = "edge"; // OpenNext: disabled for bundling

type RouteContext = {
  params: Promise<{ id: string }>;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

type VerifyPayload = {
  domainId?: string;
  domain?: string;
  token?: string;
};

function serializeDomain(record: Awaited<ReturnType<typeof listProjectDomains>>[number]) {
  return {
    id: record.id,
    domain: record.domain,
    status: record.status,
    verificationToken: record.verification_token,
    lastError: record.last_error,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "project_id es obligatorio" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => null)) as VerifyPayload | null;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }

    const domainId = typeof payload.domainId === "string" ? payload.domainId.trim() : "";
    const domainInput = typeof payload.domain === "string" ? payload.domain.trim() : "";
    const tokenInput = typeof payload.token === "string" ? payload.token.trim() : "";

    if (!domainId && !domainInput) {
      return NextResponse.json({ ok: false, error: "domain o domainId son obligatorios" }, { status: 400 });
    }

    const domains = await listProjectDomains({ tenantId, projectId });
    const target = domains.find((domain) => {
      if (domainId) return domain.id === domainId;
      return domain.domain === domainInput.toLowerCase();
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "Dominio no encontrado" }, { status: 404 });
    }

    const verification = await verifyProjectDomain({
      hostname: target.domain,
      tenantId,
      projectId,
      currentStatus: target.status,
      verificationToken: target.verification_token ?? null,
      providedToken: tokenInput || null,
    });

    await updateProjectDomainStatus({
      tenantId,
      domainId: target.id,
      status: verification.status,
      lastError: verification.error ?? null,
    });

    const updatedDomains = await listProjectDomains({ tenantId, projectId });
    return NextResponse.json({ ok: true, items: updatedDomains.map(serializeDomain) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_domain_verify_${Date.now()}`;
    console.error("PROJECT_DOMAIN_VERIFY_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "verify_failed", correlationId },
      { status: 500 },
    );
  }
}
