import { NextResponse } from "next/server";
import { normalizeHostnameInput } from "@/lib/empire/domain-utils";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import {
  createProjectDomain,
  findProjectDomainByDomain,
  listProjectDomains,
  type ProjectDomainRecord,
} from "@/lib/projects/repository";

// export const runtime = "edge"; // OpenNext: disabled for bundling

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeDomainInput(value: string): { domain: string; wasWww: boolean } {
  const normalized = normalizeHostnameInput(value);
  if (!normalized.hostname) {
    throw new Error(normalized.reason ?? "DOMAIN_INVALID");
  }
  return { domain: normalized.hostname, wasWww: normalized.wasWww };
}

function serializeDomain(record: ProjectDomainRecord) {
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "project_id es obligatorio" }, { status: 400 });
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") ?? undefined;

    const records = await listProjectDomains({ tenantId, projectId, status: statusFilter ?? undefined });
    return NextResponse.json({ ok: true, items: records.map(serializeDomain) });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_domains_get_${Date.now()}`;
    console.error("PROJECT_DOMAINS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id } = await context.params;
    const projectId = id?.trim();
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "project_id es obligatorio" }, { status: 400 });
    }

    const payload = (await request.json().catch(() => null)) as { domain?: string } | null;
    const rawDomain = payload?.domain;
    if (!rawDomain || typeof rawDomain !== "string") {
      return NextResponse.json({ ok: false, error: "domain es obligatorio" }, { status: 400 });
    }

    let normalizedDomain: string;
    try {
      ({ domain: normalizedDomain } = normalizeDomainInput(rawDomain));
    } catch (error) {
      const message = error instanceof Error ? error.message : "DOMAIN_INVALID";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const existing = await findProjectDomainByDomain(tenantId, normalizedDomain);
    if (existing) {
      return NextResponse.json({ ok: true, item: serializeDomain(existing), duplicated: true });
    }

    try {
      const created = await createProjectDomain({ tenantId, projectId, domain: normalizedDomain, status: "pending" });
      return NextResponse.json({ ok: true, item: serializeDomain(created) }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && /domain already exists|unique/i.test(error.message)) {
        const retry =
          (await findProjectDomainByDomain(tenantId, normalizedDomain)) ??
          (await listProjectDomains({ tenantId, projectId })).find((item) => item.domain === normalizedDomain);
        if (retry) {
          return NextResponse.json({ ok: true, item: serializeDomain(retry), duplicated: true });
        }
      }
      throw error;
    }
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_domain_post_${Date.now()}`;
    console.error("PROJECT_DOMAIN_POST_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "insert_failed", correlationId },
      { status: 500 },
    );
  }
}
